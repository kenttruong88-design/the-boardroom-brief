-- Adds the final compiled-video URL to ugc_video_queue. Set once all clips
-- reach "complete" — a hard-cut splice (see buildSplicedVideoUrl() in
-- ugc-video-generator.ts) of the 5 clips in order, with the persona's shared
-- outro clip appended. AI bridge transitions were evaluated but not adopted
-- as the default (they cost 4 extra Hedra generations per video and the
-- budget doesn't support that right now) — buildSplicedVideoUrl still
-- supports bridges for a future run if that changes.

alter table public.ugc_video_queue
  add column if not exists compiled_video_url text;
