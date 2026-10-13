import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Button, Card, PageHeader, inputCls } from "@/components/ui";
import { ScoreBars } from "@/components/score";
import { STAGES, fitIssues, landedEstimate, money, num, pct, roughMargin } from "@/lib/format";
import { scoreParts } from "@/lib/score";

export const metadata: Metadata = { title: "Порівняння товарів" };

const SLOTS = ["a", "b", "c"] as const;

export default async function ComparePage({ searchParams }: PageProps<"/products/compare">) {
  const sp = await searchParams;
  const ids = SLOTS.map((k) => (typeof sp[k] === "string" ? (sp[k] as string) : "")).filter(Boolean);
  const { supabase } = await requireMember();
  const [{ data: all }, { data: picked }, { data: settings }, { data: signals }] = await Promise.all([
    supabase.from("products").select("id, name, score").neq("stage", "rejected").order("score", { ascending: false, nullsFirst: false }),
    ids.length ? supabase.from("products").select("*").in("id", ids) : Promise.resolve({ data: [] as never[] }),
    supabase.from("cost_settings").select("usd_rate").eq("id", 1).single(),
    ids.length ? supabase.from("demand_signals").select("product_id").in("product_id", ids) : Promise.resolve({ data: [] as never[] }),
  ]);
  const rate = Number(settings?.usd_rate ?? 0);
  const rows = ids.map((id) => (picked ?? []).find((p) => p.id === id)).filter(Boolean) as NonNullable<typeof picked>[number][];
  const view = rows.map((p) => {
    const landed = landedEstimate(p, rate);
    const margin = roughMargin(p.price_median_uah, landed);
    const sig = (signals ?? []).filter((s) => s.product_id === p.id).length;
    return { p, landed, margin, sig, fit: fitIssues(p), parts: scoreParts(p, margin, sig) };
  });
  const best = (f: (v: (typeof view)[number]) => number | null, high = true) => {
    const vals = view.map(f).filter((v): v is number => v !== null);
    return vals.length > 1 ? (high ? Math.max(...vals) : Math.min(...vals)) : null;
  };
  const lines: [string, (v: (typeof view)[number]) => React.ReactNode, ((v: (typeof view)[number]) => number | null)?, boolean?][] = [
    ["Оцінка", (v) => v.p.score ?? "—", (v) => v.p.score, true],
    ["Етап", (v) => STAGES[v.p.stage]],
    ["Ціна на ринку", (v) => money(v.p.price_median_uah)],
    ["Собівартість ≈", (v) => money(v.landed), (v) => v.landed, false],
    ["Маржа ≈", (v) => pct(v.margin), (v) => v.margin, true],
    ["Вага, кг", (v) => num(v.p.weight_kg), (v) => (v.p.weight_kg == null ? null : Number(v.p.weight_kg)), false],
    ["MOQ", (v) => v.p.moq ?? "—", (v) => v.p.moq, false],
    ["Конкуренти", (v) => <span className="text-xs">{v.p.sellers ?? "—"}</span>],
    ["Сезон", (v) => v.p.seasonality ?? "—"],
    ["Сигналів попиту", (v) => v.sig, (v) => v.sig, true],
    ["Ризики", (v) => <span className="text-xs">{[...v.fit.block, ...v.fit.warn].join(", ") || "—"}</span>],
  ];

  return (
    <div className="space-y-4">
      <div className="text-xs"><Link href="/products" className="text-zinc-500 hover:underline">← Товари</Link></div>
      <PageHeader title="Порівняння товарів" subtitle="Обери 2–3 товари: зелене — найкраще значення в рядку." />
      <Card>
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          {SLOTS.map((k, i) => (
            <select key={k} name={k} defaultValue={ids[i] ?? ""} className={inputCls}>
              <option value="">— товар {i + 1} —</option>
              {(all ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.score != null ? ` · ${p.score}` : ""}</option>)}
            </select>
          ))}
          <Button>Порівняти</Button>
        </form>
      </Card>

      {view.length > 0 && (
        <Card pad={false} className="p-2 sm:p-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="w-32 p-2" />
                  {view.map((v) => (
                    <th key={v.p.id} className="p-2 align-top font-semibold">
                      <Link href={`/products/${v.p.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">{v.p.name}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.06] dark:divide-white/5">
                {lines.map(([label, show, metric, high]) => {
                  const top = metric ? best(metric, high) : null;
                  return (
                    <tr key={label}>
                      <td className="p-2 text-xs text-zinc-500">{label}</td>
                      {view.map((v) => (
                        <td key={v.p.id} className={`p-2 tabular-nums ${top !== null && metric?.(v) === top ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}>{show(v)}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td className="p-2 align-top text-xs text-zinc-500">Складники</td>
                  {view.map((v) => <td key={v.p.id} className="p-2 align-top"><ScoreBars parts={v.parts} /></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
