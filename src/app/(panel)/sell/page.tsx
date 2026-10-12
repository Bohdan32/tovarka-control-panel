import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Card, PageHeader, Pills } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { Simulator, type SimProduct } from "@/components/simulator";
import { CopyButton } from "@/components/copy";
import { date, landedEstimate } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = { title: "Як продавати" };

const FLOW = [
  ["kanaly", "1", "Де продавати", "Prom, OLX, Rozetka чи свій сайт — і в якому порядку"],
  ["pershi-zamovlennya", "2", "Перші замовлення", "Як отримати перші 30 продажів без бюджету"],
  ["vidguky", "3", "Відгуки", "Як чесно зібрати перші 10 відгуків"],
  ["reklama", "4", "Реклама", "Яка реклама без обличчя, скільки коштує, коли зупинятись"],
  ["proces", "5", "Від замовлення до грошей", "Що відбувається після кліку «Купити»"],
  ["groshi", "6", "Гроші: погано / нормально / добре", "Скільки можна втратити і заробити"],
] as const;

const KINDS: Record<string, string> = { chat: "Відповіді в чат", supplier: "Постачальнику (англ. + кит.)", listing: "Картка товару", ad: "Реклама", insert: "Вкладка в посилку" };

export default async function SellPage({ searchParams }: PageProps<"/sell">) {
  const { s } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data: guides }, { data: templates }, { data: products }, { data: settings }] = await Promise.all([
    supabase.from("guides").select("*").order("sort"),
    supabase.from("templates").select("*, products(name)").order("sort"),
    supabase.from("products").select("id, name, price_median_uah, cost_min_usd, cost_max_usd, weight_kg, score").not("stage", "eq", "rejected").order("score", { ascending: false, nullsFirst: false }),
    supabase.from("cost_settings").select("usd_rate, tax_pct").eq("id", 1).single(),
  ]);
  const rate = Number(settings?.usd_rate ?? 0);
  const section = typeof s === "string" ? s : "";
  const guide = (guides ?? []).find((g) => g.slug === section);
  const sim: SimProduct[] = (products ?? [])
    .filter((p) => p.price_median_uah)
    .map((p) => ({ id: p.id, name: p.name, price: Number(p.price_median_uah), landed: landedEstimate(p, rate) }));

  const tabs: [string, string][] = [
    ["/sell", "Шлях"],
    ...FLOW.map(([slug, , title]) => [`/sell?s=${slug}`, title] as [string, string]),
    ["/sell?s=simulator", "Симулятор"],
    ["/sell?s=texts", "Готові тексти"],
    ["/sell?s=slovnyk", "Словник"],
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Як продавати" subtitle="Від порожнього магазину до перших відгуків і реклами, що окупається. Без дзвінків і без обличчя в кадрі." />
      <Pills active={section ? `/sell?s=${section}` : "/sell"} items={tabs} />

      {!section && (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FLOW.map(([slug, n, title, sub]) => {
              const g = (guides ?? []).find((x) => x.slug === slug);
              return (
                <Link key={slug} href={`/sell?s=${slug}`}
                  className="flex gap-3 rounded-xl border border-black/[.07] bg-white p-3 transition hover:border-indigo-300 dark:border-white/10 dark:bg-zinc-900">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{n}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-zinc-500">{g?.summary ?? sub}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/sell?s=simulator" className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <span className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300">Симулятор грошей →</span>
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">Обери товар і бюджет — побачиш прибуток у трьох сценаріях</span>
            </Link>
            <Link href="/sell?s=texts" className="rounded-xl border border-black/[.07] bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
              <span className="block text-sm font-semibold">Готові тексти →</span>
              <span className="block text-xs text-zinc-500">{templates?.length ?? 0} шаблонів: відповіді в чат, картки, реклама</span>
            </Link>
          </div>
        </>
      )}

      {guide && (
        <Card>
          <Markdown text={guide.body} />
          <p className="mt-4 text-xs text-zinc-500">Оновлено {date(guide.updated_at)} · джерела з цифрами — на сторінці <Link href="/sources" className="text-indigo-600 hover:underline dark:text-indigo-400">Джерела</Link></p>
        </Card>
      )}
      {section && !guide && section !== "simulator" && section !== "texts" && section !== "slovnyk" && (
        <Card><p className="text-sm text-zinc-500">Цей розділ аналітик ще дописує.</p></Card>
      )}

      {section === "simulator" && (
        <Card title="Симулятор першого місяця">
          <Simulator products={sim} taxPct={Number(settings?.tax_pct ?? 0.06)} />
        </Card>
      )}

      {section === "slovnyk" && (
        <Card title={`Словник · ${GLOSSARY.length} слів`}>
          <p className="mb-2 text-xs text-zinc-500">Ці слова підкреслені пунктиром у плані, гайдах і задачах: натисни на слово — з’явиться пояснення.</p>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {[...GLOSSARY].sort((a, b) => a[0].localeCompare(b[0], "uk")).map(([term, meaning]) => (
              <div key={term}>
                <dt className="text-sm font-semibold">{term}</dt>
                <dd className="text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">{meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {section === "texts" && (
        <div className="space-y-4">
          {Object.entries(KINDS).map(([kind, label]) => {
            const rows = (templates ?? []).filter((t) => t.kind === kind);
            if (!rows.length) return null;
            return (
              <Card key={kind} title={label}>
                <ul className="divide-y divide-black/[.06] dark:divide-white/5">
                  {rows.map((t) => (
                    <li key={t.id} className="py-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{t.title}{t.products?.name && <span className="font-normal text-zinc-500"> · {t.products.name}</span>}</span>
                        <CopyButton text={t.body} />
                      </div>
                      <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{t.body}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
