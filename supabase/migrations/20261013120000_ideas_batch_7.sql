-- Пачка ідей 7: розбір тесту, журнал креативів, повторні продажі, комплекти, історія змін, міні-уроки.

-- Розбір після 14 днів тесту: висновок і урок для наступного товару.
alter table public.products add column if not exists test_verdict text;
alter table public.products add column if not exists test_lesson text;
-- Пари для комплекту, які знайшов аналітик.
alter table public.products add column if not exists bundle_with text;

-- Журнал креативів: що саме крутили і скільки кліків дало.
alter table public.ad_campaigns add column if not exists creative text;
alter table public.ad_campaigns add column if not exists clicks integer;

-- Повторні продажі: коли написали покупцю через 30–60 днів.
alter table public.orders add column if not exists repeat_sent_at timestamptz;

-- Міні-урок до кроку плану: типові помилки новачка.
alter table public.playbook_steps add column if not exists mistakes text;

-- Історія змін: хто, що і коли змінив у пульті.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who text,
  tbl text not null,
  op text not null,
  row_id text,
  label text
);
alter table public.audit_log enable row level security;
create policy "members read" on public.audit_log for select to authenticated using ((select public.is_member()));

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (who, tbl, op, row_id, label)
  values (
    coalesce(auth.jwt() ->> 'email', 'система'),
    tg_table_name,
    lower(tg_op),
    r ->> 'id',
    left(coalesce(r ->> 'name', r ->> 'title', r ->> 'customer_name', r ->> 'note', r ->> 'body', ''), 120)
  );
  return null;
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;

create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit_row();
create trigger audit_orders after insert or update or delete on public.orders for each row execute function public.audit_row();
create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function public.audit_row();
create trigger audit_batches after insert or update or delete on public.inventory_batches for each row execute function public.audit_row();
create trigger audit_tasks after insert or update or delete on public.tasks for each row execute function public.audit_row();
create trigger audit_campaigns after insert or update or delete on public.ad_campaigns for each row execute function public.audit_row();
create trigger audit_settings after update on public.cost_settings for each row execute function public.audit_row();
