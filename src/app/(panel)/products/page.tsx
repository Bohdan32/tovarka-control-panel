import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createProduct, rejectIdea, startTest } from "../actions";
import { AddForm, Badge, Button, Field, FormGrid, PageHeader, Pills, Progress, Stat, Stats, TextArea } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm";
import { NOT_FOR_US, STAGES, date, daysUntil, fitIssues, landedEstimate, money, pct, roughMargin } from "@/lib/format";

export const metadata: Metadata = { title: "Банк товарів" };

const RAIL_DAYS = 55; // зразки + виробництво + залізниця до складу

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function orderBy(stockBy: string | null) {
  if (!stockBy) return null;
  const d = new Date(stockBy);
  d.setDate(d.getDate() - RAIL_DAYS);
  return d.toISOString().slice(0, 10);
}

function Deadline({ stockBy }: { stockBy: string | null }) {
  const by = orderBy(stockBy);
  if (!by) return <Badge tone="green">цілий рік</Badge>;
  const left = daysUntil(by) ?? 0;
  if (left < 0) {
    const air = daysUntil(stockBy) ?? 0;
    return <Badge tone={air > 30 ? "amber" : "red"}>{air > 30 ? `лише авіа, склад до ${date(stockBy)}` : "сезон уже не встигнути"}</Badge>;
  }
  return <Badge tone={left <= 14 ? "amber" : "blue"}>замовити за {left} дн.</Badge>;
}

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { f } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data }, { data: sources }, { data: settings }] = await Promise.all([
    supabase.from("products").select("*").order("score", { ascending: false, nullsFirst: false }),
    supabase.from("research_sources").select("product_id, url, title, publisher").not("product_id", "is", null),
    supabase.from("cost_settings").select("usd_rate").eq("id", 1).single(),
  ]);
  const rate = Number(settings?.usd_rate ?? 0);
  const all = (data ?? []) as P[];
  const blocked = (p: P) => fitIssues(p).block.length > 0 && ["idea", "demand"].includes(p.stage);
  const live = all.filter((p) => p.stage !== "rejected" && !blocked(p));
  const seasonal = live.filter((p) => p.stock_by);
  const filters: Record<string, (p: P) => boolean> = {
    "": (p) => p.stage !== "rejected" && !blocked(p),
    season: (p) => p.stage !== "rejected" && !blocked(p) && !!p.stock_by,
    year: (p) => p.stage !== "rejected" && !blocked(p) && !p.stock_by,
    unfit: (p) => p.stage !== "rejected" && blocked(p),
    test: (p) => !["idea", "rejected", "paused"].includes(p.stage),
    rejected: (p) => p.stage === "rejected",
  };
  const key = typeof f === "string" && f in filters ? f : "";
  const rows = all.filter(filters[key]);
  const srcFor = (id: string) => (sources ?? []).filter((s) => s.product_id === id);
  const margins = live.map((p) => roughMargin(p.price_median_uah, landedEstimate(p, rate))).filter((m): m is number => m !== null);
  const urgent = seasonal.filter((p) => { const d = daysUntil(orderBy(p.stock_by)); return d !== null && d >= 0 && d <= 21; });

  return (
    <div className="space-y-4">
      <PageHeader title="Банк товарів" subtitle="Кандидати, які знайшов аналітик: ціни на ринку і в Китаї, сезон, ризики і посилання. Обери один і натисни «Беру в тест» — план запуску під нього з'явиться сам." />

      <Stats>
        <Stat label="Кандидатів" value={live.length} />
        <Stat label="Сезонних" value={seasonal.length} hint="зима і свята" />
        <Stat label="Встигнути замовити" value={urgent.length} hint="за 3 тижні" tone={urgent.length ? "warn" : undefined} href="/products?f=season" />
        <Stat label="Маржа ≥ 35%" value={margins.filter((m) => m >= 0.35).length} hint="до реклами, оцінка" tone="good" />
        <Stat label="У роботі" value={all.filter(filters.test).length} href="/products?f=test" />
        <Stat label="Відкинуто" value={all.filter(filters.rejected).length} href="/products?f=rejected" />
      </Stats>

      <Pills
        active={key ? `/products?f=${key}` : "/products"}
        items={[
          ["/products", "Усі", all.filter(filters[""]).length],
          ["/products?f=season", "Сезон", all.filter(filters.season).length],
          ["/products?f=year", "Цілий рік", all.filter(filters.year).length],
          ["/products?f=test", "У роботі", all.filter(filters.test).length],
          ["/products?f=unfit", "Не підходять", all.filter(filters.unfit).length],
          ["/products?f=rejected", "Відкинуті", all.filter(filters.rejected).length],
        ]}
      />

      {key === "unfit" ? (
        <p className="text-[13px] text-zinc-500">Ці товари автофільтр сховав з банку: червоні позначки пояснюють чому. Якщо вважаєш, що фільтр помилився, все одно можеш узяти товар у тест.</p>
      ) : (
        <details className="rounded-xl border border-black/[.07] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900">
          <summary className="cursor-pointer text-[13px] text-zinc-600 dark:text-zinc-400">
            Що ми не возимо і чому · сховано {all.filter(filters.unfit).length} товарів
          </summary>
          <ul className="mt-2 space-y-1.5">
            {NOT_FOR_US.map(([rule, why]) => (
              <li key={rule}><b className="font-medium">{rule}.</b> <span className="text-zinc-600 dark:text-zinc-400">{why}</span></li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => {
          const landed = landedEstimate(p, rate);
          const m = roughMargin(p.price_median_uah, landed);
          const src = srcFor(p.id);
          const fit = fitIssues(p);
          return (
            <article key={p.id} className="flex flex-col rounded-xl border border-black/[.07] bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/products/${p.id}`} className="font-semibold leading-snug hover:text-indigo-600 dark:hover:text-indigo-400">{p.name}</Link>
                  <div className="text-xs text-zinc-500">{p.category ?? "—"}{p.seasonality && ` · ${p.seasonality}`}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular-nums leading-none">{p.score ?? "—"}</div>
                  <div className="text-[10px] uppercase text-zinc-500">оцінка</div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.stage !== "idea" && <Badge tone={p.stage === "rejected" ? "red" : "blue"}>{STAGES[p.stage]}</Badge>}
                <Deadline stockBy={p.stock_by} />
                {p.confidence !== null && <Badge tone={p.confidence >= 60 ? "green" : p.confidence >= 40 ? "amber" : "red"}>впевненість {p.confidence}%</Badge>}
                {fit.block.map((x) => <Badge key={x} tone="red">{x}</Badge>)}
                {fit.warn.map((x) => <Badge key={x} tone="amber">{x}</Badge>)}
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-[11px] text-zinc-500">Ринок</dt>
                  <dd className="font-medium tabular-nums">{money(p.price_median_uah)}</dd>
                  {p.price_min_uah && <dd className="text-[11px] text-zinc-500">{Math.round(p.price_min_uah)}–{Math.round(p.price_max_uah ?? p.price_min_uah)}</dd>}
                </div>
                <div>
                  <dt className="text-[11px] text-zinc-500">Собівартість</dt>
                  <dd className="font-medium tabular-nums">{landed ? `≈ ${money(landed)}` : "—"}</dd>
                  {p.cost_min_usd && <dd className="text-[11px] text-zinc-500">${Number(p.cost_min_usd)}–{Number(p.cost_max_usd ?? p.cost_min_usd)} у Китаї</dd>}
                </div>
                <div>
                  <dt className="text-[11px] text-zinc-500">Маржа</dt>
                  <dd className={`font-medium tabular-nums ${m !== null && m < 0.3 ? "text-red-600 dark:text-red-400" : m !== null ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{pct(m)}</dd>
                </div>
              </dl>
              {p.sellers && <p className="mt-1 text-[11px] text-zinc-500">Конкуренти: {p.sellers}</p>}
              <div className="mt-2"><Progress value={(p.score ?? 0) / 100} tone={(p.score ?? 0) >= 65 ? "green" : "indigo"} /></div>

              {p.thesis && <p className="mt-3 line-clamp-4 text-sm text-zinc-700 dark:text-zinc-300">{p.thesis}</p>}

              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-indigo-600 dark:text-indigo-400">Детальніше: ризики, реклама, джерела ({src.length})</summary>
                <div className="mt-2 space-y-2 text-zinc-600 dark:text-zinc-400">
                  {p.thesis && <p><b className="text-zinc-800 dark:text-zinc-200">Чому:</b> {p.thesis}</p>}
                  {p.risks && <p><b className="text-zinc-800 dark:text-zinc-200">Ризики:</b> {p.risks}</p>}
                  {p.kill_criteria && <p><b className="text-zinc-800 dark:text-zinc-200">Відмовляємось, якщо:</b> {p.kill_criteria}</p>}
                  {p.where_to_sell && <p><b className="text-zinc-800 dark:text-zinc-200">Де продавати:</b> {p.where_to_sell}</p>}
                  {p.ad_angle && <p><b className="text-zinc-800 dark:text-zinc-200">Ідея реклами:</b> {p.ad_angle}</p>}
                  {p.moq && <p><b className="text-zinc-800 dark:text-zinc-200">Мінімальна партія:</b> {p.moq} шт</p>}
                  {src.length > 0 && (
                    <ul className="space-y-1">
                      {src.map((s) => (
                        <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">{s.title ?? s.publisher ?? s.url}</a>{s.publisher && <span className="text-xs"> · {s.publisher}</span>}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>

              <div className="mt-auto flex items-center gap-2 pt-3">
                {p.stage === "idea" || p.stage === "demand" ? (
                  <>
                    <form action={startTest} className="flex-1">
                      <input type="hidden" name="product_id" value={p.id} />
                      <ConfirmButton message={`Беремо «${p.name}» в тест? Створю 9 задач: зразки, фото, партія, картка, реклама.`} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">Беру в тест</ConfirmButton>
                    </form>
                    <form action={rejectIdea}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <ConfirmButton message="Відкинути цей товар?" className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5">Не цікаво</ConfirmButton>
                    </form>
                  </>
                ) : (
                  <Link href={`/products/${p.id}`} className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-center text-sm font-medium hover:border-indigo-300 dark:border-white/10">Відкрити картку</Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!rows.length && <p className="py-6 text-center text-sm text-zinc-500">Тут поки порожньо.</p>}

      <p className="text-xs text-zinc-500">
        Собівартість — оцінка: середня ціна в Китаї + мито і ПДВ ≈ 32% + залізниця ≈ $3/кг + приймання, за курсом {rate.toFixed(2)}. Маржа — до реклами, після податку і комісії ≈ 16%. «Замовити за N днів» рахує {RAIL_DAYS} днів на зразки, виробництво і залізницю.
      </p>

      <AddForm title="Додати свій товар">
        <form action={createProduct} className="space-y-2.5">
          <FormGrid>
            <Field label="Назва" name="name" required />
            <Field label="Категорія" name="category" />
            <Field label="Вага, кг" name="weight_kg" type="number" />
            <Field label="Де побачили (посилання)" name="source_url" />
          </FormGrid>
          <TextArea label="Нотатки" name="notes" rows={2} />
          <Button>Додати</Button>
        </form>
      </AddForm>
    </div>
  );
}
