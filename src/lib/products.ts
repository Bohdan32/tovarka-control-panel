import type { SupabaseClient } from "@supabase/supabase-js";

export async function productOptions(supabase: SupabaseClient) {
  const { data } = await supabase.from("products").select("id, name").not("stage", "eq", "rejected").order("name");
  return (data ?? []).map((p) => [p.id, p.name] as [string, string]);
}
