import { v2 as cloudinary } from "cloudinary";
import { createAdminClient } from "@/app/lib/supabase-server";
import { writeUgcScript } from "./ugc-script-writer";
import { getCreatorPersona, getPersonaIdentityAssetId } from "./creator-personas";
import { parseOutOfOfficeArticle } from "./out-of-office-parser";
import {
  generateNarration,
  submitAvatarVideo,
  submitTransitionClip,
  getGenerationStatus,
  generateSceneImage,
} from "./hedra-client";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type ClipLabel  = "hook" | "country_a_dos" | "country_a_donts" | "country_b_dos" | "country_b_donts";
export type ClipStatus = "pending" | "generating_audio" | "generating_video" | "complete" | "failed";

export interface UgcClip {
  label:                 ClipLabel;
  script:                string;
  scene:                 string;
  /** One bullet per Do/Don't actually spoken in this clip (2-3), same category as `label`. */
  captions?:             string[];
  scene_image_asset_id?: string;
  audio_asset_id?:       string;
  hedra_generation_id?:  string;
  video_url?:            string;
  cloudinary_public_id?: string;
  status:                ClipStatus;
  error?:                string;
}

export interface UgcVideoQueueRow {
  id:                string;
  article_id:        string;
  article_slug:       string;
  article_headline:  string;
  article_url:       string;
  pillar:            string | null;
  persona_key:       string;
  persona_name:      string;
  clips:             UgcClip[];
  status:            "pending_approval" | "rejected" | "approved" | "generating" | "complete" | "failed";
  created_at:        string;
  approved_at:       string | null;
  completed_at:      string | null;
}

async function loadRow(queueId: string): Promise<UgcVideoQueueRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ugc_video_queue")
    .select("*")
    .eq("id", queueId)
    .single();
  if (error || !data) throw new Error(`UGC video queue row not found: ${queueId}`);
  return data as UgcVideoQueueRow;
}

async function updateRow(
  queueId: string,
  patch: Partial<UgcVideoQueueRow>
): Promise<UgcVideoQueueRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ugc_video_queue")
    .update(patch)
    .eq("id", queueId)
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to update UGC video queue row ${queueId}: ${error?.message}`);
  return data as UgcVideoQueueRow;
}

// ── Step 1: Claude drafts the 5-clip script, queued for approval ────────────
// Out of Office only, Suki only: pulls the headline and both countries'
// Do's & Don'ts straight from the article's own markdown source (see
// out-of-office-parser.ts) rather than requiring the caller to restate them.

export interface DraftUgcVideoInput {
  slug:       string;
  articleUrl: string;
  markdown:   string;
}

export async function draftUgcVideo(input: DraftUgcVideoInput): Promise<UgcVideoQueueRow> {
  const persona = getCreatorPersona("suki");
  const parsed  = parseOutOfOfficeArticle(input.markdown);

  const scriptResult = await writeUgcScript({ parsed, persona });

  const clips: UgcClip[] = [
    {
      label:  "hook",
      script: scriptResult.hookClip,
      scene:  scriptResult.hookScene,
      status: "pending",
    },
    {
      label:    "country_a_dos",
      script:   scriptResult.countryADosClip,
      scene:    scriptResult.countryADosScene,
      captions: scriptResult.countryADosCaptions,
      status:   "pending",
    },
    {
      label:    "country_a_donts",
      script:   scriptResult.countryADontsClip,
      scene:    scriptResult.countryADontsScene,
      captions: scriptResult.countryADontsCaptions,
      status:   "pending",
    },
    {
      label:    "country_b_dos",
      script:   scriptResult.countryBDosClip,
      scene:    scriptResult.countryBDosScene,
      captions: scriptResult.countryBDosCaptions,
      status:   "pending",
    },
    {
      label:    "country_b_donts",
      script:   scriptResult.countryBDontsClip,
      scene:    scriptResult.countryBDontsScene,
      captions: scriptResult.countryBDontsCaptions,
      status:   "pending",
    },
  ];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ugc_video_queue")
    .insert({
      article_id:       input.slug,
      article_slug:     input.slug,
      article_headline: parsed.headline,
      article_url:      input.articleUrl,
      pillar:           "out-of-office",
      persona_key:      persona.key,
      persona_name:     persona.name,
      clips,
      status:           "pending_approval",
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to queue UGC video: ${error?.message}`);
  return data as UgcVideoQueueRow;
}

export async function rejectUgcVideo(queueId: string): Promise<UgcVideoQueueRow> {
  return updateRow(queueId, { status: "rejected" });
}

// ── Step 2: on approval, generate narration + submit video for each clip ────
// All five clips are narrated and submitted in parallel — each is a short
// (~8-13s) generation, so there's no reason to serialize them. Narration is
// awaited inline (~10-20s); avatar video is only *submitted* here and polled
// later from finalizeUgcVideo(), since each can take a few minutes.

