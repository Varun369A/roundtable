'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceInr: 0,
    description: 'Try Sabha with no commitment.',
    features: [
      '2 AI models (Claude + GPT-4o)',
      '5 tasks/month',
      '2 Roundtable tasks/month',
      'Basic support',
    ],
    cta: 'Start free',
    href: '/signup',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    priceInr: 499,
    description: 'For individuals who need real AI power.',
    features: [
      '5 AI models',
      '100 Roundtable tasks/month',
      'Claude, GPT-4o, Perplexity, DALL-E, ElevenLabs',
      'Sarvam (Indian languages)',
      'Priority support',
    ],
    cta: 'Get Starter',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceInr: 1299,
    originalPriceInr: 8526,
    description: 'The full Sabha experience. Everything, unlimited.',
    features: [
      'All 16 AI models',
      'Unlimited single tasks',
      '500 Roundtable tasks/month',
      'Midjourney, Gemini, Stability, Gamma, Runway',
      'API access',
      'Priority routing',
    ],
    cta: 'Get Pro',
    highlight: true,
    badge: 'Most popular',
  },
  {
    id: 'power',
    name: 'Power',
    priceInr: 2499,
    description: 'For power users and small teams.',
    features: [
      'Everything in Pro',
      'Unlimited Roundtable tasks',
      'Priority queue',
      'Advanced analytics',
      'Custom routing rules',
      'API access',
    ],
    cta: 'Get Power',
    highlight: false,
  },
]

const FAQS = [
  {
    q: 'Do I pay separately for each AI?',
    a: 'No. Sabha absorbs the API costs within your plan limits. One subscription, all AIs.',
  },
  {
    q: 'Which payment methods are accepted?',
    a: 'UPI, all major credit/debit cards, net banking, and EMI. Powered by Razorpay.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel anytime from your billing settings. You keep access until the end of the current billing period.',
  },
  {
    q: 'What counts as a "task"?',
    a: 'One Roundtable session (e.g., "Create a marketing campaign") counts as one task, regardless of how many AIs collaborate inside it.',
  },
  {
    q: 'Is there a free trial?',
    a: "The Free plan lets you run 5 tasks permanently with no credit card. That's your trial.",
  },
  {
    q: 'What about enterprise pricing?',
    a: 'Custom contracts for teams of 10+. Includes SLA, role-based access, admin dashboard, and on-prem routing options.',
  },
]

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  async function handleUpgrade(planId: string) {
    if (planId === 'free') { router.push('/signup'); return }

    const token = localStorage.getItem('accessToken')
    if (!token) { router.push('/login'); return }

    setLoading(planId)
    try {
      const res = await apiFetch<{ subscriptionId: string; razorpayKeyId: string }>(
        '/api/v1/billing/create-subscription',
        { method: 'POST', body: JSON.stringify({ planId }) }
      )

      if (!res.success || !res.data) {
        alert(res.error?.message || 'Failed to create subscription')
        return
      }

      const { subscriptionId, razorpayKeyId } = res.data

      // Load Razorpay script dynamically
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Razorpay'))
          document.head.appendChild(script)
        })
      }

      const plan = PLANS.find((p) => p.id === planId)
      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        subscription_id: subscriptionId,
        name: 'Sabha',
        description: `Sabha ${plan?.name} Plan`,
        image: '/logo.png',
        theme: { color: '#c026d3' },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_subscription_id: string
          razorpay_signature: string
        }) => {
          const verifyRes = await apiFetch('/api/v1/billing/verify-payment', {
            method: 'POST',
            body: JSON.stringify({
              razorpayPaymentId:     response.razorpay_payment_id,
              razorpaySubscriptionId: response.razorpay_subscription_id,
              razorpaySignature:     response.razorpay_signature,
              planId,
            }),
          })

          if (verifyRes.success) {
            router.push('/dashboard?upgraded=1')
          } else {
            alert('Payment verification failed. Contact support.')
          }
        },
      })

      rzp.open()
    } catch (err) {
      alert('Something went wrong. Please try again.')
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Nav */}
      <nav className="border-b border-zinc-800/50 px-6 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Sabha<span className="text-brand-500">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Log in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-medium transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            Simple, honest pricing
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            ChatGPT + Claude + Midjourney + ElevenLabs + Perplexity = ₹8,526/month separately.
            <br />
            Sabha Pro = <span className="text-brand-400 font-bold">₹1,299/month.</span>
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'border-2 border-brand-500 bg-brand-500/5'
                  : 'border border-zinc-800 bg-zinc-900/50'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-600 rounded-full text-xs font-semibold whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                <p className="text-zinc-500 text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                {plan.originalPriceInr && (
                  <p className="text-zinc-600 text-sm line-through">
                    ₹{plan.originalPriceInr.toLocaleString('en-IN')}/mo separately
                  </p>
                )}
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold">
                    {plan.priceInr === 0 ? 'Free' : `₹${plan.priceInr.toLocaleString('en-IN')}`}
                  </span>
                  {plan.priceInr > 0 && (
                    <span className="text-zinc-500 mb-1">/month</span>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className={plan.highlight ? 'text-brand-400' : 'text-green-400'}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                  plan.highlight
                    ? 'bg-brand-600 hover:bg-brand-500 hover:scale-105'
                    : 'bg-zinc-800 hover:bg-zinc-700'
                }`}
              >
                {loading === plan.id ? 'Opening checkout…' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Enterprise callout */}
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center mb-20">
          <h2 className="text-2xl font-bold mb-2">Enterprise</h2>
          <p className="text-zinc-400 mb-4 max-w-xl mx-auto">
            Custom contracts for teams. SLA, role-based access, admin dashboard, on-prem routing, dedicated account manager.
          </p>
          <a
            href="mailto:enterprise@sabhaai.com"
            className="inline-block px-6 py-3 border border-zinc-700 hover:border-zinc-500 rounded-xl text-sm font-medium transition-colors"
          >
            Contact sales →
          </a>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="font-medium text-sm">{faq.q}</span>
                  <span className="text-zinc-500 shrink-0 transition-transform" style={{ transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-20 py-8 text-center text-zinc-600 text-sm">
        <p>Sabha · Payments secured by Razorpay · All prices in INR incl. GST</p>
      </footer>
    </div>
  )
}
