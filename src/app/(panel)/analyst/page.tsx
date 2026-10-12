import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { Badge, Card, PageHeader, Pills, Stat, Stats } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ROLES, date } from "@/lib/format";

export const metadata: Metadata = { title: "Аналітик" };

export default async function AnalystPage({ searchParams }: PageProps<"/analyst">) {
  const { role } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data: reports }, sources, tasks] = await Promise.all([
    supabase.from("analyst_reports").select("*").order("report_date", { ascending: false }).order("created_at", { ascending: true }).limit(200),
    supabase.from("research_sources").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("source", "analyst"),
  ]);
  const all = reports ?? [];
  const rows = typeof role === "string" ? all.filter((r) => r.role === role) : all;

  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.report_date, [...(byDate.get(r.report_date) ?? []), r]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Аналітик"
        subtitle="Щоранку команда Claude (розвідник, закупівельник, фінансист, маркетолог, ревізор, адвокат диявола) перевіряє панель, шукає попит і пише сюди."
      />
      <Stats>
        <Stat label="Звітів" value={all.length} />
        <Stat label="Днів роботи" value={new Set(all.map((r) => r.report_date)).size} />
        <Stat label="Критичних" value={all.filter((r) => r.severity === "critical").length} tone={all.some((r) => r.severity === "critical") ? "bad" : undefined} />
        <Stat label="Потребують уваги" value={all.filter((r) => r.severity === "attention").length} />
        <Stat label="Джерел у базі" value={sources.count ?? 0} href="/sources" />
        <Stat label="Задач від аналітика" value={tasks.count ?? 0} href="/plan?show=analyst" />
      </Stats>

      <Pills
        active={typeof role === "string" ? `/analyst?role=${role}` : "/analyst"}
        items={[["/analyst", "Усі", all.length], ...Object.entries(ROLES).map(([k, v]) => [`/analyst?role=${k}`, v, all.filter((r) => r.role === k).length] as [string, string, number])]}
      />

      {!byDate.size && <Card><p className="text-sm text-zinc-500">Звітів ще немає. Перший з’явиться після найближчого ранкового запуску.</p></Card>}
      {[...byDate.entries()].map(([d, items]) => (
        <Card key={d} title={date(d)}>
          <div className="divide-y divide-black/[.06] dark:divide-white/10">
            {items.map((r) => (
              <article key={r.id} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={r.severity === "critical" ? "red" : r.severity === "attention" ? "amber" : "gray"}>{ROLES[r.role] ?? r.role}</Badge>
                  <h3 className="text-sm font-semibold">{r.title}</h3>
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
