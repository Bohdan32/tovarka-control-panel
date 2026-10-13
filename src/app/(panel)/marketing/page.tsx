import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { addOrganicPost, createAsset, createCampaign, updateCampaign, updateOrganicPost } from "../actions";
import { daysAgoIso } from "@/lib/orders";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Ext, Field, FormGrid, PageHeader, Progress, Select, Stat, Stats, Table, Td, TextArea, miniInput } from "@/components/ui";
import { ASSET_KINDS, money } from "@/lib/format";

export const metadata: Metadata = { title: "Маркетинг" };

const CAMPAIGN_STATUS = { draft: "Чернетка", active: "Активна", stopped: "Зупинена" };
const AD_TO_ORDER: Record<string, string> = { Meta: "Instagram", Google: "Сайт", TikTok: "TikTok", Prom: "Prom" };
const ASSET_STATUS = { draft: "Чернетка", approved: "Погоджено", live: "Працює" };

export default async function MarketingPage() {
  const { supabase } = await requireMember();
  const since30 = daysAgoIso(29).slice(0, 10);
  const [campaigns, assets, products, { data: settings }, { data: orders }, { data: extra }, { data: posts }] = await Promise.all([
    supabase.from("campaign_performance").select("*").order("started_on", { ascending: false }),
    supabase.from("marketing_assets").select("*, products(name)").order("created_at", { ascending: false }),
    productOptions(supabase),
    supabase.from("cost_settings").select("default_cpa_uah").eq("id", 1).single(),
    supabase.from("orders").select("channel, status, qty, price_uah").neq("status", "cancelled"),
    supabase.from("ad_campaigns").select("id, creative, clicks"),
    supabase.from("organic_posts").select("*, products(name)").order("posted_on", { ascending: false }).limit(60),
  ]);
  // Органіка: скільки днів з 30 останніх був хоча б один ролик і який хук набрав найбільше.
  const recent = (posts ?? []).filter((x) => x.posted_on >= since30);
  const postDays = new Set(recent.map((x) => x.posted_on)).size;
  const views = recent.reduce((a, x) => a + Number(x.views ?? 0), 0);
  const best = [...recent].sort((a, b) => Number(b.views ?? 0) - Number(a.views ?? 0))[0];
  const ex = new Map((extra ?? []).map((e) => [e.id, e]));

  const rows = campaigns.data ?? [];
  const spend = rows.reduce((a, c) => a + Number(c.spend_uah), 0);
  const ordersCount = rows.reduce((a, c) => a + Number(c.orders_count), 0);
  // Стоп-правило: дві допустимі ціни замовлення витрачено, а продажів немає.
  const limitOf = (c: (typeof rows)[number]) => Number(c.cpa_max_uah ?? settings?.default_cpa_uah ?? 0);
  const stop = rows.filter((c) => c.status === "active" && limitOf(c) > 0 && Number(c.orders_count) === 0 && Number(c.spend_uah) >= 2 * limitOf(c));
  // Звідки приходять замовлення: реклама Meta веде в Instagram, Google — на сайт.
  const byChannel = new Map<string, { orders: number; delivered: number; refused: number; revenue: number; spend: number }>();
  const ch = (k: string) => byChannel.get(k) ?? byChannel.set(k, { orders: 0, delivered: 0, refused: 0, revenue: 0, spend: 0 }).get(k)!;
  for (const o of orders ?? []) {
    const g = ch(o.channel?.trim() || "Інше");
    g.orders++;
    if (o.status === "delivered") { g.delivered++; g.revenue += Number(o.price_uah) * o.qty; }
    if (o.status === "refused" || o.status === "returned") g.refused++;
  }
  for (const c of rows) ch(AD_TO_ORDER[c.channel as string] ?? c.channel ?? "Інше").spend += Number(c.spend_uah);
  const channelRows = [...byChannel.entries()].sort((a, b) => b[1].orders - a[1].orders || b[1].spend - a[1].spend);
  // Тест креативів: кілька активних кампаній одного товару — після 200 грн на кожну лишаємо найдешевшу.
  const TEST_SPEND = 200;
  const activeBy = new Map<string, typeof rows>();
  for (const c of rows) if (c.status === "active") activeBy.set(c.product_id!, [...(activeBy.get(c.product_id!) ?? []), c]);
  const tests = [...activeBy.values()]
    .filter((g) => g.length >= 2)
    .map((g) => {
      const cost = (c: (typeof g)[number]) => {
        const o = Number(c.orders_count), k = Number(ex.get(c.id!)?.clicks ?? 0), sp = Number(c.spend_uah);
        return o ? { v: sp / o, by: "замовлення" } : k ? { v: sp / k, by: "клік" } : null;
      };
      const ready = g.every((c) => Number(c.spend_uah) >= TEST_SPEND);
      const ranked = g.map((c) => ({ c, cost: cost(c) })).sort((a, b) => {
        // Спершу ті, що дали замовлення, далі за ціною.
        if (!a.cost || !b.cost) return a.cost ? -1 : b.cost ? 1 : 0;
        if (a.cost.by !== b.cost.by) return a.cost.by === "замовлення" ? -1 : 1;
        return a.cost.v - b.cost.v;
      });
      return { product: g[0].product_name, ready, ranked };
    });
  const losing = rows.filter((c) => c.cpa_uah !== null && c.cpa_max_uah !== null && Number(c.cpa_uah) > Number(c.cpa_max_uah)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Маркетинг" subtitle="Реклама порівнюється з CPA max: якщо замовлення дорожче, кампанія йде в мінус. Дві CPA max без продажу — сигнал зупинитись." />
      <Stats>
        <Stat label="Кампаній" value={rows.length} hint={`${rows.filter((c) => c.status === "active").length} активних`} />
        <Stat label="Витрачено" value={money(spend)} />
        <Stat label="Замовлень з реклами" value={ordersCount} />
        <Stat label="Середній CPA" value={money(ordersCount ? spend / ordersCount : null)} />
        <Stat label="У мінусі" value={losing} tone={losing ? "bad" : "good"} />
        <Stat label="Матеріалів" value={assets.data?.length ?? 0} hint={`${(assets.data ?? []).filter((a) => a.status === "live").length} працюють`} />
      </Stats>

      <Card title="Звідки прийшло замовлення">
        {channelRows.length ? (
          <Table head={["Канал", "Замовлень", "Отримали", "Відмови", "Виручка", "Реклама", "CPA"]}>
            {channelRows.map(([name, g]) => (
              <tr key={name}>
                <Td className="font-medium">{name}</Td>
                <Td>{g.orders}</Td>
                <Td>{g.delivered}</Td>
                <Td>{g.refused ? <Badge tone={g.refused / Math.max(g.delivered + g.refused, 1) > 0.2 ? "red" : "gray"}>{g.refused}</Badge> : 0}</Td>
                <Td>{money(g.revenue)}</Td>
                <Td>{g.spend ? money(g.spend) : <span className="text-zinc-500">безкоштовно</span>}</Td>
                <Td>{g.spend ? (g.orders ? money(g.spend / g.orders) : <Badge tone="red">0 замовлень</Badge>) : "—"}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-zinc-500">Тут з’явиться, який канал приносить замовлення і скільки коштує кожне. Канал вибирається при додаванні замовлення, бот ставить «Telegram» сам.</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">Реклама Meta зараховується в Instagram, Google — у Сайт. Канал без витрат і з замовленнями — найдешевший, вкладай туди час.</p>
      </Card>

      {stop.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-500/40 dark:bg-red-500/10">
          <p className="font-semibold text-red-700 dark:text-red-300">Зупини рекламу: {stop.map((c) => `${c.product_name}${c.name ? ` (${c.name})` : ""}`).join(", ")}</p>
          <p className="mt-1 text-red-700/80 dark:text-red-300/80">
            Витрачено вже дві допустимі ціни замовлення, а продажів немає. «Ще трошки» тут не допоможе: міняй відео, ціну або товар, а не бюджет.
          </p>
        </div>
      )}

      <Card title={`Органіка: 30 відео за 30 днів · ${postDays}/30`} action={<span className="w-24"><Progress value={postDays / 30} tone={postDays >= 25 ? "green" : "indigo"} /></span>}>
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          Безкоштовні перегляди: одне коротке відео щодня, руками й без обличчя. Алгоритм любить регулярність, тож краще просте відео щодня, ніж ідеальне раз на тиждень.
          {recent.length > 0 && <> За 30 днів: <b>{views.toLocaleString("uk-UA")}</b> переглядів{best?.views ? <>, найкраще — «{best.hook ?? "без хука"}» ({Number(best.views).toLocaleString("uk-UA")}). Зніми ще 2 варіації цього хука.</> : "."}</>}
        </p>
        <form action={addOrganicPost} className="mb-3 flex flex-wrap gap-1.5">
          <input type="date" name="posted_on" defaultValue={daysAgoIso(0).slice(0, 10)} className={miniInput} aria-label="Дата" />
          <select name="platform" className={miniInput} aria-label="Платформа"><option>TikTok</option><option>Reels</option><option>Shorts</option></select>
          <select name="product_id" className={`${miniInput} max-w-40`} aria-label="Товар"><option value="">товар —</option>{products.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="hook" placeholder="Хук: перші 3 секунди" className={`${miniInput} min-w-0 flex-1`} required />
          <input name="url" placeholder="посилання" className={`${miniInput} w-32`} />
          <button className="rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white">Додати</button>
        </form>
        {(posts ?? []).length > 0 && (
          <ul className="divide-y divide-black/[.06] text-sm dark:divide-white/5">
            {(posts ?? []).slice(0, 10).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  {x.url ? <Ext href={x.url}>{x.hook ?? "відео"}</Ext> : x.hook ?? "відео"}
                  <span className="block text-xs text-zinc-500">{x.posted_on} · {x.platform}{x.products?.name ? ` · ${x.products.name}` : ""}</span>
                </span>
                <form action={updateOrganicPost} className="flex gap-1">
                  <input type="hidden" name="id" value={x.id} />
                  <input name="views" type="number" defaultValue={x.views ?? ""} placeholder="перегл." className={`${miniInput} w-20`} aria-label="Перегляди" />
                  <input name="clicks" type="number" defaultValue={x.clicks ?? ""} placeholder="кліки" className={`${miniInput} w-16`} aria-label="Переходи" />
                  <input name="orders" type="number" defaultValue={x.orders ?? ""} placeholder="зам." className={`${miniInput} w-14`} aria-label="Замовлення" />
                  <button className="rounded-md bg-indigo-600 px-2 text-xs font-medium text-white">ok</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {tests.map((t) => (
        <Card key={t.product} title={`Тест креативів · ${t.product}`}>
          {t.ready && t.ranked[0]?.cost ? (
            <p className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">Лиши «{t.ranked[0].c.name ?? ex.get(t.ranked[0].c.id!)?.creative ?? t.ranked[0].c.channel}», решту вимкни, а звільнений бюджет додай переможцю.</p>
          ) : (
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Чекаємо, поки кожна кампанія витратить по {TEST_SPEND} грн. Нічого не змінюй до того.</p>
          )}
          <ol className="space-y-1 text-sm">
            {t.ranked.map(({ c, cost }, i) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2">
                <span>{i + 1}. {c.name ?? c.channel}{ex.get(c.id!)?.creative && <span className="text-xs italic text-zinc-500"> «{ex.get(c.id!)?.creative}»</span>}</span>
                <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{money(c.spend_uah)} · {cost ? `${money(cost.v)}/${cost.by}` : "ще без даних"}</span>
              </li>
            ))}
          </ol>
        </Card>
      ))}

      <details className="rounded-xl border border-black/[.07] bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-900">
        <summary className="cursor-pointer font-semibold">Як тестувати креативи: 3 оголошення по 200 грн</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Зніми 3 різні відео на один товар: різний перший кадр (проблема, результат «до і після», незвичне використання). Решта однакова.</li>
          <li>Створи 3 кампанії з однаковим бюджетом і аудиторією. У полі «Креатив» запиши, чим вони відрізняються.</li>
          <li>3 дні нічого не чіпай. Щодня вноси витрати, кліки й замовлення.</li>
          <li>Коли кожна витратила {TEST_SPEND} грн — пульт покаже переможця. Лиш його, решту вимкни.</li>
          <li>Наступного тижня — 2 нові варіанти проти переможця. Так за місяць видно, що працює саме в тебе.</li>
        </ol>
      </details>

      <Card title="Рекламні кампанії · журнал креативів">
        <Table head={["Товар і креатив", "Канал", "Витрачено", "Кліки", "Замовлень", "CPA", "CPA max", "Статус", "Оновити"]} empty={!campaigns.data?.length}>
          {campaigns.data?.map((c) => {
            const over = c.cpa_uah !== null && c.cpa_max_uah !== null && Number(c.cpa_uah) > Number(c.cpa_max_uah);
            return (
              <tr key={c.id}>
                <Td>
                  {c.product_name}{c.name && <div className="text-xs text-zinc-500">{c.name}</div>}
                  {ex.get(c.id!)?.creative && <div className="mt-0.5 max-w-64 text-xs italic text-zinc-500">«{ex.get(c.id!)?.creative}»</div>}
                </Td>
                <Td>{c.channel}</Td>
                <Td>{money(c.spend_uah)}</Td>
                <Td>{ex.get(c.id!)?.clicks ? <>{ex.get(c.id!)?.clicks}<div className="text-xs text-zinc-500">{money(Number(c.spend_uah) / Number(ex.get(c.id!)?.clicks))}/клік</div></> : "—"}</Td>
                <Td>{c.orders_count}</Td>
                <Td><Badge tone={c.cpa_uah === null ? "gray" : over ? "red" : "green"}>{money(c.cpa_uah)}</Badge></Td>
                <Td>{money(c.cpa_max_uah)}</Td>
                <Td>{CAMPAIGN_STATUS[c.status as keyof typeof CAMPAIGN_STATUS]}</Td>
                <Td>
                  <form action={updateCampaign} className="flex flex-wrap justify-end gap-1 sm:justify-start">
                    <input type="hidden" name="id" value={c.id!} />
                    <input name="spend_uah" type="number" step="any" defaultValue={c.spend_uah ?? 0} className={`${miniInput} w-20`} aria-label="Витрачено" title="Витрачено, грн" />
                    <input name="clicks" type="number" defaultValue={ex.get(c.id!)?.clicks ?? ""} placeholder="кліки" className={`${miniInput} w-16`} aria-label="Кліки" title="Кліки" />
                    <input name="orders_count" type="number" defaultValue={c.orders_count ?? 0} className={`${miniInput} w-14`} aria-label="Замовлень" title="Замовлень" />
                    <select name="status" defaultValue={c.status ?? "active"} className={miniInput}>
                      {Object.entries(CAMPAIGN_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="rounded-md bg-indigo-600 px-2 text-xs font-medium text-white">ok</button>
                  </form>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <AddForm title="Нова кампанія">
        <form action={createCampaign} className="space-y-2.5">
          <FormGrid>
            <Select label="Товар" name="product_id" options={products} />
            <Select label="Канал" name="channel" options={{ Meta: "Meta (FB/IG)", TikTok: "TikTok", Google: "Google", Prom: "Prom", Інше: "Інше" }} />
            <Field label="Назва" name="name" />
            <Field label="Витрачено, грн" name="spend_uah" type="number" />
          </FormGrid>
          <TextArea label="Креатив: перші 3 секунди відео або заголовок" name="creative" rows={2} placeholder="напр. «Шафа до і після за 30 секунд», руки, без обличчя" />
          <Button>Створити</Button>
        </form>
      </AddForm>

      <Card title="Лендінги, тексти, акаунти">
        <Table head={["Тип", "Назва", "Товар", "Статус", "Посилання"]} empty={!assets.data?.length}>
          {assets.data?.map((a) => (
            <tr key={a.id}>
              <Td>{ASSET_KINDS[a.kind]}</Td>
              <Td>
                <details>
                  <summary className="cursor-pointer">{a.title}</summary>
                  {a.content && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-zinc-600 dark:text-zinc-400">{a.content}</pre>}
                </details>
              </Td>
              <Td>{a.products?.name ?? "—"}</Td>
              <Td><Badge tone={a.status === "live" ? "green" : a.status === "approved" ? "blue" : "gray"}>{ASSET_STATUS[a.status as keyof typeof ASSET_STATUS]}</Badge></Td>
              <Td><Ext href={a.url} /></Td>
            </tr>
          ))}
        </Table>
      </Card>
      <AddForm title="Новий лендінг, текст або акаунт">
        <form action={createAsset} className="space-y-2.5">
          <FormGrid>
            <Select label="Тип" name="kind" options={ASSET_KINDS} />
            <Field label="Назва" name="title" required />
            <Select label="Товар" name="product_id" options={products} includeEmpty="—" />
            <Field label="Посилання" name="url" />
          </FormGrid>
          <TextArea label="Текст" name="content" rows={4} />
          <Button>Додати</Button>
        </form>
      </AddForm>
    </div>
  );
}
