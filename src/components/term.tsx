"use client";

import { useEffect, useState } from "react";

export function Term({ word, meaning }: { word: string; meaning: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, { passive: true, once: true });
    return () => window.removeEventListener("scroll", close);
  }, [pos]);
  // Підказка фіксована на екрані й не вилазить за край телефона.
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (pos) return setPos(null);
    const r = e.currentTarget.getBoundingClientRect();
    const width = Math.min(256, window.innerWidth - 16);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 4 });
  };
  return (
    <span>
      <button type="button" onClick={toggle} onBlur={() => setPos(null)}
        className="cursor-help underline decoration-indigo-400/70 decoration-dotted underline-offset-2">
        {word}
      </button>
      {pos && (
        <span role="tooltip" style={pos} className="fixed z-50 block w-64 max-w-[calc(100vw-1rem)] rounded-lg border border-black/10 bg-white p-2.5 text-xs font-normal leading-snug text-zinc-700 shadow-lg dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
          <b className="font-semibold">{word}</b> — {meaning}
        </span>
      )}
    </span>
  );
}
