"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

type Item = [href: string, label: string, icon: string];

export const NAV: { group: string; items: Item[]; note?: string }[] = [
  {
    group: "Сьогодні",
    items: [
      ["/", "Навігатор", "home"],
      ["/plan", "План запуску", "plan"],
      ["/sell", "Як продавати", "megaphone"],
    ],
  },
  {
    group: "Товар",
    items: [
      ["/products", "Банк товарів", "box"],
      ["/calculator", "Калькулятор", "calc"],
      ["/suppliers", "Постачальники", "factory"],
      ["/sources", "Джерела", "book"],
      ["/analyst", "Аналітик", "spark"],
    ],
  },
  {
    group: "Після запуску",
    note: "заповнюються з першими продажами",
    items: [
      ["/orders", "Замовлення", "cart"],
      ["/inventory", "Склад", "warehouse"],
      ["/finance", "Фінанси", "wallet"],
      ["/investments", "Інвестиції", "chart"],
      ["/marketing", "Реклама", "spark"],
    ],
  },
  {
    group: "Система",
    items: [
      ["/ideas", "Ідеї", "bulb"],
      ["/settings", "Налаштування", "gear"],
    ],
  },
];

const TABS: Item[] = [
  ["/", "Сьогодні", "home"],
  ["/plan", "План", "plan"],
  ["/sell", "Продаж", "megaphone"],
  ["/products", "Товари", "box"],
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  return <SidebarLinks pathname={usePathname()} />;
}

export function SidebarLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-5">
      {NAV.map(({ group, items, note }) => (
        <div key={group} className={note ? "opacity-70" : ""}>
          <div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{group}</div>
          {note && <div className="-mt-0.5 mb-1 px-2.5 text-[11px] text-zinc-400">{note}</div>}
          <div className="space-y-0.5">
            {items.map(([href, label, icon]) => {
              const active = isActive(href, pathname);
              return (
                <Link key={href} href={href} onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
                  }`}>
                  <Icon name={icon} className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// Телефон: нижня панель з головними розділами + шторка з усім меню.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-white/10 dark:bg-zinc-900/95">
        <div className="grid grid-cols-5">
          {TABS.map(([href, label, icon]) => {
            const active = isActive(href, pathname);
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500"}`}>
                <Icon name={icon} className="size-5" />
                {label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-zinc-500">
            <Icon name="menu" className="size-5" />
            Ще
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Закрити" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Усі розділи</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-white/10" aria-label="Закрити">
                <Icon name="close" className="size-5" />
              </button>
            </div>
            <SidebarLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
