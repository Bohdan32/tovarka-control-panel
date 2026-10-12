-- is_member() лише для залогінених; у політиках обгортаємо в select, щоб рахувалось раз на запит.
revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

alter policy "members read" on public.members using ((select public.is_member()));
alter policy "members all" on public.cost_settings using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.fx_rates using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.products using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.demand_signals using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.competitor_prices using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.suppliers using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.offers using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.inventory_batches using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.orders using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.ad_campaigns using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.marketing_assets using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.transactions using ((select public.is_member())) with check ((select public.is_member()));
alter policy "members all" on public.analyst_reports using ((select public.is_member())) with check ((select public.is_member()));
