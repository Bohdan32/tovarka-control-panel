# Товарка — пульт керування

Next.js + Supabase, деплой на Vercel (проєкт `tovarka-control-panel`).

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
