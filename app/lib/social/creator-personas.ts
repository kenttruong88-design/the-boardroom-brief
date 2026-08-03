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
  /** Visual scene for the outro clip's distinct start frame. */
  outroScene:              string;
  /**
   * Cloudinary public_id of the generated outro clip. Undefined until
   * `scripts/generate-outro-clip.mts` has been run once for this persona —
   * paste the printed public_id in here afterward. The clip is generated
   * once and reused for every video rather than regenerated per article.
   */
  outroCloudinaryPublicId?: string;
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
    referenceImageUrl: "https://d8j0ntlcm91z4.cloudfront.net/user_3G4nfIhvBEAbwgXYF7BIO9A8UQ0/hf_20260723_205945_9811b4ce-863c-43c6-ae21-51e5d8f84fb0.png",
    voiceId:           "fec5d612-7310-4c84-a5c5-c3f0fc7699f1",
    voiceName:         "Lisa Kim",
    bio:               "Relocated 14 times. Has eaten in 60 countries. Covers food, cities, and life outside the desk for The Alignment Times.",
    outroScript:       "To find out more, read the full article at thealignmenttimes.com.",
    outroScene:        "Suki standing by a large window with soft natural light, warm closing smile, giving a small wave, vertical medium close-up as if filmed directly by the viewer's camera, no phone or camera visible in her hands.",
    outroCloudinaryPublicId: "boardroom-brief/ugc/suki-outro",
    characterSheet: {
      frontNeutral:        "a4a797c2-1d56-4c6d-b6a5-df2d20e2a88e",
      threeQuarterNeutral: "fdec828e-f5c3-4f66-896c-e2746a519997",
      profileNeutral:      "c509ac6f-da9f-4615-b88c-316522664d8c",
      frontSmiling:        "e061caaf-7052-49cf-82b1-37058cf19221",
      frontSerious:        "c71486b9-f397-453d-aef0-938755fbeac2",
      fullBodyFront:       "d7f6cc68-db2c-4436-9f95-daec953fc62a",
      fullBodySide:        "22885b69-0d85-4396-b3fb-5dbc46910f53",
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
