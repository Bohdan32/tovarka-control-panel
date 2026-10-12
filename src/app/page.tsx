import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

async function checkSupabase() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return { ok: false, detail: "Не задані змінні середовища Supabase" };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: "Підключено" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Помилка" };
  }
}

async function DbStatus() {
  const status = await checkSupabase();

  return (
    <div className="mt-4 flex items-center gap-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${status.ok ? "bg-green-500" : "bg-red-500"}`}
      />
      <span>База даних (Supabase): {status.detail}</span>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Товарка</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Пульт керування</p>
      </header>

      <section className="rounded-xl border border-black/10 p-6 dark:border-white/15">
        <h2 className="text-lg font-medium">Стан системи</h2>
        <Suspense fallback={<p className="mt-4 text-zinc-500">Перевіряю…</p>}>
          <DbStatus />
        </Suspense>
      </section>
    </main>
  );
}
