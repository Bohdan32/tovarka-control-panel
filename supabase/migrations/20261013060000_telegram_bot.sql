-- Telegram-бот: налаштування, стан розмов, нотатки власника, щоденне зведення.
-- Сам бот — Edge Function `telegram` (supabase/functions/telegram), сайт за Vercel-захистом.

create table if not exists public.bot_settings (
  id smallint primary key default 1 check (id = 1),
  token text,
  bot_username text,
  webhook_secret text,
  link_code text,
  owner_chat_id bigint,
  daily_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.bot_settings (id) values (1) on conflict do nothing;
create trigger bot_settings_touch before update on public.bot_settings
  for each row execute function public.touch_updated_at();
alter table public.bot_settings enable row level security;
create policy "members all" on public.bot_settings for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

-- Покупець посеред оформлення: який крок і що вже ввів.
create table if not exists public.bot_sessions (
  chat_id bigint primary key,
  step text,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.bot_sessions enable row level security;
create policy "members all" on public.bot_sessions for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

-- Швидкі записи власника з бота або з сайту: думка, витрата, задача, голосове.
create table if not exists public.inbox (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  kind text not null default 'note',
  source text not null default 'site',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.inbox enable row level security;
create policy "members all" on public.inbox for all to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

-- Щоденне зведення: pg_cron смикає бота, а той сам збирає задачі, посилки й дедлайни.
create or replace function public.bot_daily_ping()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.bot_settings;
begin
  select * into s from public.bot_settings where id = 1;
  if s.token is null or s.owner_chat_id is null or not s.daily_enabled then
    return;
  end if;
  perform extensions.http((
    'POST',
    'https://nnhbhxvuaudueplijwhs.supabase.co/functions/v1/telegram?job=daily',
    array[extensions.http_header('x-job-secret', s.webhook_secret)],
    'application/json',
    '{}'
  )::extensions.http_request);
end $$;
revoke execute on function public.bot_daily_ping() from public, anon, authenticated;

-- 06:00 UTC = 9:00 за Києвом влітку, 8:00 взимку.
select cron.schedule('tovarka-bot-daily', '0 6 * * *', $$ select public.bot_daily_ping(); $$);
