/**
 * Global loading UI — shown by Next.js while a page segment is loading.
 */
export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-400 animate-pulse">Loading Arivarangam…</p>
      </div>
    </div>
  )
}
