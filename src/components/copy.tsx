"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
        done ? "border-emerald-500 text-emerald-600" : "border-black/15 text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-white/15 dark:text-zinc-300"
      }`}
    >
      {done ? "Скопійовано" : "Копіювати"}
    </button>
  );
}
