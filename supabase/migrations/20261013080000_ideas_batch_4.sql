-- Пачка ідей 4: ліміт ризику на один товар і строк доставки партії для точки дозамовлення.
alter table public.cost_settings add column if not exists risk_limit_uah numeric(12,2) not null default 15000;
alter table public.cost_settings add column if not exists lead_days int not null default 55;
