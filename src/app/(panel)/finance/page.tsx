import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createTransaction } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Progress, Select, Stat, Stats, Table, Td } from "@/components/ui";
import { TX_KINDS, date, money, pct } from "@/lib/format";
import { ENVELOPES, ESV_MONTH, FOP3_LIMIT, MIN_WAGE_2026, quarterOf, yearStart } from "@/lib/money";

export const metadata: Metadata = { title: "Фінанси" };

const COSTS = ["purchase", "ads", "delivery", "other"];

export default async function FinancePage() {
  const { supabase, member } = await requireMember();
  const [{ data: txs }, { data: members }, products, { data: settings }] = await Promise.all([
    supabase.from("transactions").select("*, products(name)").order("happened_on", { ascending: false }),
    supabase.from("members").select("email, display_name, share_pct"),
    productOptions(supabase),
    supabase.from("cost_settings").select("tax_pct").eq("id", 1).single(),
  ]);
  const all = txs ?? [];
  const total = (kinds: string[], rows = all) =>
    rows.filter((t) => kinds.includes(t.kind)).reduce((a, t) => a + Number(t.amount_uah), 0);

  const revenue = total(["revenue"]);
  const costs = total(COSTS);
  const profit = revenue - costs;

  const q = quarterOf();
  const qRevenue = all.filter((t) => t.kind === "revenue" && t.happened_on >= q.start && t.happened_on <= q.end).reduce((a, t) => a + Number(t.amount_uah), 0);
  const taxPct = Number(settings?.tax_pct ?? 0.06);
  const yearRevenue = all.filter((t) => t.kind === "revenue" && t.happened_on >= yearStart()).reduce((a, t) => a + Number(t.amount_uah), 0);
  const limitUsed = yearRevenue / FOP3_LIMIT;
  const withdrawn = total(["withdrawal"]);

  const byProduct = new Map<string, { name: string; revenue: number; costs: number }>();
  for (const t of all) {
    if (!t.product_id) continue;
    const row = byProduct.get(t.product_id) ?? { name: t.products?.name ?? "—", revenue: 0, costs: 0 };
    if (t.kind === "revenue") row.revenue += Number(t.amount_uah);
    if (COSTS.includes(t.kind)) row.costs += Number(t.amount_uah);
    byProduct.set(t.product_id, row);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Фінанси" subtitle="Спільна каса: хто скільки вклав, куди пішли гроші, який прибуток." />
      <Stats>
        <Stat label="Вкладено" value={money(total(["investment"]))} />
        <Stat label="Виручка" value={money(revenue)} />
        <Stat label="Витрати" value={money(costs)} hint={`закупівля ${money(total(["purchase"]))}`} />
        <Stat label="Прибуток" value={money(profit)} tone={profit < 0 ? "bad" : "good"} />
        <Stat label="Реклама" value={money(total(["ads"]))} hint={revenue ? `${Math.round((total(["ads"]) / revenue) * 100)}% виручки` : undefined} />
        <Stat label={`Податок за ${q.n} квартал`} value={money(qRevenue * taxPct + ESV_MONTH * 3)} hint={`до ${date(q.taxDue.toISOString())}: ${pct(taxPct)} + ЄСВ`} tone="warn" />
      </Stats>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Податки · ${q.n} квартал`}>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-zinc-500">Виручка кварталу</dt><dd className="text-right tabular-nums">{money(qRevenue)}</dd>
            <dt className="text-zinc-500">Єдиний податок + ВЗ {pct(taxPct)}</dt><dd className="text-right tabular-nums">{money(qRevenue * taxPct)}</dd>
            <dt className="text-zinc-500">ЄСВ за 3 місяці</dt><dd className="text-right tabular-nums">{money(ESV_MONTH * 3)}</dd>
            <dt className="font-medium">Відклади й не чіпай</dt><dd className="text-right font-semibold tabular-nums">{money(qRevenue * taxPct + ESV_MONTH * 3)}</dd>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">ЄСВ — до {date(q.esvDue.toISOString())}, податок — до {date(q.taxDue.toISOString())}. ЄСВ платиш навіть без продажів.</p>
        </Card>
        <Card title="Ліміт доходу 3 групи">
          <div className="text-xl font-semibold tabular-nums">{pct(limitUsed)}</div>
          <div className="my-1.5"><Progress value={Math.min(limitUsed, 1)} tone={limitUsed > 0.8 ? "indigo" : "green"} /></div>
          <p className="text-xs text-zinc-500">
            {money(yearRevenue)} з {money(FOP3_LIMIT)} за {new Date().getFullYear()} рік (1167 мінімалок по {MIN_WAGE_2026} грн).
            {limitUsed > 0.8 ? " Уже понад 80%: час говорити з бухгалтером про ТОВ або другого ФОП." : " Перевищення — 15% податку з надлишку, тому стежимо заздалегідь."}
          </p>
        </Card>
        <Card title="Конверти прибутку">
          {profit > 0 ? (
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              {ENVELOPES.map(([key, label, share]) => (
                <div key={key} className="contents">
                  <dt className="text-zinc-500">{label} · {share * 100}%</dt>
                  <dd className="text-right tabular-nums">{money(profit * share)}</dd>
                </div>
              ))}
              <dt className="font-medium">Можна ще вивести</dt>
              <dd className={`text-right font-semibold tabular-nums ${profit * 0.3 - withdrawn < 0 ? "text-red-600" : ""}`}>{money(profit * 0.3 - withdrawn)}</dd>
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">Коли з’явиться прибуток, пульт розкладе його: 50% на наступну партію, 20% на рекламу, 30% собі. Так оборотні гроші не проїдаються.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
      </Card>
      <AddForm title="Додати операцію">
        <form action={createTransaction} className="space-y-2.5">
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
      </AddForm>
    </div>
  );
}
