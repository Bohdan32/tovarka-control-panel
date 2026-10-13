-- Пачка ідей 8: трекер органічних відео (TikTok 30 відео за 30 днів).
create table if not exists public.organic_posts (
  id uuid primary key default gen_random_uuid(),
  posted_on date not null default current_date,
  platform text not null default 'TikTok',
  product_id uuid references public.products(id) on delete set null,
  hook text,
  url text,
  views integer,
  clicks integer,
  orders integer,
  created_at timestamptz not null default now()
);
alter table public.organic_posts enable row level security;
create policy "members all" on public.organic_posts for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
