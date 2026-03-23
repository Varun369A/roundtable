'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type ExportStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | null

interface ExportData {
  requestId: string
  status: ExportStatus
  downloadUrl: string | null
  expiresAt: string | null
  requestedAt: string | null
  completedAt: string | null
  linkExpired: boolean
}

export default function AccountSettingsPage() {
  const router = useRouter()

  // ── Data export state ───────────────────────────────────────────────────────
  const [exportData, setExportData] = useState<ExportData | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportInitialLoading, setExportInitialLoading] = useState(true)

  // ── Account deletion state ──────────────────────────────────────────────────
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const REQUIRED_CONFIRMATION = 'DELETE MY ACCOUNT'
  const confirmationMatch = deleteConfirmation === REQUIRED_CONFIRMATION

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) { router.push('/login'); return }
    fetchExportStatus()
  }, [])

  async function fetchExportStatus() {
    try {
      const data = await apiFetch<ExportData>('/api/v1/account/export-data')
      if (data.success && data.data?.status) {
        setExportData(data.data)
      }
    } catch { /* ignore */ } finally {
      setExportInitialLoading(false)
    }
  }

  async function handleRequestExport() {
    setExportLoading(true)
    setExportError('')

    try {
      const data = await apiFetch<{ requestId: string }>('/api/v1/account/export-data', { method: 'POST' })

      if (data.success) {
        setExportData({
          requestId: data.data!.requestId,
          status: 'pending',
          downloadUrl: null,
          expiresAt: null,
          requestedAt: new Date().toISOString(),
          completedAt: null,
          linkExpired: false,
        })
        // Poll for completion
        setTimeout(fetchExportStatus, 3000)
      } else {
        setExportError(data.error?.message || 'Failed to request data export.')
      }
    } catch {
      setExportError('Network error. Please try again.')
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError('')

    if (!confirmationMatch) {
      setDeleteError(`Please type "${REQUIRED_CONFIRMATION}" exactly.`)
      return
    }

    setDeleteLoading(true)

    try {
      const data = await apiFetch('/api/v1/account/delete-account', {
        method: 'POST',
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      })

      if (data.success) {
        // Clear all local auth state
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        router.push('/login?deleted=1')
      } else {
        setDeleteError(data.error?.message || 'Failed to delete account. Please try again.')
      }
    } catch {
      setDeleteError('Network error. Please try again.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-700 transition-colors text-sm">
            ← Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-sm font-medium text-slate-700">Account Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-10">

        {/* ── Data Export ────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Download My Data</h2>
            <p className="text-sm text-slate-500">
              Request a copy of all data Arivarangam holds about your account. The export includes your profile,
              tasks and their AI outputs, memories, credits history, billing events, and referral data.
              The download link is valid for 7 days.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            {exportInitialLoading ? (
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-32" />
            ) : exportData && (exportData.status === 'pending' || exportData.status === 'processing') ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-sm text-slate-900 font-medium">Preparing your export…</p>
                  <p className="text-xs text-slate-500 mt-0.5">This usually takes 1–2 minutes. You can leave this page.</p>
                </div>
                <button onClick={fetchExportStatus} className="ml-auto text-xs text-slate-500 hover:text-slate-700 transition-colors">
                  Refresh
                </button>
              </div>
            ) : exportData?.status === 'completed' && exportData.downloadUrl && !exportData.linkExpired ? (
              <div>
                <p className="text-sm text-emerald-600 font-medium mb-2">Your export is ready</p>
                <p className="text-xs text-slate-500 mb-3">
                  Requested {exportData.requestedAt ? new Date(exportData.requestedAt).toLocaleDateString() : ''} ·
                  Expires {exportData.expiresAt ? new Date(exportData.expiresAt).toLocaleDateString() : ''}
                </p>
                <a
                  href={exportData.downloadUrl}
                  download="sabha-data-export.json"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download export (JSON)
                </a>
              </div>
            ) : exportData?.status === 'completed' && exportData.linkExpired ? (
              <div>
                <p className="text-sm text-slate-500 mb-2">Your previous export has expired.</p>
                <button
                  onClick={handleRequestExport}
                  disabled={exportLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
                >
                  {exportLoading ? 'Requesting…' : 'Request new export'}
                </button>
              </div>
            ) : exportData?.status === 'failed' ? (
              <div>
                <p className="text-sm text-red-500 mb-2">Export failed. Please try again.</p>
                <button
                  onClick={handleRequestExport}
                  disabled={exportLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
                >
                  Retry export
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={handleRequestExport}
                  disabled={exportLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
                >
                  {exportLoading ? 'Requesting…' : 'Request data export'}
                </button>
                {exportError && <p className="text-red-500 text-xs mt-2">{exportError}</p>}
              </div>
            )}
          </div>
        </section>

        {/* ── Danger Zone ────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Danger Zone</h2>
            <p className="text-sm text-slate-500">
              These actions are irreversible. Please read carefully before proceeding.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-red-600 mb-1">Delete account</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                  Permanently deletes your account and anonymizes your personal data. Your tasks and
                  AI outputs will be retained in anonymized form for platform improvement. Active subscriptions
                  will be cancelled. This action cannot be undone.
                </p>
              </div>
              {!showDeleteForm && (
                <button
                  onClick={() => setShowDeleteForm(true)}
                  className="flex-shrink-0 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-300 text-red-600 hover:text-red-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Delete account
                </button>
              )}
            </div>

            {showDeleteForm && (
              <form onSubmit={handleDeleteAccount} className="mt-6 space-y-4">
                <div className="border-t border-red-200 pt-5">
                  <p className="text-xs text-slate-600 mb-4">
                    To confirm, enter your password and type <span className="font-mono text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{REQUIRED_CONFIRMATION}</span> exactly.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1.5">Your password</label>
                      <input
                        type="password"
                        required
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors text-sm"
                        placeholder="Enter your current password"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1.5">Confirmation phrase</label>
                      <input
                        type="text"
                        required
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className={`w-full px-3 py-2.5 rounded-xl bg-white border focus:outline-none transition-colors text-sm font-mono text-slate-900 placeholder:text-slate-400 ${
                          deleteConfirmation && !confirmationMatch
                            ? 'border-red-400 focus:border-red-500'
                            : confirmationMatch
                            ? 'border-red-300 focus:border-red-400'
                            : 'border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                        }`}
                        placeholder={REQUIRED_CONFIRMATION}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {deleteConfirmation && !confirmationMatch && (
                        <p className="text-red-500 text-xs mt-1">
                          Type &quot;{REQUIRED_CONFIRMATION}&quot; exactly (case-sensitive)
                        </p>
                      )}
                    </div>
                  </div>

                  {deleteError && (
                    <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-red-600 text-xs">{deleteError}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      type="submit"
                      disabled={deleteLoading || !confirmationMatch || !deletePassword}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-xl text-sm font-semibold text-white transition-colors"
                    >
                      {deleteLoading ? 'Deleting account…' : 'Permanently delete my account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteForm(false)
                        setDeletePassword('')
                        setDeleteConfirmation('')
                        setDeleteError('')
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-sm text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>

      </main>
    </div>
  )
}
