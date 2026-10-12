import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Badge, Card, PageHeader, Stat, Table, Td } from "@/components/ui";
import { ROLES, STAGES, date, money, pct } from "@/lib/format";
import { Markdown } from "@/components/markdown";

const FUNNEL = ["idea", "demand", "sourcing", "economics", "test", "selling"];

export default async function Dashboard() {
  const { supabase } = await requireMember();
  const [products, reports, economics, txs, orders, settings] = await Promise.all([
    supabase.from("products").select("id, stage"),
    supabase.from("analyst_reports").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("offer_economics").select("*").eq("is_selected", true),
    supabase.from("transactions").select("kind, amount_uah"),
    supabase.from("orders").select("status, price_uah, qty, created_at"),
    supabase.from("cost_settings").select("usd_rate, usd_rate_date").eq("id", 1).single(),
  ]);

  const byStage = new Map<string, number>();
  for (const p of products.data ?? []) byStage.set(p.stage, (byStage.get(p.stage) ?? 0) + 1);

  const sum = (kinds: string[]) =>
    (txs.data ?? []).filter((t) => kinds.includes(t.kind)).reduce((a, t) => a + Number(t.amount_uah), 0);
  const invested = sum(["investment"]);
  const cashIn = sum(["investment", "revenue"]);
  const cashOut = sum(["purchase", "ads", "delivery", "withdrawal", "other"]);

  const latestDate = reports.data?.[0]?.report_date;
  const latest = (reports.data ?? []).filter((r) => r.report_date === latestDate);
  const lead = latest.find((r) => r.role === "lead");
  const alerts = latest.filter((r) => r.severity !== "info" && r.role !== "lead");
  const failing = (economics.data ?? []).filter((e) => !e.passes);
  const openOrders = (orders.data ?? []).filter((o) => ["new", "confirmed", "shipped"].includes(o.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Дашборд" subtitle={`Курс НБУ: ${settings.data?.usd_rate ?? "—"} грн/$ на ${date(settings.data?.usd_rate_date)}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Вкладено" value={money(invested)} />
        <Stat label="Гроші в обороті" value={money(cashIn - cashOut)} tone={cashIn - cashOut < 0 ? "bad" : undefined} />
        <Stat label="Відкриті замовлення" value={openOrders} />
        <Stat label="Товари з маржею нижче порогу" value={failing.length} tone={failing.length ? "bad" : "good"} />
      </div>

      <Card title="Воронка товарів">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {FUNNEL.map((s) => (
            <Link key={s} href={`/products?stage=${s}`} className="rounded-lg border border-black/10 p-3 text-center hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-800">
              <div className="text-2xl font-semibold">{byStage.get(s) ?? 0}</div>
              <div className="text-xs text-zinc-500">{STAGES[s]}</div>
            </Link>
          ))}
        </div>
      </Card>

      <Card title={latestDate ? `Звіт аналітика за ${date(latestDate)}` : "Звіт аналітика"}>
        {lead ? (
          <Markdown text={lead.body} />
        ) : (
          <p className="text-sm text-zinc-500">
            Аналітик ще не писав звітів. Він запускається щоранку і пише сюди, що змінилось і що робити.
          </p>
        )}
        {alerts.length > 0 && (
          <ul className="mt-4 space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex gap-2 text-sm">
                <Badge tone={a.severity === "critical" ? "red" : "amber"}>{ROLES[a.role] ?? a.role}</Badge>
                <span>{a.title}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/analyst" className="mt-4 inline-block text-sm text-sky-600 hover:underline">Усі звіти →</Link>
      </Card>

      {failing.length > 0 && (
        <Card title="Увага: обрані пропозиції не проходять фільтр">
          <Table head={["Товар", "Ціна", "Медіана ринку", "Маржа"]}>
            {failing.map((e) => (
              <tr key={e.offer_id}>
                <Td><Link href={`/products/${e.product_id}`} className="text-sky-600 hover:underline">{e.product_name}</Link></Td>
                <Td>{money(e.price_uah)}</Td>
                <Td>{money(e.market_median_uah)}</Td>
                <Td><Badge tone="red">{pct(e.margin)}</Badge></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
