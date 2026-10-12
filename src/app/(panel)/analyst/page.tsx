import { requireMember } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ROLES, date } from "@/lib/format";

export default async function AnalystPage() {
  const { supabase } = await requireMember();
  const { data: reports } = await supabase
    .from("analyst_reports")
    .select("*")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(150);

  const byDate = new Map<string, NonNullable<typeof reports>>();
  for (const r of reports ?? []) byDate.set(r.report_date, [...(byDate.get(r.report_date) ?? []), r]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Аналітик"
        subtitle="Щоранку Claude з командою (розвідник, закупівельник, фінансист, маркетолог, ревізор) аналізує панель і пише сюди."
      />
      {!byDate.size && <Card><p className="text-sm text-zinc-500">Звітів ще немає. Перший з’явиться після найближчого ранкового запуску.</p></Card>}
      {[...byDate.entries()].map(([d, rows]) => (
        <Card key={d} title={date(d)}>
          <div className="space-y-5">
            {rows.map((r) => (
              <article key={r.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={r.severity === "critical" ? "red" : r.severity === "attention" ? "amber" : "gray"}>{ROLES[r.role] ?? r.role}</Badge>
                  <h3 className="font-semibold">{r.title}</h3>
                </div>
                <Markdown text={r.body} />
              </article>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
