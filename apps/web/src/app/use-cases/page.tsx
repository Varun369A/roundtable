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
    color: 'from-pink-500/10 to-rose-500/10 border-pink-200',
    dotColor: 'bg-pink-500',
  },
  {
    category: 'coding',
    icon: '💻',
    title: 'Your AI Engineering Team',
    description: 'Architecture review, code generation, documentation, and security audit — in one task. Claude codes, GPT-4 reviews, Arivarangam synthesises.',
    tags: ['Code Gen', 'Reviews', 'GitHub Push', 'Docs'],
    color: 'from-blue-500/10 to-indigo-500/10 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  {
    category: 'research',
    icon: '🔬',
    title: 'AI Research Assistant',
    description: 'Literature reviews, competitive analysis, policy research — Arivarangam runs multiple AI models in parallel and synthesises a comprehensive report.',
    tags: ['Literature', 'Competitive', 'Policy', 'Data'],
    color: 'from-violet-500/10 to-purple-500/10 border-violet-200',
    dotColor: 'bg-violet-500',
  },
  {
    category: 'legal',
    icon: '⚖️',
    title: 'AI for Indian Legal Professionals',
    description: 'Contract drafting, Indian case law research, legal notices, and compliance documents — trained on IPC, Companies Act, and Indian court procedure.',
    tags: ['Contracts', 'Case Law', 'Notices', 'Compliance'],
    color: 'from-amber-500/10 to-yellow-500/10 border-amber-200',
    dotColor: 'bg-amber-500',
  },
  {
    category: 'healthcare',
    icon: '🏥',
    title: 'AI for Healthcare Professionals',
    description: 'Discharge summaries, ICD-10 coding, NABH documentation, and patient communication — tuned for Indian healthcare standards.',
    tags: ['Discharge', 'ICD-10', 'NABH', 'Patient Comms'],
    color: 'from-emerald-500/10 to-green-500/10 border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  {
    category: 'finance',
    icon: '📊',
    title: 'AI for Finance and Accounting',
    description: 'GST analysis, audit checklists, SEBI compliance, investment research — Arivarangam brings multi-AI intelligence to Indian financial workflows.',
    tags: ['GST', 'Audits', 'SEBI', 'Investments'],
    color: 'from-cyan-500/10 to-teal-500/10 border-cyan-200',
    dotColor: 'bg-cyan-500',
  },
]

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-600">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/features" className="hover:text-slate-900 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-slate-900 transition-colors">About</Link>
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-200 rounded-full text-indigo-600 text-xs font-medium mb-6">
            For every profession
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5 text-slate-900">
            How India uses Arivarangam
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed">
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
              <h2 className="text-base font-bold text-slate-900 mb-2 leading-snug">{title}</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{description}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs text-slate-500 bg-white/70 px-2 py-0.5 rounded-full">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-sm text-indigo-600 font-medium">
                See {category} use cases →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="py-16 px-6 border-y border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-10 text-slate-900">Arivarangam coordinates AI the way professionals actually work</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { stat: '15+', label: 'AI models coordinated' },
              { stat: '3-round', label: 'peer review process' },
              { stat: '10', label: 'Indian languages' },
              { stat: '₹1,299', label: 'for all models, all month' },
            ].map(({ stat, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-bold text-indigo-600 mb-1">{stat}</p>
                <p className="text-sm text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-slate-900">Not sure where to start?</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Start with the Free plan and explore Arivarangam with no commitment. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors">
              Start for free
            </Link>
            <Link href="/features" className="px-8 py-3 border border-slate-300 hover:border-slate-400 rounded-xl font-semibold transition-colors text-slate-700">
              See all features
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-slate-200 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} Arivarangam. Made for India.</p>
      </footer>
    </div>
  )
}
