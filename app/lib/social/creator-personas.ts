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
   * Hedra image asset id for the outro's start frame when it differs from
   * the intro's (same spot, different outfit). Falls back to
   * introSceneImageAssetId when unset.
   */
  outroSceneImageAssetId?: string;
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
  // Global Office creator. Identity designed in Higgsfield (no real source
  // photos) and registered via scripts/register-persona-sheet.mts. Her outro
  // and end-card clips aren't made yet.
  priya: {
    key:               "priya",
    name:              "Priya Mehta",
    pillar:            "global-office",
    referenceImageUrl: "https://res.cloudinary.com/dnpcbx89m/image/upload/v1792161148/boardroom-brief/ugc/priya-reference.png",
    // From the shared ElevenLabs library, found via the v3 API's
    // GET /v3/models/elevenlabs-v3/voices/search (legacy /voices doesn't list
    // it). Legacy TTS takes the bare uuid, not v3's "voice_<uuid>" form.
    // A Hedra clone of her Higgsfield voice was tried first and rejected.
    voiceId:           "5e6c6c6a-8d4a-4460-8460-bb8a7fa0aaac",
    voiceName:         "Rashmi I.",
    // Emerald-dress shot in Suki's exact reception spot (reference/priya/backdrop-emerald-v8b.png).
    introSceneImageAssetId: "d4ad9de6-624c-4dd0-8b17-7def5c80833e",
    // Burgundy blouse + pencil skirt beside the sign, composited from her
    // character sheet so the face matches it (reference/priya/backdrop-burgundy-v11-b.png).
    outroSceneImageAssetId: "be7a037d-ba49-4567-b21e-5670963e706f",
    bio:               "Raised across Mumbai, Amsterdam, Seoul and São Paulo. Covers how work actually works across 30 economies for The Alignment Times.",
    outroScript:       "To find out more, read the full article at thealignmenttimes.com.",
    outroScene:        "Priya standing in The Alignment Times' office reception, the brand sign visible on the wall beside her, warm closing smile, vertical full-body framing as if filmed directly by the viewer's camera, no phone or camera visible in her hands.",
    characterSheet: {
      frontNeutral:        "e1ccaffc-ccb7-4486-847c-a54308dd3d1a",
      threeQuarterNeutral: "c07ab9f3-9898-4a02-87c2-b219587b8c89",
      profileNeutral:      "51c1dad3-78d1-4392-8b45-44d105ebab50",
      frontSmiling:        "0f8eaa5d-6327-4315-8376-38da59af5939",
      frontSerious:        "787799ea-15fd-40ed-b46e-323046cb6606",
      fullBodyFront:       "783823f6-ca9d-47bb-a2db-924bd3648e13",
      fullBodySide:        "9cb3f587-b2cf-4dc1-976e-a0df8540e95b",
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
