import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createProduct } from "../actions";
import { Badge, Button, Card, Field, FormGrid, PageHeader, Table, Td, TextArea } from "@/components/ui";
import { STAGES, date } from "@/lib/format";

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { stage } = await searchParams;
  const { supabase } = await requireMember();
  let query = supabase.from("products").select("*").order("score", { ascending: false, nullsFirst: false });
  if (typeof stage === "string") query = query.eq("stage", stage);
  const { data: products } = await query;

  return (
    <div className="space-y-6">
      <PageHeader title="Товари і попит" subtitle="Кожен товар іде воронкою: ідея → попит → постачальник → економіка → тест → продажі." />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/products" className={!stage ? "font-semibold" : "text-sky-600"}>Усі</Link>
        {Object.entries(STAGES).map(([k, v]) => (
          <Link key={k} href={`/products?stage=${k}`} className={stage === k ? "font-semibold" : "text-sky-600"}>{v}</Link>
        ))}
      </div>

      <Card>
        <Table head={["Товар", "Категорія", "Етап", "Оцінка", "Додано"]} empty={!products?.length}>
          {products?.map((p) => (
            <tr key={p.id}>
              <Td><Link href={`/products/${p.id}`} className="font-medium text-sky-600 hover:underline">{p.name}</Link></Td>
              <Td>{p.category ?? "—"}</Td>
              <Td><Badge tone={p.stage === "rejected" ? "red" : p.stage === "selling" ? "green" : "gray"}>{STAGES[p.stage]}</Badge></Td>
              <Td>{p.score ?? "—"}</Td>
              <Td>{date(p.created_at)}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Додати товар-кандидат">
        <form action={createProduct} className="space-y-3">
          <FormGrid>
            <Field label="Назва" name="name" required />
            <Field label="Категорія" name="category" />
            <Field label="Вага, кг" name="weight_kg" type="number" />
            <Field label="Де побачили (посилання)" name="source_url" />
          </FormGrid>
          <TextArea label="Нотатки" name="notes" rows={2} />
          <Button>Додати</Button>
        </form>
      </Card>
    </div>
  );
}