export function performancePromptFor(personaName: string, label: ClipLabel): string {
  const base = `${personaName} speaking directly to camera, documentary travel vlog style, natural hand gestures, engaging eye contact.`;
  if (label === "hook") return `${base} Warm and knowing delivery, a little wry.`;
  if (label.endsWith("_dos")) return `${base} Encouraging, confident energy — recommending these back to back.`;
  return `${base} Wry, cautionary energy — warning these off back to back.`;
}

// Each clip gets its own start frame (same identity, different pose/setting)
// via image-to-image on the uploaded reference photo — flux-kontext-pro-i2i
// preserves face + outfit reliably in testing. Without this all 3 clips open
// on the exact same static shot.
async function generateClip(
  persona: ReturnType<typeof getCreatorPersona>,
  identityAssetId: string,
  articleSlug: string,
  clip: UgcClip
): Promise<UgcClip> {
  try {
    const sceneImageAssetId = await generateSceneImage(
      identityAssetId,
      clip.scene,
      `${articleSlug}-${clip.label}-scene.png`
    );
    const narration = await generateNarration(clip.script, persona.voiceId);
    // Size the video to the actual narration length (+buffer for a natural
    // trailing beat) rather than a fixed guess — a script running a couple
    // words over budget produces audio longer than a fixed-length video,
    // and Hedra cuts the video off mid-sentence instead of stretching to fit.
    const generationId = await submitAvatarVideo({
      startKeyframeId:    sceneImageAssetId,
      audioAssetId:       narration.assetId,
      performancePrompt:  performancePromptFor(persona.name, clip.label),
      durationMs:          narration.durationMs + 800,
    });
    return {
      ...clip,
      scene_image_asset_id: sceneImageAssetId,
      audio_asset_id:       narration.assetId,
      hedra_generation_id:  generationId,
      status:               "generating_video",
    };
  } catch (err) {
    return { ...clip, status: "failed", error: (err as Error).message };
  }
}

export async function approveUgcVideo(queueId: string): Promise<UgcVideoQueueRow> {
  const row = await loadRow(queueId);
  if (row.status !== "pending_approval") {
    throw new Error(`Cannot approve a video in status "${row.status}"`);
  }

  const persona = getCreatorPersona(row.persona_key);
  await updateRow(queueId, { status: "approved", approved_at: new Date().toISOString() });

  // Resolve the identity anchor once — each clip then derives its own
  // distinct scene image from this via image-to-image (see generateClip).
  const identityAssetId = await getPersonaIdentityAssetId(persona);

  const clips = await Promise.all(
    row.clips.map((clip) => generateClip(persona, identityAssetId, row.article_slug, clip))
  );
  const anyFailed = clips.some((c) => c.status === "failed");

  return updateRow(queueId, {
    clips,
    status: anyFailed && clips.every((c) => c.status === "failed") ? "failed" : "generating",
  });
}

// ── Caption overlay ───────────────────────────────────────────────────────────
// Each clip is now single-category (a country's Do's, or its Don'ts — see
// ugc-script-writer.ts), not both — so captions are a single-color stacked
// list (green DO bars for a Do's clip, red DON'T bars for a Don'ts clip)
// rather than the old two-column side-by-side table, which no longer has a
// clip that carries both categories at once to display.

export function buildCaptionedVideoUrl(publicId: string, items: string[], kind: "do" | "dont"): string {
  const fontSize   = 32;
  const rowHeight  = 90;
  const bottomGap  = 140;
  const label      = kind === "do" ? "DO" : "DON'T";
  const background = kind === "do" ? "#16a34a" : "#dc2626";
  const transformation: Record<string, unknown>[] = [];

  items.forEach((item, i) => {
    const y = bottomGap + (items.length - 1 - i) * rowHeight;
    transformation.push(
      {
        overlay: { font_family: "Arial", font_size: fontSize, font_weight: "bold", text: `${label}: ${item}` },
        color:      "white",
        background,
        crop:       "fit",
        width:      0.85,
        flags:      "relative",
      },
      { flags: "layer_apply", gravity: "south", y }
    );
  });

  return cloudinary.url(publicId, { resource_type: "video", transformation });
}

// ── Compiling the 5 clips into one video ─────────────────────────────────────
// Two approaches, both operating on the plain (uncaptioned) clip public ids —
// baking captions into a spliced sub-layer adds a lot of transformation-
// nesting risk for comparison purposes, so that's a follow-up once a
// transition approach is chosen.
//
// A) Simple splice — hard cut between clips, no Hedra cost, instant.
// B) AI bridge — generates a short Seedance 2.0 clip morphing from one
//    clip's scene image to the next's (mirrors Hedra's own "Övergång" tool),
//    then splices clip → bridge → clip → bridge → clip. Costs 2 extra video
//    generations and a few minutes per video.

export interface SpliceClip {
  publicId:   string;
  /**
   * Strips this clip's audio track in the compiled output. Seedance 2.0
   * bridge clips render with an auto-generated background-music track we
   * never asked for and don't want bleeding into the narrated clips either
   * side of them — mute those segments specifically rather than the whole
   * compiled video.
   */
  muteAudio?: boolean;
}

