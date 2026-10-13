"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { numOrNull, pctOrNull, str } from "@/lib/form";
import { BATCH_CHECKS } from "@/lib/checks";
import { randomBytes } from "node:crypto";

async function db() {
  const { supabase, member } = await requireMember();
  return { supabase, member };
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// ---------- Товари ----------
export async function createProduct(fd: FormData) {
  const { supabase } = await db();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: str(fd, "name") ?? "Без назви",
      category: str(fd, "category"),
      source_url: str(fd, "source_url"),
      weight_kg: numOrNull(fd, "weight_kg"),
      notes: str(fd, "notes"),
    })
    .select("id")
    .single();
  check(error);
  redirect(`/products/${data!.id}`);
}

export async function updateProduct(fd: FormData) {
  const { supabase } = await db();
  const id = str(fd, "id")!;
  const { error } = await supabase
    .from("products")
    .update({
      name: str(fd, "name") ?? "Без назви",
      category: str(fd, "category"),
      stage: str(fd, "stage") ?? "idea",
      score: numOrNull(fd, "score"),
      weight_kg: numOrNull(fd, "weight_kg"),
      target_price_uah: numOrNull(fd, "target_price_uah"),
      planned_cpa_uah: numOrNull(fd, "planned_cpa_uah"),
      source_url: str(fd, "source_url"),
      notes: str(fd, "notes"),
      thesis: str(fd, "thesis"),
      risks: str(fd, "risks"),
      kill_criteria: str(fd, "kill_criteria"),
      seasonality: str(fd, "seasonality"),
      confidence: numOrNull(fd, "confidence"),
      next_review_on: str(fd, "next_review_on"),
    })
    .eq("id", id);
  check(error);
  revalidatePath(`/products/${id}`);
}

export async function deleteProduct(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase.from("products").delete().eq("id", str(fd, "id")!);
  check(error);
  redirect("/products");
}

export async function addDemandSignal(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  const { error } = await supabase.from("demand_signals").insert({
    product_id: productId,
    source: str(fd, "source") ?? "вручну",
    metric: str(fd, "metric") ?? "нотатка",
    value: numOrNull(fd, "value"),
    note: str(fd, "note"),
  });
  check(error);
  revalidatePath(`/products/${productId}`);
}

export async function addCompetitorPrice(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  const { error } = await supabase.from("competitor_prices").insert({
    product_id: productId,
    marketplace: str(fd, "marketplace") ?? "Prom",
    price_uah: numOrNull(fd, "price_uah"),
    seller: str(fd, "seller"),
    url: str(fd, "url"),
  });
  check(error);
  revalidatePath(`/products/${productId}`);
}

// ---------- Постачальники і пропозиції ----------
export async function createSupplier(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase.from("suppliers").insert({
    name: str(fd, "name") ?? "Без назви",
    country: str(fd, "country") ?? "CN",
    platform: str(fd, "platform"),
    contact: str(fd, "contact"),
    url: str(fd, "url"),
    rating: numOrNull(fd, "rating"),
    notes: str(fd, "notes"),
  });
  check(error);
  revalidatePath("/suppliers");
}

export async function addOffer(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  const { error } = await supabase.from("offers").insert({
    product_id: productId,
    supplier_id: str(fd, "supplier_id"),
    unit_price_usd: numOrNull(fd, "unit_price_usd") ?? 0,
    china_shipping_usd: numOrNull(fd, "china_shipping_usd") ?? 0,
    weight_kg: numOrNull(fd, "weight_kg"),
    moq: numOrNull(fd, "moq"),
    lead_days: numOrNull(fd, "lead_days"),
    url: str(fd, "url"),
    notes: str(fd, "notes"),
  });
  check(error);
  revalidatePath(`/products/${productId}`);
}

export async function selectOffer(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  const offerId = str(fd, "offer_id")!;
  check((await supabase.from("offers").update({ is_selected: false }).eq("product_id", productId)).error);
  check((await supabase.from("offers").update({ is_selected: true }).eq("id", offerId)).error);
  revalidatePath(`/products/${productId}`);
}

export async function deleteOffer(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  check((await supabase.from("offers").delete().eq("id", str(fd, "offer_id")!)).error);
  revalidatePath(`/products/${productId}`);
}

