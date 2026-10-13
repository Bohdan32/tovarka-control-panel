import { requireMember } from "@/lib/auth";
import { refreshRates, updateSettings } from "../actions";
import type { Metadata } from "next";
import { Button, Card, Field, FormGrid, PageHeader, Table, Td } from "@/components/ui";
import { date } from "@/lib/format";

const TABLES: Record<string, string> = {
  products: "товар", orders: "замовлення", transactions: "гроші", inventory_batches: "партія", tasks: "задача", ad_campaigns: "реклама", cost_settings: "налаштування",
};
const OPS: Record<string, string> = { insert: "додав", update: "змінив", delete: "видалив" };

export const metadata: Metadata = { title: "Налаштування" };

export default async function SettingsPage() {
  const { supabase } = await requireMember();
  const [{ data: s }, { data: rates }, { data: members }, { data: log }] = await Promise.all([
    supabase.from("cost_settings").select("*").eq("id", 1).single(),
    supabase.from("fx_rates").select("*").order("rate_date", { ascending: false }).limit(9),
    supabase.from("members").select("*"),
    supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(40),
  ]);
  const p = (v: number | string | undefined) => (v === undefined ? undefined : Math.round(Number(v) * 10000) / 100);

  return (
    <div className="space-y-4">
      <PageHeader title="Налаштування" subtitle="Ці параметри використовують усі розрахунки ціни, маржі й інвестицій." />
      <Card title="Параметри розрахунку">
        <form action={updateSettings} className="space-y-2.5">
          <FormGrid>
            <Field label="Курс USD/UAH" name="usd_rate" type="number" defaultValue={s?.usd_rate} />
            <Field label="Карго, $/кг (з митом)" name="cargo_usd_per_kg" type="number" defaultValue={s?.cargo_usd_per_kg} />
            <Field label="Упаковка й обробка, грн" name="packaging_uah" type="number" defaultValue={s?.packaging_uah} />
            <Field label="Комісії (банк, NovaPay, майданчик), %" name="fee_pct" type="number" defaultValue={p(s?.fee_pct)} />
            <Field label="Податки ФОП від ціни, %" name="tax_pct" type="number" defaultValue={p(s?.tax_pct)} />
            <Field label="Цільова маржа, %" name="target_margin" type="number" defaultValue={p(s?.target_margin)} />
            <Field label="Частка відмов, %" name="refusal_rate" type="number" defaultValue={p(s?.refusal_rate)} />
            <Field label="Зворотна доставка, грн" name="return_shipping_uah" type="number" defaultValue={s?.return_shipping_uah} />
            <Field label="CPA за замовчуванням, грн" name="default_cpa_uah" type="number" defaultValue={s?.default_cpa_uah} />
            <Field label="Ліміт ризику на один товар, грн" name="risk_limit_uah" type="number" defaultValue={s?.risk_limit_uah} />
            <Field label="Доставка партії, днів" name="lead_days" type="number" defaultValue={s?.lead_days} />
          </FormGrid>
          <Button>Зберегти</Button>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Курси НБУ">
          <p className="mb-2 text-sm text-zinc-500">Оновлюються автоматично щодня о 07:00 за Києвом. Курс долара одразу підставляється в розрахунки.</p>
          <Table head={["Дата", "Валюта", "Курс"]} empty={!rates?.length}>
            {rates?.map((r) => (
              <tr key={`${r.currency}-${r.rate_date}`}>
                <Td>{date(r.rate_date)}</Td>
                <Td>{r.currency}</Td>
                <Td>{Number(r.rate).toFixed(4)}</Td>
              </tr>
            ))}
          </Table>
          <form action={refreshRates} className="mt-3">
            <Button variant="ghost">Оновити зараз</Button>
          </form>
        </Card>
        <Card title="Копія всіх даних">
          <p className="mb-2 text-sm text-zinc-500">Безкоштовна база не гарантує відновлення після збою. Раз на тиждень завантажуй копію: товари, замовлення, гроші, задачі — усе в одному файлі.</p>
          <a href="/settings/backup" className="inline-block rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:border-indigo-400 dark:border-white/15">Завантажити копію</a>
        </Card>
        <Card title="Доступ">
          <p className="mb-2 text-sm text-zinc-500">Увійти можуть лише ці email. Щоб додати партнера, попроси Claude в проєкті.</p>
          <Table head={["Хто", "Email", "Частка"]}>
            {members?.map((m) => (
              <tr key={m.email}>
                <Td>{m.display_name}</Td>
                <Td>{m.email}</Td>
                <Td>{Number(m.share_pct)}%</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card title="Історія змін">
        {log?.length ? (
          <ul className="divide-y divide-black/[.06] text-sm dark:divide-white/5">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                <span className="text-xs tabular-nums text-zinc-500">{new Date(l.at).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" })}</span>
                <span className="font-medium">{members?.find((m) => m.email === l.who)?.display_name ?? (l.who === "система" ? "Бот / аналітик" : l.who)}</span>
                <span>{OPS[l.op] ?? l.op} {TABLES[l.tbl] ?? l.tbl}</span>
                {l.label && <span className="min-w-0 truncate text-zinc-500">«{l.label}»</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Тут видно, хто і що змінив: товари, замовлення, гроші, партії, задачі, рекламу. Корисно, коли працюєте вдвох.</p>
        )}
      </Card>
    </div>
  );
}