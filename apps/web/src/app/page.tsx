import Link from 'next/link'
import { SoftwareAppJsonLd, OrganizationJsonLd } from '@/components/seo/JsonLd'

// The 8 specialist AIs that power Arivarangam AI
const SPECIALISTS = [
  { emoji: '🟠', label: 'Claude',      role: 'Coding',           color: '#EA580C', bg: '#FFF7ED' },
  { emoji: '🟢', label: 'GPT-4o',     role: 'Reasoning',        color: '#16A34A', bg: '#F0FDF4' },
  { emoji: '🔷', label: 'Gemini',     role: 'Analysis',         color: '#2563EB', bg: '#EFF6FF' },
  { emoji: '🔵', label: 'Perplexity', role: 'Research',         color: '#0891B2', bg: '#ECFEFF' },
  { emoji: '🇮🇳', label: 'Sarvam',    role: 'Indian Languages', color: '#7C3AED', bg: '#F5F3FF' },
  { emoji: '🎵', label: 'ElevenLabs', role: 'Voice',            color: '#CA8A04', bg: '#FEFCE8' },
  { emoji: '🎤', label: 'Whisper',    role: 'Voice Input',      color: '#475569', bg: '#F8FAFC' },
  { emoji: '🎨', label: 'GPT Image',  role: 'Images',           color: '#DB2777', bg: '#FDF2F8' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'You describe your goal',
    desc:  'Type what you want to build, research, write, or create. One sentence is enough.',
    icon:  '✏️',
  },
  {
    step: '02',
    title: 'Arivarangam AI consults the specialists',
    desc:  'Internally, it asks each expert AI for their input — Claude codes, Perplexity researches, GPT-4o reasons, Gemini analyses.',
    icon:  '⚡',
  },
  {
    step: '03',
    title: 'You get one complete deliverable',
    desc:  'Arivarangam AI reads everything and builds the final output. Code, reports, content, images — ready to use.',
    icon:  '✦',
  },
]

