import type { NextRequest } from "next/server";
import { requireMember } from "@/lib/auth";
import { TX_KINDS } from "@/lib/format";
import { quarterOf } from "@/lib/money";

// CSV для бухгалтера: усі операції кварталу (або за весь час з ?all=1). BOM — щоб Excel прочитав кирилицю.
export async function GET(req: NextRequest) {
  const { supabase } = await requireMember();
  const q = quarterOf();
  const all = req.nextUrl.searchParams.get("all") === "1";
  let query = supabase.from("transactions").select("happened_on, kind, amount_uah, note, member_email, products(name)").order("happened_on");
  if (!all) query = query.gte("happened_on", q.start).lte("happened_on", q.end);
  const { data } = await query;
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Дата", "Тип", "Сума, грн", "Дохід ФОП", "Товар", "Хто", "Коментар"],
    ...(data ?? []).map((t) => [
      t.happened_on, TX_KINDS[t.kind] ?? t.kind, Number(t.amount_uah).toFixed(2).replace(".", ","),
      t.kind === "revenue" ? "так" : "", (t.products as { name?: string } | null)?.name ?? "", t.member_email ?? "", t.note ?? "",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const name = all ? "tovarka-operations-all.csv" : `tovarka-${new Date().getFullYear()}-Q${q.n}.csv`;
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` },
  });
}
