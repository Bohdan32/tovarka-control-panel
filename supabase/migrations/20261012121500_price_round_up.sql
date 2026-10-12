-- Рекомендовану ціну округлюємо вгору, щоб маржа не падала нижче цілі через округлення.
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

