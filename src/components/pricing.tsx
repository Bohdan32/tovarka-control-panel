import { Card } from "@/components/ui";
import { money } from "@/lib/format";

const DISCOUNTS = [0, 0.1, 0.15, 0.2];
const round10 = (v: number) => Math.round(v / 10) * 10;

// Мінімальна ціна і ціна за 2–3 штуки. Реклама і резерв на відмову — один раз на замовлення,
// тож друга штука зі знижкою часто приносить більше, ніж перша.
export function PricingCard({ price, landed, fee, cpa, reserve, market }: {
  price: number | null;
  landed: number | null;
  fee: number;
  cpa: number;
  reserve: number;
  market: number | null;
}) {
  if (!price || !landed) {
    return (
      <Card title="Мінімальна ціна і знижки">
        <p className="text-sm text-zinc-500">Порахую, коли буде собівартість і ціна: додай пропозицію постачальника або ціни конкурентів.</p>
      </Card>
    );
  }
  const floor = (landed + reserve) / (1 - fee);
  const floorAds = (landed + cpa + reserve) / (1 - fee);
  const profit = (n: number, d: number) => {
    const total = round10(price * (1 + (n - 1) * (1 - d)));
    return { total, profit: total * (1 - fee) - n * landed - cpa - reserve };
  };
  const single = profit(1, 0).profit;

  return (
    <Card title="Мінімальна ціна і знижки">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-white/5">
          <div className="text-xs text-zinc-500">Нижче — збиток з кожного продажу</div>
          <div className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{money(Math.ceil(floor))}</div>
          <div className="text-xs text-zinc-500">без реклами (органіка, повторний покупець)</div>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-white/5">
          <div className="text-xs text-zinc-500">Мінімум, коли платиш за рекламу</div>
          <div className="text-xl font-semibold tabular-nums">{money(Math.ceil(floorAds))}</div>
          <div className="text-xs text-zinc-500">реклама {money(cpa)} на замовлення</div>
        </div>
      </div>
      {market !== null && price > market && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Ціна {money(price)} вища за середню на ринку ({money(market)}). Без причини (комплект, краща якість, швидка доставка) купуватимуть у сусіда.
        </p>
      )}

      <h3 className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Ціна за 2 і 3 штуки · прибуток з замовлення</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="py-1 font-normal">Знижка на 2-гу і 3-тю</th>
              <th className="py-1 font-normal">1 шт</th>
              <th className="py-1 font-normal">2 шт</th>
              <th className="py-1 font-normal">3 шт</th>
            </tr>
          </thead>
          <tbody>
            {DISCOUNTS.map((d) => (
              <tr key={d} className="border-t border-black/[.06] dark:border-white/5">
                <td className="py-1 text-zinc-500">{d ? `−${d * 100}%` : "без знижки"}</td>
                {[1, 2, 3].map((n) => {
                  const r = profit(n, d);
                  const tone = r.profit < 0 ? "text-red-600 dark:text-red-400" : n > 1 && r.profit > single ? "text-emerald-600 dark:text-emerald-400" : "";
                  return (
                    <td key={n} className="py-1">
                      {n === 1 && d ? <span className="text-zinc-300 dark:text-zinc-600">—</span> : (
                        <>
                          <span className="block">{money(r.total)}</span>
                          <span className={`block text-xs ${tone}`}>{r.profit >= 0 ? "+" : ""}{money(Math.round(r.profit))}</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Зелене — більше, ніж з однієї штуки. Пиши в картці «2 шт — {money(profit(2, 0.15).total)}»: середній чек росте, а реклама та сама.
      </p>
    </Card>
  );
}
