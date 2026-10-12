"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const params = useSearchParams();
  const noAccess = params.get("error") === "no-access";
  const error = state.error ?? (noAccess ? "Цей акаунт не має доступу до Товарки" : undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Email</span>
        <input name="email" type="email" required autoComplete="email"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-zinc-950" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Пароль</span>
        <input name="password" type="password" required minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-zinc-950" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Зачекай…" : mode === "signin" ? "Увійти" : "Створити пароль і увійти"}
      </button>
      <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        {mode === "signin" ? "Перший вхід? Створи пароль" : "Вже маю пароль"}
      </button>
    </form>
  );
}
