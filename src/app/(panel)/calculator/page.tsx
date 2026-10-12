import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Badge, Card, PageHeader, Table, Td } from "@/components/ui";
import { money, pct } from "@/lib/format";
import { QuickCalc, type CalcSettings } from "./quick-calc";

export default async function CalculatorPage() {
  const { supabase } = await requireMember();
  const [{ data: settings }, { data: rows }] = await Promise.all([
    supabase.from("cost_settings").select("*").eq("id", 1).single(),
    supabase.from("offer_economics").select("*").order("margin", { ascending: false }),
  ]);
  const s = Object.fromEntries(Object.entries(settings ?? {}).map(([k, v]) => [k, Number(v)])) as CalcSettings;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Калькулятор ціни"
        subtitle="Ціна = (собівартість + CPA + резерв на відмови) / (1 − маржа − комісія). Параметри — у Налаштуваннях."
      />
      <Card title="Швидкий розрахунок">
        <QuickCalc settings={s} />
      </Card>
      <Card title="Усі пропозиції">
        <Table head={["Товар", "Постачальник", "Собівартість", "Ціна", "Ринок", "Прибуток", "Маржа", "CPA max", ""]} empty={!rows?.length}>
          {rows?.map((e) => (
            <tr key={e.offer_id}>
              <Td><Link href={`/products/${e.product_id}`} className="text-sky-600 hover:underline">{e.product_name}</Link></Td>
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
