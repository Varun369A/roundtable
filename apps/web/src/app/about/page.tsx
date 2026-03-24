import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Arivarangam — Building the AI Operating System for India',
  description: 'Arivarangam AI consults 8 specialist AIs — Claude, GPT-4o, Gemini, Perplexity, Sarvam, ElevenLabs, Whisper, GPT Image — and builds your complete deliverable. Built in Coimbatore for India.',
  alternates: { canonical: 'https://arivarangam.com/about' },
}

const TECH_FEATURES = [
  {
    title: 'Synthesis Engine',
    description: 'Arivarangam AI internally consults 8 world-class specialist AIs — Claude for coding, GPT-4o for reasoning, Gemini 2.5 Pro for analysis, Perplexity for research, Sarvam for Indian languages, ElevenLabs for voice, Whisper for transcription, GPT Image 1 for visuals. Specialists run in parallel. Arivarangam AI reads all their outputs and builds one complete, polished deliverable. You never see the internal consultations — only the finished result.',
    icon: '⚡',
    color: 'from-indigo-500 to-purple-600',
  },
  {
    title: 'Arivarangam Self-Learning AI',
    description: 'Arivarangam builds a private memory of your preferences, industry context, writing style, and past outputs. Every session it gets a little smarter about you — without sharing that memory with anyone else.',
    icon: '🧠',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'AI Firewall',
    description: 'Every prompt passes through Arivarangam\'s firewall before touching any external AI provider. Aadhaar numbers, PAN cards, phone numbers, bank details, and email addresses are automatically redacted. Prompt injection attacks are blocked.',
    icon: '🛡️',
    color: 'from-green-500 to-emerald-600',
  },
]

