import { requireMember } from "@/lib/auth";
import { createSupplier } from "../actions";
import type { Metadata } from "next";
import { AddForm, Button, Card, Ext, Field, FormGrid, PageHeader, Stat, Stats, Table, Td, TextArea } from "@/components/ui";
import { num } from "@/lib/format";

export const metadata: Metadata = { title: "Постачальники" };

export default async function SuppliersPage() {
  const { supabase } = await requireMember();
  const { data: suppliers } = await supabase.from("suppliers").select("*, offers(count)").order("rating", { ascending: false, nullsFirst: false });

  return (
    <div className="space-y-4">
      <PageHeader title="Постачальники" subtitle="Китай (1688, Alibaba, Made-in-China) і українські оптовики. Пропозиції додаються на сторінці товару." />
      <Stats>
        <Stat label="Постачальників" value={suppliers?.length ?? 0} />
        <Stat label="З Китаю" value={(suppliers ?? []).filter((s) => s.country === "CN").length} />
        <Stat label="З України" value={(suppliers ?? []).filter((s) => s.country === "UA").length} />
        <Stat label="Пропозицій" value={(suppliers ?? []).reduce((a, s) => a + (s.offers?.[0]?.count ?? 0), 0)} />
        <Stat label="Рейтинг 4+" value={(suppliers ?? []).filter((s) => Number(s.rating) >= 4).length} />
        <Stat label="Без контакту" value={(suppliers ?? []).filter((s) => !s.contact).length} tone="warn" />
      </Stats>
      <Card pad={false} className="p-2 sm:p-3">
        <Table head={["Назва", "Країна", "Платформа", "Рейтинг", "Пропозицій", "Контакт", "Нотатки"]} empty={!suppliers?.length}>
          {suppliers?.map((s) => (
            <tr key={s.id}>
              <Td><Ext href={s.url}>{s.name}</Ext></Td>
              <Td>{s.country}</Td>
              <Td>{s.platform ?? "—"}</Td>
              <Td>{num(s.rating)}</Td>
              <Td>{s.offers?.[0]?.count ?? 0}</Td>
              <Td>{s.contact ?? "—"}</Td>
              <Td className="rt-wide max-w-xs text-zinc-500">{s.notes ?? ""}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <AddForm title="Додати постачальника">
        <form action={createSupplier} className="space-y-2.5">
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
      </AddForm>
    </div>
  );
}
