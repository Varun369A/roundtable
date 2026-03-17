'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expert {
  id: string
  name: string
  avatarUrl?: string
  specializations: string[]
  rating: number
  reviewCount: number
  ratePerReview: number
  languages?: string[]
}

interface MarketplaceStats {
  totalExperts: number
  avgRating: number
  avgResponseTime: string
}

const SPECIALIZATIONS = ['Legal', 'Medical', 'Finance', 'Engineering', 'Content', 'Code', 'HR']

const SPEC_COLORS: Record<string, string> = {
  legal:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medical:     'bg-red-500/10 text-red-400 border-red-500/20',
  finance:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  engineering: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  content:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  code:        'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  hr:          'bg-pink-500/10 text-pink-400 border-pink-500/20',
}

// ─── Star rating ─────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${star <= Math.round(rating) ? 'text-amber-400 fill-current' : 'text-zinc-700 fill-current'}`}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

// ─── Expert card ─────────────────────────────────────────────────────────────

function ExpertCard({ expert, onRequest }: { expert: Expert; onRequest: (expert: Expert) => void }) {
  const initials = expert.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 hover:border-white/15 hover:bg-white/5 transition-all p-5 flex flex-col gap-4">
      {/* Avatar + name */}
      <div className="flex items-start gap-3">
        {expert.avatarUrl ? (
          <img src={expert.avatarUrl} alt={expert.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{expert.name}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Stars rating={expert.rating} />
            <span className="text-xs text-zinc-500">({expert.reviewCount})</span>
          </div>
        </div>
      </div>

      {/* Specializations */}
      <div className="flex flex-wrap gap-1.5">
        {expert.specializations.map((spec) => (
          <span
            key={spec}
            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SPEC_COLORS[spec.toLowerCase()] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
          >
            {spec}
          </span>
        ))}
      </div>

      {/* Rate + button */}
      <div className="flex items-center justify-between mt-auto">
        <span className="text-sm font-bold text-indigo-300">{expert.ratePerReview} credits</span>
        <button
          onClick={() => onRequest(expert)}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95"
        >
          Request Review
        </button>
      </div>
    </div>
  )
}

// ─── Apply modal ──────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Other']

function ApplyModal({ onClose }: { onClose: () => void }) {
  const [bio, setBio] = useState('')
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([])
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['English'])
  const [credentialsUrl, setCredentialsUrl] = useState('')
  const [rate, setRate] = useState(50)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const toggleSpec = (s: string) => {
    setSelectedSpecs((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const toggleLang = (l: string) => {
    setSelectedLangs((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l])
  }

  const handleSubmit = async () => {
    if (!bio.trim() || selectedSpecs.length === 0) {
      setError('Please fill in your bio and select at least one specialization.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await apiFetch('/api/v1/marketplace/experts/apply', {
        method: 'POST',
        body: JSON.stringify({
          bio: bio.trim(),
          specializations: selectedSpecs.map((s) => s.toLowerCase()),
          languages: selectedLangs,
          credentialsUrl: credentialsUrl.trim() || undefined,
          ratePerReview: rate,
        }),
      })
      if (res.success) {
        setSuccess(true)
      } else {
        setError(res.error?.message || 'Failed to submit application')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-base font-bold">Apply to Become an Expert</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-semibold text-white mb-1">Application submitted!</p>
            <p className="text-sm text-zinc-400">We review applications within 48 hours and will email you with the decision.</p>
            <button onClick={onClose} className="mt-6 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all">
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Bio <span className="text-red-400">*</span></label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Tell us about your expertise, credentials, and experience…"
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-zinc-600 resize-none transition-colors"
              />
            </div>

            {/* Specializations */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Specializations <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpec(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedSpecs.includes(s)
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Languages</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLang(l)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedLangs.includes(l)
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Credentials URL */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Credentials URL <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={credentialsUrl}
                onChange={(e) => setCredentialsUrl(e.target.value)}
                placeholder="https://linkedin.com/in/… or portfolio link"
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-zinc-600 transition-colors"
              />
            </div>

            {/* Rate */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Rate per review: <span className="text-indigo-300 font-bold">{rate} credits</span>
              </label>
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-1">
                <span>10</span>
                <span>200</span>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-all active:scale-95"
              >
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExpertsMarketplacePage() {
  const [leaderboard, setLeaderboard] = useState<Expert[]>([])
  const [filteredExperts, setFilteredExperts] = useState<Expert[]>([])
  const [stats, setStats] = useState<MarketplaceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSpec, setActiveSpec] = useState<string | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [requestExpert, setRequestExpert] = useState<Expert | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<{ experts: Expert[] }>('/api/v1/marketplace/experts/leaderboard'),
      apiFetch<{ stats: MarketplaceStats }>('/api/v1/marketplace/stats'),
    ]).then(([leadRes, statsRes]) => {
      if (leadRes.success && leadRes.data) setLeaderboard(leadRes.data.experts)
      if (statsRes.success && statsRes.data) setStats(statsRes.data.stats)
    }).finally(() => setLoading(false))
  }, [])

  const handleSpecFilter = async (spec: string | null) => {
    setActiveSpec(spec)
    if (!spec) {
      setFilteredExperts([])
      return
    }
    setFilterLoading(true)
    try {
      const res = await apiFetch<{ experts: Expert[] }>(
        `/api/v1/marketplace/experts?specialization=${spec.toLowerCase()}`,
      )
      if (res.success && res.data) setFilteredExperts(res.data.experts)
    } finally {
      setFilterLoading(false)
    }
  }

  const displayExperts = activeSpec ? filteredExperts : leaderboard

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
        <div className="h-4 w-px bg-zinc-800" />
        <Link href="/marketplace" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">AI Marketplace</Link>
        <div className="h-4 w-px bg-zinc-800" />
        <span className="font-semibold text-sm">Expert Reviews</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Human Expert Review</h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Get your AI-generated work reviewed by certified domain experts
          </p>

          {stats && (
            <div className="flex items-center justify-center gap-8 mt-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{stats.totalExperts}</p>
                <p className="text-xs text-zinc-500">Verified experts</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{stats.avgRating.toFixed(1)} ★</p>
                <p className="text-xs text-zinc-500">Average rating</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-400">{stats.avgResponseTime}</p>
                <p className="text-xs text-zinc-500">Avg. response time</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Leaderboard ───────────────────────────────────────────────────── */}
        {!activeSpec && (
          <div className="mb-10">
            <h2 className="text-base font-bold mb-4">Top Experts</h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-3xl mb-2">👨‍💼</p>
                <p className="text-sm">No experts listed yet — check back soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {leaderboard.map((expert) => (
                  <ExpertCard key={expert.id} expert={expert} onRequest={setRequestExpert} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Browse by specialization ─────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold mb-4">Browse by Specialization</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => handleSpecFilter(null)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                !activeSpec
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              All
            </button>
            {SPECIALIZATIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSpecFilter(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  activeSpec === s
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {activeSpec && (
            filterLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />)}
              </div>
            ) : filteredExperts.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm">No experts found for <strong>{activeSpec}</strong>.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExperts.map((expert) => (
                  <ExpertCard key={expert.id} expert={expert} onRequest={setRequestExpert} />
                ))}
              </div>
            )
          )}
        </div>

        {/* ── Become an Expert CTA ─────────────────────────────────────────── */}
        <div className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-indigo-500/5 p-10 text-center">
          <p className="text-3xl mb-3">🎓</p>
          <h2 className="text-xl font-bold mb-2">Become an Expert</h2>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-6">
            Share your expertise and earn credits reviewing AI-generated work across your domain.
          </p>
          <button
            onClick={() => setShowApply(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all active:scale-95"
          >
            Apply to become an expert
          </button>
        </div>
      </main>

      {/* Apply modal */}
      {showApply && <ApplyModal onClose={() => setShowApply(false)} />}

      {/* Request review shortcut (from expert card) */}
      {requestExpert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
            <p className="font-semibold text-white mb-2">Request review from {requestExpert.name}</p>
            <p className="text-sm text-zinc-400 mb-4">
              To request a review for a specific task, open that task&apos;s roundtable page and click &quot;Request Expert Review&quot;.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setRequestExpert(null)}
                className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
