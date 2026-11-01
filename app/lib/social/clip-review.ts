import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { logClaudeUsage } from "@/app/lib/claude";
import type { CreatorPersona } from "./creator-personas";
import { FACE_MATCH_PASS, faceCropAt, faceCropBase64, fetchAsset, fetchWithRetry, locateFace, referenceAssetIds, splitPanels, toJpegBase64, type FaceBox } from "./frame-identity-review";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const REVIEW_MODEL = "claude-opus-5-5";
const REVIEW_RUNS  = 2;

// The frame review (frame-identity-review.ts) only sees the start frame; the
// avatar model can still drift her face, close her eyes, mirror both hands or
// push the camera in mid-clip (all seen in the India–Spain clips, 10-26..11-01),
// which until now only a human watching the clip caught. This samples stills
// across a rendered clip and asks Claude to check them in order.

export interface ClipIssue {
  /** Seconds into the clip, or null when it applies to the whole clip. */
  t:        number | null;
  kind:     "identity" | "eyes" | "hands" | "figure" | "camera" | "scene" | "artifact" | "text" | "other";
  /** blocking = re-render; minor = worth a look, usually acceptable. */
  severity: "blocking" | "minor";
  note:     string;
}

export interface ClipReview {
  /** True when the lowest faceMatch passes and nothing is blocking. */
  pass:      boolean;
  /** 1-10, the LOWEST likeness across the sampled stills. */
  faceMatch: number;
  /** Her figure across the clip vs the full-body references (personas with a figureFeature). */
  figure?:   { match: boolean; note: string };
  issues:    ClipIssue[];
  summary:   string;
  /** Seconds sampled, in order. */
  sampledAt: number[];
  /** Each independent run's verdict; the issues and summary are the strictest run's. */
  runs?:     Array<{ pass: boolean; faceMatch: number }>;
}

const SAMPLE_EVERY_S = 1.5;
const MAX_SAMPLES    = 12;
const TILE_W = 360, TILE_H = 640;
// Blinks last ~0.2-0.4s, so the 1.5s stills almost never catch one. Priya's
// eyelids stalled half-closed and looked see-through mid-blink (11-01) and no
// review flagged it; a dense strip of eye close-ups does.
const EYE_EVERY_S = 0.25, MAX_EYE_SAMPLES = 48;
const EYE_W = 360, EYE_H = 150;

/** Sample times across a clip, skipping the very first/last instant. */
export function sampleTimes(durationS: number): number[] {
  const n = Math.min(MAX_SAMPLES, Math.max(3, Math.ceil(durationS / SAMPLE_EVERY_S)));
  const start = 0.3, end = Math.max(start, durationS - 0.3);
  return Array.from({ length: n }, (_, i) => Math.round((start + ((end - start) * i) / (n - 1)) * 10) / 10);
}

/**
 * A still at `t` seconds from a Cloudinary video URL, via its so_ (start
 * offset) transform, so no local ffmpeg is needed. Past the end Cloudinary
 * returns the last frame rather than an error, hence the known duration.
 */
export function cloudinaryStillUrl(videoUrl: string, t: number, width = 1080): string {
  if (!videoUrl.includes("/video/upload/")) throw new Error(`Not a Cloudinary video URL: ${videoUrl}`);
  return videoUrl
    .replace(/\/video\/upload\/(v\d+\/)?/, `/video/upload/so_${t},w_${width}/$1`)
    .replace(/\.(mp4|mov|webm)(\?.*)?$/i, ".jpg");
}


