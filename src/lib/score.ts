// Розклад оцінки товару на 5 складників (0–1), щоб було видно, що тягне оцінку вниз і що перевірити.

type P = {
  confidence?: number | null;
  sellers?: string | null;
  seasonality?: string | null;
  stock_by?: string | null;
  fit_block?: string[] | null;
  fit_warn?: string[] | null;
};

export type Part = { key: string; label: string; value: number | null; hint: string };

const clamp = (v: number) => Math.max(0, Math.min(1, v));

// «6000+ товарів…», «~70+ товарів» → 6000, 70.
export function sellersCount(s: string | null | undefined) {
  const m = s?.replace(/\s/g, "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function scoreParts(p: P, margin: number | null, signals: number): Part[] {
  const sellers = sellersCount(p.sellers);
  const warn = (p.fit_warn ?? []).length;
  const yearRound = /цілий рік|круглий рік|весь рік/i.test(p.seasonality ?? "");
  const late = p.stock_by ? new Date(p.stock_by).getTime() < Date.now() : false;
  return [
    {
      key: "demand", label: "Попит",
      value: signals ? clamp(signals / 5) : p.confidence != null ? clamp(p.confidence / 100) : null,
      hint: signals < 3 ? "Мало доказів попиту: додай 3+ сигнали (лічильники «куплено», Google Trends, відгуки)." : "Попит підтверджений кількома джерелами.",
    },
    {
      key: "margin", label: "Маржа",
      value: margin == null ? null : clamp((margin - 0.1) / 0.35),
      hint: margin == null ? "Немає ціни постачальника: запитай 3 пропозиції." : margin < 0.3 ? "Маржа нижче 30%: шукай дешевшого постачальника або продавай комплектом." : "Маржа з запасом.",
    },
    {
      key: "competition", label: "Конкуренція",
      value: sellers == null ? null : clamp(1 - Math.log10(Math.max(sellers, 10)) / 4.5),
      hint: sellers == null ? "Невідомо, скільки продавців: глянь Prom." : sellers > 2000 ? "Тісно: потрібна відмінність (комплект, краща якість, фото)." : "Ринок не переповнений.",
    },
    {
      key: "risk", label: "Ризик",
      value: (p.fit_block ?? []).length ? 0 : clamp(1 - warn * 0.25),
      hint: (p.fit_block ?? []).length ? "Є стоп-фактор: товар не для нас." : warn ? `Попередження: ${(p.fit_warn ?? []).join(", ")}.` : "Явних ризиків не знайдено.",
    },
    {
      key: "season", label: "Сезон",
      value: yearRound ? 1 : late ? 0.2 : p.seasonality ? 0.6 : null,
      hint: yearRound ? "Продається цілий рік." : late ? "Цього сезону вже не встигаємо завезти." : "Сезонний: дивись дату «замовити до» в календарі.",
    },
  ];
}
