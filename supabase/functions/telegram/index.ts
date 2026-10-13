// Telegram-бот Товарки. Живе в Supabase, бо сайт на Vercel закритий авторизацією.
// Покупцям: каталог, замовлення за 3 кроки, автовідповіді з готових текстів (і вночі).
// Власнику: нові замовлення й питання, відповідь покупцю реплаєм, нотатки в пульт, зведення о 9:00.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Settings = { token: string; webhook_secret: string; link_code: string | null; owner_chat_id: number | null };
type Product = { id: string; name: string; price: number | null; note: string | null };

let S: Settings;

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${S.token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) console.error(method, JSON.stringify(json));
  return json;
}

const send = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (v: number | null) => (v ? `${Math.round(v)} грн` : "ціну уточнимо");
const kyivHour = () => Number(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv", hour: "numeric", hour12: false }));
const isNight = () => { const h = kyivHour(); return h >= 22 || h < 8; };

async function catalog(): Promise<Product[]> {
  const { data } = await db
    .from("products")
    .select("id, name, target_price_uah, price_median_uah, ad_angle")
    .in("stage", ["test", "selling"])
    .order("score", { ascending: false, nullsFirst: false })
    .limit(20);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.target_price_uah ?? p.price_median_uah) || null,
    note: p.ad_angle,
  }));
}

// ---------- Підбір відповіді з готових текстів (та сама логіка, що й «Відповісти покупцю» на сайті) ----------
const SYNONYMS = [
  ["скільки", "ціна", "цін", "кошт", "дорог", "дешев", "знижк", "уступ"],
  ["доставк", "відправ", "пошт", "коли", "прийде", "дійде", "ттн", "трек", "відстеж", "затрим"],
  ["наявн", "є ще", "залиш", "закінч", "немає"],
  ["оплат", "наклад", "післяплат", "передоплат", "картк", "рахун", "реквізит"],
  ["поверн", "обмін", "не підійш", "розмір"],
  ["брак", "злам", "пошкодж", "трісн", "не працю"],
  ["подзвон", "дзвін", "телефон", "передзвон"],
  ["замов", "оформ", "куп", "беру"],
];
const stem = (w: string) => w.slice(0, 5);
const words = (t: string) => t.toLowerCase().match(/[\p{L}\d]{3,}/gu) ?? [];

async function bestTemplate(q: string) {
  const text = q.toLowerCase();
  const set = new Set(words(text).map(stem));
  for (const g of SYNONYMS) if (g.some((x) => text.includes(x))) g.forEach((x) => set.add(stem(x)));
  const { data } = await db.from("templates").select("title, body").eq("kind", "chat").is("section", null);
  let best: { title: string; body: string } | null = null;
  let top = 0;
  for (const t of data ?? []) {
    // Шаблони з {ТТН}, {дата} тощо бот не шле: їх треба заповнити руками.
    if (/\{[^}]+\}/.test(t.body)) continue;
    let s = 0;
    for (const w of new Set(words(t.title).map(stem))) if (set.has(w)) s += 3;
    for (const w of new Set(words(t.body).map(stem))) if (set.has(w)) s += 1;
    if (s > top) { top = s; best = t; }
  }
  return top >= 4 ? best : null;
}

