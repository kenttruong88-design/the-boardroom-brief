import { v2 as cloudinary } from "cloudinary";
import {
  generateNarration,
  submitAvatarVideo,
  getGenerationStatus,
  generateSceneImage,
} from "./hedra-client";
import { getPersonaIdentityAssetId, type CreatorPersona } from "./creator-personas";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Generated ONCE per persona, then reused as the closing clip on every
// video — not regenerated per article. Uses a fixed, stable Cloudinary
// public_id (no timestamp) so re-running this overwrites the same slot
// rather than accumulating copies.

/**
 * Generates the persona's outro clip end to end and uploads it to Cloudinary
 * under a stable public_id. Run this once (see scripts/generate-outro-clip.mts)
 * and paste the resulting public_id into creator-personas.ts.
 */
export async function generateOutroClip(
  persona: CreatorPersona,
  opts: { pollIntervalMs?: number; pollTimeoutMs?: number } = {}
): Promise<{ publicId: string; secureUrl: string }> {
  const identityAssetId = await getPersonaIdentityAssetId(persona);
  const sceneAssetId    = await generateSceneImage(identityAssetId, persona.outroScene, `${persona.key}-outro-scene.png`);
  const narration       = await generateNarration(persona.outroScript, persona.voiceId);

  const generationId = await submitAvatarVideo({
    startKeyframeId:   sceneAssetId,
    audioAssetId:      narration.assetId,
    performancePrompt: `${persona.name} speaking directly to camera, documentary travel vlog style, warm closing tone, natural hand gesture.`,
    durationMs:        narration.durationMs + 800,
  });

  const timeoutMs = opts.pollTimeoutMs ?? 400_000;
  const deadline  = Date.now() + timeoutMs;
  let status = await getGenerationStatus(generationId);
  while (status.status !== "complete" && status.status !== "error" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, opts.pollIntervalMs ?? 8000));
    status = await getGenerationStatus(generationId);
  }
  if (status.status !== "complete") {
    throw new Error(`Outro clip generation failed: ${status.error_message ?? status.status}`);
  }
  const rawUrl = status.url ?? status.download_url;
  if (!rawUrl) throw new Error("Outro clip completed but returned no video URL");

  const upload = await cloudinary.uploader.upload(rawUrl, {
    resource_type: "video",
    folder:        "boardroom-brief/ugc",
    public_id:     `${persona.key}-outro`,
    overwrite:     true,
  });

  return { publicId: upload.public_id, secureUrl: upload.secure_url };
}
