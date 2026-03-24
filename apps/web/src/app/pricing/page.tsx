'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Credit packs — ₹X = Y credits. 1 typical 3-AI Roundtable = 30 credits.
const CREDIT_PACKS = [
  {
    id: 'starter',
    label: 'Starter',
    inr: 500,
    credits: 500,
    bonus: 0,
    tasks: 16,
    highlight: false,
  },
  {
    id: 'standard',
    label: 'Standard',
    inr: 1000,
    credits: 1100,
    bonus: 100,
    tasks: 36,
    highlight: true,
    badge: 'Best value',
  },
  {
    id: 'pro',
    label: 'Pro',
    inr: 2500,
    credits: 3000,
    bonus: 500,
    tasks: 100,
    highlight: false,
  },
  {
    id: 'power',
    label: 'Power',
    inr: 5000,
    credits: 6500,
    bonus: 1500,
    tasks: 216,
    highlight: false,
  },
]

const FAQS = [
  {
    q: 'If I have my own API keys, is Arivarangam really free?',
    a: 'Yes, completely. Connect your Anthropic, OpenAI, Perplexity, or Gemini keys in Settings → AI Keys. Arivarangam orchestrates them for free — we take no markup. You only pay your AI provider directly at their rates.',
  },
  {
    q: 'How many credits does a Roundtable task use?',
    a: 'Each AI agent (subtask) costs 10 credits. A typical 3-AI Roundtable costs 30 credits. A full discussion-round Roundtable (3 AIs + peer review + synthesis) costs ~75 credits. You always see the estimated cost before a task starts.',
  },
  {
    q: 'Do credits expire?',
    a: 'No. Credits you purchase never expire. Promotional or referral credits may have a 1-year validity noted at the time they\'re granted.',
  },
  {
    q: 'Which AI models are available?',
    a: 'Claude 3.5 Sonnet, Claude 3 Opus, GPT-4o, GPT-4 Turbo, Gemini 1.5 Pro, Perplexity Sonar, Stable Diffusion XL, DALL·E 3, ElevenLabs, Runway Gen-3, Sarvam-1 (Indian languages), Groq, Cohere, and more. BYOAI users get all models they hold keys for. Credit users get Claude + GPT-4o by default.',
  },
  {
    q: 'What is Arivarangam Passport?',
    a: 'Your Passport is a public AI-verified skill profile that builds automatically from your completed tasks — shareable as a link. It shows what you\'ve built, which AI models you used, and your expertise areas. Every account gets a Passport for free.',
  },
  {
    q: 'Which payment methods are accepted?',
    a: 'UPI, all major credit/debit cards, net banking, and EMI — powered by Razorpay. All prices are in Indian Rupees (₹).',
  },
  {
    q: 'Can I use both BYOAI keys and credits?',
    a: 'Yes. When you have your own key for a model, Arivarangam uses it. When you don\'t, it automatically falls back to credit-based usage. You\'re never blocked from running a task.',
  },
  {
    q: 'What about teams or enterprise?',
    a: 'Email admin@arivarangam.com for team credit packs, custom SLAs, role-based access, and dedicated support. Built in Coimbatore — we respond fast.',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white px-6 h-16 flex items-center justify-between max-w-6xl mx-auto">
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

      <main className="max-w-5xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 tracking-tight text-slate-900">
            Your API keys? Free forever.<br />
            <span className="text-brand-500">No keys? Pay per use.</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Arivarangam orchestrates Claude, GPT-4o, Gemini, Perplexity and more together — free if you bring your own keys, credit-based if you don't.
          </p>
          <p className="text-xs text-slate-400 mt-3">Built in Coimbatore, Tamil Nadu · India-first pricing · No hidden fees</p>
        </div>

        {/* ── BYOAI section ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border-2 border-brand-500 bg-white shadow-md p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔑</span>
                <h2 className="text-2xl font-bold text-slate-900">BYOAI — Bring Your Own API Keys</h2>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">FREE FOREVER</span>
              </div>
              <p className="text-slate-500 mb-5">
                Connect your own Anthropic, OpenAI, Perplexity, or Gemini keys. Arivarangam orchestrates them — we charge nothing. You pay your AI provider at their rates with zero markup.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'All 16 AI models (you hold the keys)',
                  'Unlimited Roundtable tasks',
                  'Workflow builder & scheduling',
                  'Arivarangam Passport (auto-generated)',
                  'Sarvam — Indian language support',
                  'Social media automation',
                  'Team workspace',
                  'No subscription, no lock-in',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-brand-500 font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:w-48 text-center shrink-0">
              <div className="text-5xl font-black text-slate-900 mb-1">₹0</div>
              <div className="text-slate-400 text-sm mb-4">forever</div>
              <Link
                href="/signup"
                className="block w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Start free →
              </Link>
              <p className="text-xs text-slate-400 mt-2">No credit card needed</p>
            </div>
          </div>
        </div>

        {/* ── Credits section ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 mb-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-2xl">💳</span>
              <h2 className="text-2xl font-bold text-slate-900">Credits — No API Keys Needed</h2>
            </div>
            <p className="text-slate-500 max-w-lg mx-auto">
              Don't have API keys? Buy credits and run tasks instantly. Arivarangam uses its own keys on your behalf.
              <br />
              <span className="text-sm font-medium text-slate-700 mt-1 block">1 credit = ₹1 · Typical 3-AI Roundtable = 30 credits · Credits never expire</span>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`relative rounded-xl p-5 flex flex-col text-center border transition-all ${
                  pack.highlight
                    ? 'border-brand-500 bg-brand-50 shadow-md'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                {pack.badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-brand-600 rounded-full text-[10px] font-bold whitespace-nowrap text-white">
                    {pack.badge}
                  </div>
                )}
                <div className="text-sm font-semibold text-slate-500 mb-1">{pack.label}</div>
                <div className="text-3xl font-black text-slate-900 mb-1">₹{pack.inr.toLocaleString('en-IN')}</div>
                <div className={`text-lg font-bold mb-0.5 ${pack.highlight ? 'text-brand-600' : 'text-slate-700'}`}>
                  {pack.credits.toLocaleString('en-IN')} credits
                </div>
                {pack.bonus > 0 && (
                  <div className="text-xs text-emerald-600 font-medium mb-1">+{pack.bonus} bonus</div>
                )}
                <div className="text-xs text-slate-400 mb-4">~{pack.tasks} Roundtable tasks</div>
                <button
                  onClick={() => router.push('/credits')}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                    pack.highlight
                      ? 'bg-brand-600 hover:bg-brand-500 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  Buy credits
                </button>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-400">
              Sign up free — you get <strong className="text-slate-600">100 credits</strong> on your first day, no card required.
              Top up anytime from your dashboard.
            </p>
          </div>
        </div>

        {/* ── Comparison row ──────────────────────────────────────────────── */}
        <div className="rounded-xl bg-slate-100 border border-slate-200 p-5 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-center">
            <div>
              <div className="font-semibold text-slate-700 mb-1">ChatGPT Plus alone</div>
              <div className="text-2xl font-black text-red-400 line-through">₹1,675/mo</div>
              <div className="text-slate-400 text-xs">just one AI</div>
            </div>
            <div>
              <div className="font-semibold text-slate-700 mb-1">All 5 AIs separately</div>
              <div className="text-2xl font-black text-red-400 line-through">₹8,526/mo</div>
              <div className="text-slate-400 text-xs">ChatGPT + Claude + Gemini + Perplexity + Midjourney</div>
            </div>
            <div>
              <div className="font-semibold text-brand-600 mb-1">Arivarangam BYOAI</div>
              <div className="text-2xl font-black text-emerald-600">₹0/mo</div>
              <div className="text-slate-400 text-xs">all of them together, orchestrated</div>
            </div>
          </div>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center mb-16">
          <h2 className="text-xl font-bold mb-2 text-slate-900">Enterprise / Teams</h2>
          <p className="text-slate-500 text-sm mb-4 max-w-lg mx-auto">
            Bulk credit packs, custom SLAs, role-based access, dedicated admin dashboard, on-prem routing, and a dedicated account manager.
          </p>
          <a
            href="mailto:admin@arivarangam.com"
            className="inline-block px-6 py-3 border border-slate-300 hover:border-brand-500 hover:text-brand-600 rounded-xl text-sm font-medium transition-colors text-slate-700"
          >
            Contact us → admin@arivarangam.com
          </a>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-slate-900">Frequently asked</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
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
