import { Suspense } from "react";
import { Sidebar, SidebarLinks } from "@/components/sidebar";
import { requireMember } from "@/lib/auth";
import { logout } from "@/app/login/actions";

async function CurrentUser() {
  const { member } = await requireMember();
  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">{member.displayName}</span>
      <button type="submit" className="text-sky-600 hover:underline">Вийти</button>
    </form>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 md:flex-row dark:bg-zinc-950">
      <aside className="border-b border-black/10 bg-white p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between md:block">
          <div>
            <div className="text-lg font-semibold">Товарка</div>
            <div className="text-xs text-zinc-500">Пульт керування</div>
          </div>
          <div className="md:mt-3">
            <Suspense fallback={<span className="text-sm text-zinc-400">…</span>}>
              <CurrentUser />
            </Suspense>
          </div>
        </div>
        <Suspense fallback={<SidebarLinks pathname="" />}>
          <Sidebar />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
