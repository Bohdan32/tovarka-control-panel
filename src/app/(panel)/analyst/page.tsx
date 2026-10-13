import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { Badge, Button, Card, PageHeader, Pills, Stat, Stats } from "@/components/ui";
import { askAnalyst, inboxDone } from "../actions";
import { Markdown } from "@/components/markdown";
import { ROLES, date } from "@/lib/format";

export const metadata: Metadata = { title: "Аналітик" };

export default async function AnalystPage({ searchParams }: PageProps<"/analyst">) {
  const { role } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data: reports }, sources, tasks, { data: questions }] = await Promise.all([
    supabase.from("analyst_reports").select("*").order("report_date", { ascending: false }).order("created_at", { ascending: true }).limit(200),
    supabase.from("research_sources").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("source", "analyst"),
    supabase.from("inbox").select("id, body, answer, answered_at, created_at, done").eq("kind", "question").order("created_at", { ascending: false }).limit(30),
  ]);
  const openQ = (questions ?? []).filter((q) => !q.done);
  const oldQ = (questions ?? []).filter((q) => q.done).slice(0, 5);
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

      <Card title="Спитати аналітика">
        <form action={askAnalyst} className="space-y-2">
          <textarea name="body" required rows={2} placeholder="Напр.: чи варто брати органайзери для взуття на зиму? Скільки реально коштує реклама в TikTok на старті?" className="w-full rounded-lg border border-black/15 bg-white px-2.5 py-2 text-base outline-none focus:border-indigo-500 sm:text-sm dark:border-white/15 dark:bg-zinc-950" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">Відповідь з’явиться тут після ранкового запуску, з джерелами.</span>
            <Button>Спитати</Button>
          </div>
        </form>
        {openQ.length > 0 && (
          <ul className="mt-3 space-y-3 border-t border-black/[.07] pt-3 dark:border-white/10">
            {openQ.map((q) => (
              <li key={q.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{q.body}</p>
                  {q.answer ? <Badge tone="green">відповів</Badge> : <Badge>чекає ранку</Badge>}
                </div>
                <p className="text-xs text-zinc-500">спитав {date(q.created_at)}{q.answered_at && ` · відповідь ${date(q.answered_at)}`}</p>
                {q.answer && (
                  <div className="mt-1.5 rounded-lg bg-zinc-50 p-2.5 dark:bg-white/5">
                    <Markdown text={q.answer} />
                    <form action={inboxDone} className="mt-1.5"><input type="hidden" name="id" value={q.id} /><button className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">Зрозумів, сховати</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {oldQ.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-zinc-500">Попередні відповіді · {oldQ.length}</summary>
            <ul className="mt-2 space-y-2">
              {oldQ.map((q) => (
                <li key={q.id}><p className="font-medium">{q.body}</p>{q.answer && <Markdown text={q.answer} />}</li>
              ))}
            </ul>
          </details>
        )}
      </Card>

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
