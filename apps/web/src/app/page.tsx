import Link from 'next/link'
import { SoftwareAppJsonLd, OrganizationJsonLd } from '@/components/seo/JsonLd'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <SoftwareAppJsonLd />
      <OrganizationJsonLd />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-brand-600">.</span>
          </span>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/waitlist"
              className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              Get early access
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-slow" />
          Early access — limited spots available
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1] text-slate-900">
          One platform.{' '}
          <span className="bg-gradient-to-r from-brand-600 to-indigo-400 bg-clip-text text-transparent">
            Every AI.
          </span>
        </h1>

        <p className="mt-6 text-xl text-slate-500 max-w-2xl leading-relaxed">
          Type one goal. Watch Claude, GPT, Perplexity, Midjourney work together live.
          Get the complete deliverable in minutes.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/waitlist"
            className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-md shadow-brand-600/20"
          >
            Request early access
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl font-semibold text-lg transition-all bg-white hover:bg-slate-50 shadow-sm"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-3 text-slate-400 text-sm">No credit card required</p>

        {/* Demo preview */}
        <div className="mt-20 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl shadow-slate-200/80">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-slate-400 font-mono">
              Arivarangam — Create a marketing campaign for my chai brand
            </span>
          </div>
          <div className="p-6 space-y-4 text-left font-mono text-sm">
            {[
              { model: 'Perplexity', color: 'text-blue-600', bg: 'bg-blue-50', msg: 'Searching market data for chai brands targeting college demographics...' },
              { model: 'Perplexity', color: 'text-blue-600', bg: 'bg-blue-50', msg: 'Found: 18-24 yr olds prefer authentic, low-sugar chai. Peak consumption: 8-11am.' },
              { model: 'Claude', color: 'text-orange-600', bg: 'bg-orange-50', msg: 'Strategy ready. Positioning: "chai that actually gets you". 3 campaign pillars: authenticity, energy, community.' },
              { model: 'Midjourney', color: 'text-violet-600', bg: 'bg-violet-50', msg: 'Generating 4 visual concepts based on campaign brief...' },
              { model: 'ElevenLabs', color: 'text-emerald-600', bg: 'bg-emerald-50', msg: 'Voiceover for 30s ad ready. ▶' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 animate-fade-in">
                <span className={`${item.color} ${item.bg} font-semibold shrink-0 px-2 py-0.5 rounded text-xs`}>{item.model}</span>
                <span className="text-slate-600 text-sm leading-relaxed">{item.msg}</span>
              </div>
            ))}
            <div className="flex gap-1.5 pt-2">
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-slate-400 text-sm">
          {['Claude 3.5', 'GPT-4o', 'Gemini 1.5', 'Perplexity', 'Midjourney', 'ElevenLabs'].map((model) => (
            <span key={model} className="font-medium">{model}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-100 py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Everything you need to orchestrate AI at scale
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '⚡',
                title: 'Multi-model workflows',
                desc: 'Chain Claude for reasoning, Perplexity for research, Midjourney for visuals — all in one task.',
              },
              {
                icon: '🔒',
                title: 'Enterprise security',
                desc: 'AES-256 encryption, audit logs, SSO-ready. Your data never trains third-party models.',
              },
              {
                icon: '📊',
                title: 'Full cost visibility',
                desc: 'See exactly what each AI call costs. Set budgets, get alerts, optimize spend.',
              },
              {
                icon: '🧩',
                title: 'Bring your own keys',
                desc: 'Use your own API keys for every provider. Zero markup on AI costs.',
              },
              {
                icon: '🔄',
                title: 'Automated workflows',
                desc: 'Schedule tasks, trigger on events, build pipelines without code.',
              },
              {
                icon: '🌐',
                title: 'Team workspaces',
                desc: 'Collaborate with your team. Share prompts, templates, and outputs.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-brand-600 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to orchestrate AI?</h2>
        <p className="text-brand-200 mb-8 max-w-xl mx-auto">
          Join the waitlist and get early access when a spot opens. Free to start.
        </p>
        <Link
          href="/waitlist"
          className="inline-block px-8 py-4 bg-white text-brand-700 hover:bg-brand-50 rounded-xl font-semibold text-lg transition-colors shadow-sm"
        >
          Request early access
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-900 font-bold tracking-tight">
            Arivarangam<span className="text-brand-600">.</span>
          </span>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <Link href="/pricing" className="hover:text-slate-600 transition-colors">Pricing</Link>
            <a href="mailto:support@arivarangam.com" className="hover:text-slate-600 transition-colors">Support</a>
          </div>
          <p className="text-slate-400 text-sm">© 2025 Arivarangam</p>
        </div>
      </footer>
    </main>
  )
}
