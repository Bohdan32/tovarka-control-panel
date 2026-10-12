import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Member = { email: string; displayName: string };

// Data access gate: a signed-in user whose email is in public.members.
export async function requireMember() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("email, display_name")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!member) redirect("/login?error=no-access");

  return {
    supabase,
    member: { email: member.email, displayName: member.display_name } as Member,
  };
}
