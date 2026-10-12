# Товарка — пульт керування

Закрита панель для товарного бізнесу (Китай → Україна): товари і попит, постачальники, калькулятор ціни й маржі,
інвестиції, маркетинг, замовлення, склад, фінанси і щоденний Claude-аналітик.
Next.js + Supabase, деплой на Vercel (проєкт `tovarka-control-panel`).

## Як це влаштовано

- **Доступ.** Вхід email + пароль (Supabase Auth). Акаунт можна створити лише для email із таблиці `members`
  (тригер `guard_new_user`), усі таблиці закриті RLS через `is_member()`. Щоб додати партнера:
  `insert into members (email, display_name, share_pct) values (...)`.
- **Розрахунки** живуть у базі: представлення `offer_economics` (собівартість, рекомендована ціна, маржа, CPA max,
  фільтр «проходить»), `product_stock`, `campaign_performance`. Параметри — таблиця `cost_settings` (сторінка «Налаштування»).
- **Курс НБУ** оновлює `pg_cron` щодня о 04:00 UTC (`refresh_nbu_rates()`), без токенів і без зовнішніх сервісів.
- **Аналітик** — щоденна рутина Claude за інструкцією [`analyst/ROUTINE.md`](analyst/ROUTINE.md); пише в `analyst_reports`.
- **Міграції** — `supabase/migrations/`.

## Локальний запуск

```bash
cp .env.example .env.local   # і впиши значення
npm install
npm run dev
```

## Змінні середовища

| Змінна | Опис |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL проєкту Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key Supabase |

На Vercel вони вже задані для всіх середовищ.

## Деплой

Кожен пуш у `main` автоматично деплоїться на Vercel у продакшн, інші гілки дають preview.
