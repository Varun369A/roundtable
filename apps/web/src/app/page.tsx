import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            Sabha<span className="text-brand-500">.</span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-medium transition-colors"
            >
              Get early access
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
          Building in stealth. Coming soon.
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]">
          One platform.{' '}
          <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            Every AI.
          </span>
        </h1>

        <p className="mt-6 text-xl text-zinc-400 max-w-2xl leading-relaxed">
          Type one goal. Watch Claude, GPT, Perplexity, Midjourney work together live.
          Get the complete deliverable in minutes.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/signup"
            className="px-8 py-4 bg-brand-600 hover:bg-brand-500 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-brand-500/20"
          >
            Join the waitlist
          </Link>
          <p className="text-zinc-500 text-sm">No credit card. Free to join.</p>
        </div>

        {/* Roundtable Preview */}
        <div className="mt-20 w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-zinc-500 font-mono">
              Roundtable — Create a marketing campaign for my chai brand
            </span>
          </div>
          <div className="p-6 space-y-4 text-left font-mono text-sm">
            {[
              { model: 'Perplexity', color: 'text-blue-400', msg: 'Searching market data for chai brands targeting college demographics...' },
              { model: 'Perplexity', color: 'text-blue-400', msg: 'Found: 18-24 yr olds prefer authentic, low-sugar chai. Peak consumption: 8-11am and post-college hours.' },
              { model: 'Claude', color: 'text-orange-400', msg: 'Strategy ready. Positioning: "chai that actually gets you". 3 campaign pillars: authenticity, energy, community.' },
              { model: 'Midjourney', color: 'text-pink-400', msg: 'Generating 4 visual concepts based on campaign brief...' },
              { model: 'ElevenLabs', color: 'text-green-400', msg: 'Voiceover for 30s ad ready. ▶' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 animate-fade-in">
                <span className={`${item.color} font-semibold shrink-0`}>[{item.model}]</span>
                <span className="text-zinc-300">{item.msg}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
