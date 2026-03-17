'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Wallet {
  balance: number
  lifetimeEarned: number
  lifetimeSpent: number
}

interface Referral {
  code: string
  referralCount: number
  creditsEarned: number
}

interface CreditPack {
  id: string
  name: string
  credits: number
  bonusCredits: number
  priceInr: number
  isPopular: boolean
}

interface Transaction {
  id: string
  type: string
  description: string
  amount: number
  balanceAfter: number
  createdAt: string
}

interface TransactionPage {
  items: Transaction[]
  total: number
}

// ─── Type badge colours ───────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, string> = {
  EARNED:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  SPENT:     'bg-red-500/10 text-red-400 border-red-500/20',
  PURCHASED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  REFERRAL:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  BONUS:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  REFUND:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
}

// ─── Purchase modal ───────────────────────────────────────────────────────────

function PurchaseModal({
  packs,
  onClose,
  onPurchased,
}: {
  packs: CreditPack[]
  onClose: () => void
  onPurchased: () => void
}) {
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadRazorpay = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })

  const handlePurchase = async (pack: CreditPack) => {
    setPurchasing(pack.id)
    setError('')
    try {
      const res = await apiFetch<{ orderId: string; amount: number; currency: string; keyId: string }>(
        `/api/v1/credits/packs/${pack.id}/purchase`,
        { method: 'POST' },
      )
      if (!res.success || !res.data) {
        setError(res.error?.message || 'Failed to initiate purchase')
        return
      }

      const loaded = await loadRazorpay()
      if (!loaded || !(window as any).Razorpay) {
        setError('Razorpay could not be loaded. Please disable any ad blockers and try again.')
        return
      }

      const rzp = new (window as any).Razorpay({
        key: res.data.keyId,
        order_id: res.data.orderId,
        amount: res.data.amount,
        currency: res.data.currency || 'INR',
        name: 'Sabha Credits',
        description: `${pack.name} — ${pack.credits + pack.bonusCredits} credits`,
        theme: { color: '#6366f1' },
        handler: () => {
          onPurchased()
          onClose()
        },
      })
      rzp.open()
    } catch {
      setError('Network error — please try again')
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-lg font-bold">Buy Credits</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className={`relative rounded-2xl border p-5 flex flex-col gap-3 ${
                pack.isPopular
                  ? 'border-indigo-500/50 bg-indigo-500/5'
                  : 'border-white/10 bg-white/3'
              }`}
            >
              {pack.isPopular && (
                <span className="absolute -top-2.5 left-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                  Most Popular
                </span>
              )}
              <div>
                <p className="font-semibold text-white">{pack.name}</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {pack.credits.toLocaleString('en-IN')}
                  {pack.bonusCredits > 0 && (
                    <span className="text-emerald-400 text-base font-semibold ml-1.5">
                      +{pack.bonusCredits.toLocaleString('en-IN')} bonus
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">credits</p>
              </div>
              <button
                onClick={() => handlePurchase(pack)}
                disabled={purchasing === pack.id}
                className={`mt-auto w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                  pack.isPopular
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-white/8 hover:bg-white/12 text-white'
                } disabled:opacity-40`}
              >
                {purchasing === pack.id ? 'Opening…' : `₹${pack.priceInr.toLocaleString('en-IN')}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreditsPage() {
  const router = useRouter()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txOffset, setTxOffset] = useState(0)
  const [txFilter, setTxFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [showPurchase, setShowPurchase] = useState(false)
  const [copied, setCopied] = useState(false)

  const TX_LIMIT = 20

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) { router.push('/login'); return }
    fetchAll()
  }, [])

  async function fetchAll() {
    const [walletRes, refRes, packsRes] = await Promise.allSettled([
      apiFetch<{ wallet: Wallet }>('/api/v1/credits/wallet'),
      apiFetch<{ referral: Referral }>('/api/v1/credits/referral'),
      apiFetch<{ packs: CreditPack[] }>('/api/v1/credits/packs'),
    ])
    if (walletRes.status === 'fulfilled' && walletRes.value.success) setWallet(walletRes.value.data!.wallet)
    if (refRes.status === 'fulfilled' && refRes.value.success) setReferral(refRes.value.data!.referral)
    if (packsRes.status === 'fulfilled' && packsRes.value.success) setPacks(packsRes.value.data!.packs)
    setLoading(false)
    fetchTransactions(0, txFilter)
  }

  const fetchTransactions = useCallback(async (offset: number, filter: string) => {
    setTxLoading(true)
    const params = new URLSearchParams({ limit: String(TX_LIMIT), offset: String(offset) })
    if (filter !== 'ALL') params.set('type', filter)
    const res = await apiFetch<TransactionPage>(`/api/v1/credits/transactions?${params}`)
    if (res.success && res.data) {
      setTransactions(res.data.items)
      setTxTotal(res.data.total)
      setTxOffset(offset)
    }
    setTxLoading(false)
  }, [])

  const handleFilterChange = (f: string) => {
    setTxFilter(f)
    fetchTransactions(0, f)
  }

  const copyCode = () => {
    if (!referral) return
    navigator.clipboard.writeText(referral.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareOnTwitter = () => {
    if (!referral) return
    const text = encodeURIComponent(`I use Sabha to run multiple AIs in one roundtable — it's incredible. Join with my code ${referral.code} and get 50 free credits! https://sabha.ai/signup?ref=${referral.code}`)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }

  const shareOnWhatsApp = () => {
    if (!referral) return
    const text = encodeURIComponent(`Hey! I've been using Sabha to run multiple AIs together. Use my referral code *${referral.code}* and get 50 free credits: https://sabha.ai/signup?ref=${referral.code}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const TX_TYPES = ['ALL', 'EARNED', 'SPENT', 'PURCHASED', 'REFERRAL', 'BONUS', 'REFUND']

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <header className="border-b border-white/5 px-6 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="font-semibold">Credits</span>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)}
        </main>
      </div>
    )
  }

  const totalCreditsNextPage = txOffset + TX_LIMIT
  const hasNextPage = totalCreditsNextPage < txTotal
  const hasPrevPage = txOffset > 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</Link>
        <div className="h-4 w-px bg-zinc-800" />
        <span className="font-semibold">Credits & Wallet</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* ── Wallet Hero Card ─────────────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-700 to-purple-900 p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 0%, transparent 60%)' }} />
          <div className="relative z-10">
            <p className="text-indigo-200 text-sm font-medium mb-1">Current Balance</p>
            <div className="flex items-end gap-3 mb-6">
              <span className="text-7xl font-bold tracking-tight text-white">
                {(wallet?.balance ?? 0).toLocaleString('en-IN')}
              </span>
              <span className="text-indigo-300 text-lg mb-2 font-medium">credits</span>
            </div>

            <div className="flex items-center gap-8 mb-8">
              <div>
                <p className="text-indigo-300 text-xs">Lifetime earned</p>
                <p className="text-white font-bold text-lg">{(wallet?.lifetimeEarned ?? 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-indigo-300 text-xs">Lifetime spent</p>
                <p className="text-white font-bold text-lg">{(wallet?.lifetimeSpent ?? 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <button
              onClick={() => setShowPurchase(true)}
              className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-all active:scale-95 shadow-lg"
            >
              Buy Credits
            </button>
          </div>
        </div>

        {/* ── Referral Section ─────────────────────────────────────────────── */}
        {referral && (
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6">
            <h2 className="text-base font-bold mb-4">Refer & Earn</h2>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* Code display */}
              <div className="flex-1">
                <p className="text-xs text-zinc-500 mb-2">Your referral code</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold tracking-widest text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl">
                    {referral.code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="px-3 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-sm transition-colors flex items-center gap-1.5"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  Share link:{' '}
                  <span className="text-zinc-400">https://sabha.ai/signup?ref={referral.code}</span>
                </p>
              </div>

              {/* Stats */}
              <div className="flex gap-4 sm:flex-col sm:gap-2 sm:items-end justify-center sm:justify-start">
                <div className="text-center sm:text-right">
                  <p className="text-2xl font-bold text-white">{referral.referralCount}</p>
                  <p className="text-xs text-zinc-500">people referred</p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-2xl font-bold text-emerald-400">{referral.creditsEarned.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-zinc-500">credits earned</p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-xl bg-white/5 border border-white/5 p-4 mb-4">
              <p className="text-xs font-semibold text-zinc-400 mb-2">How it works</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="text-emerald-400 font-bold mt-0.5">+100</span>
                  <span>You earn 100 credits when someone signs up using your code</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="text-indigo-400 font-bold mt-0.5">+50</span>
                  <span>They earn 50 credits when they complete their first task</span>
                </div>
              </div>
            </div>

            {/* Social share */}
            <div className="flex gap-3">
              <button
                onClick={shareOnTwitter}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a2e] border border-white/10 hover:bg-white/8 text-sm text-white transition-colors"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share on X
              </button>
              <button
                onClick={shareOnWhatsApp}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a2e1a] border border-white/10 hover:bg-white/8 text-sm text-white transition-colors"
              >
                <svg className="w-4 h-4 fill-current text-green-400" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Share on WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* ── Credit Packs ─────────────────────────────────────────────────── */}
        {packs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Credit Packs</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className={`relative rounded-2xl border p-5 flex flex-col gap-3 ${
                    pack.isPopular
                      ? 'border-indigo-500/50 bg-indigo-500/5'
                      : 'border-white/10 bg-white/3'
                  }`}
                >
                  {pack.isPopular && (
                    <span className="absolute -top-2.5 left-4 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                      Most Popular
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-white">{pack.name}</p>
                    <p className="text-3xl font-bold text-white mt-2">
                      {pack.credits.toLocaleString('en-IN')}
                    </p>
                    {pack.bonusCredits > 0 && (
                      <p className="text-emerald-400 text-sm font-semibold">
                        +{pack.bonusCredits.toLocaleString('en-IN')} bonus credits
                      </p>
                    )}
                    <p className="text-xs text-zinc-500 mt-0.5">credits</p>
                  </div>
                  <button
                    onClick={() => setShowPurchase(true)}
                    className={`mt-auto w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                      pack.isPopular
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'bg-white/8 hover:bg-white/12 text-white'
                    }`}
                  >
                    ₹{pack.priceInr.toLocaleString('en-IN')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Transaction History ───────────────────────────────────────────── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold">Transaction History</h2>
            <div className="flex gap-1.5 flex-wrap">
              {TX_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => handleFilterChange(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    txFilter === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {txLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <p className="text-3xl mb-2">💳</p>
              <p className="text-sm">No transactions yet.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 text-zinc-500 text-xs">
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Description</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Balance after</th>
                      <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_STYLE[tx.type] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                            {tx.type.charAt(0) + tx.type.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300 text-xs hidden sm:table-cell max-w-[200px] truncate">
                          {tx.description}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold text-sm ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-500 text-xs hidden md:table-cell">
                          {tx.balanceAfter.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600 text-xs hidden md:table-cell whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(hasPrevPage || hasNextPage) && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-zinc-500">
                    Showing {txOffset + 1}–{Math.min(txOffset + TX_LIMIT, txTotal)} of {txTotal}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchTransactions(txOffset - TX_LIMIT, txFilter)}
                      disabled={!hasPrevPage}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-xs disabled:opacity-30 hover:bg-white/10 transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => fetchTransactions(txOffset + TX_LIMIT, txFilter)}
                      disabled={!hasNextPage}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-xs disabled:opacity-30 hover:bg-white/10 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Purchase modal */}
      {showPurchase && (
        <PurchaseModal
          packs={packs}
          onClose={() => setShowPurchase(false)}
          onPurchased={async () => {
            const res = await apiFetch<{ wallet: Wallet }>('/api/v1/credits/wallet')
            if (res.success && res.data) setWallet(res.data.wallet)
            fetchTransactions(0, txFilter)
            window.dispatchEvent(new CustomEvent('credits_updated'))
          }}
        />
      )}
    </div>
  )
}
