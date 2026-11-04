---
name: review-ugc-video
description: Review every newly rendered UGC creator video (Priya, Suki) with Claude before showing it to the user — identity drift, eye colour, closed eyes, hand gestures, camera push-in, artifacts. Use right after any Hedra clip, hook, outro or compiled video is rendered (ugc-test-clips, ugc-draft/ugc-approve, generate-endcard-clip, edits), or when the user asks to check/review a clip.
---

# Review UGC video

**Ask the user before running any review.** It spends Anthropic API credits
(2 Opus 5.5 calls per clip, ~$0.10 each; frame reviews add Sonnet 5.5 calls). On
2026-11-04 the user ruled that all API credit use needs their approval first.
`scripts/ugc-test-clips.mts` reviews automatically, so pass `--skip-review`
unless the user approved the review.

Every new creator video gets a Claude review before the user sees it. Stills
from a quick visual skim are too small to catch drift: on 2026-11-01 a skim
passed all five India–Spain clips, and the clip review then caught Priya's grey
eyes turning brown mid-clip in three of them.

## Steps

1. **Run the review** on each rendered clip's Cloudinary URL (no Hedra credits;
   ~2 Opus calls per clip):

   ```
   npx tsx scripts/review-clip.mts <persona> <cloudinary-video-url> [url2 ...]
   ```

   `persona` is `priya` (global-office) or `suki` (out-of-office).
   `scripts/ugc-test-clips.mts` already runs this review on each clip it
   renders (unless `--skip-review`) and writes
   `reference/ugc-test/clip-reviews/ugc-test-<run>-<label>.json`; for those,
   run `review-clip.mts` only if you need the shareable contact-sheet links.

2. **Check the verdict yourself.** Open the faces sheet
   (`reference/ugc-test/clip-reviews/<clip>-faces.jpg`) with Read for any clip
   with an identity or eyes issue. Confirm the reviewer's claim before
   repeating it. If it's wrong (e.g. a lighting change read as eye colour),
   say so.

3. **Report to the user with links**, never bare local paths (the user can't
   tell samples apart from file names). For each clip give:
   - the clip link (Cloudinary .mp4) and PASS/FAIL with the lowest face match;
   - blocking issues with timestamps, in plain words;
   - the minor issues worth knowing (mirrored/chest-height hands, push-in,
     heavy-lidded moments), briefly;
   - the faces contact-sheet link printed by `review-clip.mts`.

4. **Recommend, don't spend.** For failing clips, recommend what to do (re-render
   on the same frame ~70 Hedra credits, change the performance prompt, or accept)
   and wait for the user's go-ahead. Paid Hedra work always needs explicit
   approval (see memory: feedback_paid_api_spend).

## What blocks a clip

`pass` = every one of the 2 independent review runs passes (lowest faceMatch ≥ 7,
no blocking issue, and her figure matches the sheet's full-body panels).
Borderline clips flip between runs, so a split vote is a FAIL. Blocking: she reads as a
different woman in any still; a distinctive feature changing (light eyes
turning brown, however gradual); a visibly slimmer figure than the sheet; eyes closed with irises mostly hidden across 2+ consecutive stills (heavy
lids alone are minor), malformed hands or face, scene/outfit/
background changing or warping, text appearing. Everything else is minor.

## Notes

- Lip sync can't be judged from stills; say so if the user asks.
- Clips must be on Cloudinary: stills come from its `so_<seconds>` transform
  (no ffmpeg on this machine). Code: `app/lib/social/clip-review.ts`.
- Start frames are reviewed separately before rendering
  (`app/lib/social/frame-identity-review.ts`, `scripts/review-frames.mts`).

- Calibration (2026-11-01, India–Spain clips): the user passed only India
  Do's and failed the hook (slimmer figure, face drift) and the three clips
  whose eyes turn brown. The review matches that; re-check against it if you
  change the prompt.
