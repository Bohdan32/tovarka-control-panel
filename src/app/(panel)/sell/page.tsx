import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Card, PageHeader, Pills } from "@/components/ui";
import { Infographic } from "@/components/infographic";
import { Markdown } from "@/components/markdown";
import { Simulator, type SimProduct } from "@/components/simulator";
import { CopyButton } from "@/components/copy";
import { date, landedEstimate } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import { ReplyHelper } from "@/components/reply-helper";
import { saveQuestion, updateQuestion } from "../actions";
import { miniInput } from "@/components/ui";

export const metadata: Metadata = { title: "Як продавати" };

const FLOW = [
  ["kanaly", "1", "Де продавати", "Prom, OLX, Rozetka чи свій сайт — і в якому порядку"],
  ["pershi-zamovlennya", "2", "Перші замовлення", "Як отримати перші 30 продажів без бюджету"],
  ["vidguky", "3", "Відгуки", "Як чесно зібрати перші 10 відгуків"],
  ["reklama", "4", "Реклама", "Яка реклама без обличчя, скільки коштує, коли зупинятись"],
  ["proces", "5", "Від замовлення до грошей", "Що відбувається після кліку «Купити»"],
  ["groshi", "6", "Гроші: погано / нормально / добре", "Скільки можна втратити і заробити"],
] as const;

// Групи готових текстів: вид + підрозділ (section).
const GROUPS: [kind: string, section: string | null, label: string][] = [
  ["chat", null, "Відповіді в чат"],
  ["chat", "hard", "Складні ситуації"],
  ["supplier", null, "Постачальнику (англ. + кит.)"],
  ["listing", null, "Картка товару"],
  ["ad", "video", "Сценарії відео без обличчя"],
  ["ad", null, "Реклама"],
  ["insert", null, "Вкладка в посилку"],
];

export default async function SellPage({ searchParams }: PageProps<"/sell">) {
  const { s } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data: guides }, { data: templates }, { data: products }, { data: settings }, { data: questions }] = await Promise.all([
    supabase.from("guides").select("*").order("sort"),
    supabase.from("templates").select("*, products(name)").order("sort"),
    supabase.from("products").select("id, name, price_median_uah, cost_min_usd, cost_max_usd, weight_kg, score").not("stage", "eq", "rejected").order("score", { ascending: false, nullsFirst: false }),
    supabase.from("cost_settings").select("usd_rate, tax_pct").eq("id", 1).single(),
    supabase.from("customer_questions").select("*, products(name)").order("times", { ascending: false }).order("created_at", { ascending: false }),
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
    ["/sell?s=foto", "Фото вдома"],
    ["/sell?s=infographic", "Перше фото"],
    ["/sell?s=video-start", "Відео від постачальника"],
    ["/sell?s=simulator", "Симулятор"],
    ["/sell?s=chat", "Відповісти покупцю"],
    ["/sell?s=texts", "Готові тексти"],
    ["/sell?s=opt", "Опт"],
    ["/sell?s=pomichnyk", "Помічник"],
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
          <div className="grid gap-2 sm:grid-cols-3">
            <Link href="/sell?s=simulator" className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <span className="block text-sm font-semibold text-indigo-700 dark:text-indigo-300">Симулятор грошей →</span>
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">Обери товар і бюджет — побачиш прибуток у трьох сценаріях</span>
            </Link>
            <Link href="/sell?s=chat" className="rounded-xl border border-black/[.07] bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
              <span className="block text-sm font-semibold">Відповісти покупцю →</span>
              <span className="block text-xs text-zinc-500">Встав питання — пульт підбере відповідь з назвою і ціною</span>
            </Link>
            <Link href="/sell?s=texts" className="rounded-xl border border-black/[.07] bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
              <span className="block text-sm font-semibold">Готові тексти →</span>
              <span className="block text-xs text-zinc-500">{templates?.length ?? 0} шаблонів: чат, складні ситуації, сценарії відео, постачальники</span>
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
      {section && !guide && section !== "simulator" && section !== "infographic" && section !== "texts" && section !== "slovnyk" && section !== "chat" && (
        <Card><p className="text-sm text-zinc-500">Цей розділ аналітик ще дописує.</p></Card>
      )}

      {section === "infographic" && (
        <Card title="Перше фото з перевагами">
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Перше фото вирішує, чи клікнуть на картку серед 40 інших. Білий фон, товар великим планом і 3 переваги, які читаються з телефона.</p>
          <Infographic />
        </Card>
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

      {section === "chat" && (
        <div className="space-y-4">
          <Card title="Підказка відповіді">
            <ReplyHelper
              templates={(templates ?? []).filter((t) => t.kind === "chat").map((t) => ({ id: t.id, title: t.title, body: t.body }))}
              products={(products ?? []).slice(0, 40).map((p) => ({ name: p.name, price: p.price_median_uah === null ? null : Number(p.price_median_uah) }))}
            />
          </Card>
          <Card title={`Банк питань покупців · ${questions?.length ?? 0}`}>
            <p className="mb-2 text-xs text-zinc-500">
              Записуй кожне нове питання. Те, що питають 3+ рази, допиши в опис картки: таких питань стане менше. Позначка «в картці» — вже дописано.
            </p>
            <form action={saveQuestion} className="mb-3 flex flex-wrap gap-1.5">
              <input name="question" required placeholder="Питання покупця" className={`${miniInput} min-w-0 flex-[2]`} />
              <input name="answer" placeholder="Відповідь (можна пізніше)" className={`${miniInput} min-w-0 flex-[2]`} />
              <button className="rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white">Записати</button>
            </form>
            <ul className="divide-y divide-black/[.06] dark:divide-white/5">
              {(questions ?? []).map((q) => (
                <li key={q.id} className="py-2">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{q.question}</span>
                    <span className={`shrink-0 text-xs tabular-nums ${q.times >= 3 && !q.in_listing ? "font-medium text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>
                      {q.times}× {q.in_listing ? "· в картці" : q.times >= 3 ? "· додай у картку" : ""}
                    </span>
                  </div>
                  <form action={updateQuestion} className="mt-1 flex flex-wrap items-center gap-1.5">
                    <input type="hidden" name="id" value={q.id} />
                    <input name="answer" defaultValue={q.answer ?? ""} placeholder="Відповідь" className={`${miniInput} min-w-0 flex-1`} />
                    <input name="times" type="number" min={1} defaultValue={q.times} className={`${miniInput} w-14`} aria-label="Скільки разів питали" />
                    <label className="flex items-center gap-1 text-xs text-zinc-500"><input type="checkbox" name="in_listing" defaultChecked={q.in_listing} /> в картці</label>
                    <button className="rounded-md bg-indigo-600 px-2 text-xs font-medium text-white">ok</button>
                    <button name="delete" value="1" className="text-xs text-zinc-400 hover:text-red-600">×</button>
                    {q.answer && <CopyButton text={q.answer} />}
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {section === "texts" && (
        <div className="space-y-4">
          {GROUPS.map(([kind, sect, label]) => {
            const rows = (templates ?? []).filter((t) => t.kind === kind && (t.section ?? null) === sect);
            if (!rows.length) return null;
            return (
              <Card key={`${kind}-${sect}`} title={label}>
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
