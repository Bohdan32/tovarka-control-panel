import { requireMember } from "@/lib/auth";

// Усі дані пульта одним JSON-файлом. Безкоштовний Supabase не гарантує відновлення, тож копія — у тебе.
const TABLES = [
  "products", "offers", "suppliers", "competitor_prices", "demand_signals", "inventory_batches", "orders",
  "transactions", "ad_campaigns", "marketing_assets", "tasks", "playbook_steps", "research_sources", "guides",
  "templates", "ideas", "calendar_events", "customer_questions", "blacklist", "inbox", "analyst_reports",
  "cost_settings", "fx_rates", "members",
];

export async function GET() {
  const { supabase } = await requireMember();
  const dump: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*").limit(10000);
    dump[t] = error ? { error: error.message } : data;
  }
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(dump, null, 1), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="tovarka-${day}.json"`,
    },
  });
}
