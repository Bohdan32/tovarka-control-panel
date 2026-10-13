import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Пошук" };

type Hit = { href: string; title: string; snippet?: string | null; ext?: boolean };

// Шматок тексту навколо знайденого слова, щоб було видно контекст.
function around(text: string | null | undefined, q: string) {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return flat.slice(0, 140);
  const from = Math.max(i - 60, 0);
  return `${from ? "…" : ""}${flat.slice(from, i + q.length + 80)}…`;
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q: raw } = await searchParams;
  // Кома, дужки й % ламають фільтр PostgREST, тому прибираємо їх із запиту.
  const q = (typeof raw === "string" ? raw : "").replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
  const { supabase } = await requireMember();

  let groups: [string, Hit[]][] = [];
  if (q.length >= 2) {
    const like = (cols: string[]) => cols.map((c) => `${c}.ilike.%${q}%`).join(",");
    const [products, tasks, templates, sources, guides, ideas, suppliers, steps] = await Promise.all([
      supabase.from("products").select("id, name, category, notes, thesis").or(like(["name", "category", "notes", "thesis", "ad_angle"])).limit(15),
      supabase.from("tasks").select("id, title, details, status").or(like(["title", "details", "help"])).limit(15),
      supabase.from("templates").select("id, title, body, kind").or(like(["title", "body"])).limit(15),
      supabase.from("research_sources").select("id, title, url, finding, publisher").or(like(["title", "finding", "publisher", "topic", "url"])).limit(15),
      supabase.from("guides").select("slug, title, summary, body").or(like(["title", "summary", "body"])).limit(10),
      supabase.from("ideas").select("id, title, why, status").or(like(["title", "why", "note"])).limit(15),
      supabase.from("suppliers").select("id, name, platform, notes").or(like(["name", "platform", "notes", "contact"])).limit(10),
      supabase.from("playbook_steps").select("id, title, goal, body").or(like(["title", "goal", "body"])).limit(10),
    ]);
    groups = [
      ["Товари", (products.data ?? []).map((p) => ({ href: `/products/${p.id}`, title: p.name, snippet: around(p.thesis ?? p.notes ?? p.category, q) }))],
      ["Задачі", (tasks.data ?? []).map((t) => ({ href: `/plan`, title: `${t.status === "done" ? "✓ " : ""}${t.title}`, snippet: around(t.details, q) }))],
      ["Кроки плану", (steps.data ?? []).map((s) => ({ href: `/plan`, title: s.title, snippet: around(s.body ?? s.goal, q) }))],
      ["Шаблони текстів", (templates.data ?? []).map((t) => ({ href: t.kind === "chat" ? `/sell?s=chat` : `/sell?s=texts`, title: t.title, snippet: around(t.body, q) }))],
      ["Інструкції", (guides.data ?? []).map((g) => ({ href: `/sell?s=${g.slug}`, title: g.title, snippet: around(g.body ?? g.summary, q) }))],
      ["Джерела", (sources.data ?? []).map((s) => ({ href: s.url, ext: true, title: s.title ?? s.url, snippet: around(s.finding, q) }))],
      ["Ідеї", (ideas.data ?? []).map((i) => ({ href: `/ideas`, title: i.title, snippet: around(i.why, q) }))],
      ["Постачальники", (suppliers.data ?? []).map((s) => ({ href: `/suppliers`, title: s.name, snippet: around(s.notes ?? s.platform, q) }))],
    ];
    groups = groups.filter(([, hits]) => hits.length);
  }
  const total = groups.reduce((a, [, h]) => a + h.length, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Пошук" subtitle="Товари, задачі, тексти, інструкції, джерела, ідеї й постачальники в одному місці." />
      <form className="flex gap-2">
        <input name="q" defaultValue={q} autoFocus placeholder="Напр.: відмова, Prom, органайзер, ФОП" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-base outline-none focus:border-indigo-500 dark:border-white/15 dark:bg-zinc-950" />
        <button className="rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white">Знайти</button>
      </form>
      {q.length >= 2 && !total && <p className="text-sm text-zinc-500">Нічого не знайшлось за «{q}». Спробуй коротше слово або корінь: «відмов» замість «відмовився».</p>}
      {groups.map(([name, hits]) => (
        <Card key={name} title={<span className="flex items-center gap-2">{name} <Badge>{hits.length}</Badge></span>}>
          <ul className="divide-y divide-black/[.06] dark:divide-white/5">
            {hits.map((h, i) => (
              <li key={i} className="py-2 first:pt-0 last:pb-0">
                {h.ext ? (
                  <a href={h.href} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">{h.title} ↗</a>
                ) : (
                  <Link href={h.href} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">{h.title}</Link>
                )}
                {h.snippet && <p className="text-xs leading-snug text-zinc-500">{h.snippet}</p>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