function label(text: string, w: number, h = 44): Buffer {
  const size = Math.round(h * 0.64);
  return Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="#000" opacity="0.7"/>` +
    `<text x="8" y="${Math.round(h * 0.72)}" font-family="Arial, sans-serif" font-size="${size}" font-weight="bold" fill="#fff">${text}</text></svg>`
  );
}

/** The band across both eyes (brows to below the lower lids) of a face box. */
async function eyeBand(buf: Buffer, box: FaceBox): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const fw = (box.x1 - box.x0) * width, fh = (box.y1 - box.y0) * height;
  const left = Math.max(0, Math.round(box.x0 * width - 0.05 * fw));
  const top  = Math.max(0, Math.round(box.y0 * height + 0.18 * fh));
  const w    = Math.min(width - left, Math.round(fw * 1.1));
  const h    = Math.min(height - top, Math.round(fh * 0.42));
  return sharp(buf).extract({ left, top, width: w, height: h }).resize(EYE_W, EYE_H, { fit: "cover" }).toBuffer();
}

/** Tiles in time order with a timestamp on each, `cols` per row. */
async function timeline(tiles: Buffer[], times: number[], w: number, h: number, cols: number): Promise<Buffer> {
  const rows = Math.ceil(tiles.length / cols);
  return sharp({ create: { width: w * cols, height: h * rows, channels: 3, background: "#ffffff" } })
    .composite((await Promise.all(tiles.map(async (t, i) => [
      { input: await sharp(t).resize(w, h, { fit: "cover" }).toBuffer(), left: (i % cols) * w, top: Math.floor(i / cols) * h },
      { input: label(`${times[i].toFixed(1)}s`, w), left: (i % cols) * w, top: Math.floor(i / cols) * h },
    ]))).flat())
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function reviewClip(
  persona: CreatorPersona,
  videoUrl: string,
  durationS: number,
  opts: { refs?: Buffer[]; debugDir?: string } = {}
): Promise<ClipReview> {
  if (!(durationS > 0)) throw new Error(`Clip duration unknown for ${videoUrl}`);
  const times  = sampleTimes(durationS);
  const stills = await Promise.all(times.map((t) => fetchWithRetry(cloudinaryStillUrl(videoUrl, t))));
  const refBufs = opts.refs ?? await Promise.all(referenceAssetIds(persona).map(fetchAsset));
  if (refBufs.length === 0) throw new Error(`Persona "${persona.key}" has no reference images to review against`);

  const refSources = persona.mainReference ? await splitPanels(refBufs[0], persona.mainReference.grid) : refBufs;
  const boxes = await Promise.all(stills.map(locateFace));
  // Dense eye stills reuse the face box of the nearest regular still.
  const nEye     = Math.max(2, Math.min(MAX_EYE_SAMPLES, Math.floor((durationS - 0.2) / EYE_EVERY_S) + 1));
  const eyeTimes = Array.from({ length: nEye }, (_, i) => Math.round((0.1 + (i * (durationS - 0.2)) / (nEye - 1)) * 100) / 100);
  const eyeTiles = await Promise.all(eyeTimes.map(async (t) => {
    let near = 0;
    times.forEach((st, i) => { if (Math.abs(st - t) < Math.abs(times[near] - t)) near = i; });
    const box = boxes[near] ?? boxes.find(Boolean);
    return box ? eyeBand(await fetchWithRetry(cloudinaryStillUrl(videoUrl, t)), box) : null;
  }));
  const eyeOk = eyeTiles.flatMap((b, i) => (b ? [{ b, t: eyeTimes[i] }] : []));
  const EYE_COLS = 8;
  const eyeStrip = eyeOk.length ? await sharp({ create: { width: EYE_W * EYE_COLS, height: EYE_H * Math.ceil(eyeOk.length / EYE_COLS), channels: 3, background: "#ffffff" } })
    .composite(eyeOk.flatMap(({ b, t }, i) => [
      { input: b, left: (i % EYE_COLS) * EYE_W, top: Math.floor(i / EYE_COLS) * EYE_H },
      { input: label(`${t.toFixed(2)}s`, 96, 26), left: (i % EYE_COLS) * EYE_W, top: Math.floor(i / EYE_COLS) * EYE_H },
    ]))
    .jpeg({ quality: 90 })
    .toBuffer() : null;

  const [refFaces, clipFaces, refFull] = await Promise.all([
    Promise.all(refSources.map(faceCropBase64)),
    Promise.all(stills.map((st, i) => faceCropAt(st, boxes[i]))),
    // The whole sheet for her figure: face crops alone left the figure
    // judged only from a written description.
    toJpegBase64(refBufs[0]),
  ]);
  const b64 = (s: string) => Buffer.from(s, "base64");
  const refCols   = Math.min(refFaces.length, 8);
  const refRow    = await sharp({ create: { width: 384 * refCols, height: 384 * Math.ceil(refFaces.length / refCols), channels: 3, background: "#ffffff" } })
    .composite(await Promise.all(refFaces.map(async (f, i) => ({
      input: await sharp(b64(f)).resize(384, 384, { fit: "cover" }).toBuffer(), left: (i % refCols) * 384, top: Math.floor(i / refCols) * 384,
    }))))
    .jpeg({ quality: 88 })
    .toBuffer();
  const faceStrip = await timeline(clipFaces.map(b64), times, 384, 384, 6);
  const fullStrip = await timeline(stills, times, TILE_W, TILE_H, 6);

  if (opts.debugDir) {
    const { writeFileSync } = await import("fs");
    writeFileSync(`${opts.debugDir}/clip-faces.jpg`, faceStrip);
    writeFileSync(`${opts.debugDir}/clip-frames.jpg`, fullStrip);
    if (eyeStrip) writeFileSync(`${opts.debugDir}/clip-eyes.jpg`, eyeStrip);
  }

  const features = persona.identityFeatures ?? [];
  const content: Anthropic.Messages.ContentBlockParam[] = [
    { type: "text", text: `REFERENCE faces of ${persona.name}:` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: refRow.toString("base64") } },
    { type: "text", text: persona.mainReference ? `${persona.name}'s main character reference sheet (her figure in the full-body panels):` : `Reference full frame of ${persona.name}:` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: refFull } },
    { type: "text", text: `Her face in the CLIP, sampled every ~${SAMPLE_EVERY_S}s (timestamp on each):` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: faceStrip.toString("base64") } },
    { type: "text", text: "The same moments as full frames:" },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: fullStrip.toString("base64") } },
    ...(eyeStrip ? [
      { type: "text" as const, text: `Her EYES close up every ~${EYE_EVERY_S}s, in order (timestamp on each), to judge blinks and eyelids:` },
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: eyeStrip.toString("base64") } },
    ] : []),
    {
      type: "text",
      text:
        `These are stills, in order, from a ${durationS.toFixed(1)}s lip-synced talking-head clip of ${persona.name} for social video. ` +
        "The first still is the approved start frame; judge how the clip holds up from there. You can't hear audio, so don't judge lip sync.\n\n" +
        "What the performance was asked for: a static, eye-level vertical full-body shot with no camera movement; her face and eyes toward camera throughout" +
        (persona.handsDirection ? `; hands: ${persona.handsDirection}` : "") +
        (persona.performanceNote ? `; eyes: ${persona.performanceNote}` : "") + ".\n\n" +
        "Check, citing the timestamp of each problem:\n" +
        "1. identity: is it the same woman as the reference faces in EVERY still? " +
        (features.length ? `Her distinctive features: ${features.join("; ")}. ` : "") +
        "Flag any still where she drifts toward a different-looking woman.\n" +
        (persona.figureFeature
          ? `1b. figure: compare her body in EVERY full-frame still against the full-body panels of the reference sheet, allowing for outfit and pose: ${persona.figureFeature}. ` +
            "Flag any still where she is visibly slimmer, flatter or less curvy than the sheet (kind \"figure\", blocking), and give the overall verdict in \"figure\".\n"
          : "") +
        "2. eyes: closed, half-closed, squinting or heavy-lidded beyond a normal quick blink; looking away from camera.\n" +
        "2b. eyelids, from the dense eye strip: follow every blink. A good blink closes the lids fully and reopens them. Flag (kind \"eyes\") blinks that stall " +
        "half-closed or never fully close, eyelids that look transparent or ghosted (iris or pupil visible through a closed or closing lid, " +
        "or the lid and iris blended together), one eye closing without the other, and lids drooping for long stretches.\n" +
        "3. hands: both hands gesturing together or mirrored, hands raised to chest/shoulder height, malformed or extra fingers, hands melting into the body or clothes.\n" +
        "4. camera: zoom/push-in, pan or reframing (compare her size and position in the frame across stills).\n" +
        "5. scene/artifacts: background warping or changing, people or objects morphing or appearing, clothing changing, garbled text appearing, face or body distortion.\n\n" +
        // Calibrated on the India–Spain clips (11-01): the user passed only India
        // Do's, failing three clips whose grey eyes turn brown mid-clip; an
        // earlier wording let one through as "some darkening", and failed India
        // Do's for heavy lids the user accepts.
        "severity=blocking for: a still where she reads as a different woman; any distinctive feature visibly changing from the references " +
        "in any still, eye colour included (light eyes turning brown or dark is blocking, however gradual, but judge colour only on stills where her eyes are open); " +
        "eyes closed or so far closed that the irises are mostly hidden across two or more consecutive stills (merely heavy or lowered lids are minor); " +
        "transparent or ghosted eyelids in any eye still; incomplete blinks (lids stalling half-closed) more than once; visibly malformed hands or face;the scene, outfit or background changing or warping; text or captions appearing; a visibly slimmer figure than the reference sheet. " +
        "Everything else (mirrored or chest-height gestures, a mild push-in, a single blink) is minor. Report only what you actually see; an empty list is fine.\n\n" +
        "faceMatch 1-10 is the LOWEST likeness across the stills: would someone who knows her from the references say without hesitation that it's her? A similar-looking woman is 6 or below.\n\n" +
        'Reply with JSON only: {"faceMatch": <1-10>, ' +
        (persona.figureFeature ? '"figure": {"match": true|false, "note": "<her figure across the clip vs the sheet>"}, ' : "") +
        '"issues": [{"t": <seconds or null>, "kind": "identity|eyes|hands|figure|camera|scene|artifact|text|other", ' +
        '"severity": "blocking|minor", "note": "<what you see>"}], "summary": "<one or two sentences>"}',
    },
  ];

  // Borderline clips flipped between PASS and FAIL across identical runs
  // (Spain Don'ts, 11-01: 6 FAIL, 6 FAIL, 7 PASS), so the review runs twice
  // and a clip passes only when every run passes; the strictest run is kept.
  const runs = await Promise.all(Array.from({ length: REVIEW_RUNS }, async () => {
    const response = await client.messages.create({
      model:      REVIEW_MODEL,
      max_tokens: 4000,
      system:     "You are a strict continuity and quality checker for an AI video pipeline. You compare faces precisely, look closely at hands and eyes, and never wave through a lookalike.",
      messages:   [{ role: "user", content }],
    });
    logClaudeUsage("ugc:clip-review", REVIEW_MODEL, response.usage.input_tokens, response.usage.output_tokens);

    const text  = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Clip review returned no JSON: ${text.slice(0, 200)}`);
    const raw = JSON.parse(match[0]) as Omit<ClipReview, "pass" | "sampledAt" | "runs">;
    const issues = raw.issues ?? [];
    return {
      faceMatch: raw.faceMatch,
      figure:    raw.figure,
      issues,
      summary:   raw.summary ?? "",
      sampledAt: times,
      pass:      raw.faceMatch >= FACE_MATCH_PASS && !issues.some((i) => i.severity === "blocking")
        && (!persona.figureFeature || raw.figure?.match === true),
    };
  }));
  const strictest = [...runs].sort((x, y) => Number(x.pass) - Number(y.pass) || x.faceMatch - y.faceMatch)[0];
  return {
    ...strictest,
    faceMatch: Math.min(...runs.map((r) => r.faceMatch)),
    pass:      runs.every((r) => r.pass),
    runs:      runs.map((r) => ({ pass: r.pass, faceMatch: r.faceMatch })),
  };
}

export function formatClipReview(r: ClipReview): string {
  const votes = r.runs ? ` (runs: ${r.runs.map((x) => `${x.pass ? "pass" : "fail"} ${x.faceMatch}`).join(", ")})` : "";
  const lines = [`${r.pass ? "PASS" : "FAIL"}  lowest face match ${r.faceMatch}/10${votes} — ${r.summary}`];
  if (r.figure) lines.push(`    ${r.figure.match ? "ok   " : "MISS "} figure: ${r.figure.note}`);
  for (const i of r.issues) {
    lines.push(`    ${i.severity === "blocking" ? "BLOCK" : "minor"} ${i.t === null ? "  all" : `${i.t.toFixed(1).padStart(5)}s`} ${i.kind}: ${i.note}`);
  }
  return lines.join("\n");
}
