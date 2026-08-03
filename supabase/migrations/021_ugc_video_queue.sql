-- Tracks Claude-orchestrated creator-style avatar videos (see app/lib/social/ugc-*).
-- Each video is generated as a SEQUENCE of clips (hook, then each country's
-- Do's and Don's as SEPARATE clips: country_a_dos, country_a_donts,
-- country_b_dos, country_b_donts) rather than one long clip per country —
-- a distinct start frame per beat, ~8-13s each. Split this granularly
-- (rather than one combined Do's+Don'ts clip per country) because a direct
-- comparison showed together/hedra-character-3's lip-sync holds tight on
-- short ~8-13s clips but visibly drifts on long ~25s ones.
-- `clips` holds one JSON object per clip, in order:
--   { label, script, scene, captions, scene_image_asset_id,
--     audio_asset_id, hedra_generation_id, video_url, cloudinary_public_id,
--     status, error }
-- `scene` is a short visual-scene description Claude writes per clip, used to
-- generate a distinct start-frame image per clip (same identity, different
-- pose/setting) via image-to-image — see generateSceneImage() in
-- hedra-client.ts. Without this all 5 clips would open on the same static
-- shot. `captions` (country_a_dos/country_a_donts/country_b_dos/
-- country_b_donts only) is a flat array of strings, one per Do (or Don't)
-- actually spoken (2-3) — since each clip is now single-category, captions
-- render as a single-color stacked list (green DO bars, or red DON'T bars)
-- rather than a two-column table — see buildCaptionedVideoUrl() in
-- ugc-video-generator.ts. Video duration is sized dynamically to the actual
-- narration length (see generateNarration()'s durationMs), not a fixed
-- guess, so a script running long doesn't get cut off mid-sentence. The 5
-- per-article clips have NO call-to-action — a shared closing clip
-- (generated once per persona, see outro-clip.ts /
-- persona.outroCloudinaryPublicId in creator-personas.ts) is appended to
-- every video instead and directs viewers to the site. Clips are compiled
-- into one video via buildSplicedVideoUrl() (hard cut) or with 4 additional
-- AI "bridge" transition clips spliced in between (see submitTransitionClip())
-- — both approaches are available; no single default is picked yet.
-- status per clip: pending | generating_audio | generating_video | complete | failed

create table if not exists public.ugc_video_queue (
  id                uuid default gen_random_uuid() primary key,

  article_id        text not null,
  article_slug      text not null,
  article_headline  text not null,
  article_url       text not null,
  pillar            text,

  persona_key       text not null,
  persona_name      text not null,

  clips             jsonb not null default '[]'::jsonb,

  status            text not null default 'pending_approval'
                       check (status in (
                         'pending_approval', 'rejected', 'approved',
                         'generating', 'complete', 'failed'
                       )),

  created_at        timestamptz not null default now(),
  approved_at       timestamptz,
  completed_at      timestamptz
);

alter table public.ugc_video_queue enable row level security;

create policy "Service role only"
  on public.ugc_video_queue
  using (false);

create index if not exists ugc_video_queue_status_idx  on public.ugc_video_queue(status);
create index if not exists ugc_video_queue_article_idx on public.ugc_video_queue(article_id);
