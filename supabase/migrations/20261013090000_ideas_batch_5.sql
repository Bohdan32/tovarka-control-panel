-- Пачка ідей 5: чекліст якості картки товару.
alter table public.products add column if not exists listing_check text[] not null default '{}';
