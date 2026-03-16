/**
 * Global loading UI — shown by Next.js while a page segment is loading.
 */
export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-sm text-zinc-500 animate-pulse">Loading Sabha…</p>
      </div>
    </div>
  )
}
