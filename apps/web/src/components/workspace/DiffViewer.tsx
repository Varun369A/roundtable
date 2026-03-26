'use client'

interface AppliedFile {
  path: string
  fileIndex: number
  totalFiles: number
}

interface DiffViewerProps {
  appliedFiles: AppliedFile[]
  isApplying: boolean
  totalFiles: number
}

/**
 * Shows real-time progress as files are applied during an edit session.
 */
export function DiffViewer({ appliedFiles, isApplying, totalFiles }: DiffViewerProps) {
  if (!isApplying && appliedFiles.length === 0) return null

  const progress = totalFiles > 0 ? Math.round((appliedFiles.length / totalFiles) * 100) : 0

  return (
    <div className="mx-4 my-3 border border-slate-200 rounded-2xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isApplying ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-sm font-medium text-slate-800">
              {isApplying ? 'Applying changes…' : 'Changes applied'}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {appliedFiles.length}/{totalFiles} files
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
        {appliedFiles.map((f) => (
          <div key={f.path} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-emerald-500 text-xs shrink-0">✓</span>
            <span className="text-xs font-mono text-slate-600 truncate">{f.path}</span>
          </div>
        ))}
        {isApplying && appliedFiles.length < totalFiles && (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-xs text-slate-400">Processing next file…</span>
          </div>
        )}
      </div>
    </div>
  )
}
