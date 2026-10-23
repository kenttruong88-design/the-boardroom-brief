# Priya hook clip — what we learned and the final recipe

Status 2026-10-23. Problems being solved: sleepy / half-closed eyes and weird, busy hands
in Priya's Character-3 hook clips (Suki's clips don't have them).

## Root causes (all confirmed by trials)

| Symptom | Cause | Evidence |
|---|---|---|
| Soft, low-detail face; eyes collapse easily | Start frame made at Nano Banana's default 1K (768×1376) and upscaled to the 1080×1920 video, so her face was only ~70 px wide | 2K frame (1536×2752) removed the 5.25 s and 6.75–7 s droops and the head tilt (`trial/_hook-eyes-2k.png`) |
| Heavy lids at specific moments | Character-3 is audio-driven: mid-line silences ≥0.4 s (and low, choppy pitch) make it play a "thinking", downcast look | Droops line up with the 2.1–2.65 s and 4.6–5.25 s pauses in the narration; take D (max 0.4 s pause) cut them to one |
| Eyes read as closed | Light grey irises under a dark lash line lose contrast | Brown/hazel frames drooped less, but grey is her identity, so it's kept; 2K solved most of it |
| Busy, fidgety, chest-height hands | Shared hook prompt asks for "stance and hands stay loose and animated" | Hands busy on every frame variant; a faster voice (speed 1.2) made it worse |

## Final recipe

1. **Start frame:** `reference/priya/v22-grey-2k-a.png` (2K, grey eyes, Hedra asset 69f613f6-507f-4ce8-bc93-c18993cc8d34),
   set as priya `introSceneImageAssetId`. All future Priya frames (outro, country scenes) are made at 2K
   (`edit-backdrop.mts --resolution 2K`, ~11 credits).
2. **Render at 1080p** (pipeline default, ~7 credits/s × 1.25).
3. **Narration with no pause longer than ~0.3 s.** Rashmi, normal speed (1.0–1.1, not 1.2), with pauses
   shortened in post (same words/voice) or a tighter TTS take. To build into the pipeline: a pause-trim step
   after TTS, before upload to Hedra.
4. **Priya-only hands line** via `performanceNote` (Suki's shared prompt untouched): arms relaxed at her
   sides, at most one small slow right-hand gesture at waist height, left arm still, never both hands,
   never at chest height, no fidgeting.
5. Keep the existing eyes-open `performanceNote`.

## Still to verify (one 1080p trial, ~70 credits)

Steps 3 + 4 together on the 2K-a frame. If it passes: set the frame in `creator-personas.ts`, make a matching
2K outro frame + render the official outro and end card, then produce the India–Spain clips.

## Optional extra

Gemini Omni Flash video-to-video "photoreal" re-render of a finished clip (`scripts/ugc-video-edit.mts`,
~34 credits/s at 720p). Input clip must be ≤10 s (`ugc-trial-clip.mts --pad 500`). Not tried successfully yet.

## Trials so far

| Trial | Frame | Audio | Result |
|---|---|---|---|
| v18-c / v20-c | 1K light eyes | original | droops at 2.5, 5.25, 6.75 s; mirrored hands |
| hazel / brown (720p) | 1K darker eyes | original | fewer droops, still there |
| take D (720p) | 1K hazel | speed 1.2, max 0.4 s pause | one droop at 2–3 s; hands very weird |
| **2K-a (1080p)** | **2K grey** | original | **big improvement**: sharp face, only the 2.5–3.5 s droop left; hands still busy |
