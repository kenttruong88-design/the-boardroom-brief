import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { logClaudeUsage } from "@/app/lib/claude";
import type { CreatorPersona } from "./creator-personas";
import { getImageAssetUrl } from "./hedra-client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Pinned here rather than taken from MODELS: on 10-28 claude-sonnet-4-6
// (MODELS.default) put face boxes 150px+ off the face in full-body frames,
// while both 5.5 models landed within a few pixels.
const LOCATE_MODEL = "claude-sonnet-5-5";
const REVIEW_MODEL = "claude-opus-5-5";

// Claude checks every generated scene frame against the persona's references
// before any avatar video is paid for. nano-banana-pro's identity drifts as
// the scene moves away from the reference shots, and Priya's country frames
// kept coming back as a different woman (10-26..28) that only a human
// review caught.

export interface FrameReview {
  /** True only when every identity feature matches and faceMatch passes. */
  pass:         boolean;
  /** 1-10: would a viewer who knows her from the references say it's her? */
  faceMatch:    number;
  /** One entry per persona.identityFeatures item. */
  features:     Array<{ feature: string; match: boolean; note: string }>;
  /** Non-identity problems that hurt the video (garbled text, bad hands, clasped hands, wrong framing). */
  frameIssues:  string[];
  summary:      string;
}

// An overall 1-10 likeness score alone didn't separate frames: on 10-28 a
// frame the user said "doesn't look like Priya at all" scored 7 and an
// approved one 7-8. The per-feature checklist is what catches a lookalike;
// with it, approved frames score 7-8 and that rejected one 5.
export const FACE_MATCH_PASS = 7;

// Long edge sent to Claude. 2K frames are ~5 MB PNGs, over the image limit.
const REVIEW_LONG_EDGE = 1568;

async function toJpegBase64(buf: Buffer): Promise<string> {
  const out = await sharp(buf)
    .resize({ width: REVIEW_LONG_EDGE, height: REVIEW_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  return out.toString("base64");
}

async function fetchAsset(assetId: string): Promise<Buffer> {
  const res = await fetch(await getImageAssetUrl(assetId));
  if (!res.ok) throw new Error(`Failed to download image asset ${assetId}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Full-body 9:16 frames shrunk to fit Claude leave the face ~100px tall, too
// small to compare features: the first calibration scored a rejected frame
// and an approved one the same (7/10). So the face is found first, then
// cropped from the full-resolution image.
// Asked as fractions of the image, the boxes landed well off the face (the
// crop missed it entirely on the hook frame), so the face is asked for in
// pixels of an image whose exact size the prompt states.
const LOCATE_LONG_EDGE = 1000;

async function locateFace(buf: Buffer): Promise<{ x0: number; y0: number; x1: number; y1: number } | null> {
  const small = await sharp(buf).resize({ width: LOCATE_LONG_EDGE, height: LOCATE_LONG_EDGE, fit: "inside" }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = small.info;
  const response = await client.messages.create({
    model:      LOCATE_MODEL,
    max_tokens: 2000,
    messages:   [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: small.data.toString("base64") } },
        { type: "text", text: `This image is ${w}x${h} pixels. Give the pixel bounding box of the woman's face, from hairline to chin and ear to ear. JSON only: {"x0":..,"y0":..,"x1":..,"y1":..}` },
      ],
    }],
  });
  logClaudeUsage("ugc:frame-review-face", LOCATE_MODEL, response.usage.input_tokens, response.usage.output_tokens);
  const text  = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  const box = JSON.parse(match[0]);
  if (![box.x0, box.y0, box.x1, box.y1].every((v) => typeof v === "number") || box.x1 <= box.x0 || box.y1 <= box.y0) return null;
  return { x0: box.x0 / w, y0: box.y0 / h, x1: box.x1 / w, y1: box.y1 / h };
}

