-- Навігатор, банк товарів, гайд «Як продавати» і готові тексти.

-- Кроки плану: навіщо і що отримаєш — для навігатора на головній.
alter table public.playbook_steps
  add column if not exists why text,
  add column if not exists result text;

-- Задачі: скільки часу займе і як зробити коротко.
alter table public.tasks
  add column if not exists minutes int check (minutes > 0);

-- Банк товарів: ринкові ціни, ціна в Китаї, сезон і де продавати.
alter table public.products
  add column if not exists price_min_uah numeric(10,2),
  add column if not exists price_median_uah numeric(10,2),
  add column if not exists price_max_uah numeric(10,2),
  add column if not exists cost_min_usd numeric(10,2),
  add column if not exists cost_max_usd numeric(10,2),
  add column if not exists moq int,
  add column if not exists sellers text,
  add column if not exists stock_by date,
  add column if not exists where_to_sell text,
  add column if not exists ad_angle text,
  add column if not exists in_test_at timestamptz;

-- Гайди: розділи «Як продавати», які аналітик може оновлювати.
create table if not exists public.guides (
  slug text primary key,
  title text not null,
  summary text,
  body text not null default '',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger guides_touch before update on public.guides
  for each row execute function public.touch_updated_at();

-- Готові тексти: відповіді в чат, картки, реклама.
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('chat','listing','ad','insert')),
  title text not null,
  body text not null,
  product_id uuid references public.products(id) on delete cascade,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists templates_product_idx on public.templates(product_id);

alter table public.guides enable row level security;
alter table public.templates enable row level security;
create policy "members all" on public.guides for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "members all" on public.templates for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
