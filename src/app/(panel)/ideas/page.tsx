import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { AddForm, Button, Empty, Field, FormGrid, PageHeader, Pills, Select, Stat, Stats, TextArea } from "@/components/ui";
import { createIdea } from "../actions";
import { AREAS, IdeaCard, PHASES, value, type Idea } from "@/components/ideas";

export const metadata: Metadata = { title: "Ідеї" };

export default async function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  const sp = await searchParams;
  const v = typeof sp.v === "string" ? sp.v : "top";
  const p = typeof sp.p === "string" && sp.p in PHASES ? sp.p : "";
  const { supabase } = await requireMember();
  const { data } = await supabase.from("ideas").select("id, area, phase, title, why, catch, impact, effort, cost, status, top, task_id, sort");
  const all = ((data ?? []) as (Idea & { sort: number })[]).sort(
    (a, b) => (a.top ?? 99) - (b.top ?? 99) || value(b) - value(a) || a.sort - b.sort,
  );
  const count = (s: string) => all.filter((i) => i.status === s).length;
  const live = all.filter((i) => i.status !== "skip" && i.status !== "done");

  let list: Idea[];
  if (v === "top") list = all.filter((i) => i.top);
  else if (v === "quick") list = live.filter((i) => i.impact === 3 && i.effort === 1);
  else if (["want", "doing", "done", "skip"].includes(v)) list = all.filter((i) => i.status === v);
  else if (v in AREAS) list = all.filter((i) => i.area === v);
  else list = live;
  if (p) list = list.filter((i) => i.phase === p);

  const q = (view: string, phase = p) => `/ideas?v=${view}${phase ? `&p=${phase}` : ""}`;
  const views: [string, string, number?][] = [
    [q("top"), "Топ-10"],
    [q("quick"), "Швидкі перемоги", live.filter((i) => i.impact === 3 && i.effort === 1).length],
    [q("want"), "Хочу", count("want")],
    [q("doing"), "В роботі", count("doing")],
    [q("all"), "Усі", live.length],
    ...Object.entries(AREAS).map(([k, label]) => [q(k), label, all.filter((i) => i.area === k).length] as [string, string, number]),
    [q("done"), "Готово", count("done")],
    [q("skip"), "Не треба", count("skip")],
  ];
  const phases: [string, string][] = [[q(v, ""), "Будь-коли"], ...Object.entries(PHASES).map(([k, label]) => [q(v, k), label] as [string, string])];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Ідеї"
        subtitle="Що додати в пульт і в бізнес, з ефектом, обсягом роботи й ціною. Познач «Хочу», і Claude братиме ці ідеї в роботу першими; «→ у план» кладе ідею в задачі." />
      <Stats>
        <Stat label="Ідей" value={all.length} hint={`${all.filter((i) => i.impact === 3).length} з великим ефектом`} />
        <Stat label="Хочу" value={count("want")} href={q("want")} />
        <Stat label="В роботі" value={count("doing")} href={q("doing")} />
        <Stat label="Готово" value={count("done")} tone="good" href={q("done")} />
      </Stats>
      <div>
        <Pills items={views} active={q(v)} />
        <div className="-mt-1.5"><Pills items={phases} active={q(v, p)} /></div>
      </div>

      {v === "top" && !p && (
        <p className="text-[13px] leading-snug text-zinc-500">
          Що я зробив би першим. Логіка проста: поки не виконано жодної задачі плану, головний ризик не в нестачі функцій, а в тому, щоб не почати або почати з дорогої помилки. Тому зверху — дешева перевірка попиту, захист від поганих товарів і те, що щодня штовхає до дії.
        </p>
      )}

      {list.length ? (
        <ul className="grid gap-2 lg:grid-cols-2">
          {list.map((i) => <IdeaCard key={i.id} i={i} showArea={!(v in AREAS)} />)}
        </ul>
      ) : (
        <Empty>Тут поки порожньо</Empty>
      )}

      <AddForm title="Своя ідея">
        <form action={createIdea} className="space-y-2.5">
          <Field label="Що зробити" name="title" required />
          <TextArea label="Навіщо (необов'язково)" name="why" rows={2} />
          <FormGrid>
            <Select label="Розділ" name="area" options={AREAS} defaultValue="daily" />
            <Select label="Коли" name="phase" options={PHASES} defaultValue="now" />
            <Select label="Ефект" name="impact" options={[["3", "великий"], ["2", "середній"], ["1", "малий"]]} defaultValue="2" />
            <Select label="Роботи" name="effort" options={[["1", "години"], ["2", "1–3 дні"], ["3", "тиждень+"]]} defaultValue="2" />
          </FormGrid>
          <Field label="Ціна (необов'язково)" name="cost" placeholder="0 грн" />
          <Button>Додати</Button>
        </form>
      </AddForm>
    </div>
  );
}
