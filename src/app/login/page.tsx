import { Suspense } from "react";
import { LogoMark } from "@/components/icons";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-black/[.07] bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-zinc-900">
        <LogoMark className="size-11" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Товарка</h1>
        <p className="mb-6 mt-1 text-sm text-zinc-500">Пульт керування. Вхід лише для своїх.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