/**
 * Concatenates clips in order with a hard cut (no dissolve).
 *
 * Three Cloudinary gotchas this works around:
 * 1. Every clip (base + each overlay) is resized to a common frame —
 *    Cloudinary refuses to splice mismatched dimensions, and Seedance 2.0
 *    bridge clips render at a different resolution than Character-3 avatar
 *    clips even when both request the same "720p"/"9:16" params (confirmed:
 *    720x1280 vs 832x1088 for the same nominal settings).
 * 2. Folder-nested public ids (e.g. "boardroom-brief/ugc/clip-1") must have
 *    EVERY "/" manually replaced with ":" for the `l_video:` overlay syntax
 *    — the Node SDK's own overlay-object conversion only handles this
 *    correctly for single-level paths, silently mis-converting deeper ones
 *    and producing a 400 (confirmed by testing).
 * 3. `audio_codec: "none"` must be its own transformation step placed AFTER
 *    the overlay declaration and BEFORE `layer_apply` to mute only that
 *    inserted clip's segment, rather than the whole spliced output.
 */
export function buildSplicedVideoUrl(
  clips: SpliceClip[],
  dimensions: { width: number; height: number } = { width: 720, height: 1280 }
): string {
  if (clips.length < 2) throw new Error("Need at least 2 clips to splice");
  const { width, height } = dimensions;
  const [first, ...rest] = clips;

  const baseTransformation: Record<string, unknown>[] = [{ width, height, crop: "fill" }];
  if (first.muteAudio) baseTransformation.push({ audio_codec: "none" });

  const transformation = rest.flatMap((clip) => {
    const steps: Record<string, unknown>[] = [
      {
        flags:   "splice",
        overlay: { resource_type: "video" as const, public_id: clip.publicId.replace(/\//g, ":") },
        width, height, crop: "fill",
      },
    ];
    if (clip.muteAudio) steps.push({ audio_codec: "none" });
    steps.push({ flags: "layer_apply" });
    return steps;
  });

  return cloudinary.url(first.publicId, {
    resource_type: "video",
    transformation: [...baseTransformation, ...transformation],
  });
}

/** Submits one bridge clip morphing between two clips' scene images. */
export async function submitBridgeClip(fromSceneAssetId: string, toSceneAssetId: string): Promise<string> {
  return submitTransitionClip({
    startKeyframeId: fromSceneAssetId,
    endKeyframeId:   toSceneAssetId,
    prompt:          "Same person, natural continuous camera movement turning from one scene into the next, smooth motion blur, seamless walk-through transition.",
    durationMs:      4000,
  });
}

// ── Step 3: check/finalize each clip once Hedra completes it ────────────────
// Call repeatedly (e.g. from a polling UI) until row.status is "complete" or
// "failed". Each call checks only clips still in "generating_video".

export async function finalizeUgcVideo(queueId: string): Promise<UgcVideoQueueRow> {
  const row = await loadRow(queueId);
  if (row.status !== "generating") return row;

  const clips = await Promise.all(row.clips.map(async (clip) => {
    if (clip.status !== "generating_video" || !clip.hedra_generation_id) return clip;

    const genStatus = await getGenerationStatus(clip.hedra_generation_id);

    if (genStatus.status === "error") {
      return { ...clip, status: "failed" as const, error: genStatus.error_message ?? "Hedra video generation failed" };
    }
    if (genStatus.status !== "complete") return clip; // still queued/processing

    const videoUrl = genStatus.url ?? genStatus.download_url;
    if (!videoUrl) {
      return { ...clip, status: "failed" as const, error: "Hedra reported complete but returned no video URL" };
    }

    // Hedra's S3 URL is signed and expires — re-host on Cloudinary for a
    // permanent link.
    const upload = await cloudinary.uploader.upload(videoUrl, {
      resource_type: "video",
      folder:        "boardroom-brief/ugc",
      public_id:      `ugc-${row.article_slug}-${clip.label}-${Date.now()}`,
    });

    const finalUrl = (clip.captions && clip.captions.length > 0)
      ? buildCaptionedVideoUrl(upload.public_id, clip.captions, clip.label.endsWith("_dos") ? "do" : "dont")
      : upload.secure_url;

    return {
      ...clip,
      status:                "complete" as const,
      video_url:              finalUrl,
      cloudinary_public_id:   upload.public_id,
    };
  }));

  const allComplete = clips.every((c) => c.status === "complete");
  const anyFailed   = clips.some((c) => c.status === "failed");
  const stillGoing  = clips.some((c) => c.status === "generating_video");

  return updateRow(queueId, {
    clips,
    status:        allComplete ? "complete" : anyFailed && !stillGoing ? "failed" : "generating",
    completed_at:  allComplete ? new Date().toISOString() : null,
  });
}
