'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    q: 'How does Arivarangam AI work?',
    a: 'You describe your goal. Arivarangam AI internally consults 8 specialist AIs — Claude for coding, GPT-4o for reasoning, Gemini for analysis, Perplexity for research, Sarvam for Indian languages, ElevenLabs for voice, Whisper for transcription, and GPT Image for visuals. Then Arivarangam AI reads all their outputs and builds you one complete, polished deliverable.',
  },
  {
    q: 'How many credits does a task use?',
    a: 'Each specialist sub-task costs 10 credits. A typical task (3 specialists + synthesis) costs ~30 credits. A complex task with peer review + multiple specialists costs ~75 credits. You always see the estimated cost before a task starts.',
  },
  {
    q: 'Do credits expire?',
    a: 'No. Credits you purchase never expire. Promotional or referral credits may have a 1-year validity noted at the time they\'re granted.',
  },
  {
    q: 'Which AI models are included?',
    a: 'All 8 specialist AIs are included: Claude 3.5 Sonnet (coding), GPT-4o (reasoning), Gemini 2.5 Pro (analysis), Perplexity Sonar Pro (research), Sarvam-1 (Indian languages), ElevenLabs (voice output), Whisper (voice input), and GPT Image 1 (images). Arivarangam AI synthesises them all into your final output.',
  },
  {
    q: 'What is the 100 free credits on signup?',
    a: 'Every new account gets 100 credits automatically on signup — no card required. That\'s enough for 3 full tasks. Use them to try Arivarangam AI before buying any credits.',
  },
  {
    q: 'Which payment methods are accepted?',
    a: 'UPI, all major credit/debit cards, net banking, and EMI — powered by Razorpay. All prices are in Indian Rupees (₹). No dollar conversion, no international fees.',
  },
  {
    q: 'What about teams or enterprise?',
    a: 'Email admin@arivarangam.com for team credit packs, custom SLAs, role-based access, and dedicated support. Built in Coimbatore — we respond fast.',
  },
  {
    q: 'Can Arivarangam AI generate images and voice?',
    a: 'Yes. For tasks requiring visuals, Arivarangam AI automatically allocates GPT Image 1. For voice output, it uses ElevenLabs TTS. For voice input, it uses Whisper. You don\'t need to pick — it\'s allocated automatically based on your task.',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-600">.</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">Features</Link>
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/signup" className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors text-white shadow-sm">
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Simple credit-based pricing · No subscriptions
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-slate-900">
            One AI. Pay only for what you use.
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Arivarangam AI consults 8 world-class specialists and builds your complete deliverable.
            Buy credits once — use for any task. Credits never expire.
          </p>
          <p className="text-xs text-slate-400 mt-3">Built in Coimbatore, Tamil Nadu · Indian pricing · UPI accepted</p>
        </div>

        {/* Free signup banner */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="font-semibold text-emerald-800 text-sm">100 free credits on signup</p>
              <p className="text-xs text-emerald-600">No card required · Enough for 3 full tasks</p>
            </div>
          </div>
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            Create free account →
          </Link>
        </div>

        {/* Credit packs */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Credit Packs</h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm">
              1 credit = ₹1 · Typical task = 30 credits · Credits never expire · Top up anytime
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`relative rounded-xl p-5 flex flex-col text-center border transition-all ${
                  pack.highlight
                    ? 'border-indigo-400 bg-indigo-50 shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                {pack.badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-indigo-600 rounded-full text-[10px] font-bold whitespace-nowrap text-white">
                    {pack.badge}
                  </div>
                )}
                <div className="text-xs font-semibold text-slate-500 mb-1">{pack.label}</div>
                <div className="text-3xl font-black text-slate-900 mb-1">₹{pack.inr.toLocaleString('en-IN')}</div>
                <div className={`text-base font-bold mb-0.5 ${pack.highlight ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {pack.credits.toLocaleString('en-IN')} credits
                </div>
                {pack.bonus > 0 && (
                  <div className="text-xs text-emerald-600 font-medium mb-1">+{pack.bonus} bonus</div>
                )}
                <div className="text-xs text-slate-400 mb-4">~{pack.tasks} tasks</div>
                <button
                  onClick={() => router.push(`/credits?pack=${pack.id}`)}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                    pack.highlight
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  Buy {pack.label} Pack →
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400">
            UPI · Credit/debit cards · Net banking · EMI — via Razorpay
          </p>
        </div>

        {/* What's included */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Every credit pack includes everything</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: '🟠', label: 'Claude 3.5 Sonnet — coding specialist' },
              { icon: '🟢', label: 'GPT-4o — reasoning specialist' },
              { icon: '🔷', label: 'Gemini 2.5 Pro — analysis specialist' },
              { icon: '🔵', label: 'Perplexity Sonar Pro — research specialist' },
              { icon: '🇮🇳', label: 'Sarvam-1 — Indian language specialist' },
              { icon: '🎵', label: 'ElevenLabs — voice output (TTS)' },
              { icon: '🎤', label: 'Whisper — voice input (STT)' },
              { icon: '🎨', label: 'GPT Image 1 — image generation' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-5">
            Arivarangam AI reads all specialist outputs and builds your final deliverable. You see one polished result.
          </p>
        </div>

        {/* Value comparison */}
        <div className="rounded-xl bg-slate-100 border border-slate-200 p-6 mb-12">
          <h3 className="text-center font-semibold text-slate-700 mb-5 text-sm">The value of 8 AIs in one</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-center">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">ChatGPT Plus</div>
              <div className="text-2xl font-black text-red-400 line-through">₹1,675/mo</div>
              <div className="text-slate-400 text-xs">just GPT-4o</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">All 5 AIs separately</div>
              <div className="text-2xl font-black text-red-400 line-through">₹8,500+/mo</div>
              <div className="text-slate-400 text-xs">ChatGPT + Claude + Gemini + Perplexity + ElevenLabs</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-indigo-600 mb-1 uppercase tracking-wide">Arivarangam AI</div>
              <div className="text-2xl font-black text-emerald-600">₹1,000</div>
              <div className="text-slate-400 text-xs">all 8 specialists · 36 complete tasks · no subscription</div>
            </div>
          </div>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center mb-16">
          <h2 className="text-xl font-bold mb-2 text-slate-900">Enterprise / Teams</h2>
          <p className="text-slate-500 text-sm mb-4 max-w-lg mx-auto">
            Bulk credit packs, custom SLAs, role-based access, dedicated admin dashboard, and a dedicated account manager.
          </p>
          <a
            href="mailto:admin@arivarangam.com"
            className="inline-block px-6 py-3 border border-slate-300 hover:border-indigo-400 hover:text-indigo-600 rounded-xl text-sm font-medium transition-colors text-slate-700"
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

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-900 font-bold">Arivarangam<span className="text-indigo-600">.</span></span>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/features" className="hover:text-slate-700">Features</Link>
            <Link href="/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-700">Terms</Link>
            <a href="mailto:admin@arivarangam.com" className="hover:text-slate-700">Contact</a>
          </div>
          <span className="text-xs text-slate-400">© 2025 Arivarangam. Built in India.</span>
        </div>
      </footer>
    </div>
  )
}
