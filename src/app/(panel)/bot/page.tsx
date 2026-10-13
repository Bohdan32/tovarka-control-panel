import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { connectBot, disconnectBot, relinkBotOwner, toggleBotDaily } from "../actions";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm";
import { CopyButton } from "@/components/copy";

export const metadata: Metadata = { title: "Telegram-бот" };

const ERRORS: Record<string, string> = {
  format: "Це не схоже на токен. Він виглядає так: 1234567890:AAH…, скопіюй повністю з повідомлення BotFather.",
  token: "Telegram не прийняв цей токен. Перевір, що скопіював його повністю, або створи новий через /token у BotFather.",
  webhook: "Токен правильний, але Telegram не дав під’єднати бота. Спробуй ще раз за хвилину.",
};

const CAN = [
  ["Покупцям", "Каталог товарів у тесті й на продажу, замовлення за 3 кроки (ім’я, телефон кнопкою, відділення НП). Замовлення одразу падає в «Замовлення» з каналом Telegram."],
  ["Автовідповіді", "На питання про ціну, доставку, оплату, повернення бот сам відповідає готовим текстом. Уночі каже, що відповіси зранку. Кожне питання пишеться в «Банк питань»."],
  ["Тобі", "Нові замовлення й питання приходять у твій чат. Щоб відповісти покупцю, зроби reply на повідомлення — бот перешле."],
  ["Записи", "Пиши боту думку, витрату чи задачу — вона з’явиться на головній у «Записах». Голосові позначаються, але поки без розшифровки."],
  ["Зведення о 9:00", "Щоранку: нові замовлення, посилки, що лежать 3+ дні, 3 головні задачі і дедлайни тижня. Команда /today — те саме будь-коли."],
];

export default async function BotPage({ searchParams }: PageProps<"/bot">) {
  const { err } = await searchParams;
  const { supabase } = await requireMember();
  const [{ data: s }, { count: orders }, { count: notes }] = await Promise.all([
    supabase.from("bot_settings").select("bot_username, link_code, owner_chat_id, daily_enabled, token").eq("id", 1).single(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("channel", "Telegram"),
    supabase.from("inbox").select("id", { count: "exact", head: true }).eq("source", "telegram"),
  ]);
  const connected = Boolean(s?.token);
  const link = s?.bot_username ? `https://t.me/${s.bot_username}` : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Telegram-бот" subtitle="Приймає замовлення і відповідає покупцям, поки ти зайнятий. Тобі шле замовлення, питання і ранкове зведення." />

      {!connected && (
        <Card title="Підключення · 2 хвилини">
          <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>Відкрий у Telegram <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">@BotFather</a> і натисни Start.</li>
            <li>Напиши <code className="rounded bg-zinc-100 px-1 dark:bg-white/10">/newbot</code>, потім назву магазину (напр. «Товарка Дім») і логін, що закінчується на <code className="rounded bg-zinc-100 px-1 dark:bg-white/10">bot</code>.</li>
            <li>BotFather надішле токен: довгий рядок з двокрапкою. Скопіюй і встав сюди.</li>
          </ol>
          {typeof err === "string" && ERRORS[err] && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{ERRORS[err]}</p>}
          <form action={connectBot} className="flex flex-wrap gap-2">
            <input name="token" required autoComplete="off" placeholder="1234567890:AAH…" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-2.5 py-1.5 font-mono text-sm outline-none focus:border-indigo-500 dark:border-white/15 dark:bg-zinc-950" />
            <Button>Підключити</Button>
          </form>
          <p className="mt-2 text-xs text-zinc-500">Токен зберігається лише в базі пульта, яку бачите ви з партнером. Нікому його не пересилай, і мені в чат теж.</p>
        </Card>
      )}

      {connected && (
        <>
          <Card title={<span className="flex items-center gap-2">@{s?.bot_username} <Badge tone="green">працює</Badge></span>}>
            {!s?.owner_chat_id ? (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                <p className="text-sm font-semibold">Останній крок: познайомся з ботом</p>
                <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Відкрий посилання з телефона й натисни Start. Бот запам’ятає тебе як власника і почне слати замовлення та зведення.</p>
                {link && s?.link_code && (
                  <a href={`${link}?start=${s.link_code}`} target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">Відкрити бота</a>
                )}
              </div>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Ти підключений як власник: замовлення, питання й зведення приходять тобі.</p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-white/5"><div className="text-xs text-zinc-500">Замовлень з бота</div><div className="text-lg font-semibold">{orders ?? 0}</div></div>
              <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-white/5"><div className="text-xs text-zinc-500">Записів з Telegram</div><div className="text-lg font-semibold">{notes ?? 0}</div></div>
            </div>

            {link && (
              <div className="mt-3">
                <div className="mb-1 text-xs text-zinc-500">Посилання для покупців: постав у профіль Prom, OLX, Instagram і TikTok</div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-zinc-100 px-2 py-1 text-sm dark:bg-white/10">{link}</code>
                  <CopyButton text={link} />
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-black/[.07] pt-3 text-sm dark:border-white/10">
              <form action={toggleBotDaily}>
                <input type="hidden" name="on" value={s?.daily_enabled ? "0" : "1"} />
                <button className="flex items-center gap-2">
                  <span className={`relative h-5 w-9 rounded-full transition ${s?.daily_enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${s?.daily_enabled ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                  Зведення щоранку о 9:00
                </button>
              </form>
              {s?.owner_chat_id && (
                <form action={relinkBotOwner}><button className="text-xs text-zinc-500 hover:underline">Змінити власника</button></form>
              )}
              <form action={disconnectBot} className="ml-auto">
                <ConfirmButton message="Відключити бота? Покупці не зможуть замовляти через Telegram." className="text-xs text-red-600 hover:underline">Відключити</ConfirmButton>
              </form>
            </div>
          </Card>
        </>
      )}

      <Card title="Що вміє бот">
        <dl className="grid gap-3 sm:grid-cols-2">
          {CAN.map(([t, d]) => (
            <div key={t}>
              <dt className="text-sm font-semibold">{t}</dt>
              <dd className="text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-zinc-500">
          Каталог показує товари на етапі «Тест» і «Продажі». Поки таких немає, бот приймає питання і каже, що каталог оновлюється.
        </p>
      </Card>
    </div>
  );
}