// ---------- Налаштування ----------
export async function updateSettings(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase
    .from("cost_settings")
    .update({
      usd_rate: numOrNull(fd, "usd_rate") ?? undefined,
      cargo_usd_per_kg: numOrNull(fd, "cargo_usd_per_kg") ?? undefined,
      packaging_uah: numOrNull(fd, "packaging_uah") ?? undefined,
      fee_pct: pctOrNull(fd, "fee_pct") ?? undefined,
      tax_pct: pctOrNull(fd, "tax_pct") ?? undefined,
      target_margin: pctOrNull(fd, "target_margin") ?? undefined,
      refusal_rate: pctOrNull(fd, "refusal_rate") ?? undefined,
      return_shipping_uah: numOrNull(fd, "return_shipping_uah") ?? undefined,
      default_cpa_uah: numOrNull(fd, "default_cpa_uah") ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  check(error);
  revalidatePath("/settings");
}

export async function refreshRates() {
  const { supabase } = await db();
  check((await supabase.rpc("refresh_nbu_rates")).error);
  revalidatePath("/settings");
}

// ---------- Замовлення ----------
export async function createOrder(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase.from("orders").insert({
    product_id: str(fd, "product_id")!,
    customer_name: str(fd, "customer_name"),
    phone: str(fd, "phone"),
    city: str(fd, "city"),
    qty: numOrNull(fd, "qty") ?? 1,
    price_uah: numOrNull(fd, "price_uah") ?? 0,
    channel: str(fd, "channel"),
    ttn: str(fd, "ttn"),
    notes: str(fd, "notes"),
  });
  check(error);
  revalidatePath("/orders");
}

export async function updateOrder(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase
    .from("orders")
    .update({ status: str(fd, "status") ?? "new", ttn: str(fd, "ttn") })
    .eq("id", str(fd, "id")!);
  check(error);
  revalidatePath("/orders");
}

// ---------- Склад ----------
export async function createBatch(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase.from("inventory_batches").insert({
    product_id: str(fd, "product_id")!,
    qty: numOrNull(fd, "qty") ?? 1,
    total_cost_uah: numOrNull(fd, "total_cost_uah") ?? 0,
    status: str(fd, "status") ?? "ordered",
    notes: str(fd, "notes"),
  });
  check(error);
  revalidatePath("/inventory");
}

export async function updateBatch(fd: FormData) {
  const { supabase } = await db();
  const status = str(fd, "status") ?? "ordered";
  const { error } = await supabase
    .from("inventory_batches")
    .update({ status, arrived_on: status === "arrived" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", str(fd, "id")!);
  check(error);
  revalidatePath("/inventory");
}

// ---------- Маркетинг ----------
export async function createCampaign(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase.from("ad_campaigns").insert({
    product_id: str(fd, "product_id")!,
    channel: str(fd, "channel") ?? "Meta",
    name: str(fd, "name"),
    spend_uah: numOrNull(fd, "spend_uah") ?? 0,
    orders_count: numOrNull(fd, "orders_count") ?? 0,
  });
  check(error);
  revalidatePath("/marketing");
}

export async function updateCampaign(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase
    .from("ad_campaigns")
    .update({
      spend_uah: numOrNull(fd, "spend_uah") ?? 0,
      orders_count: numOrNull(fd, "orders_count") ?? 0,
      status: str(fd, "status") ?? "active",
    })
    .eq("id", str(fd, "id")!);
  check(error);
  revalidatePath("/marketing");
}

export async function createAsset(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase.from("marketing_assets").insert({
    product_id: str(fd, "product_id"),
    kind: str(fd, "kind") ?? "landing",
    title: str(fd, "title") ?? "Без назви",
    url: str(fd, "url"),
    content: str(fd, "content"),
    status: str(fd, "status") ?? "draft",
  });
  check(error);
  revalidatePath("/marketing");
}

// ---------- Фінанси ----------
export async function createTransaction(fd: FormData) {
  const { supabase, member } = await db();
  const { error } = await supabase.from("transactions").insert({
    kind: str(fd, "kind") ?? "other",
    amount_uah: numOrNull(fd, "amount_uah") ?? 0,
    member_email: str(fd, "member_email") ?? member.email,
    product_id: str(fd, "product_id"),
    note: str(fd, "note"),
    happened_on: str(fd, "happened_on") ?? undefined,
  });
  check(error);
  revalidatePath("/finance");
}

// ---------- План і задачі ----------
function revalidateTasks(productId?: string | null) {
  revalidatePath("/plan");
  revalidatePath("/");
  if (productId) revalidatePath(`/products/${productId}`);
}

export async function createTask(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id");
  const { error } = await supabase.from("tasks").insert({
    title: str(fd, "title") ?? "Без назви",
    details: str(fd, "details"),
    step_id: str(fd, "step_id"),
    product_id: productId,
    priority: numOrNull(fd, "priority") ?? 2,
    due_on: str(fd, "due_on"),
    cost_uah: numOrNull(fd, "cost_uah"),
  });
  check(error);
  revalidateTasks(productId);
}

export async function setTaskStatus(fd: FormData) {
  const { supabase } = await db();
  const status = str(fd, "status") ?? "todo";
  const { data, error } = await supabase
    .from("tasks")
    .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", str(fd, "id")!)
    .select("product_id")
    .single();
  check(error);
  revalidateTasks(data?.product_id);
}

export async function updateTask(fd: FormData) {
  const { supabase } = await db();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: str(fd, "title") ?? "Без назви",
      details: str(fd, "details"),
      priority: numOrNull(fd, "priority") ?? 2,
      due_on: str(fd, "due_on"),
      cost_uah: numOrNull(fd, "cost_uah"),
    })
    .eq("id", str(fd, "id")!)
    .select("product_id")
    .single();
  check(error);
  revalidateTasks(data?.product_id);
}

export async function deleteTask(fd: FormData) {
  const { supabase } = await db();
  const { data, error } = await supabase.from("tasks").delete().eq("id", str(fd, "id")!).select("product_id").maybeSingle();
  check(error);
  revalidateTasks(data?.product_id);
}

// ---------- Джерела ----------
export async function createSource(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id");
  const { error } = await supabase.from("research_sources").insert({
    url: str(fd, "url") ?? "",
    title: str(fd, "title") ?? str(fd, "url") ?? "Без назви",
    publisher: str(fd, "publisher"),
    kind: str(fd, "kind") ?? "other",
    topic: str(fd, "topic") ?? "попит",
    reliability: numOrNull(fd, "reliability"),
    finding: str(fd, "finding"),
    product_id: productId,
    published_on: str(fd, "published_on"),
  });
  check(error);
  revalidatePath("/sources");
  if (productId) revalidatePath(`/products/${productId}`);
}

export async function deleteSource(fd: FormData) {
  const { supabase } = await db();
  check((await supabase.from("research_sources").delete().eq("id", str(fd, "id")!)).error);
  revalidatePath("/sources");
}

// ---------- Тест товару ----------
// «Беру в тест»: товар іде в роботу, а під нього одразу з'являються всі кроки запуску.
const TEST_STEPS: [title: string, details: string, minutes: number, days: number, cost: number | null, priority: number][] = [
  ["Написати 3 постачальникам", "1688 / Alibaba: ціна за 100 і 300 шт, MOQ, вага з упаковкою, є штрихкод, фото упаковки. Пиши англійською або через перекладач.", 30, 2, null, 1],
  ["Замовити 2–3 зразки", "Від різних постачальників, авіа. Порівняєш якість і упаковку.", 40, 4, 1500, 1],
  ["Перевірити зразки", "Якість, розмір, запах, упаковка, чи не ламається. Обрати постачальника.", 20, 18, null, 1],
  ["Зробити 8 фото і 2 короткі відео руками", "Телефон, денне світло, світлий фон. Без обличчя: руки, товар у дії, текст на екрані.", 90, 19, null, 2],
  ["Перерахувати ціну в калькуляторі", "Внести реальну ціну постачальника і вагу. Якщо маржа < 30% — не замовляти партію.", 10, 19, null, 1],
  ["Замовити пробну партію 100–200 шт", "Через «білий» карго з доставкою на склад фулфілменту Нової Пошти.", 60, 20, null, 1],
  ["Створити картку на Prom і оголошення на OLX", "Текст і фото — з «Готових текстів». Телефон у картці не вказувати, тільки чат.", 60, 45, null, 2],
  ["Запустити рекламу на 5 днів", "Бюджет і очікування — у симуляторі на сторінці «Як продавати».", 30, 50, 1500, 2],
  ["Перевірити умову зупинки", "Через 14 днів після старту реклами: порівняти CPA і кількість замовлень з умовою відмови товару.", 10, 64, null, 1],
];

export async function startTest(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  const { data: open } = await supabase.from("tasks").select("id").eq("product_id", productId).neq("status", "done").limit(1);
  const { error } = await supabase
    .from("products")
    .update({ stage: "sourcing", in_test_at: new Date().toISOString() })
    .eq("id", productId);
  check(error);
  if (!open?.length) {
    const today = new Date();
    const rows = TEST_STEPS.map(([title, details, minutes, days, cost, priority], i) => {
      const due = new Date(today);
      due.setDate(due.getDate() + days);
      return {
        title, details, minutes, priority, cost_uah: cost, sort: i + 1,
        product_id: productId, due_on: due.toISOString().slice(0, 10), source: "manual",
      };
    });
    const { error: e2 } = await supabase.from("tasks").insert(rows);
    check(e2);
  }
  revalidateTasks(productId);
  revalidatePath("/products");
  redirect(`/products/${productId}`);
}

export async function rejectIdea(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  const { error } = await supabase.from("products").update({ stage: "rejected" }).eq("id", productId);
  check(error);
  revalidatePath("/products");
  revalidatePath("/");
}

// ---------- Ідеї ----------
const IDEA_STATUSES = ["new", "want", "doing", "done", "skip"];

export async function setIdeaStatus(fd: FormData) {
  const { supabase } = await db();
  const status = str(fd, "status") ?? "new";
  if (!IDEA_STATUSES.includes(status)) throw new Error("Невідомий статус");
  const { data, error } = await supabase.from("ideas").update({ status }).eq("id", str(fd, "id")!).select("task_id").single();
  check(error);
  // Задача в плані йде слідом за ідеєю.
  if (data?.task_id) {
    const taskStatus = status === "done" ? "done" : status === "skip" ? "skipped" : status === "doing" ? "doing" : "todo";
    check((await supabase.from("tasks").update({ status: taskStatus, done_at: taskStatus === "done" ? new Date().toISOString() : null }).eq("id", data.task_id)).error);
    revalidateTasks();
  }
  revalidatePath("/ideas");
}

// Ідея → задача в плані, щоб вона з'явилась у навігаторі.
export async function ideaToTask(fd: FormData) {
  const { supabase } = await db();
  const id = str(fd, "id")!;
  const { data: idea, error } = await supabase.from("ideas").select("title, why, impact, task_id").eq("id", id).single();
  check(error);
  if (!idea!.task_id) {
    const { data: task, error: e2 } = await supabase
      .from("tasks")
      .insert({ title: idea!.title, details: idea!.why, priority: idea!.impact === 3 ? 1 : 2, source: "claude" })
      .select("id")
      .single();
    check(e2);
    check((await supabase.from("ideas").update({ task_id: task!.id, status: "doing" }).eq("id", id)).error);
  }
  revalidatePath("/ideas");
  revalidateTasks();
}

export async function createIdea(fd: FormData) {
  const { supabase } = await db();
  const { error } = await supabase.from("ideas").insert({
    title: str(fd, "title") ?? "Без назви",
    why: str(fd, "why"),
    area: str(fd, "area") ?? "daily",
    phase: str(fd, "phase") ?? "now",
    impact: numOrNull(fd, "impact") ?? 2,
    effort: numOrNull(fd, "effort") ?? 2,
    cost: str(fd, "cost"),
    status: "want",
    sort: 1000,
  });
  check(error);
  revalidatePath("/ideas");
}

// ---------- Чекліст перед партією ----------

export async function toggleBatchCheck(fd: FormData) {
  const { supabase } = await db();
  const productId = str(fd, "product_id")!;
  const key = str(fd, "key")!;
  if (!BATCH_CHECKS.some(([k]) => k === key)) throw new Error("Невідомий пункт");
  const { data, error } = await supabase.from("products").select("batch_check").eq("id", productId).single();
  check(error);
  const current: string[] = data?.batch_check ?? [];
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  check((await supabase.from("products").update({ batch_check: next }).eq("id", productId)).error);
  revalidatePath(`/products/${productId}`);
}

// ---------- «Застряг» ----------
// Питання йде аналітику: він відповідає в полі help під задачею під час ранкового запуску.
export async function askTaskHelp(fd: FormData) {
  const { supabase } = await db();
  const { data, error } = await supabase
    .from("tasks")
    .update({ stuck_note: str(fd, "stuck_note") ?? "Не розумію, що робити", stuck_at: new Date().toISOString() })
    .eq("id", str(fd, "id")!)
    .select("product_id")
    .single();
  check(error);
  revalidateTasks(data?.product_id);
}

// ---------- Замовлення: прибуття, чорний список ----------
export async function markArrived(fd: FormData) {
  const { supabase } = await db();
  const arrived = str(fd, "undo") ? null : new Date().toISOString();
  check((await supabase.from("orders").update({ arrived_at: arrived }).eq("id", str(fd, "id")!)).error);
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function addBlacklist(fd: FormData) {
  const { supabase } = await db();
  const digits = (str(fd, "phone") ?? "").replace(/\D/g, "");
  if (digits.length < 9) throw new Error("Телефон замалий");
  const { error } = await supabase.from("blacklist").upsert({ phone: `380${digits.slice(-9)}`, reason: str(fd, "reason") });
  check(error);
  revalidatePath("/orders");
}

export async function removeBlacklist(fd: FormData) {
  const { supabase } = await db();
  check((await supabase.from("blacklist").delete().eq("phone", str(fd, "phone")!)).error);
  revalidatePath("/orders");
}

// ---------- Банк питань покупців ----------
export async function saveQuestion(fd: FormData) {
  const { supabase } = await db();
  const question = str(fd, "question");
  if (!question) return;
  const { data: same } = await supabase.from("customer_questions").select("id, times").ilike("question", question.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle();
  if (same) {
    check((await supabase.from("customer_questions").update({ times: same.times + 1 }).eq("id", same.id)).error);
  } else {
    check((await supabase.from("customer_questions").insert({ question, answer: str(fd, "answer"), product_id: str(fd, "product_id") })).error);
  }
  revalidatePath("/sell");
}

export async function updateQuestion(fd: FormData) {
  const { supabase } = await db();
  const id = str(fd, "id")!;
  if (str(fd, "delete")) {
    check((await supabase.from("customer_questions").delete().eq("id", id)).error);
  } else {
    check((await supabase.from("customer_questions").update({
      answer: str(fd, "answer"),
      times: numOrNull(fd, "times") ?? 1,
      in_listing: fd.get("in_listing") === "on",
    }).eq("id", id)).error);
  }
  revalidatePath("/sell");
}

// ---------- Telegram-бот ----------
// Бот живе в Supabase Edge Function: сайт за авторизацією Vercel, і Telegram до нього не достукається.
const BOT_WEBHOOK = "https://nnhbhxvuaudueplijwhs.supabase.co/functions/v1/telegram";

async function telegram(token: string, method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as { ok: boolean; result?: { username?: string }; description?: string };
}

const randomCode = (n: number) => randomBytes(n).toString("hex");

export async function connectBot(fd: FormData) {
  const { supabase } = await db();
  const token = (str(fd, "token") ?? "").replace(/\s/g, "");
  if (!/^\d{6,}:[\w-]{30,}$/.test(token)) redirect("/bot?err=format");
  const me = await telegram(token, "getMe");
  if (!me.ok) redirect("/bot?err=token");
  const secret = randomCode(24);
  const hook = await telegram(token, "setWebhook", {
    url: BOT_WEBHOOK,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (!hook.ok) redirect("/bot?err=webhook");
  await telegram(token, "setMyCommands", { commands: [{ command: "start", description: "Каталог і замовлення" }] });
  check((await supabase.from("bot_settings").update({
    token, bot_username: me.result?.username ?? null, webhook_secret: secret, link_code: randomCode(8), owner_chat_id: null,
  }).eq("id", 1)).error);
  revalidatePath("/bot");
  redirect("/bot");
}

export async function disconnectBot() {
  const { supabase } = await db();
  const { data } = await supabase.from("bot_settings").select("token").eq("id", 1).single();
  if (data?.token) await telegram(data.token, "deleteWebhook");
  check((await supabase.from("bot_settings").update({ token: null, bot_username: null, webhook_secret: null, link_code: null, owner_chat_id: null }).eq("id", 1)).error);
  revalidatePath("/bot");
}

export async function relinkBotOwner() {
  const { supabase } = await db();
  check((await supabase.from("bot_settings").update({ owner_chat_id: null, link_code: randomCode(8) }).eq("id", 1)).error);
  revalidatePath("/bot");
}

export async function toggleBotDaily(fd: FormData) {
  const { supabase } = await db();
  check((await supabase.from("bot_settings").update({ daily_enabled: str(fd, "on") === "1" }).eq("id", 1)).error);
  revalidatePath("/bot");
}

// ---------- Швидкі записи ----------
export async function addInbox(fd: FormData) {
  const { supabase } = await db();
  const body = str(fd, "body");
  if (!body) return;
  check((await supabase.from("inbox").insert({ body, source: "site" })).error);
  revalidatePath("/");
}

export async function inboxDone(fd: FormData) {
  const { supabase } = await db();
  check((await supabase.from("inbox").update({ done: true }).eq("id", str(fd, "id")!)).error);
  revalidatePath("/");
}
