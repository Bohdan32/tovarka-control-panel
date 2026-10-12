-- Товарка: основна схема (етапи 0–3)

create extension if not exists pg_cron;
create extension if not exists http with schema extensions;

-- ---------- Доступ ----------
create table public.members (
  email text primary key,
  display_name text not null,
  share_pct numeric(5,2) not null default 100 check (share_pct between 0 and 100),
  created_at timestamptz not null default now()
);

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Реєстрація лише для email зі списку members; такі акаунти підтверджуються одразу.
create or replace function public.guard_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.members m where lower(m.email) = lower(new.email)) then
    raise exception 'Цей email не має доступу до Товарки';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

create trigger guard_new_user
  before insert on auth.users
  for each row execute function public.guard_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Налаштування розрахунку ----------
create table public.cost_settings (
  id int primary key default 1 check (id = 1),
  usd_rate numeric(10,4) not null default 41.5,
  usd_rate_date date,
  cargo_usd_per_kg numeric(10,2) not null default 5,
  packaging_uah numeric(10,2) not null default 15,
  fee_pct numeric(5,4) not null default 0.02,
  target_margin numeric(5,4) not null default 0.30,
  refusal_rate numeric(5,4) not null default 0.15,
  return_shipping_uah numeric(10,2) not null default 80,
  default_cpa_uah numeric(10,2) not null default 120,
  updated_at timestamptz not null default now()
);
insert into public.cost_settings (id) values (1);

create table public.fx_rates (
  currency text not null,
  rate numeric(12,4) not null,
  rate_date date not null,
  primary key (currency, rate_date)
);

-- ---------- Товари і попит ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  stage text not null default 'idea'
    check (stage in ('idea','demand','sourcing','economics','test','selling','paused','rejected')),
  score int check (score between 0 and 100),
  weight_kg numeric(8,3),
  target_price_uah numeric(10,2),
  planned_cpa_uah numeric(10,2),
  source_url text,
  notes text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create table public.demand_signals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source text not null,
  metric text not null,
  value numeric,
  note text,
  observed_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.demand_signals (product_id);

create table public.competitor_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  marketplace text not null,
  price_uah numeric(10,2) not null check (price_uah > 0),
  seller text,
  url text,
  observed_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.competitor_prices (product_id);

-- ---------- Постачальники ----------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'CN',
  platform text,
  contact text,
  url text,
  rating numeric(3,1),
  notes text,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  unit_price_usd numeric(10,2) not null check (unit_price_usd >= 0),
  china_shipping_usd numeric(10,2) not null default 0,
  weight_kg numeric(8,3),
  moq int,
  lead_days int,
  url text,
  notes text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.offers (product_id);
create index on public.offers (supplier_id);

-- ---------- Продажі ----------
create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  qty int not null check (qty > 0),
  total_cost_uah numeric(12,2) not null default 0,
  status text not null default 'ordered' check (status in ('ordered','in_transit','arrived')),
  ordered_on date not null default current_date,
  arrived_on date,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.inventory_batches (product_id);
create index on public.inventory_batches (offer_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  customer_name text,
  phone text,
  city text,
  qty int not null default 1 check (qty > 0),
  price_uah numeric(10,2) not null,
  status text not null default 'new'
    check (status in ('new','confirmed','shipped','delivered','refused','returned','cancelled')),
  ttn text,
  channel text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (product_id);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  channel text not null,
  name text,
  status text not null default 'active' check (status in ('draft','active','stopped')),
  started_on date not null default current_date,
  spend_uah numeric(12,2) not null default 0,
  orders_count int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.ad_campaigns (product_id);

create table public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  kind text not null check (kind in ('landing','ad_text','account','creative')),
  title text not null,
  url text,
  content text,
  status text not null default 'draft' check (status in ('draft','approved','live')),
  created_at timestamptz not null default now()
);
create index on public.marketing_assets (product_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('investment','purchase','ads','delivery','revenue','withdrawal','other')),
  amount_uah numeric(12,2) not null check (amount_uah > 0),
  member_email text,
  product_id uuid references public.products(id) on delete set null,
  note text,
  happened_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.transactions (product_id);

