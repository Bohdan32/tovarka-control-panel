import Link from "next/link";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Icon } from "./icons";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Card({ title, action, children, className = "", pad = true }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-black/[.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,.03)] dark:border-white/10 dark:bg-zinc-900 ${pad ? "p-3 sm:p-4" : ""} ${className}`}>
      {(title || action) && (
        <div className={`mb-3 flex items-center justify-between gap-2 ${pad ? "" : "px-3 pt-3 sm:px-4 sm:pt-4"}`}>
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{children}</div>;
}

export function Stat({ label, value, hint, tone, href }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "warn"; href?: string;
}) {
  const color = tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "";
  const body = (
    <>
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-xl ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-zinc-500">{hint}</div>}
    </>
  );
  const cls = "block min-w-0 rounded-xl border border-black/[.07] bg-white px-3 py-2.5 dark:border-white/10 dark:bg-zinc-900";
  return href ? <Link href={href} className={`${cls} hover:border-indigo-300 dark:hover:border-indigo-500/50`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Progress({ value, tone = "indigo" }: { value: number; tone?: "indigo" | "green" }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
      <div className={`h-full rounded-full ${tone === "green" ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

// Таблиця: на телефоні рядки стають картками, а клітинки підписуються заголовком колонки.
export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  const rows = Children.map(children, (row) => {
    if (!isValidElement<{ children?: ReactNode }>(row)) return row;
    let i = 0;
    const cells = Children.map(row.props.children, (cell) => {
      if (!isValidElement(cell)) return cell;
      const label = head[i++];
      return cell.type === Td ? cloneElement(cell as ReactElement<TdProps>, { label }) : cell;
    });
    return cloneElement(row, {}, cells);
  });
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="rt w-full text-sm">
        <thead>
          <tr className="border-b border-black/[.07] text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:border-white/10">
            {head.map((h, i) => (
              <th key={`${h}-${i}`} className="whitespace-nowrap px-2 py-1.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="sm:divide-y sm:divide-black/[.05] sm:dark:divide-white/5">{rows}</tbody>
      </table>
      {empty && <p className="py-6 text-center text-sm text-zinc-500">Поки порожньо</p>}
    </div>
  );
}

type TdProps = { children?: ReactNode; className?: string; label?: string };

export function Td({ children, className = "", label }: TdProps) {
  return <td data-label={label || undefined} className={`px-2 py-1.5 align-top ${className}`}>{children}</td>;
}

const TONES = {
  gray: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  blue: "bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300",
};
export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent ${TONES[tone]}`}>{children}</span>;
}

export const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-zinc-950";

// Компактне поле для форм у рядках таблиць.
export const miniInput =
  "rounded-md border border-black/15 bg-white px-1.5 py-1 text-sm outline-none focus:border-indigo-500 dark:border-white/15 dark:bg-zinc-950";

export function Field({ label, name, type = "text", defaultValue, placeholder, required, step }: {
  label: string; name: string; type?: string; defaultValue?: string | number | null; placeholder?: string; required?: boolean; step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        name={name}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        step={step ?? (type === "number" ? "any" : undefined)}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        required={required}
        className={inputCls}
      />
    </label>
  );
}

export function TextArea({ label, name, defaultValue, rows = 3, placeholder }: {
  label: string; name: string; defaultValue?: string | null; rows?: number; placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <textarea name={name} rows={rows} defaultValue={defaultValue ?? undefined} placeholder={placeholder} className={inputCls} />
    </label>
  );
}

export function Select({ label, name, options, defaultValue, includeEmpty }: {
  label: string; name: string; options: Record<string, string> | [string, string][]; defaultValue?: string | null; includeEmpty?: string;
}) {
  const entries = Array.isArray(options) ? options : Object.entries(options);
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className={inputCls}>
        {includeEmpty !== undefined && <option value="">{includeEmpty}</option>}
        {entries.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

const BTN = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm",
  ghost: "border border-black/15 bg-white hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:hover:bg-white/5",
  danger: "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10",
};

export function Button({ children, variant = "primary", name, value }: {
  children: ReactNode; variant?: keyof typeof BTN; name?: string; value?: string;
}) {
  return (
    <button type="submit" name={name} value={value} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${BTN[variant]}`}>
      {children}
    </button>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{children}</div>;
}

// Форма додавання, згорнута за кнопкою, щоб сторінки лишались компактними.
export function AddForm({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-dashed border-black/15 bg-white/60 dark:border-white/15 dark:bg-zinc-900/60">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">
        <Icon name="plus" className="size-4 transition group-open:rotate-45" />
        {title}
      </summary>
      <div className="border-t border-dashed border-black/10 p-3 dark:border-white/10">{children}</div>
    </details>
  );
}

export function Pills({ items, active }: { items: [href: string, label: string, count?: number][]; active: string }) {
  return (
    <div className="-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map(([href, label, count]) => (
        <Link key={href} href={href}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
            active === href
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-black/10 bg-white text-zinc-600 hover:border-indigo-300 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
          }`}>
          {label}{count !== undefined && <span className="ml-1 opacity-70">{count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-zinc-500">{children}</p>;
}

export function Ext({ href, children }: { href: string | null; children?: ReactNode }) {
  if (!href) return <>{children ?? "—"}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">
      {children ?? "посилання"}
    </a>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-indigo-600 hover:underline dark:text-indigo-400">
      {children}
    </Link>
  );
}
