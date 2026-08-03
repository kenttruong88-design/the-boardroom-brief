import { callClaude, parseJSON, MODELS } from "@/app/lib/claude";
import type { CreatorPersona } from "./creator-personas";
import type { ParsedOutOfOfficeArticle } from "./out-of-office-parser";

// Generated as FIVE per-article clips, followed by a SIXTH clip that is
// generated once and reused across every video — see outro-clip.ts. Hedra's
// avatar models handle a distinct pose/scene per beat more reliably than one
// continuous take, AND — confirmed by direct comparison — hold lip-sync
// noticeably tighter on short (~8-13s) generations than on long (~25s) ones,
// even though together/hedra-character-3 technically allows up to 10min per
// clip. That's why each country's Do's and Don'ts are now split into TWO
// separate clips rather than one combined clip covering both: it's not just
// a scripting choice, it keeps every individual Hedra generation inside the
// duration range that's actually looked clean.
//   Clip 1 (hook, ~8-10s):        the article's own headline + one snappy
//                                 follow-up line — no CTA, the shared outro
//                                 clip handles that for every video.
//   Clip 2 (country A Do's):      country A's Do's only, back to back.
//   Clip 3 (country A Don'ts):    country A's Don'ts only, back to back.
//   Clip 4 (country B Do's):      country B's Do's only, back to back.
//   Clip 5 (country B Don'ts):    country B's Don'ts only, no CTA — the
//                                 shared outro closes every video instead.
// Each Do's/Don'ts clip covers all the pairs used for that country (2-3) —
// the extra time comes from using more of the article's own existing
// Do's & Don'ts, never from adding countries or inventing content.
const SYSTEM_PROMPT = `You write scripts for a 5-clip creator-style vertical video series for The Alignment Times' Out of Office pillar, delivered to camera by Suki Nakamura for Instagram and TikTok. A separate, shared closing clip (not written here) plays after these 5 and directs viewers to the website — so none of these clips needs a call-to-action. Total runtime across the 5 clips should land around 45-60 seconds of natural speech.

Before returning your answer, COUNT THE WORDS in each spoken clip and check they land in range. If a clip is over its maximum, cut it down — remove words, don't just note the target. If a clip is under its minimum, that means you dropped an item too eagerly — add back one rather than leaving the clip thin. A clip a little short is fine; a clip over its maximum breaks the video (Hedra generates a fixed-length take and cuts off whatever doesn't fit).

Clip 1 — Hook (max 22 words): The article's own headline, lightly adapted so it reads as something Suki would say out loud rather than a written headline — keep its wit and contrast fully intact, do not soften or generalize it — followed by ONE short, snappy follow-up line that sets up the countries/topic to come (not a CTA, not "stay tuned" — a real observation or a teasing contrast, e.g. "And I've lived both."). The follow-up must earn its place; cut it rather than pad if nothing sharp comes to mind.

Clips 2-5 — one clip per country PER category (STRICT maximum 35 words spoken each, this is a hard limit): Say the country's name once, then deliver EXACTLY 3 items from that category (Do's, or Don'ts) from the list given — if the source list has fewer than 3, use however many exist; never invent a 3rd. Selection rule: when there are more than 3 available, pick the 3 most surprising/vivid and mutually complementary (e.g. one about etiquette, one about logistics, one about cost) rather than any that make the same point twice. IMPORTANT: pick the SAME 3 pairs for a country's Do's clip and its Don'ts clip — each pair's Do goes in the Do's clip, its matching Don't goes in the Don'ts clip, so the two clips stay about the same underlying set of pairs even though they're spoken separately. State each item plainly and directly, back to back — no narrative asides, reactions, or commentary between them ("and I mean everyone", "here's the thing", "just remember" as filler). Every word must be part of an item or the country name — nothing else. If 3 items stated plainly would still exceed 35 words, drop to 2 rather than rushing the delivery. The Don'ts clips get no call-to-action or closing line — end on the last Don't.

Each Do's/Don'ts clip ALSO needs its own caption LIST — these get burned onto the video as a stacked list of bullets shown for the whole clip, one entry for EVERY item you actually spoke in that clip (so 2 or 3, matching the spoken clip exactly — never fewer, never inventing extra). Captions must be terser than the spoken line: max 6 words each, no country name (shown separately). The caption styling already prepends "DO:"/"DON'T:" (matching the clip's own category), so:
- Do caption: a short imperative phrase, e.g. "Book a PT session".
- Don't caption: name the thing to avoid directly — either a plain verb phrase ("Wear mismatched activewear") or a bare noun phrase ("Mismatched activewear") both work fine under the "DON'T:" prefix. NEVER use a verb that itself already means "avoid" ("skip", "avoid", "don't") — that double-negates under the prefix and flips the meaning. E.g. spoken "Don't wear old, baggy gym clothes — mismatched activewear reads as not trying" → caption "Wear mismatched activewear" or "Mismatched activewear" (both correct), NOT "Skip mismatched activewear" (reads as "DON'T: Skip..." = the opposite of intended).

Each clip also needs a SHORT VISUAL SCENE description — a real-world setting/pose for the speaker in that clip, used to generate a distinct start frame per clip so no two clips show the same static shot. Keep each to one photographable sentence: a location plausible for the clip's content, a vertical medium/close-up framing as if the viewer's own camera is filming her directly (handheld feel, natural angle — NEVER describe her holding or looking at a phone/camera herself, that breaks the illusion she's talking to the viewer), and what the speaker is doing (not talking — a natural paused/mid-gesture pose, since a still photo can't show speech). Vary all five scenes from each other — a country's Do's and Don'ts clips should still look like different moments, not the same shot twice. Ground each country's scenes in something evocative of that country/topic where sensible (e.g. a gym for a fitness article), not just "outside".

Rules:
- Use ONLY the do's/don'ts provided — never invent new ones.
- Each clip must end on a complete thought — no clip should cut off mid-sentence, even when covering multiple items.
- Sound like Suki talking directly to camera — dry, curious, a little wry — never like a listicle being narrated or a checklist being read aloud.
- Never soften the headline's edge when adapting it for speech.
- When trimming an item to fit (spoken or caption), cut to the sharpest phrase — never cut the part that makes it surprising.
- Selecting fewer, better items beats cramming all available ones in — a rushed 3rd item reads worse than a confident 2.
- Do the word-count check silently. Output ONLY the JSON object below — no word-count notes, no commentary, no text before or after it, not even inside the same code block.

Return only valid JSON, and nothing else:
{
  "hookClip": "string — Clip 1 script",
  "hookScene": "string — Clip 1 visual scene description",
  "countryADosClip": "string — Clip 2 spoken script, Do's only",
  "countryADosScene": "string — Clip 2 visual scene description",
  "countryADosCaptions": ["string — max 6 words", "... one entry per Do actually spoken (2-3)"],
  "countryADontsClip": "string — Clip 3 spoken script, Don'ts only",
  "countryADontsScene": "string — Clip 3 visual scene description",
  "countryADontsCaptions": ["string — max 6 words", "... one entry per Don't actually spoken (2-3)"],
  "countryBDosClip": "string — Clip 4 spoken script, Do's only",
  "countryBDosScene": "string — Clip 4 visual scene description",
  "countryBDosCaptions": ["string — max 6 words", "... one entry per Do actually spoken (2-3)"],
  "countryBDontsClip": "string — Clip 5 spoken script, Don'ts only, no call-to-action",
  "countryBDontsScene": "string — Clip 5 visual scene description",
  "countryBDontsCaptions": ["string — max 6 words", "... one entry per Don't actually spoken (2-3)"]
}`;

