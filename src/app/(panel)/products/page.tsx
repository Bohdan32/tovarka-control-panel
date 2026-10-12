import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createProduct } from "../actions";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Pills, Stat, Stats, Table, Td, TextArea } from "@/components/ui";
import { STAGES, date, daysUntil, money, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Товари і попит" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { stage } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data }, { data: econ }, { data: signals }, { data: sources }] = await Promise.all([
    supabase.from("products").select("*").order("score", { ascending: false, nullsFirst: false }),
    supabase.from("offer_economics").select("product_id, is_selected, price_uah, margin, market_median_uah, market_count, profit_per_sale_uah, passes"),
    supabase.from("demand_signals").select("product_id"),
    supabase.from("research_sources").select("product_id").not("product_id", "is", null),
  ]);
  const all = data ?? [];
  const products = typeof stage === "string" ? all.filter((p) => p.stage === stage) : all;
  const pick = (id: string) => {
    const rows = (econ ?? []).filter((e) => e.product_id === id);
    return rows.find((e) => e.is_selected) ?? rows.sort((a, b) => Number(b.margin) - Number(a.margin))[0];
  };
  const count = (rows: { product_id: string | null }[] | null, id: string) => (rows ?? []).filter((r) => r.product_id === id).length;
  const active = all.filter((p) => !["rejected", "paused"].includes(p.stage));
  const scored = active.filter((p) => p.score !== null);

  return (
    <div className="space-y-4">
      <PageHeader title="Товари і попит" subtitle="Воронка: ідея → попит → постачальник → економіка → тест → продажі. Кожен товар має тезу, ризики і умову відмови." />

      <Stats>
        <Stat label="Активних" value={active.length} />
        <Stat label="Середня оцінка" value={scored.length ? Math.round(scored.reduce((a, p) => a + p.score, 0) / scored.length) : "—"} hint="0–100" />
        <Stat label="Проходять фільтр" value={active.filter((p) => pick(p.id)?.passes).length} tone="good" />
        <Stat label="Без цін ринку" value={active.filter((p) => !Number(pick(p.id)?.market_count)).length} tone="warn" />
        <Stat label="Без тези / ризиків" value={active.filter((p) => !p.thesis || !p.risks).length} tone="warn" />
        <Stat label="Відкинуто" value={all.filter((p) => p.stage === "rejected").length} href="/products?stage=rejected" />
      </Stats>

      <Pills
        active={typeof stage === "string" ? `/products?stage=${stage}` : "/products"}
        items={[["/products", "Усі", all.length], ...Object.entries(STAGES).map(([k, v]) => [`/products?stage=${k}`, v, all.filter((p) => p.stage === k).length] as [string, string, number])]}
      />

      <Card pad={false} className="p-2 sm:p-3">
        <Table head={["Товар", "Етап", "Оцінка", "Впевненість", "Ціна", "Ринок", "Маржа", "З продажу", "Докази", "Перегляд"]} empty={!products.length}>
          {products.map((p) => {
            const e = pick(p.id);
            const review = daysUntil(p.next_review_on);
            return (
              <tr key={p.id}>
                <Td className="min-w-44">
                  <Link href={`/products/${p.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{p.name}</Link>
                  {p.category && <div className="text-xs text-zinc-500">{p.category}</div>}
                </Td>
                <Td><Badge tone={p.stage === "rejected" ? "red" : p.stage === "selling" ? "green" : p.stage === "test" ? "blue" : "gray"}>{STAGES[p.stage]}</Badge></Td>
                <Td className="tabular-nums">{p.score ?? "—"}</Td>
                <Td className="tabular-nums">{p.confidence !== null ? `${p.confidence}%` : "—"}</Td>
                <Td className="whitespace-nowrap tabular-nums">{money(e?.price_uah)}</Td>
                <Td className="whitespace-nowrap tabular-nums">{money(e?.market_median_uah)}</Td>
                <Td>{e ? <Badge tone={e.passes ? "green" : "red"}>{pct(e.margin)}</Badge> : "—"}</Td>
                <Td className="whitespace-nowrap tabular-nums">{money(e?.profit_per_sale_uah)}</Td>
                <Td className="whitespace-nowrap text-xs text-zinc-500">{count(signals, p.id)} сигн. · {count(sources, p.id)} дж. · {e?.market_count ?? 0} цін</Td>
                <Td className="whitespace-nowrap">{p.next_review_on ? <Badge tone={review !== null && review <= 0 ? "amber" : "gray"}>{date(p.next_review_on)}</Badge> : "—"}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <AddForm title="Додати товар-кандидат">
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
