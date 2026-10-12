import { requireMember } from "@/lib/auth";
import { refreshRates, updateSettings } from "../actions";
import { Button, Card, Field, FormGrid, PageHeader, Table, Td } from "@/components/ui";
import { date } from "@/lib/format";

export default async function SettingsPage() {
  const { supabase } = await requireMember();
  const [{ data: s }, { data: rates }, { data: members }] = await Promise.all([
    supabase.from("cost_settings").select("*").eq("id", 1).single(),
    supabase.from("fx_rates").select("*").order("rate_date", { ascending: false }).limit(9),
    supabase.from("members").select("*"),
  ]);
  const p = (v: number | string | undefined) => (v === undefined ? undefined : Math.round(Number(v) * 10000) / 100);

  return (
    <div className="space-y-6">
      <PageHeader title="Налаштування" subtitle="Ці параметри використовують усі розрахунки ціни, маржі й інвестицій." />
      <Card title="Параметри розрахунку">
        <form action={updateSettings} className="space-y-3">
          <FormGrid>
            <Field label="Курс USD/UAH" name="usd_rate" type="number" defaultValue={s?.usd_rate} />
            <Field label="Карго, $/кг (з митом)" name="cargo_usd_per_kg" type="number" defaultValue={s?.cargo_usd_per_kg} />
            <Field label="Упаковка й обробка, грн" name="packaging_uah" type="number" defaultValue={s?.packaging_uah} />
            <Field label="Комісії, %" name="fee_pct" type="number" defaultValue={p(s?.fee_pct)} />
            <Field label="Цільова маржа, %" name="target_margin" type="number" defaultValue={p(s?.target_margin)} />
            <Field label="Частка відмов, %" name="refusal_rate" type="number" defaultValue={p(s?.refusal_rate)} />
            <Field label="Зворотна доставка, грн" name="return_shipping_uah" type="number" defaultValue={s?.return_shipping_uah} />
            <Field label="CPA за замовчуванням, грн" name="default_cpa_uah" type="number" defaultValue={s?.default_cpa_uah} />
          </FormGrid>
          <Button>Зберегти</Button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Курси НБУ">
          <p className="mb-3 text-sm text-zinc-500">Оновлюються автоматично щодня о 07:00 за Києвом. Курс долара одразу підставляється в розрахунки.</p>
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
        <Card title="Доступ">
          <p className="mb-3 text-sm text-zinc-500">Увійти можуть лише ці email. Щоб додати партнера, попроси Claude в проєкті.</p>
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
    </div>
  );
}