const WHY_INDIA = [
  {
    stat: '400M+',
    label: 'English-speaking professionals',
    detail: 'India has the world\'s largest pool of English-proficient knowledge workers — the world\'s biggest underserved AI market.',
  },
  {
    stat: '10',
    label: 'Indian languages supported',
    detail: 'Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia — via Sarvam AI.',
  },
  {
    stat: '100%',
    label: 'INR-native pricing',
    detail: 'No dollar-denominated pricing. No forex risk. No conversion fees. Prices set for Indian purchasing power.',
  },
  {
    stat: '₹0',
    label: 'Subscriptions needed',
    detail: 'No monthly fees. Buy credits once, use for any task. The equivalent of 8 separate AI subscriptions costs ₹8,500+/month. Arivarangam AI charges per task.',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-500">.</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Blog</Link>
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Log in</Link>
            <Link href="/signup" className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors text-white">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Made in India, for the world
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-slate-900">
            Building the AI Operating System{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              for India
            </span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto">
            We believe everyone deserves access to the world's best AI tools — not one at a time, but all together.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6 border-y border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-slate-900">Our Mission</h2>
              <p className="text-slate-700 leading-relaxed text-lg">
                We believe everyone deserves access to the world's best AI tools — not one at a time, but all together.
              </p>
              <p className="text-slate-500 leading-relaxed mt-4">
                AI has the potential to be the great equaliser — giving a solo founder the research power of a corporate team, or a small-town lawyer access to the analytical capability of a major firm. But today, that potential is locked behind fragmented tools, dollar-denominated pricing, and systems that weren't designed with India in mind.
              </p>
              <p className="text-slate-500 leading-relaxed mt-4">
                Arivarangam exists to change that.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { icon: '🎯', text: 'One platform. Every AI model. One task.' },
                { icon: '🇮🇳', text: 'Built for Indian knowledge workers first.' },
                { icon: '💰', text: 'INR pricing. No dollar premium.' },
                { icon: '🗣️', text: 'Works in Hindi, Tamil, Telugu, and 7 more Indian languages.' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-slate-700 font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-slate-900">The Problem We Solve</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Using the world's best AI tools today is fragmented, expensive, and exhausting.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                title: 'Fragmentation',
                desc: 'You need ChatGPT for writing, Claude for coding, Perplexity for research, GPT Image for visuals, ElevenLabs for audio. Each is a separate tab, a separate subscription, a separate context switch.',
                pain: true,
              },
              {
                title: 'Cost',
                desc: 'ChatGPT + Claude + Gemini + Perplexity + ElevenLabs adds up to ₹8,500+/month in separate subscriptions. Arivarangam AI gives you all 8 specialists in one, credit-based, no monthly fee.',
                pain: true,
              },
              {
                title: 'Context loss',
                desc: 'You repeat yourself across tools. None of them know each other\'s outputs. There\'s no synthesis, no coordination, no "team" — just a collection of expensive chatbots.',
                pain: true,
              },
            ].map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-red-200 bg-red-50">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4 text-lg">✕</div>
                <h3 className="font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Solution */}
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-8 text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Arivarangam's Solution</h3>
            <p className="text-slate-700 leading-relaxed max-w-2xl mx-auto text-lg">
              You describe a goal once. Arivarangam AI internally consults 8 specialist AIs — Claude codes, Perplexity researches, GPT-4o reasons, Gemini analyses, Sarvam handles Indian languages, ElevenLabs generates voice, and GPT Image 1 creates visuals. Then Arivarangam AI reads everything and builds one complete, polished deliverable.
            </p>
            <p className="text-slate-500 mt-4 leading-relaxed max-w-xl mx-auto">
              One prompt. 8 AIs working together. One complete output.
            </p>
          </div>
        </div>
      </section>

      {/* Why India */}
      <section className="py-20 px-6 border-y border-slate-200 bg-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-slate-900">Why India First?</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              India is the world's largest underserved AI market. Western AI tools were built for Western defaults.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {WHY_INDIA.map(({ stat, label, detail }) => (
              <div key={label} className="p-6 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
                <p className="text-3xl font-bold text-indigo-600 mb-1">{stat}</p>
                <p className="text-sm font-semibold text-slate-900 mb-3">{label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">What "India-first" actually means at Arivarangam:</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                'All prices in INR, set at Indian purchasing power parity — not a dollar conversion',
                'Sarvam AI integration for accurate, low-latency Indian language voice input and translation',
                'Legal and medical vertical AI packs tuned for Indian law (IPC, companies act) and the Indian healthcare context',
                'UPI, net banking, and EMI payment options via Razorpay — no international card required',
                'Data residency options for enterprises who cannot route data to US servers',
                'India-specific AI model routing: Sarvam for Indic languages, not Google Translate',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="text-indigo-600 mt-0.5 shrink-0">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-slate-900">The Technology</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Arivarangam is not a wrapper. We've built original AI infrastructure.
            </p>
          </div>

          <div className="space-y-6">
            {TECH_FEATURES.map(({ title, description, icon, color }) => (
              <div key={title} className="flex gap-6 p-6 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-sm">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-2xl flex-shrink-0`}>
                  {icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-500 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-6 border-y border-slate-200 bg-slate-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-slate-900">Team</h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-8">
            A small team with a big mission.
          </p>
          <p className="text-slate-700 leading-relaxed max-w-2xl mx-auto mb-8">
            Arivarangam is built by a small, focused team of engineers, designers, and AI researchers who believe India deserves a world-class AI platform that respects its scale, its languages, and its economics. We move fast, we ship constantly, and we believe the best way to build AI tools is to be the most intensive users of AI tools ourselves.
          </p>

          <div className="p-8 rounded-2xl border border-indigo-500/30 bg-white shadow-sm max-w-xl mx-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-3">We're Hiring</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">
              We're looking for engineers, AI researchers, and product designers who want to build the AI platform for a billion people. Remote-first. Equity-bearing. Interesting problems every day.
            </p>
            <a
              href="mailto:support@arivarangam.com"
              className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors text-white"
            >
              support@arivarangam.com
            </a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-slate-900">Get in Touch</h2>
          <p className="text-slate-500 mb-8">We'd love to hear from you — whether you're a user, a potential partner, or just curious about what we're building.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'General', email: 'support@arivarangam.com' },
              { label: 'Enterprise', email: 'admin@arivarangam.com' },
              { label: 'Press', email: 'admin@arivarangam.com' },
            ].map(({ label, email }) => (
              <a
                key={email}
                href={`mailto:${email}`}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-sm"
              >
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                <p className="text-sm font-medium text-indigo-600">{email}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-500">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
            <Link href="/features" className="hover:text-slate-700 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-slate-700 transition-colors">Pricing</Link>
            <Link href="/blog" className="hover:text-slate-700 transition-colors">Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
