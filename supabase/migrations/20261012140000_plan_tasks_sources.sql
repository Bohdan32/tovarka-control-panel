-- План запуску, задачі, база джерел, глибша оцінка товарів і податки в розрахунку ціни.

-- ---------- План запуску ----------
create table public.playbook_steps (
  id uuid primary key default gen_random_uuid(),
  n int not null unique,
  title text not null,
  goal text,
  body text,
  cost_min_uah numeric(12,2),
  cost_max_uah numeric(12,2),
  days_min int,
  days_max int,
  updated_at timestamptz not null default now()
);
create trigger playbook_steps_touch before update on public.playbook_steps
  for each row execute function public.touch_updated_at();

-- ---------- Задачі ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  step_id uuid references public.playbook_steps(id) on delete set null,
  product_id uuid references public.products(id) on delete cascade,
  title text not null,
  details text,
  status text not null default 'todo' check (status in ('todo','doing','done','skipped')),
  priority int not null default 2 check (priority between 1 and 3),
  due_on date,
  cost_uah numeric(12,2),
  sort int not null default 0,
  source text not null default 'manual' check (source in ('manual','plan','analyst')),
  done_at timestamptz,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks (step_id);
create index on public.tasks (product_id);
create index on public.tasks (status);
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ---------- База джерел ----------
create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null,
  publisher text,
  kind text not null default 'other'
    check (kind in ('official','marketplace','trends','media','supplier','logistics','community','other')),
  topic text not null default 'попит',
  reliability int check (reliability between 1 and 5),
  finding text,
  product_id uuid references public.products(id) on delete set null,
  published_on date,
  checked_on date not null default current_date,
  created_by text default coalesce(auth.jwt() ->> 'email', 'analyst'),
  created_at timestamptz not null default now()
);
create index on public.research_sources (product_id);
create index on public.research_sources (topic);

-- ---------- Глибша оцінка товару ----------
alter table public.products
  add column thesis text,
  add column risks text,
  add column kill_criteria text,
  add column seasonality text,
  add column confidence int check (confidence between 0 and 100),
  add column next_review_on date;

-- ---------- Податки ФОП у ціні ----------
-- 5% єдиний податок + 1% військовий збір рахуються від ціни, як і комісія.
alter table public.cost_settings add column tax_pct numeric(5,4) not null default 0.06;

create or replace view public.offer_economics with (security_invoker = true) as
with s as (select * from public.cost_settings where id = 1),
market as (
  select product_id,
         percentile_cont(0.5) within group (order by price_uah) as market_median_uah,
         count(*) as market_count
  from public.competitor_prices
  where observed_on >= current_date - 60
  group by product_id
),
base as (
  select o.id as offer_id, o.product_id, o.supplier_id, o.is_selected,
         p.name as product_name, p.stage, p.target_price_uah,
         sup.name as supplier_name,
         o.unit_price_usd, o.china_shipping_usd, o.moq, o.lead_days,
         coalesce(o.weight_kg, p.weight_kg, 0) as weight_kg,
         round((o.unit_price_usd + o.china_shipping_usd
                + coalesce(o.weight_kg, p.weight_kg, 0) * s.cargo_usd_per_kg) * s.usd_rate
               + s.packaging_uah, 2) as landed_cost_uah,
         coalesce(p.planned_cpa_uah, s.default_cpa_uah) as cpa_uah,
         round(s.refusal_rate * s.return_shipping_uah, 2) as refusal_reserve_uah,
         -- fee_pct = комісії + податки: усе, що забирається відсотком від ціни.
         (s.fee_pct + s.tax_pct)::numeric(5,4) as fee_pct,
         s.target_margin,
         m.market_median_uah, coalesce(m.market_count, 0) as market_count
  from public.offers o
  join public.products p on p.id = o.product_id
  left join public.suppliers sup on sup.id = o.supplier_id
  left join market m on m.product_id = o.product_id
  cross join s
),
priced as (
  select b.*,
         ceil((b.landed_cost_uah + b.cpa_uah + b.refusal_reserve_uah)
              / nullif(1 - b.target_margin - b.fee_pct, 0)) as recommended_price_uah
  from base b
),
final as (
  select pr.*,
         coalesce(pr.target_price_uah, pr.recommended_price_uah) as price_uah
  from priced pr
)
select f.*,
       round(f.price_uah * (1 - f.fee_pct) - f.landed_cost_uah - f.cpa_uah - f.refusal_reserve_uah, 2)
         as profit_per_sale_uah,
       round((f.price_uah * (1 - f.fee_pct) - f.landed_cost_uah - f.cpa_uah - f.refusal_reserve_uah)
             / nullif(f.price_uah, 0), 4) as margin,
       round(f.price_uah * (1 - f.fee_pct) - f.landed_cost_uah - f.refusal_reserve_uah, 2) as cpa_max_uah,
       (
         (f.price_uah * (1 - f.fee_pct) - f.landed_cost_uah - f.cpa_uah - f.refusal_reserve_uah)
           / nullif(f.price_uah, 0) >= f.target_margin
         and (f.market_median_uah is null or f.price_uah <= f.market_median_uah)
       ) as passes
from final f;

-- ---------- RLS ----------
alter table public.playbook_steps enable row level security;
alter table public.tasks enable row level security;
alter table public.research_sources enable row level security;
create policy "members all" on public.playbook_steps for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "members all" on public.tasks for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "members all" on public.research_sources for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
