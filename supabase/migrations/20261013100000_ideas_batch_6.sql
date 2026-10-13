-- Пачка ідей 6: трекер партії, прохання про відгук, питання аналітику з пульта.

-- Детальний етап партії: paid → china_wh → transit → customs → fulfillment (status лишається для складу).
alter table public.inventory_batches add column if not exists stage text not null default 'paid';
alter table public.inventory_batches add column if not exists eta_on date;
alter table public.inventory_batches add column if not exists tracking text;

-- Коли посилку отримали і коли попросили відгук.
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists review_asked_at timestamptz;

-- Записи з kind = 'question' — питання аналітику; він відповідає в answer під час ранкового запуску.
alter table public.inbox add column if not exists answer text;
alter table public.inbox add column if not exists answered_at timestamptz;
