import { requireMember } from "@/lib/auth";
import { createSupplier } from "../actions";
import { Button, Card, Ext, Field, FormGrid, PageHeader, Table, Td, TextArea } from "@/components/ui";
import { num } from "@/lib/format";

export default async function SuppliersPage() {
  const { supabase } = await requireMember();
  const { data: suppliers } = await supabase.from("suppliers").select("*, offers(count)").order("rating", { ascending: false, nullsFirst: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Постачальники" subtitle="Китай (1688, Alibaba, AliExpress) і українські оптовики. Пропозиції додаються на сторінці товару." />
      <Card>
        <Table head={["Назва", "Країна", "Платформа", "Рейтинг", "Пропозицій", "Контакт", "Нотатки"]} empty={!suppliers?.length}>
          {suppliers?.map((s) => (
            <tr key={s.id}>
              <Td><Ext href={s.url}>{s.name}</Ext></Td>
              <Td>{s.country}</Td>
              <Td>{s.platform ?? "—"}</Td>
              <Td>{num(s.rating)}</Td>
              <Td>{s.offers?.[0]?.count ?? 0}</Td>
              <Td>{s.contact ?? "—"}</Td>
              <Td className="max-w-xs text-zinc-500">{s.notes ?? ""}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="Додати постачальника">
        <form action={createSupplier} className="space-y-3">
          <FormGrid>
            <Field label="Назва" name="name" required />
            <Field label="Країна" name="country" defaultValue="CN" />
            <Field label="Платформа" name="platform" placeholder="1688, Alibaba…" />
            <Field label="Рейтинг 0–5" name="rating" type="number" />
            <Field label="Контакт" name="contact" placeholder="WeChat, email…" />
            <Field label="Посилання" name="url" />
          </FormGrid>
          <TextArea label="Нотатки (якість зразків, умови)" name="notes" rows={2} />
          <Button>Додати</Button>
        </form>
      </Card>
    </div>
  );
}
