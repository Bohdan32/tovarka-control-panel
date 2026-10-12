// Правила замовлень: хто платить наперед, які посилки лежать задовго, де відмови.

export const PREPAY_FROM_UAH = 1500;
export const LYING_DAYS = 3;

// Телефон у вигляді 380XXXXXXXXX, щоб «067…», «+38 067…» і «38067…» вважались одним номером.
export function normPhone(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 9 ? `380${d.slice(-9)}` : null;
}

type OrderLike = { id: string; phone: string | null; status: string; qty: number; price_uah: number | string; created_at: string };

// Телефони з невикупом або поверненням і причина з чорного списку.
export function riskyPhones(orders: OrderLike[], blacklist: { phone: string; reason: string | null }[]) {
  const map = new Map<string, string>();
  for (const b of blacklist) {
    const p = normPhone(b.phone);
    if (p) map.set(p, b.reason ? `чорний список: ${b.reason}` : "чорний список");
  }
  for (const o of orders) {
    const p = normPhone(o.phone);
    if (p && !map.has(p) && (o.status === "refused" || o.status === "returned")) map.set(p, "вже був невикуп");
  }
  return map;
}

// Чому для цього замовлення варто попросити передоплату (або null, якщо не треба).
export function prepayReason(o: OrderLike, risky: Map<string, string>, orders: OrderLike[]) {
  const p = normPhone(o.phone);
  if (p && risky.has(p)) {
    // Невикуп у цьому ж замовленні не рахуємо як «історію».
    const own = orders.filter((x) => normPhone(x.phone) === p && x.id !== o.id && (x.status === "refused" || x.status === "returned"));
    if (risky.get(p)!.startsWith("чорний") || own.length) return `${risky.get(p)} — лише 100% передоплата`;
  }
  if (Number(o.price_uah) * o.qty >= PREPAY_FROM_UAH) return `сума від ${PREPAY_FROM_UAH} грн — передоплата 150–200 грн`;
  return null;
}

export function daysSince(v: string | null | undefined) {
  if (!v) return null;
  return Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
}

// Частка відмов по групах (товар, канал, місто). Рахуємо лише завершені замовлення.
export function refusalBy<T extends { status: string }>(orders: T[], key: (o: T) => string | null | undefined) {
  const groups = new Map<string, { done: number; refused: number }>();
  for (const o of orders) {
    if (!["delivered", "refused", "returned"].includes(o.status)) continue;
    const k = key(o)?.trim() || "—";
    const g = groups.get(k) ?? { done: 0, refused: 0 };
    g.done++;
    if (o.status !== "delivered") g.refused++;
    groups.set(k, g);
  }
  return [...groups.entries()]
    .map(([name, g]) => ({ name, ...g, rate: g.refused / g.done }))
    .sort((a, b) => b.refused - a.refused || b.done - a.done);
}

export const LYING_TEXT = `Добрий день! Ваша посилка вже чекає у відділенні Нової Пошти. Безкоштовне зберігання скоро закінчиться, тож заберіть її, будь ласка, найближчими днями. Якщо щось змінилось — напишіть, підкажемо.`;