export interface UgcScript {
  hookClip:              string;
  hookScene:             string;
  countryADosClip:       string;
  countryADosScene:      string;
  countryADosCaptions:   string[];
  countryADontsClip:     string;
  countryADontsScene:    string;
  countryADontsCaptions: string[];
  countryBDosClip:       string;
  countryBDosScene:      string;
  countryBDosCaptions:   string[];
  countryBDontsClip:     string;
  countryBDontsScene:    string;
  countryBDontsCaptions: string[];
}

export interface UgcScriptInput {
  parsed:   ParsedOutOfOfficeArticle;
  persona:  CreatorPersona;
}

// Word caps are enforced in code, not just prompted — the model's compliance
// with a stated cap has proven inconsistent run-to-run on identical prompts
// (one run: 66/49 words; a later run, same prompt: 83/80 words). Rather than
// keep re-wording the prompt, verify the actual output and retry with the
// specific overage called out numerically when it's over.
const WORD_CAPS: Record<
  "hookClip" | "countryADosClip" | "countryADontsClip" | "countryBDosClip" | "countryBDontsClip",
  number
> = {
  hookClip:          22,
  countryADosClip:   35,
  countryADontsClip: 35,
  countryBDosClip:   35,
  countryBDontsClip: 35,
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function findOverages(script: UgcScript): Array<{ field: string; words: number; cap: number }> {
  return (Object.keys(WORD_CAPS) as Array<keyof typeof WORD_CAPS>)
    .map((field) => ({ field, words: countWords(script[field]), cap: WORD_CAPS[field] }))
    .filter((o) => o.words > o.cap);
}

export async function writeUgcScript(input: UgcScriptInput): Promise<UgcScript> {
  const { parsed, persona } = input;
  const [countryA, countryB] = parsed.dosDonts;

  const formatCountry = (c: typeof countryA) =>
    `${c.country}:\n${c.items.map((i) => `- Do: ${i.do}\n  Don't: ${i.dont}`).join("\n")}`;

  const baseUserPrompt = `Speaker: ${persona.name} — ${persona.bio}

Headline: ${parsed.headline}
Countries: ${parsed.countries.join(", ")}

Country A — ${formatCountry(countryA)}

Country B — ${formatCountry(countryB)}

Write the 5-clip script for Suki to deliver directly to camera.`;

  let userPrompt = baseUserPrompt;
  let lastScript: UgcScript | null = null;

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await callClaude(
      SYSTEM_PROMPT,
      userPrompt,
      900,
      "social:ugc-script",
      MODELS.default
    );
    const script = parseJSON<UgcScript>(response.content);
    lastScript = script;

    const overages = findOverages(script);
    if (overages.length === 0) return script;

    console.warn(
      `[ugc-script-writer] Attempt ${attempt}/${MAX_ATTEMPTS} over word cap: ` +
      overages.map((o) => `${o.field}=${o.words}w (max ${o.cap})`).join(", ")
    );
    if (attempt === MAX_ATTEMPTS) break;

    userPrompt = `${baseUserPrompt}

Your previous attempt broke the word limit: ${overages.map((o) => `${o.field} was ${o.words} words (max ${o.cap})`).join("; ")}. Rewrite ALL clips from scratch. For any clip over its cap, drop a whole item rather than trimming words from each sentence — that's what actually gets you under the limit.`;
  }

  // Exhausted retries — return the last attempt rather than throwing. Hedra's
  // video duration is sized to the actual narration length (see
  // hedra-client.ts), so an over-length script runs long rather than
  // truncating; it just won't hit the 45-60s target as tightly.
  return lastScript!;
}
