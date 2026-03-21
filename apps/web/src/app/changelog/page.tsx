'use client'

import { useState } from 'react'
import Link from 'next/link'

const RELEASES = [
  {
    version: 'v1.4.0',
    date: 'March 2025',
    title: 'Credit Economy, Expert Marketplace & Vertical AI Packs',
    tag: 'Major Release',
    tagColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    changes: [
      { tag: 'Feature',     text: 'Credit Economy: transparent usage-based credits with INR top-up, referral bonuses (500 credits per referred user), and per-task cost estimation before submission.' },
      { tag: 'Feature',     text: 'Expert Marketplace: background-verified legal, medical, finance, and tech experts review AI outputs within defined SLAs (4h, 24h, 48h). Expert annotations appear inline.' },
      { tag: 'Feature',     text: 'Vertical AI Packs: pre-configured Discussion Engine setups for Legal, Medical, Finance, Engineering, and HR. India-specific regulatory context included in all packs.' },
      { tag: 'Feature',     text: 'Credit warning before task submission: warns when balance drops below 50 credits so you can top up before starting a task.' },
      { tag: 'Improvement', text: 'Discussion Engine synthesis prompts now tuned per vertical when a pack is active.' },
      { tag: 'Improvement', text: 'Expert identity verification now uses DigiLocker for Indian professionals.' },
      { tag: 'Fix',         text: 'Credit balance now updates in real time after task completion without requiring a page refresh.' },
      { tag: 'Security',    text: 'Expert profile data is stored separately from user data with independent access controls.' },
    ],
  },
  {
    version: 'v1.3.0',
    date: 'March 2025',
    title: 'Voice Input (10 Indian Languages), Agent Execution & Quality Verification',
    tag: 'Major Release',
    tagColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    changes: [
      { tag: 'Feature',     text: 'Voice Input via Sarvam AI: speak your task in Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, or Odia. English via OpenAI Whisper.' },
      { tag: 'Feature',     text: 'Agent Execution: AI can push code to GitHub, send emails via Gmail/Outlook, update Notion pages, and POST to webhooks. Every action requires explicit user approval.' },
      { tag: 'Feature',     text: 'Output Quality Verification: every Discussion Engine output is scored for accuracy, completeness, and internal consistency. Score shown alongside the output.' },
      { tag: 'Feature',     text: 'Agent audit log: full history of all agent actions taken on your behalf with the ability to revert GitHub actions.' },
      { tag: 'Improvement', text: 'Transcription review screen: transcript is shown before task submission so you can edit before sending.' },
      { tag: 'Improvement', text: 'Quality score now includes claim-level sourcing indicators — flagged claims show which AI provided supporting evidence.' },
      { tag: 'Fix',         text: 'Sarvam AI voice detection no longer switches to English mid-sentence on Hinglish inputs.' },
      { tag: 'Security',    text: 'Audio data deleted from processing servers within 30 seconds of transcription completion. No audio is ever persisted.' },
    ],
  },
  {
    version: 'v1.2.0',
    date: 'March 2025',
    title: 'Multiplayer Roundtable & Workflow Builder',
    tag: 'Major Release',
    tagColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    changes: [
      { tag: 'Feature',     text: 'Multiplayer Roundtable: share a live Sabha session with workspace members. Multiple users can observe AI outputs streaming in real time and send steering messages.' },
      { tag: 'Feature',     text: 'Workflow Builder: chain multiple Sabha tasks into pipelines with variable interpolation, conditional branching, webhook triggers, and scheduled execution.' },
      { tag: 'Feature',     text: 'Workspace role permissions: distinguish observers (can watch) from participants (can steer) in multiplayer sessions.' },
      { tag: 'Feature',     text: '12 pre-built workflow templates for common use cases: content pipeline, competitive research, weekly report, and more.' },
      { tag: 'Improvement', text: 'Multiplayer sessions now show a live participant count and a side chat panel alongside the AI output stream.' },
      { tag: 'Improvement', text: 'Workflow Builder now supports conditional branching on the content of AI outputs using string-match conditions.' },
      { tag: 'Fix',         text: 'Fixed race condition where two concurrent multiplayer users could submit conflicting steering messages and produce undefined Discussion Engine behaviour.' },
    ],
  },
  {
    version: 'v1.1.0',
    date: 'March 2025',
    title: 'Clarification Round, User Memory, Mid-Generation Steering & Scheduled Tasks',
    tag: 'Feature Release',
    tagColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    changes: [
      { tag: 'Feature',     text: 'Clarification Round: Sabha\'s AI asks 1–3 targeted clarifying questions before starting a task to improve output quality. Always skippable.' },
      { tag: 'Feature',     text: 'User Memory: Sabha builds a persistent, private memory profile with your industry, role, writing style, and preferences. Applied automatically to every task.' },
      { tag: 'Feature',     text: 'Mid-Generation Steering: send a message to Sabha while it\'s processing to change direction, add context, or correct errors — without restarting the task.' },
      { tag: 'Feature',     text: 'Scheduled Tasks: run any Sabha task on a cron schedule (daily, weekly, or custom) with results delivered via email or saved to task history.' },
      { tag: 'Improvement', text: 'Memory editor in Settings → Account: add, edit, and delete individual memory entries with instant effect.' },
      { tag: 'Improvement', text: 'Steering messages are clearly labelled in session transcripts.' },
      { tag: 'Fix',         text: 'Scheduled task cron expressions with specific-minute components (e.g. "every Monday at 9:00 AM") now execute reliably.' },
    ],
  },
  {
    version: 'v1.0.0',
    date: 'January 2025',
    title: 'Initial Launch: Discussion Engine, 15+ AI Models, BYOAI, AI Firewall',
    tag: 'Launch',
    tagColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    changes: [
      { tag: 'Feature',  text: 'Discussion Engine: 3-round adversarial peer review. Initial responses → cross-AI critique → synthesis. Produces better results than any single AI.' },
      { tag: 'Feature',  text: '15+ AI models: Claude, GPT-4, Gemini, Perplexity, DALL-E 3, Midjourney, Stable Diffusion, ElevenLabs, Sarvam AI, and more.' },
      { tag: 'Feature',  text: 'BYOAI (Bring Your Own AI): connect your own Anthropic, OpenAI, or Google API keys. AES-256-GCM encryption at rest.' },
      { tag: 'Feature',  text: 'AI Firewall: automatic PII redaction (Aadhaar, PAN, phone, email, addresses) and prompt injection protection on every request.' },
      { tag: 'Feature',  text: 'Sabha self-learning AI: the platform learns your preferences over time and personalises every session.' },
      { tag: 'Feature',  text: 'Workspaces: personal and shared workspaces, task privacy controls (private vs. workspace-visible).' },
      { tag: 'Feature',  text: 'INR-native billing via Razorpay: Free, Starter (₹499), Pro (₹1,299), Power (₹2,499). UPI, cards, net banking, EMI all supported.' },
      { tag: 'Security', text: 'TLS 1.3 in transit, AES-256-GCM at rest, bcrypt password hashing, RBAC for all internal systems.' },
    ],
  },
]

