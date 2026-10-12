import { requireMember } from "@/lib/auth";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Інвестиції" };
import { Planner, type PlanOffer } from "./planner";

export default async function InvestmentsPage() {
  const { supabase } = await requireMember();
  const { data } = await supabase
    .from("offer_economics")
    .select("offer_id, product_name, supplier_name, landed_cost_uah, price_uah, cpa_uah, refusal_reserve_uah, fee_pct, moq, is_selected")
    .order("is_selected", { ascending: false });
  const offers: PlanOffer[] = (data ?? []).map((o) => ({
    ...o,
    landed_cost_uah: Number(o.landed_cost_uah),
    price_uah: Number(o.price_uah),
    cpa_uah: Number(o.cpa_uah),
    refusal_reserve_uah: Number(o.refusal_reserve_uah),
    fee_pct: Number(o.fee_pct),
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Інвестиції" subtitle="Скільки вкласти в партію і що буде в трьох сценаріях." />
      <Card>
        <Planner offers={offers} />
      </Card>
    </div>
  );
}
