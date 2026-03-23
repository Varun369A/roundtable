'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthlyInr: 0,
    annualInr: 0,
    description: 'Try Arivarangam with no commitment.',
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
    id: 'builder',
    name: 'Builder',
    monthlyInr: 799,
    annualInr: 638,   // 20% off
    description: 'For individuals who bring their own API keys.',
    features: [
      'Bring your own API keys (BYOAI)',
      'All 16 AI models',
      'Unlimited Roundtable tasks',
      'Sarvam (Indian languages)',
      'Priority support',
    ],
    cta: 'Get Builder',
    highlight: false,
  },
  {
    id: 'studio',
    name: 'Studio',
    monthlyInr: 1999,
    annualInr: 1599,  // 20% off
    originalComboInr: 8526,
    description: 'The full Arivarangam experience — Arivarangam absorbs API costs.',
    features: [
      'All 16 AI models (Arivarangam pays)',
      'Unlimited Roundtable tasks',
      'Claude Opus synthesis',
      'Team workspace (up to 5 seats)',
      'API access + priority routing',
      'Midjourney, Runway, Stability',
    ],
    cta: 'Get Studio',
    highlight: true,
    badge: 'Most popular',
  },
]

const FAQS = [
  {
    q: 'Do I pay separately for each AI?',
    a: 'No. On Studio, Arivarangam absorbs the API costs within your plan. On Builder, you bring your own API keys — you pay the AI providers directly at their rates.',
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
  // Fix 16: annual billing is the default — users save 20%, better for Arivarangam LTV
  const [isAnnual, setIsAnnual] = useState(true)

  async function handleUpgrade(planId: string) {
    if (planId === 'free') { router.push('/signup'); return }

    const token = localStorage.getItem('accessToken')
    if (!token) { router.push('/login'); return }

    setLoading(planId)
    try {
      const res = await apiFetch<{ subscriptionId: string; razorpayKeyId: string }>(
        '/api/v1/billing/create-subscription',
        { method: 'POST', body: JSON.stringify({ planId, billing: isAnnual ? 'annual' : 'monthly' }) }
      )

      if (!res.success || !res.data) {
        alert(res.error?.message || 'Failed to create subscription')
        return
      }

      const { subscriptionId, razorpayKeyId } = res.data

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
        name: 'Arivarangam',
        description: `Arivarangam ${plan?.name} Plan${isAnnual ? ' (Annual)' : ''}`,
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
              razorpayPaymentId:      response.razorpay_payment_id,
              razorpaySubscriptionId: response.razorpay_subscription_id,
              razorpaySignature:      response.razorpay_signature,
              planId,
              billing: isAnnual ? 'annual' : 'monthly',
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
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav role="navigation" aria-label="Main navigation" className="border-b border-slate-200 bg-white px-6 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
          Arivarangam<span className="text-brand-500">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Log in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-medium transition-colors text-white">
            Get started free
          </Link>
        </div>
      </nav>

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 tracking-tight text-slate-900">
            Simple, honest pricing
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            ChatGPT + Claude + Midjourney + ElevenLabs + Perplexity = ₹8,526/month separately.
            <br />
            Arivarangam Studio = <span className="text-brand-400 font-bold">₹1,599/month.</span>
          </p>
        </div>

        {/* Annual / Monthly toggle — annual is the default */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <button
            onClick={() => setIsAnnual(false)}
            className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
          >
            Monthly
          </button>

          <button
            role="switch"
            aria-checked={isAnnual}
            aria-label="Toggle annual billing"
            onClick={() => setIsAnnual((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors ${isAnnual ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAnnual(true)}
              className={`text-sm font-medium transition-colors ${isAnnual ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
            >
              Annual
            </button>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </div>
        </div>

        {/* Plans */}
        <div role="list" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          {PLANS.map((plan) => {
            const price = isAnnual ? plan.annualInr : plan.monthlyInr
            return (
              <div
                key={plan.id}
                role="listitem"
                className={`relative rounded-2xl p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-2 border-brand-500 bg-white shadow-md'
                    : 'border border-slate-200 bg-white shadow-sm'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-600 rounded-full text-xs font-semibold whitespace-nowrap text-white">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="font-bold text-lg mb-1 text-slate-900">{plan.name}</h2>
                  <p id={`plan-desc-${plan.id}`} className="text-slate-500 text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  {'originalComboInr' in plan && isAnnual && (
                    <p className="text-slate-400 text-sm line-through">
                      ₹{(plan as typeof plan & { originalComboInr: number }).originalComboInr.toLocaleString('en-IN')}/mo if bought separately
                    </p>
                  )}
                  {!isAnnual && plan.monthlyInr > 0 && (
                    <p className="text-slate-400 text-sm">
                      or ₹{plan.annualInr.toLocaleString('en-IN')}/mo billed annually
                    </p>
                  )}
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-4xl font-bold text-slate-900">
                      {price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}`}
                    </span>
                    {price > 0 && (
                      <span className="text-slate-500 mb-1">/mo{isAnnual ? ' · billed annually' : ''}</span>
                    )}
                  </div>
                  {isAnnual && plan.monthlyInr > 0 && (
                    <p className="text-emerald-600 text-xs mt-1 font-medium">
                      Saves ₹{((plan.monthlyInr - plan.annualInr) * 12).toLocaleString('en-IN')}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className={plan.highlight ? 'text-brand-400' : 'text-green-600'}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading === plan.id}
                  aria-label={`${plan.cta} with ${plan.name} plan`}
                  aria-describedby={`plan-desc-${plan.id}`}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                    plan.highlight
                      ? 'bg-brand-600 hover:bg-brand-500 hover:scale-105 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {loading === plan.id ? 'Opening checkout…' : plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* Enterprise callout */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center mb-20">
          <h2 className="text-2xl font-bold mb-2 text-slate-900">Enterprise</h2>
          <p className="text-slate-500 mb-4 max-w-xl mx-auto">
            Custom contracts for teams. SLA, role-based access, admin dashboard, on-prem routing, dedicated account manager.
          </p>
          <a
            href="mailto:admin@arivarangam.com"
            className="inline-block px-6 py-3 border border-slate-300 hover:border-slate-400 rounded-xl text-sm font-medium transition-colors text-slate-700 hover:text-slate-900"
          >
            Contact sales →
          </a>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-slate-900">Frequently asked</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-slate-50 transition-colors text-slate-800"
                  aria-expanded={openFaq === i}
                >
                  <span>{faq.q}</span>
                  <span className="text-slate-400 ml-4 flex-shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                    <p className="pt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
