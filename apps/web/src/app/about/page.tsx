import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Arivarangam — Building the AI Operating System for India',
  description: 'Arivarangam coordinates Claude, GPT-4, Gemini, Perplexity and more so Indian knowledge workers get the best of every AI — without the per-app subscriptions.',
  alternates: { canonical: 'https://arivarangam.com/about' },
}

const TECH_FEATURES = [
  {
    title: 'Discussion Engine',
    description: 'Arivarangam\'s proprietary 3-round peer review system. Each AI model produces an initial response, critiques the others\' work, and a synthesis AI produces a final, battle-tested output. This isn\'t just "ask multiple AIs" — it\'s structured intellectual adversarialism.',
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
    label: 'Dollar premium',
    detail: 'The equivalent of ChatGPT + Claude + Gemini costs ₹8,500/month separately. Arivarangam Pro is ₹1,299.',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Arivarangam<span className="text-brand-500">.</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">Pricing</Link>
            <Link href="/blog" className="text-sm text-zinc-400 hover:text-white transition-colors">Blog</Link>
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Log in</Link>
            <Link href="/signup" className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-medium transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Made in India, for the world
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Building the AI Operating System{' '}
            <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
              for India
            </span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            We believe everyone deserves access to the world's best AI tools — not one at a time, but all together.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6 border-y border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
              <p className="text-zinc-300 leading-relaxed text-lg">
                We believe everyone deserves access to the world's best AI tools — not one at a time, but all together.
              </p>
              <p className="text-zinc-400 leading-relaxed mt-4">
                AI has the potential to be the great equaliser — giving a solo founder the research power of a corporate team, or a small-town lawyer access to the analytical capability of a major firm. But today, that potential is locked behind fragmented tools, dollar-denominated pricing, and systems that weren't designed with India in mind.
              </p>
              <p className="text-zinc-400 leading-relaxed mt-4">
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
                <div key={text} className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-zinc-300 font-medium">{text}</span>
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
            <h2 className="text-3xl font-bold mb-4">The Problem We Solve</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Using the world's best AI tools today is fragmented, expensive, and exhausting.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                title: 'Fragmentation',
                desc: 'You need ChatGPT for writing, Claude for analysis, Perplexity for research, Midjourney for images, ElevenLabs for audio. Each is a separate tab, a separate subscription, a separate context switch.',
                pain: true,
              },
              {
                title: 'Cost',
                desc: 'ChatGPT Pro + Claude Pro + Gemini Advanced + Perplexity Pro adds up to over ₹8,500 per month — before image generation, audio, or video tools. That\'s unaffordable for most Indian professionals.',
                pain: true,
              },
              {
                title: 'Context loss',
                desc: 'You repeat yourself across tools. None of them know each other\'s outputs. There\'s no synthesis, no coordination, no "team" — just a collection of expensive chatbots.',
                pain: true,
              },
            ].map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 mb-4 text-lg">✕</div>
                <h3 className="font-bold text-white mb-3">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Solution */}
          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Arivarangam's Solution</h3>
            <p className="text-zinc-300 leading-relaxed max-w-2xl mx-auto text-lg">
              Arivarangam acts as the coordinator. You describe a goal once. Arivarangam's Discussion Engine assigns the right AI to each sub-task — Perplexity researches, Claude strategises, GPT-4 writes, Midjourney visualises — and synthesises a complete, coherent deliverable.
            </p>
            <p className="text-zinc-400 mt-4 leading-relaxed max-w-xl mx-auto">
              One subscription. One prompt. Every AI working together.
            </p>
          </div>
        </div>
      </section>

      {/* Why India */}
      <section className="py-20 px-6 border-y border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why India First?</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              India is the world's largest underserved AI market. Western AI tools were built for Western defaults.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {WHY_INDIA.map(({ stat, label, detail }) => (
              <div key={label} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900 text-center">
                <p className="text-3xl font-bold text-brand-400 mb-1">{stat}</p>
                <p className="text-sm font-semibold text-white mb-3">{label}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900">
            <h3 className="font-bold text-white mb-4">What "India-first" actually means at Arivarangam:</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                'All prices in INR, set at Indian purchasing power parity — not a dollar conversion',
                'Sarvam AI integration for accurate, low-latency Indian language voice input and translation',
                'Legal and medical vertical AI packs tuned for Indian law (IPC, companies act) and the Indian healthcare context',
                'UPI, net banking, and EMI payment options via Razorpay — no international card required',
                'Data residency options for enterprises who cannot route data to US servers',
                'India-specific AI model routing: Sarvam for Indic languages, not Google Translate',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                  <span className="text-brand-400 mt-0.5 shrink-0">✓</span>
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
            <h2 className="text-3xl font-bold mb-4">The Technology</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Arivarangam is not a wrapper. We've built original AI infrastructure.
            </p>
          </div>

          <div className="space-y-6">
            {TECH_FEATURES.map(({ title, description, icon, color }) => (
              <div key={title} className="flex gap-6 p-6 rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-2xl flex-shrink-0`}>
                  {icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-6 border-y border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Team</h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-8">
            A small team with a big mission.
          </p>
          <p className="text-zinc-300 leading-relaxed max-w-2xl mx-auto mb-8">
            Arivarangam is built by a small, focused team of engineers, designers, and AI researchers who believe India deserves a world-class AI platform that respects its scale, its languages, and its economics. We move fast, we ship constantly, and we believe the best way to build AI tools is to be the most intensive users of AI tools ourselves.
          </p>

          <div className="p-8 rounded-2xl border border-brand-500/30 bg-brand-500/5 max-w-xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-3">We're Hiring</h3>
            <p className="text-zinc-400 mb-6 leading-relaxed">
              We're looking for engineers, AI researchers, and product designers who want to build the AI platform for a billion people. Remote-first. Equity-bearing. Interesting problems every day.
            </p>
            <a
              href="mailto:support@arivarangam.com"
              className="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-500 rounded-xl font-semibold transition-colors"
            >
              support@arivarangam.com
            </a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Get in Touch</h2>
          <p className="text-zinc-400 mb-8">We'd love to hear from you — whether you're a user, a potential partner, or just curious about what we're building.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'General', email: 'support@arivarangam.com' },
              { label: 'Enterprise', email: 'admin@arivarangam.com' },
              { label: 'Press', email: 'admin@arivarangam.com' },
            ].map(({ label, email }) => (
              <a
                key={email}
                href={`mailto:${email}`}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors"
              >
                <p className="text-xs text-zinc-500 mb-1">{label}</p>
                <p className="text-sm font-medium text-brand-400">{email}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Arivarangam<span className="text-brand-500">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
            <Link href="/features" className="hover:text-zinc-300 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-300 transition-colors">Pricing</Link>
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
