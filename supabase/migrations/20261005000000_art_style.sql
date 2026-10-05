-- Puzzles can now show the original photo (default) or a pixel-art / brick version.
-- Photo challenges store no mosaic.
alter table public.challenges
  add column if not exists style text not null default 'brick' check (style in ('photo', 'pixel', 'brick'));
alter table public.challenges alter column style set default 'photo';
alter table public.challenges alter column mosaic drop not null;
