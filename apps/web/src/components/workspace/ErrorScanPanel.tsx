'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

interface ScanIssue {
  filePath: string
  errors: string[]
  correctionPrompt: string
}

interface ScanResult {
  scannedFiles: number
  issueCount: number
  issues: ScanIssue[]
}

interface ErrorScanPanelProps {
  taskId: string
  onEditRequest: (prompt: string) => void  // switch to Edit tab with pre-filled prompt
}

export function ErrorScanPanel({ taskId, onEditRequest }: ErrorScanPanelProps) {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)

  async function runScan() {
    setScanning(true)
    const res = await apiFetch<ScanResult>(`/api/v1/code-projects/${taskId}/scan`, { method: 'POST' })
    if (res.success && res.data) setResult(res.data)
    setScanning(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + scan button */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Error Scanner</p>
            <p className="text-xs text-slate-500 mt-0.5">Detects common issues across all generated files</p>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : '🔍 Run Scan'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!result && !scanning && (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm text-slate-500">Click "Run Scan" to detect issues in your generated code</p>
          </div>
        )}

        {result && result.issueCount === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium text-slate-700">No issues found</p>
            <p className="text-xs text-slate-400 mt-1">Scanned {result.scannedFiles} files — all clean</p>
          </div>
        )}

        {result && result.issues.length > 0 && (
          <div>
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200">
              <p className="text-xs font-semibold text-amber-700">
                {result.issueCount} issue{result.issueCount !== 1 ? 's' : ''} found across {result.scannedFiles} files
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {result.issues.map((issue, i) => (
                <div key={i} className="px-5 py-4">
                  <p className="text-xs font-mono text-slate-500 mb-2 truncate">{issue.filePath}</p>
                  <ul className="space-y-1 mb-3">
                    {issue.errors.map((e, j) => (
                      <li key={j} className="flex gap-2 items-start text-xs text-slate-700">
                        <span className="text-red-500 shrink-0 mt-0.5">•</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => onEditRequest(issue.correctionPrompt)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium transition-colors"
                  >
                    ✏️ Auto-fix with AI
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
