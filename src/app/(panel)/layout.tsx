import Link from "next/link";
import { Suspense } from "react";
import { MobileNav, Sidebar, SidebarLinks } from "@/components/sidebar";
import { Icon, Logo } from "@/components/icons";
import { requireMember } from "@/lib/auth";
import { logout } from "@/app/login/actions";

async function CurrentUser() {
  const { member } = await requireMember();
  return (
    <form action={logout} className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 truncate text-zinc-600 dark:text-zinc-400">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {member.displayName.slice(0, 1)}
        </span>
        <span className="truncate">{member.displayName}</span>
      </span>
      <button type="submit" title="Вийти" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-zinc-100">
        <Icon name="logout" />
      </button>
    </form>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-black/[.07] bg-white px-3 py-4 lg:flex dark:border-white/10 dark:bg-zinc-900">
        <Link href="/" className="mb-6 px-1.5"><Logo /></Link>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<SidebarLinks pathname="" />}>
            <Sidebar />
          </Suspense>
        </div>
        <div className="border-t border-black/[.07] pt-3 dark:border-white/10">
          <Suspense fallback={<span className="text-sm text-zinc-400">…</span>}>
            <CurrentUser />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/[.07] bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden dark:border-white/10 dark:bg-zinc-900/90">
          <Link href="/"><Logo /></Link>
          <Suspense><CurrentUser /></Suspense>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-24 pt-4 sm:px-5 lg:px-8 lg:pb-10 lg:pt-6">{children}</main>
      </div>

      <Suspense>
        <MobileNav />
      </Suspense>
    </div>
  );
}
