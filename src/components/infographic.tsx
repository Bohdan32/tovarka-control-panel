"use client";

import { useEffect, useRef, useState } from "react";
import { inputCls } from "@/components/ui";

const SIZE = 1200;
const ACCENTS = ["#4f46e5", "#059669", "#dc2626", "#ea580c", "#0f172a"];

// Перше фото для Prom/OLX: товар на білому, 3 переваги і ціна. Усе малюється в браузері, нікуди не вантажиться.
export function Infographic() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [title, setTitle] = useState("Органайзер для взуття");
  const [points, setPoints] = useState(["Вміщує 6 пар", "Складається за 10 секунд", "Не пахне, щільна тканина"]);
  const [price, setPrice] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Товар праворуч, переваги ліворуч: так око спершу бачить товар, потім читає.
    const box = { x: 470, y: 170, w: 690, h: 900 };
    if (img) {
      const k = Math.min(box.w / img.width, box.h / img.height);
      const w = img.width * k, h = img.height * k;
      ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    } else {
      ctx.fillStyle = "#f4f4f5";
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "500 36px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Завантаж фото товару", box.x + box.w / 2, box.y + box.h / 2);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "#18181b";
    ctx.font = "800 64px system-ui, sans-serif";
    wrap(ctx, title, 60, 110, 1080, 70, 2);

    let y = 290;
    ctx.font = "700 42px system-ui, sans-serif";
    for (const p of points.filter(Boolean)) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(90, y - 12, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(77, y - 12);
      ctx.lineTo(87, y - 1);
      ctx.lineTo(105, y - 24);
      ctx.stroke();
      ctx.fillStyle = "#27272a";
      y = wrap(ctx, p, 135, y, 305, 50, 3) + 80;
    }

    if (price.trim()) {
      ctx.fillStyle = accent;
      roundRect(ctx, 60, 1040, 340, 110, 24);
      ctx.fillStyle = "#fff";
      ctx.font = "800 60px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${price.trim()} грн`, 230, 1117);
      ctx.textAlign = "left";
    }
  }, [img, title, points, price, accent]);

  const load = (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = canvas.current!.toDataURL("image/png");
    a.download = "pershe-foto.png";
    a.click();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2.5">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Фото товару (краще вже без фону)</span>
          <input type="file" accept="image/*" onChange={(e) => load(e.target.files?.[0])} className="block w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Назва</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>
        {points.map((p, i) => (
          <label key={i} className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Перевага {i + 1}</span>
            <input value={p} onChange={(e) => setPoints(points.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
          </label>
        ))}
        <div className="flex items-end gap-2">
          <label className="block flex-1 text-sm">
            <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Ціна (порожньо — без ціни)</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className={inputCls} />
          </label>
          <div className="flex gap-1 pb-1.5">
            {ACCENTS.map((c) => (
              <button key={c} type="button" onClick={() => setAccent(c)} aria-label={`Колір ${c}`} className={`size-7 rounded-full ring-offset-2 ${accent === c ? "ring-2 ring-zinc-400" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        <button type="button" onClick={download} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">Завантажити PNG 1200×1200</button>
        <p className="text-xs text-zinc-500">
          Фон прибери безкоштовно в <a href="https://www.remove.bg/uk" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">remove.bg</a> або
          {" "}<a href="https://www.photoroom.com/tools/background-remover" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">Photoroom</a>, потім завантаж сюди PNG.
          Переваги — не «якісний», а цифри й результат: «6 пар», «за 10 секунд». На Rozetka перше фото має бути без тексту — там використовуй інфографіку другим фото.
        </p>
      </div>
      <canvas ref={canvas} width={SIZE} height={SIZE} className="w-full rounded-lg border border-black/10 dark:border-white/10" />
    </div>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number, maxLines: number) {
  const words = text.split(/\s+/);
  let cur = "";
  let n = 0;
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > max && cur) {
      ctx.fillText(cur, x, y);
      y += line;
      cur = w;
      if (++n >= maxLines - 1) break;
    } else cur = test;
  }
  if (cur) ctx.fillText(cur, x, y);
  return y;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
