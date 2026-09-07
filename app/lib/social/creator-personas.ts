import { uploadImageAsset } from "./hedra-client";

export interface CreatorPersona {
  key:                     string;
  name:                    string;
  pillar:                  string;
  referenceImageUrl:       string;
  voiceId:                 string;
  voiceName:               string;
  bio:                     string;
  /** Spoken script for the shared closing clip, reused across every video. */
  outroScript:             string;
  /** Description of the shared intro/outro backdrop, for documentation — the actual generation uses `introSceneImageAssetId`, not this text. */
  outroScene:              string;
  /**
   * Hedra image asset id for the fixed office-reception start frame shared
   * by the hook (intro) clip and the outro clip — see
   * scripts/suki-office-backdrop.mts. Generated ONCE and reused directly
   * (not re-generated per article) so the backdrop stays pixel-identical
   * across every video, hook and outro alike. Both clips still get their
   * own spoken script/narration — only the visual start frame is shared.
   */
  introSceneImageAssetId?: string;
  /**
   * Cloudinary public_id of the generated outro clip. Undefined until
   * `scripts/generate-outro-clip.mts` has been run once for this persona —
   * paste the printed public_id in here afterward. The clip is generated
   * once and reused for every video rather than regenerated per article.
   */
  outroCloudinaryPublicId?: string;
  /**
   * Cloudinary public_id of the generated end-card clip (dark brand screen
   * + website URL) appended after the outro in every compiled video — see
   * `scripts/generate-endcard-clip.mts`. Generated once and reused, same
   * pattern as `outroCloudinaryPublicId`.
   */
  endcardCloudinaryPublicId?: string;
  /**
   * Reference character sheet: 3 head/shoulders angles (front/three-quarter/
   * profile) at a neutral expression, 2 more expressions (smiling/serious)
   * at the front angle, plus full-body front and side standing shots — a
   * richer identity-reference pool than one single photo. Populated
   * incrementally by `scripts/generate-character-sheet.mts`, which skips any
   * shot already present here unless run with --force. Values are Hedra
   * image asset ids.
   */
  characterSheet?: {
    frontNeutral?:        string;
    threeQuarterNeutral?: string;
    profileNeutral?:      string;
    frontSmiling?:        string;
    frontSerious?:        string;
    fullBodyFront?:       string;
    fullBodySide?:        string;
  };
}

// Reference image + voice pairing for each on-camera "creator." Add a new
// entry here (and a matching reference photo) before pointing a new pillar
// at UGC-style video.
export const CREATOR_PERSONAS: Record<string, CreatorPersona> = {
  suki: {
    key:               "suki",
    name:              "Suki Nakamura",
    pillar:            "out-of-office",
    referenceImageUrl: "https://res.cloudinary.com/dnpcbx89m/image/upload/v1788096800/boardroom-brief/ugc/suki-reference-2026-08.png",
    voiceId:           "fec5d612-7310-4c84-a5c5-c3f0fc7699f1",
    voiceName:         "Lisa Kim",
    bio:               "Relocated 14 times. Has eaten in 60 countries. Covers food, cities, and life outside the desk for The Alignment Times.",
    outroScript:       "To find out more, read the full article at thealignmenttimes.com.",
    outroScene:        "Suki standing in The Alignment Times' office reception, the brand sign visible on the wall beside her, warm closing smile, vertical full-body framing as if filmed directly by the viewer's camera, no phone or camera visible in her hands.",
    outroCloudinaryPublicId: "boardroom-brief/ugc/suki-outro",
    endcardCloudinaryPublicId: "boardroom-brief/ugc/suki-endcard",
    introSceneImageAssetId: "01b0e67e-bfe5-4f49-940f-338776023c0c",
    characterSheet: {
      frontNeutral:        "048ffced-045e-4034-b884-edf4c80cac34",
      threeQuarterNeutral: "1d0ed6cf-52b1-4d40-ac82-30af1392c907",
      profileNeutral:      "33ed221a-f72a-4a41-9f12-616b8d4facc0",
      frontSmiling:        "841ed6e9-d3bd-4f43-a108-0f5a5bfd42af",
      frontSerious:        "7488f0d6-69e1-42b8-9641-15243d4ff90e",
      fullBodyFront:       "49a23de8-8a6d-4076-9d8d-3ad3472617ca",
      fullBodySide:        "35cc9560-125a-44ee-9d3d-ab3be49d6d64",
    },
  },
};

export function getCreatorPersona(key: string): CreatorPersona {
  const persona = CREATOR_PERSONAS[key];
  if (!persona) throw new Error(`Unknown creator persona: "${key}"`);
  return persona;
}

/**
 * Resolves the identity reference to anchor image-to-image scene generation
 * on. Prefers the persona's verified `characterSheet.frontNeutral` shot
 * (already a Hedra asset id — no re-upload needed, and it's a QA'd studio
 * portrait rather than an arbitrary source photo). Falls back to uploading
 * the raw `referenceImageUrl` for personas without a character sheet yet.
 */
export async function getPersonaIdentityAssetId(persona: CreatorPersona): Promise<string> {
  if (persona.characterSheet?.frontNeutral) return persona.characterSheet.frontNeutral;
  return uploadImageAsset(persona.referenceImageUrl, `${persona.key}-reference.png`);
}
