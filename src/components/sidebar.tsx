"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: [string, string][] = [
  ["/", "Дашборд"],
  ["/analyst", "Аналітик"],
  ["/products", "Товари і попит"],
  ["/suppliers", "Постачальники"],
  ["/calculator", "Калькулятор ціни"],
  ["/investments", "Інвестиції"],
  ["/marketing", "Маркетинг"],
  ["/orders", "Замовлення"],
  ["/inventory", "Склад і закупівлі"],
  ["/finance", "Фінанси"],
  ["/settings", "Налаштування"],
];

export function Sidebar() {
  return <SidebarLinks pathname={usePathname()} />;
}

export function SidebarLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV.map(([href, label]) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