const TAG_STYLES: Record<string, string> = {
  Feature:     'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20',
  Improvement: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
  Fix:         'bg-amber-500/15 text-amber-300 border border-amber-500/20',
  Security:    'bg-green-500/15 text-green-300 border border-green-500/20',
}

export default function ChangelogPage() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubscribing(true)
    try {
      await fetch('/api/v1/beta/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'changelog' }),
      })
    } catch {
      // non-critical — mark as subscribed regardless
    } finally {
      setSubscribed(true)
      setSubscribing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Sabha<span className="text-indigo-400">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/blog" className="hover:text-zinc-100 transition-colors">Blog</Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-12 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-medium mb-6">
            Release notes
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Changelog</h1>
          <p className="text-zinc-400 mb-8">
            Every Sabha release, documented. New features, improvements, and fixes.
          </p>

          {/* Subscribe CTA */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900 text-left max-w-md mx-auto">
            <p className="text-sm font-semibold text-white mb-1">Get release updates by email</p>
            <p className="text-xs text-zinc-500 mb-4">An email whenever Sabha ships something new.</p>
            {subscribed ? (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <span>✓</span>
                <span>You&apos;re subscribed. Watch your inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-zinc-600 transition-colors"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  {subscribing ? 'Subscribing…' : 'Subscribe'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-zinc-800" aria-hidden="true" />

            <div className="space-y-12 pl-12">
              {RELEASES.map((release, i) => (
                <article key={release.version} className="relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[2.45rem] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                      i === 0 ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600 bg-zinc-900'
                    }`}
                    aria-hidden="true"
                  />

                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                      i === 0
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      {release.version}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${release.tagColor}`}>
                      {release.tag}
                    </span>
                    <span className="text-sm text-zinc-500">{release.date}</span>
                    {i === 0 && (
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full border border-indigo-500/30 font-medium">
                        Latest
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-zinc-100 mb-4">{release.title}</h2>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
                      What&apos;s new
                    </p>
                    <ul className="space-y-3">
                      {release.changes.map((change, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <span className={`shrink-0 mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${TAG_STYLES[change.tag] || 'bg-zinc-700 text-zinc-300'}`}>
                            {change.tag}
                          </span>
                          <span className="text-sm text-zinc-300 leading-relaxed">{change.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 px-6 text-center">
        <p className="text-zinc-500 text-sm mb-4">Want to try all these features?</p>
        <Link href="/signup" className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors">
          Get started free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
        <div className="flex flex-wrap items-center justify-center gap-6 mb-3">
          <Link href="/features" className="hover:text-zinc-300 transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-zinc-300 transition-colors">Pricing</Link>
          <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
          <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
        </div>
        <p>© {new Date().getFullYear()} Sabha AI. Made for India.</p>
      </footer>
    </div>
  )
}