async function saveQuestion(q: string) {
  const { data: same } = await db.from("customer_questions").select("id, times").ilike("question", q.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle();
  if (same) await db.from("customer_questions").update({ times: same.times + 1 }).eq("id", same.id);
  else await db.from("customer_questions").insert({ question: q.slice(0, 500) });
}

// ---------- Покупець ----------
async function showCatalog(chat: number) {
  const items = await catalog();
  if (!items.length) {
    return send(chat, "Вітаємо! 👋 Каталог зараз оновлюється. Напишіть, що шукаєте, і ми відповімо тут у чаті.");
  }
  return send(chat, "Вітаємо! 👋 Оберіть товар. Відправляємо Новою Поштою, оплата при отриманні після огляду.", {
    reply_markup: { inline_keyboard: items.map((p) => [{ text: `${p.name} · ${money(p.price)}`, callback_data: `p:${p.id}` }]) },
  });
}

async function setSession(chat: number, step: string | null, data: Record<string, unknown> = {}) {
  if (!step) await db.from("bot_sessions").delete().eq("chat_id", chat);
  else await db.from("bot_sessions").upsert({ chat_id: chat, step, data, updated_at: new Date().toISOString() });
}

async function onCallback(cb: { id: string; data?: string; message?: { chat: { id: number } } }) {
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  const chat = cb.message?.chat.id;
  if (!chat || !cb.data) return;
  const [kind, id] = cb.data.split(":");
  const { data: p } = await db.from("products").select("id, name, target_price_uah, price_median_uah, ad_angle").eq("id", id).maybeSingle();
  if (!p) return send(chat, "Цього товару вже немає. Натисніть /start, щоб побачити каталог.");
  const price = Number(p.target_price_uah ?? p.price_median_uah) || null;
  if (kind === "p") {
    return send(chat, `<b>${esc(p.name)}</b>\n${money(price)}\n\n✔️ Відправка Новою Поштою щодня\n✔️ Оплата при отриманні після огляду\n✔️ 14 днів на повернення`, {
      reply_markup: { inline_keyboard: [[{ text: "Замовити", callback_data: `o:${p.id}` }], [{ text: "← Каталог", callback_data: "c:0" }]] },
    });
  }
  if (kind === "o") {
    await setSession(chat, "name", { product_id: p.id, product: p.name, price });
    return send(chat, `Оформлюємо <b>${esc(p.name)}</b>. Як вас звати (ПІБ для посилки)?`);
  }
}

async function onOrderStep(chat: number, step: string, data: Record<string, unknown>, msg: TgMessage) {
  const text = msg.text?.trim() ?? "";
  if (step === "name") {
    if (text.length < 3) return send(chat, "Напишіть, будь ласка, ПІБ для посилки.");
    await setSession(chat, "phone", { ...data, name: text });
    return send(chat, "Номер телефону для ТТН (ми не телефонуємо, лише для Нової Пошти):", {
      reply_markup: { keyboard: [[{ text: "📱 Надіслати номер", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    });
  }
  if (step === "phone") {
    const phone = msg.contact?.phone_number ?? text;
    if (phone.replace(/\D/g, "").length < 9) return send(chat, "Схоже, номер неповний. Напишіть ще раз або натисніть кнопку.");
    await setSession(chat, "city", { ...data, phone });
    return send(chat, "Місто і номер відділення або поштомата Нової Пошти:", { reply_markup: { remove_keyboard: true } });
  }
  if (step === "city") {
    if (text.length < 3) return send(chat, "Напишіть місто і номер відділення, напр. «Львів, 12».");
    const order = { ...data, city: text } as { product_id: string; product: string; price: number | null; name: string; phone: string; city: string };
    await db.from("orders").insert({
      product_id: order.product_id,
      customer_name: order.name,
      phone: order.phone,
      city: order.city,
      qty: 1,
      price_uah: order.price ?? 0,
      channel: "Telegram",
      notes: `з бота, chat ${chat}${msg.from?.username ? `, @${msg.from.username}` : ""}`,
    });
    await setSession(chat, null);
    await send(chat, "Дякуємо! Замовлення прийнято ✅ Ми підтвердимо його тут у чаті і надішлемо номер ТТН після відправки.");
    if (S.owner_chat_id) {
      await send(S.owner_chat_id, `🛒 <b>Нове замовлення з бота</b>\n${esc(order.product)} · ${money(order.price)}\n${esc(order.name)}, ${esc(order.phone)}\n${esc(order.city)}\n\nУже в «Замовленнях» на сайті. Відповісти покупцю: зроби reply на це повідомлення.\n#c${chat}`);
    }
  }
}

async function onCustomerText(chat: number, msg: TgMessage) {
  const text = msg.text?.trim() ?? "";
  if (!text) return send(chat, "Напишіть питання текстом, будь ласка 🙂 Каталог — /start");
  const tpl = await bestTemplate(text);
  await saveQuestion(text);
  if (tpl) await send(chat, esc(tpl.body));
  else if (isNight()) await send(chat, "Дякуємо за питання! Зараз ніч, відповімо зранку 🌙 Замовити можна вже зараз: /start");
  else await send(chat, "Дякуємо за питання! Відповімо тут найближчим часом.");
  if (S.owner_chat_id) {
    const who = msg.from?.username ? `@${msg.from.username}` : esc(msg.from?.first_name ?? "покупець");
    await send(S.owner_chat_id, `💬 <b>${who}</b>: ${esc(text)}\n${tpl ? `Бот відповів шаблоном «${esc(tpl.title)}».` : "Готової відповіді не було."}\nВідповісти: reply на це повідомлення.\n#c${chat}`);
  }
}

// ---------- Власник ----------
function guessKind(t: string) {
  const s = t.toLowerCase();
  if (/витрат|заплатив|купив|оплатив|\d+\s*грн/.test(s)) return "expense";
  if (/зробити|треба|не забути|нагада/.test(s)) return "task";
  if (/товар|ідея|продавати|ніша/.test(s)) return "idea";
  return "note";
}

async function onOwner(msg: TgMessage) {
  const chat = msg.chat.id;
  const text = msg.text?.trim() ?? "";
  // Reply на пересланому питанні → відповідь іде покупцю.
  const target = msg.reply_to_message?.text?.match(/#c(-?\d+)/)?.[1];
  if (target && text) {
    await send(Number(target), esc(text));
    return send(chat, "Надіслав покупцю ✅");
  }
  if (text === "/start" || text === "/help") {
    return send(chat, "Я твій помічник пульта.\n\n• Пиши сюди будь-яку думку, витрату чи задачу — запишу в пульт (головна → «Записи»).\n• Нові замовлення й питання покупців приходять сюди; відповідай покупцю через reply.\n• /today — зведення на сьогодні (щодня о 9:00 приходить саме).\n• /shop — каталог, як його бачать покупці.");
  }
  if (text === "/today") return daily();
  if (text === "/shop") return showCatalog(chat);
  if (msg.voice) {
    await db.from("inbox").insert({ body: `🎤 Голосове ${msg.voice.duration} с (розшифровки поки немає, послухай у Telegram)`, kind: "voice", source: "telegram" });
    return send(chat, "Голосове позначив у пульті. Розшифровувати поки не вмію, тому краще коротко текстом 🙏");
  }
  if (!text) return;
  const kind = guessKind(text);
  await db.from("inbox").insert({ body: text, kind, source: "telegram" });
  const label = { expense: "витрату", task: "задачу", idea: "ідею", note: "нотатку" }[kind];
  return send(chat, `Записав ${label} в пульт ✍️`);
}

// ---------- Щоденне зведення ----------
async function daily() {
  if (!S.owner_chat_id) return;
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const [tasks, orders, lying, events, notes] = await Promise.all([
    db.from("tasks").select("title, due_on, priority").neq("source", "claude").in("status", ["todo", "doing"]).order("priority").order("sort").limit(3),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "new"),
    db.from("orders").select("customer_name, arrived_at").eq("status", "shipped").not("arrived_at", "is", null).lte("arrived_at", new Date(Date.now() - 3 * 86_400_000).toISOString()),
    db.from("calendar_events").select("title, starts_on").gte("starts_on", today).lte("starts_on", week).order("starts_on").limit(3),
    db.from("inbox").select("id", { count: "exact", head: true }).eq("done", false),
  ]);
  const lines = ["☀️ <b>Доброго ранку! Сьогодні:</b>"];
  if (orders.count) lines.push(`🛒 Нових замовлень: ${orders.count} — підтверди в чаті`);
  if (lying.data?.length) lines.push(`📦 Лежать у відділенні 3+ дні: ${lying.data.length} — напиши покупцям`);
  if (tasks.data?.length) {
    lines.push("", "<b>Зроби:</b>");
    for (const t of tasks.data) lines.push(`• ${esc(t.title)}${t.due_on ? ` (до ${t.due_on.split("-").reverse().slice(0, 2).join(".")})` : ""}`);
  }
  if (events.data?.length) {
    lines.push("", "<b>Цього тижня:</b>");
    for (const e of events.data) lines.push(`• ${e.starts_on.split("-").reverse().slice(0, 2).join(".")} — ${esc(e.title)}`);
  }
  if (notes.count) lines.push("", `✍️ Неопрацьованих записів: ${notes.count}`);
  lines.push("", "Пульт: https://tovarka-control-panel.vercel.app");
  await send(S.owner_chat_id, lines.join("\n"));
}

// ---------- Вхід ----------
type TgMessage = {
  chat: { id: number; type: string };
  from?: { username?: string; first_name?: string };
  text?: string;
  contact?: { phone_number: string };
  voice?: { duration: number };
  reply_to_message?: { text?: string };
};

Deno.serve(async (req) => {
  const { data } = await db.from("bot_settings").select("token, webhook_secret, link_code, owner_chat_id").eq("id", 1).single();
  if (!data?.token || !data.webhook_secret) return new Response("bot not configured");
  S = { ...data, owner_chat_id: data.owner_chat_id ? Number(data.owner_chat_id) : null } as Settings;
  const url = new URL(req.url);

  if (url.searchParams.get("job") === "daily") {
    if (req.headers.get("x-job-secret") !== S.webhook_secret) return new Response("forbidden", { status: 403 });
    await daily();
    return new Response("ok");
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== S.webhook_secret) return new Response("forbidden", { status: 403 });

  try {
    const update = await req.json();
    if (update.callback_query) {
      if (update.callback_query.data === "c:0") {
        await tg("answerCallbackQuery", { callback_query_id: update.callback_query.id });
        await showCatalog(update.callback_query.message.chat.id);
      } else await onCallback(update.callback_query);
      return new Response("ok");
    }
    const msg: TgMessage | undefined = update.message;
    if (!msg || msg.chat.type !== "private") return new Response("ok");
    const chat = msg.chat.id;
    const text = msg.text?.trim() ?? "";

    // Прив'язка власника: посилання зі сторінки «Telegram-бот» відкриває /start <код>.
    if (S.link_code && text === `/start ${S.link_code}`) {
      await db.from("bot_settings").update({ owner_chat_id: chat, link_code: null }).eq("id", 1);
      S.owner_chat_id = chat;
      await send(chat, "Готово! Тепер це твій робочий чат з пультом ✅");
      await onOwner({ ...msg, text: "/help" });
      return new Response("ok");
    }
    if (text.startsWith("/")) await setSession(chat, null);
    // Посеред оформлення (зокрема коли власник сам тестує /shop) — продовжуємо замовлення.
    const { data: session } = await db.from("bot_sessions").select("step, data").eq("chat_id", chat).maybeSingle();
    if (session?.step) await onOrderStep(chat, session.step, session.data ?? {}, msg);
    else if (S.owner_chat_id === chat) await onOwner(msg);
    else if (text.startsWith("/start")) await showCatalog(chat);
    else await onCustomerText(chat, msg);
  } catch (e) {
    console.error(e);
  }
  return new Response("ok");
});