const TASK_EXAMPLES = [
  { icon: '💻', label: 'Build a React dashboard with auth and charts' },
  { icon: '📊', label: 'Research EV market in India with competitor analysis' },
  { icon: '✍️', label: 'Write a product launch blog post in Tamil' },
  { icon: '🎯', label: 'Create a go-to-market strategy for a SaaS startup' },
  { icon: '🎨', label: 'Generate a logo concept for a fintech brand' },
  { icon: '🎙️', label: 'Create a podcast intro voiceover script' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <SoftwareAppJsonLd />
      <OrganizationJsonLd />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-600">.</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-500">
            <Link href="/pricing"    className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/features"   className="hover:text-slate-900 transition-colors">Features</Link>
            <Link href="/use-cases"  className="hover:text-slate-900 transition-colors">Use cases</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link href="/signup"
              className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm">
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-6 pt-36 pb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Built in Coimbatore · India-first AI platform
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.08] text-slate-900">
          One AI.<br />
          <span className="text-indigo-600">Built from the world's best.</span>
        </h1>

        <p className="mt-6 text-xl text-slate-500 max-w-xl leading-relaxed">
          Arivarangam AI consults Claude, GPT-4o, Gemini, Perplexity and more —
          then builds your complete deliverable. One goal. One answer. Done.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-10">
          <Link
            href="/signup"
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-base shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            Start building free
          </Link>
          <Link
            href="/pricing"
            className="px-8 py-3.5 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-medium text-base transition-colors"
          >
            View pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-400">100 free credits on signup · No card required</p>
      </section>

      {/* ── Specialist AIs ───────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-semibold tracking-widest text-slate-400 uppercase mb-10">
            Powered by 8 world-class specialist AIs
          </p>

          {/* Circular diagram — desktop */}
          <div className="hidden md:flex items-center justify-center gap-0 mb-6">
            {/* Specialists */}
            <div className="flex flex-col gap-3 items-end mr-8">
              {SPECIALISTS.slice(0, 4).map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-700 text-right">{s.label}</div>
                    <div className="text-[10px] text-slate-400 text-right">{s.role}</div>
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg border"
                    style={{ backgroundColor: s.bg, borderColor: `${s.color}30` }}
                  >
                    {s.emoji}
                  </div>
                  <div className="w-8 h-px bg-slate-200" />
                </div>
              ))}
            </div>

            {/* Centre: Arivarangam AI */}
            <div className="flex flex-col items-center z-10">
              <div className="w-28 h-28 rounded-full bg-indigo-600 flex flex-col items-center justify-center shadow-xl">
                <span className="text-3xl">✦</span>
                <span className="text-white text-xs font-bold mt-1">Arivarangam</span>
                <span className="text-indigo-200 text-[9px]">AI</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 font-medium">Builds your output</div>
            </div>

            {/* Specialists right */}
            <div className="flex flex-col gap-3 items-start ml-8">
              {SPECIALISTS.slice(4).map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-8 h-px bg-slate-200" />
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg border"
                    style={{ backgroundColor: s.bg, borderColor: `${s.color}30` }}
                  >
                    {s.emoji}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700">{s.label}</div>
                    <div className="text-[10px] text-slate-400">{s.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: grid */}
          <div className="md:hidden grid grid-cols-4 gap-3 mb-6">
            {SPECIALISTS.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl border"
                  style={{ backgroundColor: s.bg, borderColor: `${s.color}30` }}
                >
                  {s.emoji}
                </div>
                <div className="text-[10px] font-semibold text-slate-600 text-center">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">How it works</h2>
          <p className="text-slate-500 text-center mb-16 max-w-lg mx-auto">
            You give one goal. Arivarangam AI handles everything.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="relative">
                <div className="text-xs font-bold text-indigo-400 tracking-widest mb-3">{step.step}</div>
                <div className="text-3xl mb-4">{step.icon}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Task examples ────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">What can you build?</h2>
          <p className="text-slate-500 text-center mb-12">Anything. Just describe it.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {TASK_EXAMPLES.map((ex) => (
              <div
                key={ex.label}
                className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <span className="text-xl shrink-0">{ex.icon}</span>
                <span className="text-sm text-slate-700 font-medium leading-snug">{ex.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Credits section ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple credit-based pricing</h2>
          <p className="text-slate-500 mb-10 max-w-lg mx-auto">
            Buy credits once. Use them for any task. No subscriptions, no lock-in. Indian pricing.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { inr: '₹500',   credits: '500 credits',  tasks: '~16 tasks' },
              { inr: '₹1,000', credits: '1,100 credits', tasks: '~36 tasks', best: true },
              { inr: '₹2,500', credits: '3,000 credits', tasks: '~100 tasks' },
              { inr: '₹5,000', credits: '6,500 credits', tasks: '~216 tasks' },
            ].map((pack) => (
              <div
                key={pack.inr}
                className={`p-4 rounded-xl border text-center ${
                  pack.best
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {pack.best && (
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1">Best value</div>
                )}
                <div className="text-2xl font-black text-slate-900">{pack.inr}</div>
                <div className={`text-sm font-semibold mt-0.5 ${pack.best ? 'text-indigo-600' : 'text-slate-600'}`}>
                  {pack.credits}
                </div>
                <div className="text-xs text-slate-400 mt-1">{pack.tasks}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Typical task = 30 credits · 1 credit = ₹1 · Credits never expire · UPI accepted
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="bg-indigo-600 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start building with Arivarangam AI
          </h2>
          <p className="text-indigo-200 mb-8">
            100 free credits when you sign up. No card required.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-white text-indigo-700 font-bold rounded-xl text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Create your free account →
          </Link>
          <p className="text-indigo-300 text-xs mt-4">Made in Coimbatore, Tamil Nadu · India-first</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-slate-900 font-bold">Arivarangam<span className="text-indigo-600">.</span></span>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/pricing"  className="hover:text-slate-700">Pricing</Link>
            <Link href="/privacy"  className="hover:text-slate-700">Privacy</Link>
            <Link href="/terms"    className="hover:text-slate-700">Terms</Link>
            <a href="mailto:admin@arivarangam.com" className="hover:text-slate-700">Contact</a>
          </div>
          <span className="text-xs text-slate-400">© 2025 Arivarangam. Built in India.</span>
        </div>
      </footer>
    </main>
  )
}
