import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900 ${className}`}>
      {title && <h2 className="mb-4 text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "";
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/5">{children}</tbody>
      </table>
      {empty && <p className="py-6 text-center text-sm text-zinc-500">Поки порожньо</p>}
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>;
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "red" | "amber" | "blue" }) {
  const tones = {
    gray: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    blue: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-white/15 dark:bg-zinc-950";

export function Field({ label, name, type = "text", defaultValue, placeholder, required, step }: {
  label: string; name: string; type?: string; defaultValue?: string | number | null; placeholder?: string; required?: boolean; step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        name={name}
        type={type}
        step={step ?? (type === "number" ? "any" : undefined)}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        required={required}
        className={inputCls}
      />
    </label>
  );
}

export function TextArea({ label, name, defaultValue, rows = 3 }: { label: string; name: string; defaultValue?: string | null; rows?: number }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600 dark:text-zinc-400">{label}</span>
      <textarea name={name} rows={rows} defaultValue={defaultValue ?? undefined} className={inputCls} />
    </label>
  );
}

export function Select({ label, name, options, defaultValue, includeEmpty }: {
  label: string; name: string; options: Record<string, string> | [string, string][]; defaultValue?: string | null; includeEmpty?: string;
}) {
  const entries = Array.isArray(options) ? options : Object.entries(options);
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600 dark:text-zinc-400">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className={inputCls}>
        {includeEmpty !== undefined && <option value="">{includeEmpty}</option>}
        {entries.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

export function Button({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
    ghost: "border border-black/15 hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-zinc-800",
    danger: "text-red-600 hover:bg-red-50 dark:hover:bg-red-950",
  };
  return (
    <button type="submit" className={`rounded-lg px-3 py-2 text-sm font-medium ${v[variant]}`}>
      {children}
    </button>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function Ext({ href, children }: { href: string | null; children?: ReactNode }) {
  if (!href) return <>—</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
      {children ?? "посилання"}
    </a>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sky-600 hover:underline">
      {children}
    </Link>
  );
}