-- ---------- Аналітик ----------
create table public.analyst_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null default current_date,
  role text not null default 'lead'
    check (role in ('lead','scout','sourcer','finance','marketing','auditor')),
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info','attention','critical')),
  product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.analyst_reports (report_date desc);

-- ---------- Розрахунки ----------
create view public.offer_economics with (security_invoker = true) as
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
         s.fee_pct, s.target_margin,
         m.market_median_uah, coalesce(m.market_count, 0) as market_count
  from public.offers o
  join public.products p on p.id = o.product_id
  left join public.suppliers sup on sup.id = o.supplier_id
  left join market m on m.product_id = o.product_id
  cross join s
),
priced as (
  select b.*,
         round((b.landed_cost_uah + b.cpa_uah + b.refusal_reserve_uah)
               / nullif(1 - b.target_margin - b.fee_pct, 0), 0) as recommended_price_uah
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

create view public.product_stock with (security_invoker = true) as
select p.id as product_id, p.name,
       coalesce((select sum(b.qty) from public.inventory_batches b
                 where b.product_id = p.id and b.status = 'arrived'), 0)
     - coalesce((select sum(o.qty) from public.orders o
                 where o.product_id = p.id and o.status in ('confirmed','shipped','delivered')), 0)
       as in_stock,
       coalesce((select sum(b.qty) from public.inventory_batches b
                 where b.product_id = p.id and b.status in ('ordered','in_transit')), 0) as incoming
from public.products p;

create view public.campaign_performance with (security_invoker = true) as
select c.*, p.name as product_name,
       round(c.spend_uah / nullif(c.orders_count, 0), 2) as cpa_uah,
       (select max(e.cpa_max_uah) from public.offer_economics e
         where e.product_id = c.product_id and e.is_selected) as cpa_max_uah
from public.ad_campaigns c
join public.products p on p.id = c.product_id;

-- ---------- Курс НБУ ----------
create or replace function public.refresh_nbu_rates()
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  resp extensions.http_response;
  item jsonb;
  usd numeric;
  usd_date date;
begin
  if auth.uid() is not null and not public.is_member() then
    raise exception 'Немає доступу';
  end if;

  select * into resp
  from extensions.http_get('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
  if resp.status <> 200 then
    raise exception 'НБУ відповів статусом %', resp.status;
  end if;

  for item in select * from jsonb_array_elements(resp.content::jsonb) loop
    if item ->> 'cc' in ('USD','EUR','CNY') then
      insert into public.fx_rates (currency, rate, rate_date)
      values (item ->> 'cc', (item ->> 'rate')::numeric, to_date(item ->> 'exchangedate', 'DD.MM.YYYY'))
      on conflict (currency, rate_date) do update set rate = excluded.rate;
      if item ->> 'cc' = 'USD' then
        usd := (item ->> 'rate')::numeric;
        usd_date := to_date(item ->> 'exchangedate', 'DD.MM.YYYY');
      end if;
    end if;
  end loop;

  if usd is not null then
    update public.cost_settings
       set usd_rate = usd, usd_rate_date = usd_date, updated_at = now()
     where id = 1;
  end if;
  return usd;
end;
$$;

revoke execute on function public.refresh_nbu_rates() from public, anon;
grant execute on function public.refresh_nbu_rates() to authenticated;
revoke execute on function public.guard_new_user() from public, anon, authenticated;

select cron.schedule('nbu-rates-daily', '0 4 * * *', $$select public.refresh_nbu_rates()$$);

-- ---------- RLS: лише учасники ----------
alter table public.members enable row level security;
create policy "members read" on public.members for select to authenticated using (public.is_member());

do $$
declare t text;
begin
  foreach t in array array['cost_settings','fx_rates','products','demand_signals','competitor_prices',
                           'suppliers','offers','inventory_batches','orders','ad_campaigns',
                           'marketing_assets','transactions','analyst_reports']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members all" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;
