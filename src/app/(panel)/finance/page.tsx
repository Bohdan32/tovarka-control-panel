import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createTransaction } from "../actions";
import { Badge, Button, Card, Field, FormGrid, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { TX_KINDS, date, money } from "@/lib/format";

const COSTS = ["purchase", "ads", "delivery", "other"];

export default async function FinancePage() {
  const { supabase, member } = await requireMember();
  const [{ data: txs }, { data: members }, products] = await Promise.all([
    supabase.from("transactions").select("*, products(name)").order("happened_on", { ascending: false }),
    supabase.from("members").select("email, display_name, share_pct"),
    productOptions(supabase),
  ]);
  const all = txs ?? [];
  const total = (kinds: string[], rows = all) =>
    rows.filter((t) => kinds.includes(t.kind)).reduce((a, t) => a + Number(t.amount_uah), 0);

  const revenue = total(["revenue"]);
  const costs = total(COSTS);
  const profit = revenue - costs;

  const byProduct = new Map<string, { name: string; revenue: number; costs: number }>();
  for (const t of all) {
    if (!t.product_id) continue;
    const row = byProduct.get(t.product_id) ?? { name: t.products?.name ?? "—", revenue: 0, costs: 0 };
    if (t.kind === "revenue") row.revenue += Number(t.amount_uah);
    if (COSTS.includes(t.kind)) row.costs += Number(t.amount_uah);
    byProduct.set(t.product_id, row);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Фінанси" subtitle="Спільна каса: хто скільки вклав, куди пішли гроші, який прибуток." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Вкладено" value={money(total(["investment"]))} />
        <Stat label="Виручка" value={money(revenue)} />
        <Stat label="Витрати" value={money(costs)} />
        <Stat label="Прибуток" value={money(profit)} tone={profit < 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Партнери">
          <Table head={["Хто", "Частка", "Вклав", "Вивів", "Частка прибутку"]}>
            {members?.map((m) => {
              const mine = all.filter((t) => t.member_email === m.email);
              return (
                <tr key={m.email}>
                  <Td>{m.display_name}</Td>
                  <Td>{Number(m.share_pct)}%</Td>
                  <Td>{money(total(["investment"], mine))}</Td>
                  <Td>{money(total(["withdrawal"], mine))}</Td>
                  <Td>{money((profit * Number(m.share_pct)) / 100)}</Td>
                </tr>
              );
            })}
          </Table>
        </Card>
        <Card title="Прибуток по товарах">
          <Table head={["Товар", "Виручка", "Витрати", "Результат"]} empty={!byProduct.size}>
            {[...byProduct.entries()].map(([id, r]) => (
              <tr key={id}>
                <Td>{r.name}</Td>
                <Td>{money(r.revenue)}</Td>
                <Td>{money(r.costs)}</Td>
                <Td><Badge tone={r.revenue - r.costs < 0 ? "red" : "green"}>{money(r.revenue - r.costs)}</Badge></Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card title="Рух грошей">
        <Table head={["Дата", "Тип", "Сума", "Хто", "Товар", "Коментар"]} empty={!all.length}>
          {all.map((t) => (
            <tr key={t.id}>
              <Td>{date(t.happened_on)}</Td>
              <Td>{TX_KINDS[t.kind]}</Td>
              <Td className={t.kind === "revenue" || t.kind === "investment" ? "text-emerald-600" : ""}>{money(t.amount_uah)}</Td>
              <Td>{members?.find((m) => m.email === t.member_email)?.display_name ?? "—"}</Td>
              <Td>{t.products?.name ?? "—"}</Td>
              <Td className="text-zinc-500">{t.note ?? ""}</Td>
            </tr>
          ))}
        </Table>
        <form action={createTransaction} className="mt-6 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Додати операцію</h3>
          <FormGrid>
            <Select label="Тип" name="kind" options={TX_KINDS} />
            <Field label="Сума, грн" name="amount_uah" type="number" required />
            <Select label="Хто" name="member_email" defaultValue={member.email}
              options={(members ?? []).map((m) => [m.email, m.display_name] as [string, string])} />
            <Select label="Товар" name="product_id" options={products} includeEmpty="—" />
            <Field label="Дата" name="happened_on" type="date" />
            <Field label="Коментар" name="note" />
          </FormGrid>
          <Button>Додати</Button>
        </form>
      </Card>
    </div>
  );
}
