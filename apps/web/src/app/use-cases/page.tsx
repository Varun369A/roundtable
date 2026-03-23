import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Use Cases — Arivarangam for Every Industry',
  description: 'How Indian professionals use Arivarangam: marketing, coding, research, legal, medical, finance — coordinated AI for every domain.',
  alternates: { canonical: 'https://arivarangam.com/use-cases' },
}

const USE_CASES = [
  {
    category: 'marketing',
    icon: '📣',
    title: 'AI Marketing Team in Your Browser',
    description: 'Campaign strategy, copywriting, competitive research, and social content — all coordinated. Perplexity researches, Claude strategises, GPT-4 writes.',
    tags: ['Campaigns', 'Copywriting', 'SEO', 'Social'],
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
    dotColor: 'bg-pink-500',
  },
  {
    category: 'coding',
    icon: '💻',
    title: 'Your AI Engineering Team',
    description: 'Architecture review, code generation, documentation, and security audit — in one task. Claude codes, GPT-4 reviews, Arivarangam synthesises.',
    tags: ['Code Gen', 'Reviews', 'GitHub Push', 'Docs'],
    color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  {
    category: 'research',
    icon: '🔬',
    title: 'AI Research Assistant',
    description: 'Literature reviews, competitive analysis, policy research — Arivarangam runs multiple AI models in parallel and synthesises a comprehensive report.',
    tags: ['Literature', 'Competitive', 'Policy', 'Data'],
    color: 'from-violet-500/20 to-purple-500/20 border-violet-500/30',
    dotColor: 'bg-violet-500',
  },
  {
    category: 'legal',
    icon: '⚖️',
    title: 'AI for Indian Legal Professionals',
    description: 'Contract drafting, Indian case law research, legal notices, and compliance documents — trained on IPC, Companies Act, and Indian court procedure.',
    tags: ['Contracts', 'Case Law', 'Notices', 'Compliance'],
    color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
    dotColor: 'bg-amber-500',
  },
  {
    category: 'healthcare',
    icon: '🏥',
    title: 'AI for Healthcare Professionals',
    description: 'Discharge summaries, ICD-10 coding, NABH documentation, and patient communication — tuned for Indian healthcare standards.',
    tags: ['Discharge', 'ICD-10', 'NABH', 'Patient Comms'],
    color: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
  },
  {
    category: 'finance',
    icon: '📊',
    title: 'AI for Finance and Accounting',
    description: 'GST analysis, audit checklists, SEBI compliance, investment research — Arivarangam brings multi-AI intelligence to Indian financial workflows.',
    tags: ['GST', 'Audits', 'SEBI', 'Investments'],
    color: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30',
    dotColor: 'bg-cyan-500',
  },
]

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Arivarangam<span className="text-indigo-400">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-zinc-100 transition-colors">About</Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-16 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-medium mb-6">
            For every profession
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
            How India uses Arivarangam
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            From a CA in Ahmedabad doing GST analysis to a startup founder in Bangalore writing a pitch deck — Arivarangam coordinates the world's best AI for every professional task.
          </p>
        </div>
      </section>

      {/* Use case cards */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {USE_CASES.map(({ category, icon, title, description, tags, color, dotColor }) => (
            <Link
              key={category}
              href={`/use-cases/${category}`}
              className={`block rounded-2xl border bg-gradient-to-br p-6 hover:scale-[1.02] transition-all ${color}`}
            >
              <div className="text-3xl mb-4">{icon}</div>
              <h2 className="text-base font-bold text-zinc-100 mb-2 leading-snug">{title}</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">{description}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-900/50 px-2 py-0.5 rounded-full">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-sm text-indigo-400 font-medium">
                See {category} use cases →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="py-16 px-6 border-y border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-10">Arivarangam coordinates AI the way professionals actually work</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { stat: '15+', label: 'AI models coordinated' },
              { stat: '3-round', label: 'peer review process' },
              { stat: '10', label: 'Indian languages' },
              { stat: '₹1,299', label: 'for all models, all month' },
            ].map(({ stat, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-bold text-indigo-400 mb-1">{stat}</p>
                <p className="text-sm text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Not sure where to start?</h2>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            Start with the Free plan and explore Arivarangam with no commitment. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors">
              Start for free
            </Link>
            <Link href="/features" className="px-8 py-3 border border-zinc-700 hover:border-zinc-500 rounded-xl font-semibold transition-colors text-zinc-300">
              See all features
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} Arivarangam. Made for India.</p>
      </footer>
    </div>
  )
}