/** Square crop around the face with margin, from the full-resolution image. */
async function faceCropBase64(buf: Buffer): Promise<string> {
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const box = await locateFace(buf);
  if (!box) return toJpegBase64(buf);
  const cx   = ((box.x0 + box.x1) / 2) * width;
  const cy   = ((box.y0 + box.y1) / 2) * height;
  const side = Math.min(width, height, Math.max((box.x1 - box.x0) * width, (box.y1 - box.y0) * height) * 1.6);
  const left = Math.round(Math.min(Math.max(cx - side / 2, 0), width - side));
  const top  = Math.round(Math.min(Math.max(cy - side / 2, 0), height - side));
  const out  = await sharp(buf)
    .extract({ left, top, width: Math.round(side), height: Math.round(side) })
    .resize({ width: 768, height: 768, fit: "inside" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return out.toString("base64");
}

// The approved hook frame is how the user actually knows her, so it goes in
// next to the studio sheet shots. Profile/side shots add little for a
// front-facing frame and cost tokens.
export function referenceAssetIds(persona: CreatorPersona): string[] {
  const sheet = persona.characterSheet ?? {};
  return [
    persona.introSceneImageAssetId,
    sheet.frontNeutral,
    sheet.threeQuarterNeutral,
    sheet.frontSmiling,
    sheet.fullBodyFront,
  ].filter((id): id is string => Boolean(id));
}

export async function reviewSceneFrame(
  persona: CreatorPersona,
  frame: Buffer | string,
  opts: { refs?: Buffer[] } = {}
): Promise<FrameReview> {
  const frameBuf = typeof frame === "string" ? await fetchAsset(frame) : frame;
  const refBufs  = opts.refs ?? await Promise.all(referenceAssetIds(persona).map(fetchAsset));
  if (refBufs.length === 0) throw new Error(`Persona "${persona.key}" has no reference images to review against`);

  const [refFaces, candidateFace, candidateFull] = await Promise.all([
    Promise.all(refBufs.map(faceCropBase64)),
    faceCropBase64(frameBuf),
    toJpegBase64(frameBuf),
  ]);
  // Faces side by side in one image, candidate last: a direct comparison
  // shows a different brow or face shape far more plainly than separate images.
  const faceRow = await sharp({ create: { width: 512 * (refFaces.length + 1), height: 512, channels: 3, background: "#ffffff" } })
    .composite(await Promise.all([...refFaces, candidateFace].map(async (b64, i) => ({
      input: await sharp(Buffer.from(b64, "base64")).resize(512, 512, { fit: "cover" }).toBuffer(),
      left:  i * 512,
      top:   0,
    }))))
    .jpeg({ quality: 90 })
    .toBuffer();
  if (process.env.FRAME_REVIEW_DEBUG_DIR) {
    const { writeFileSync } = await import("fs");
    writeFileSync(`${process.env.FRAME_REVIEW_DEBUG_DIR}/face-row-${Date.now()}.jpg`, faceRow);
  }

  const features = persona.identityFeatures ?? [];
  const content: Anthropic.Messages.ContentBlockParam[] = [
    { type: "text", text: `Face row: the first ${refFaces.length} faces are ${persona.name}; the LAST face (far right) is the CANDIDATE.` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: faceRow.toString("base64") } },
    { type: "text", text: "CANDIDATE full frame:" },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: candidateFull } },
    {
      type: "text",
      text:
        `The candidate is the opening frame of a lip-synced video of ${persona.name}, generated from her references. ` +
        "Outfit, location, lighting and expression are SUPPOSED to differ; judge only whether it is the same woman, and whether the frame is fit to animate.\n\n" +
        (features.length
          ? "Check each of her distinctive features on the CANDIDATE face against the reference faces. match=false if the candidate's version " +
            "is visibly different (e.g. flat brows where hers are arched, a round face where hers is oval):\n" +
            features.map((f, i) => `${i + 1}. ${f}`).join("\n") + "\n\n"
          : "") +
        "Then give faceMatch 1-10: would someone who knows her from the reference faces say without hesitation that the candidate is her? " +
        "A similar-looking woman is 6 or below.\n\n" +
        "Finally, list frame problems from the full frame that would hurt the video: garbled or misspelled text/signage, malformed hands or fingers, " +
        "hands clasped or held together in front of her (they animate into mirrored two-hand gestures), face not toward camera" +
        (persona.sceneNote ? `, and anything contradicting her fixed look: ${persona.sceneNote}` : "") + ". " +
        "Report only problems actually visible; an empty list is fine.\n\n" +
        'Reply with JSON only: {"features": [{"feature": "<short name>", "match": true|false, "note": "<what you see>"}], ' +
        '"faceMatch": <1-10>, "frameIssues": [..], "summary": "<one sentence>"}',
    },
  ];

  const response = await client.messages.create({
    model:      REVIEW_MODEL,
    max_tokens: 4000,
    system:     "You are a strict casting continuity checker for an AI video pipeline. You compare faces precisely and never wave through a lookalike.",
    messages:   [{ role: "user", content }],
  });
  logClaudeUsage("ugc:frame-review", REVIEW_MODEL, response.usage.input_tokens, response.usage.output_tokens);

  const text  = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Frame review returned no JSON: ${text.slice(0, 200)}`);
  const raw = JSON.parse(match[0]) as Omit<FrameReview, "pass">;

  const reviewed = raw.features ?? [];
  return {
    faceMatch:   raw.faceMatch,
    features:    reviewed,
    frameIssues: raw.frameIssues ?? [],
    summary:     raw.summary ?? "",
    // Frame issues are reported for the human, but only identity blocks a
    // video: some (clasped hands) were accepted before (India Do's).
    pass:        raw.faceMatch >= FACE_MATCH_PASS && reviewed.every((f) => f.match),
  };
}

export function formatFrameReview(r: FrameReview): string {
  const lines = [`${r.pass ? "PASS" : "FAIL"}  face match ${r.faceMatch}/10 — ${r.summary}`];
  for (const f of r.features)    lines.push(`    ${f.match ? "ok  " : "MISS"} ${f.feature}: ${f.note}`);
  for (const i of r.frameIssues) lines.push(`    frame: ${i}`);
  return lines.join("\n");
}
