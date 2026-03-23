'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface RequestReviewModalProps {
  taskId: string
  taskTitle: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (reviewId: string) => void
}

const SPECIALIZATIONS = [
  { value: 'legal',       label: 'Legal' },
  { value: 'medical',     label: 'Medical' },
  { value: 'finance',     label: 'Finance' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'content',     label: 'Content' },
  { value: 'code',        label: 'Code' },
  { value: 'hr',          label: 'HR' },
]

export default function RequestReviewModal({
  taskId,
  taskTitle,
  isOpen,
  onClose,
  onSuccess,
}: RequestReviewModalProps) {
  const [specialization, setSpecialization] = useState(SPECIALIZATIONS[0].value)
  const [description, setDescription] = useState('')
  const [lowestRate, setLowestRate] = useState<number | null>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [noExperts, setNoExperts] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    fetchRate(specialization)
  }, [isOpen, specialization])

  const fetchRate = async (spec: string) => {
    setRateLoading(true)
    setNoExperts(false)
    try {
      const res = await apiFetch<{ experts: Array<{ ratePerReview: number }> }>(
        `/api/v1/marketplace/experts?specialization=${spec}`,
      )
      if (res.success && res.data) {
        const rates = res.data.experts.map((e) => e.ratePerReview).filter(Boolean)
        if (rates.length === 0) {
          setNoExperts(true)
          setLowestRate(null)
        } else {
          setLowestRate(Math.min(...rates))
          setNoExperts(false)
        }
      } else {
        setNoExperts(true)
        setLowestRate(null)
      }
    } catch {
      setNoExperts(true)
    } finally {
      setRateLoading(false)
    }
  }

  const handleSpecChange = (val: string) => {
    setSpecialization(val)
    setError('')
  }

  const handleSubmit = async () => {
    if (noExperts) return
    setSubmitting(true)
    setError('')
    try {
      const res = await apiFetch<{ review: { id: string } }>(
        `/api/v1/tasks/${taskId}/expert-review`,
        {
          method: 'POST',
          body: JSON.stringify({ specialization, description: description.trim() || undefined }),
        },
      )
      if (res.success && res.data) {
        onSuccess(res.data.review.id)
      } else {
        const code = res.error?.code
        if (code === 'INSUFFICIENT_CREDITS') {
          setError('insufficient_credits')
        } else if (code === 'NO_EXPERTS_AVAILABLE') {
          setNoExperts(true)
          setError('no_experts')
        } else {
          setError(res.error?.message || 'Failed to submit request')
        }
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Request Expert Review</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Task title */}
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-400 mb-0.5">Task</p>
            <p className="text-sm font-medium text-slate-900 truncate">{taskTitle}</p>
          </div>

          {/* Specialization */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Specialization
            </label>
            <select
              value={specialization}
              onChange={(e) => handleSpecChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-900 transition-colors"
            >
              {SPECIALIZATIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Focus areas <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What specifically should the expert focus on?"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-900 placeholder-slate-400 resize-none transition-colors"
            />
          </div>

          {/* Cost display */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200">
            <span className="text-sm text-slate-700">Estimated cost</span>
            {rateLoading ? (
              <div className="w-16 h-5 rounded bg-slate-200 animate-pulse" />
            ) : noExperts ? (
              <span className="text-xs text-slate-400">—</span>
            ) : lowestRate !== null ? (
              <span className="text-sm font-bold text-indigo-600">
                from {lowestRate} credits
              </span>
            ) : null}
          </div>

          {/* Errors */}
          {error === 'no_experts' || noExperts ? (
            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              No experts are currently available for <strong>{SPECIALIZATIONS.find((s) => s.value === specialization)?.label}</strong>. Try a different specialization.
            </div>
          ) : error === 'insufficient_credits' ? (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center justify-between">
              <span>Not enough credits for this review.</span>
              <Link
                href="/credits"
                onClick={onClose}
                className="ml-3 text-xs underline text-red-500 hover:text-red-700 whitespace-nowrap"
              >
                Buy credits →
              </Link>
            </div>
          ) : error ? (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || noExperts || rateLoading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {submitting ? 'Submitting…' : 'Request Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
