import Link from "next/link";
import { requireMember } from "@/lib/auth";
import type { Metadata } from "next";
import { Badge, Card, PageHeader, Table, Td } from "@/components/ui";
import { money, pct } from "@/lib/format";
import { QuickCalc, type CalcSettings } from "./quick-calc";
import { BatchBudget } from "./batch-budget";

export const metadata: Metadata = { title: "Калькулятор" };

export default async function CalculatorPage() {
  const { supabase } = await requireMember();
  const [{ data: settings }, { data: rows }] = await Promise.all([
    supabase.from("cost_settings").select("*").eq("id", 1).single(),
    supabase.from("offer_economics").select("*").order("margin", { ascending: false }),
  ]);
  const s = Object.fromEntries(Object.entries(settings ?? {}).map(([k, v]) => [k, Number(v)])) as CalcSettings;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Калькулятор ціни"
        subtitle="Ціна = (собівартість + CPA + резерв на відмови) / (1 − маржа − комісії − податки). Параметри — у Налаштуваннях."
      />
      <Card title="Швидкий розрахунок">
        <QuickCalc settings={s} />
      </Card>
      <Card title="Бюджет партії: скільки штук брати">
        <BatchBudget
          riskLimit={Number(settings?.risk_limit_uah ?? 15000)}
          defaultCpa={Number(settings?.default_cpa_uah ?? 120)}
          offers={(rows ?? []).filter((e, i, a) => a.findIndex((x) => x.product_id === e.product_id) === i).map((e) => ({
            id: e.offer_id, name: `${e.product_name}${e.supplier_name ? ` · ${e.supplier_name}` : ""}`,
            landed: Number(e.landed_cost_uah), moq: e.moq, cpa: Number(e.cpa_uah), profit: Number(e.profit_per_sale_uah),
          }))}
        />
      </Card>
      <Card title="Усі пропозиції" pad={false} className="p-2 sm:p-3">
        <Table head={["Товар", "Постачальник", "Собівартість", "Ціна", "Ринок", "Прибуток", "Маржа", "CPA max", ""]} empty={!rows?.length}>
          {rows?.map((e) => (
            <tr key={e.offer_id}>
              <Td><Link href={`/products/${e.product_id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">{e.product_name}</Link></Td>
              <Td>{e.supplier_name ?? "—"}{e.is_selected && <> <Badge tone="blue">обрана</Badge></>}</Td>
              <Td>{money(e.landed_cost_uah)}</Td>
              <Td>{money(e.price_uah)}</Td>
              <Td>{money(e.market_median_uah)}</Td>
              <Td>{money(e.profit_per_sale_uah)}</Td>
              <Td>{pct(e.margin)}</Td>
              <Td>{money(e.cpa_max_uah)}</Td>
              <Td><Badge tone={e.passes ? "green" : "red"}>{e.passes ? "проходить" : "ні"}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
