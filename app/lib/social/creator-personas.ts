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
      frontNeutral:        "799518ab-fd66-4310-a4a6-55be34ecb086",
      threeQuarterNeutral: "63d9c710-c31f-437f-a017-e749206d6bd6",
      profileNeutral:      "783842af-b64a-4e31-ae94-9c940d764e7c",
      frontSmiling:        "cb174182-8f7d-440f-9f60-643056f01dbd",
      frontSerious:        "f438d0d0-9d96-48f8-ba5d-4dd94f044792",
      fullBodyFront:       "1dde9ffc-5087-42fb-a0f9-47fb68c352b9",
      fullBodySide:        "fffdcafe-842e-4dc9-97a0-f051f767ad7d",
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

/**
 * Resolves the FULL set of identity reference images (every populated
 * `characterSheet` angle/expression) rather than just `frontNeutral` — for
 * scene generation calls where the target pose/setting diverges a lot from
 * any single reference photo (see hedra-client.ts generateSceneImage notes
 * on identity drift growing with scene distance). Confirmed on a country
 * clip test (2026-09-08/09): passing all 7 character-sheet shots as
 * multi-reference to nano-banana-pro held identity noticeably better than
 * the single-`frontNeutral` reference used previously. Falls back to the
 * single uploaded `referenceImageUrl` (as a one-element array) for personas
 * without a character sheet yet.
 */
export async function getPersonaIdentityAssetIds(persona: CreatorPersona): Promise<string[]> {
  if (persona.characterSheet) {
    const ids = Object.values(persona.characterSheet).filter((id): id is string => Boolean(id));
    if (ids.length > 0) return ids;
  }
  return [await uploadImageAsset(persona.referenceImageUrl, `${persona.key}-reference.png`)];
}
