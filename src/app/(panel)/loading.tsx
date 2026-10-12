export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Завантажую">
      <div className="h-7 w-48 rounded-lg bg-zinc-200 dark:bg-white/10" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-200/70 dark:bg-white/5" />)}
      </div>
      <div className="h-64 rounded-xl bg-zinc-200/70 dark:bg-white/5" />
    </div>
  );
}
