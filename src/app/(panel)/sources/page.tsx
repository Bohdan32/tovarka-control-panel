import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { ConfirmButton } from "@/components/confirm";
import { productOptions } from "@/lib/products";
import { createSource, deleteSource } from "../actions";
import { AddForm, Badge, Button, Card, Ext, Field, FormGrid, PageHeader, Pills, Select, Stat, Stats, Table, Td, TextArea } from "@/components/ui";
import { SOURCE_KINDS, SOURCE_TOPICS, date, daysUntil } from "@/lib/format";

export const metadata: Metadata = { title: "Джерела" };

export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const { topic } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data }, products] = await Promise.all([
    supabase.from("research_sources").select("*, products(name)").order("checked_on", { ascending: false }).order("created_at", { ascending: false }),
    productOptions(supabase),
  ]);
  const all = data ?? [];
  const rows = typeof topic === "string" ? all.filter((s) => s.topic === topic) : all;
  const topics = [...new Set([...SOURCE_TOPICS, ...all.map((s) => s.topic)])];
  const stale = all.filter((s) => (daysUntil(s.checked_on) ?? 0) < -60).length;
  const strong = all.filter((s) => (s.reliability ?? 0) >= 4).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Джерела" subtitle="База, на якій стоять цифри плану і висновки аналітика. Кожен факт — з посиланням і оцінкою надійності." />

      <Stats>
        <Stat label="Джерел" value={all.length} />
        <Stat label="Надійних (4–5)" value={strong} hint={`${Math.round((strong / Math.max(all.length, 1)) * 100)}% бази`} />
        <Stat label="Офіційних" value={all.filter((s) => s.kind === "official").length} />
        <Stat label="Про попит" value={all.filter((s) => s.topic === "попит").length} />
        <Stat label="По товарах" value={all.filter((s) => s.product_id).length} />
        <Stat label="Старші 60 днів" value={stale} tone={stale ? "warn" : "good"} hint="перевірити ще раз" />
      </Stats>

      <Pills
        active={typeof topic === "string" ? `/sources?topic=${encodeURIComponent(topic)}` : "/sources"}
        items={[
          ["/sources", "Усі", all.length],
          ...topics.map((t) => [`/sources?topic=${encodeURIComponent(t)}`, t, all.filter((s) => s.topic === t).length] as [string, string, number]),
        ]}
      />

      <Card pad={false} className="p-2 sm:p-3">
        <Table head={["Джерело", "Що каже", "Тип", "Надійність", "Товар", "Перевірено", ""]} empty={!rows.length}>
          {rows.map((s) => (
            <tr key={s.id}>
              <Td className="min-w-48">
                <Ext href={s.url}>{s.title}</Ext>
                <div className="text-xs text-zinc-500">{s.publisher ?? ""}{s.published_on && ` · ${date(s.published_on)}`}</div>
              </Td>
              <Td className="rt-wide max-w-md text-zinc-600 dark:text-zinc-400">{s.finding ?? "—"}</Td>
              <Td><Badge>{SOURCE_KINDS[s.kind] ?? s.kind}</Badge></Td>
              <Td><Badge tone={(s.reliability ?? 0) >= 4 ? "green" : (s.reliability ?? 0) >= 3 ? "amber" : "red"}>{s.reliability ?? "?"}/5</Badge></Td>
              <Td>{s.product_id ? <Link href={`/products/${s.product_id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">{s.products?.name}</Link> : "—"}</Td>
              <Td className="whitespace-nowrap">{date(s.checked_on)}</Td>
              <Td>
                <form action={deleteSource}>
                  <input type="hidden" name="id" value={s.id} />
                  <ConfirmButton message="Видалити джерело?" className="text-xs text-red-600 hover:underline">видалити</ConfirmButton>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <AddForm title="Додати джерело">
        <form action={createSource} className="space-y-2.5">
          <FormGrid>
            <div className="col-span-2"><Field label="Посилання" name="url" required /></div>
            <div className="col-span-2"><Field label="Назва" name="title" /></div>
            <Field label="Хто опублікував" name="publisher" />
            <Select label="Тип" name="kind" options={SOURCE_KINDS} defaultValue="media" />
            <Select label="Тема" name="topic" options={SOURCE_TOPICS.map((t) => [t, t] as [string, string])} />
            <Select label="Надійність" name="reliability" options={{ "5": "5 — офіційне", "4": "4 — надійне", "3": "3 — середнє", "2": "2 — слабке", "1": "1 — чутки" }} defaultValue="3" />
            <Select label="Товар" name="product_id" includeEmpty="—" options={products} />
            <Field label="Дата публікації" name="published_on" type="date" />
          </FormGrid>
          <TextArea label="Що каже (цифри, факти)" name="finding" rows={2} />
          <Button>Додати</Button>
        </form>
      </AddForm>
    </div>
  );
}
