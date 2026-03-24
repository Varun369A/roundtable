import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Features — Arivarangam Platform',
  description: 'Every Arivarangam AI feature explained: 8 specialist AIs, synthesis engine, voice input in 10 Indian languages, mid-generation steering, agent execution, AI Firewall, and more.',
  alternates: { canonical: 'https://arivarangam.com/features' },
}

const FEATURES = [
  {
    id: 'discussion-engine',
    icon: '✦',
    title: 'Arivarangam AI Synthesis',
    tagline: '8 specialists consult. One AI builds your deliverable.',
    description:
      'Arivarangam AI is not a chatbot. It\'s a builder. When you give it a goal, it internally consults 8 world-class specialist AIs — Claude for coding, GPT-4o for reasoning, Gemini 2.5 Pro for analysis, Perplexity for research, Sarvam for Indian languages, ElevenLabs for voice, and GPT Image 1 for visuals. Then Arivarangam AI reads everything and builds one complete, polished deliverable. You see the final output — not the internal consultations.',
    highlights: [
      'Auto-routes each task to the right specialist AI',
      'Specialists consult in parallel — faster results',
      'Arivarangam AI synthesises all outputs into one deliverable',
      'Final output is complete and production-ready',
    ],
  },
  {
    id: 'voice-input',
    icon: '🎙️',
    title: 'Voice Input',
    tagline: '10 Indian languages + English. Just speak your task.',
    description:
      'Record your task instead of typing. Arivarangam supports 10 Indian languages via Sarvam AI — India\'s leading speech AI — and English via OpenAI Whisper. Speak naturally in Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, or Odia. The transcription is shown before submission so you can review and edit.',
    highlights: [
      'Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia',
      'English transcription via Whisper',
      'Accurate with accents, technical terms, and Hinglish',
      'Audio is never stored — deleted immediately after transcription',
    ],
  },
  {
    id: 'mid-generation-steering',
    icon: '🎮',
    title: 'Mid-Generation Steering',
    tagline: 'Change direction while AI is working.',
    description:
      'You don\'t have to wait for Arivarangam to finish before redirecting it. If an AI is going in the wrong direction, send a steering message mid-generation. Arivarangam injects your instruction into the active generation context and all subsequent AIs in the pipeline receive it. No restart required.',
    highlights: [
      'Inject new constraints without restarting the task',
      'Correct factual errors as they appear',
      'Add context you forgot to include in the original prompt',
      'Real-time control without losing completed work',
    ],
  },
  {
    id: 'user-memory',
    icon: '🧠',
    title: 'User Memory',
    tagline: 'Arivarangam remembers your preferences, style, and context.',
    description:
      'Arivarangam builds a persistent memory profile for you: your industry, your role, your writing style, formatting preferences, and instructions you\'ve given. Every session is personalised without you having to repeat yourself. Memory is completely private — encrypted and never shared with other users or used to train AI models.',
    highlights: [
      'Remembers writing style, tone, and formatting preferences',
      'Knows your industry context for more relevant outputs',
      'Fully editable — add, update, or delete memory entries at any time',
      'Encrypted and private to your account only',
    ],
  },
  {
    id: 'scheduled-tasks',
    icon: '📅',
    title: 'Scheduled Tasks',
    tagline: 'Automate recurring AI tasks with cron scheduling.',
    description:
      'Define a task once, then schedule it to run automatically on a cron schedule — daily, weekly, or on a custom interval. Ideal for recurring reports, competitive monitoring, content batches, or any workflow that benefits from consistency. Results are delivered to your email or saved to your task history.',
    highlights: [
      'Cron-based scheduling: daily, weekly, or custom interval',
      'Results emailed or saved to task history',
      'Variable interpolation for dynamic tasks (e.g. {today\'s date})',
      'Pause, edit, or delete schedules at any time',
    ],
  },
  {
    id: 'workflow-builder',
    icon: '🔄',
    title: 'Workflow Builder',
    tagline: 'Chain multiple tasks with variable interpolation.',
    description:
      'Arivarangam\'s Workflow Builder lets you create multi-step AI pipelines where the output of one task becomes the input of the next. Use variable interpolation to pass data between steps. Workflows can be triggered manually, on a schedule, or via webhook.',
    highlights: [
      'Visual drag-and-drop workflow builder',
      'Variable interpolation: {output_step_1} into step 2\'s prompt',
      'Webhook triggers for integration with external tools',
      'Conditional branching and built-in retry logic',
    ],
  },
  {
    id: 'multiplayer',
    icon: '👥',
    title: 'Multiplayer Roundtable',
    tagline: 'Share your session with team members live.',
    description:
      'Share a live Arivarangam session with team members. Multiple users can watch AI outputs stream in real time, send steering messages, and discuss outputs together. Multiplayer sessions are scoped to your workspace. All participants must be workspace members. Ideal for collaborative brainstorming, design reviews, or client-facing AI sessions.',
    highlights: [
      'Share a live session link with workspace members',
      'Multiple users can observe and send steering messages',
      'Full session transcript saved to workspace history',
      'Permission controls: observers vs. active participants',
    ],
  },
  {
    id: 'quality-verification',
    icon: '✅',
    title: 'Output Quality Verification',
    tagline: 'Every output is scored for accuracy and completeness.',
    description:
      'After each Discussion Engine cycle, Arivarangam\'s verification model scores the final output on accuracy (are claims supported by evidence?), completeness (does it address the full task?), and consistency (does it contradict itself?). The score is shown alongside the output. High-stakes outputs can be escalated to human expert review.',
    highlights: [
      'Automated quality score on every Discussion Engine output',
      'Flags specific claims that lack sourcing or evidence',
      'Completeness check against original task requirements',
      'Escalate to expert human review via the Marketplace',
    ],
  },
  {
    id: 'vertical-packs',
    icon: '📦',
    title: 'Vertical AI Packs',
    tagline: 'Pre-configured for Legal, Medical, Finance, Engineering, HR.',
    description:
      'Vertical AI Packs are curated, pre-configured Discussion Engine setups for specific industries. Each pack includes the right AI models for the domain, domain-specific system prompts, and calibrated quality thresholds. A Legal Pack uses Claude for analysis, Perplexity for case research, and a legal-tuned synthesis prompt. All packs include Indian regulatory context.',
    highlights: [
      'Legal Pack: IPC, Companies Act, contract analysis, court filings',
      'Medical Pack: clinical research, drug interactions, patient summaries',
      'Finance Pack: market analysis, GST/SEBI compliance, financial modelling',
      'HR Pack: JD creation, appraisals, offer letters, policy drafting',
    ],
  },
  {
    id: 'expert-review',
    icon: '👨‍⚖️',
    title: 'Expert Review',
    tagline: 'Get AI outputs reviewed by certified domain experts.',
    description:
      'For outputs that matter — a contract, a clinical summary, a financial model — Arivarangam\'s Expert Marketplace connects you with background-verified, rated domain experts who review and annotate AI outputs within a defined SLA. Payment is per-review and deducted from your credit balance.',
    highlights: [
      'Verified experts in Legal, Medical, Finance, and Technology',
      'Defined turnaround SLAs: 4h, 24h, or 48h',
      'Expert annotations appear inline on the AI output',
      'Expert rating and review history visible before engaging',
    ],
  },
  {
    id: 'agent-execution',
    icon: '🤖',
    title: 'Agent Execution',
    tagline: 'AI can push code to GitHub, send emails, update Notion.',
    description:
      'Arivarangam\'s agent execution layer connects AI outputs to real-world actions. AI can push code to a GitHub repository, send emails via your connected Gmail or Outlook, update Notion pages, post to Slack channels, or make HTTP requests to any API. Every agent action requires explicit user approval before execution, and a full audit log is maintained.',
    highlights: [
      'GitHub: push commits, create PRs, open issues',
      'Email: send via Gmail or Outlook (with your approval)',
      'Notion: create and update pages and databases',
      'Generic webhooks: connect to any API endpoint',
    ],
  },
  {
    id: 'ai-firewall',
    icon: '🛡️',
    title: 'AI Firewall',
    tagline: 'PII redaction + prompt injection protection on every request.',
    description:
      'Every prompt passes through Arivarangam\'s AI Firewall before being sent to any external AI provider. The Firewall automatically detects and redacts PII — Aadhaar, PAN, phone numbers, bank details, email addresses — and blocks prompt injection attacks. A firewall audit log shows you exactly what was redacted from each request.',
    highlights: [
      'Automatic PII redaction: Aadhaar, PAN, phone, email, bank details',
      'Prompt injection attack detection and blocking',
      'Firewall audit log: see exactly what was redacted',
      'Configurable sensitivity levels for enterprise deployments',
    ],
  },
  {
    id: 'credit-economy',
    icon: '💎',
    title: 'Credit Economy',
    tagline: 'Fair usage pricing with referral bonuses.',
    description:
      'Arivarangam uses credit-based pay-per-use pricing — no subscriptions, ever. Buy a credit pack once, use it for any task. Credit costs reflect actual AI compute — a quick task costs ~10 credits; a full 8-specialist synthesis costs ~30 credits. Earn credits by referring users and completing onboarding. Credits never expire.',
    highlights: [
      'Transparent credit cost shown before task submission',
      'Credit warning if balance is below 50 before submitting',
      'Earn 500 credits per referred user who activates',
      'Credits never expire',
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Arivarangam<span className="text-indigo-600">.</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-slate-900 transition-colors">About</Link>
            <Link href="/changelog" className="hover:text-slate-900 transition-colors">Changelog</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Log in</Link>
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
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-600 text-xs font-medium mb-6">
            8 specialist AIs · One unified output
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-slate-900">
            Every feature that makes Arivarangam AI{' '}
            <span className="text-indigo-600">different</span>
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed">
            Arivarangam AI consults Claude, GPT-4o, Gemini, Perplexity and more —
            then builds your complete deliverable. India's knowledge workers get
            every AI working together, without managing a single subscription.
          </p>
        </div>
      </section>

      {/* Feature quick-nav */}
      <div className="sticky top-16 z-30 border-y border-slate-200 bg-white/95 backdrop-blur-md py-3 px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max">
          {FEATURES.map(({ id, icon, title }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <span>{icon}</span>
              <span>{title}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Features — alternating two-column layout */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {FEATURES.map(({ id, icon, title, tagline, description, highlights }, i) => (
            <div
              key={id}
              id={id}
              className={`grid md:grid-cols-2 gap-8 items-center p-8 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-sm`}
            >
              {/* Text */}
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{icon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">{description}</p>
                <ul className="space-y-2">
                  {highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-indigo-600 mt-0.5 shrink-0">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual placeholder */}
              <div className={`rounded-xl border border-slate-200 bg-slate-50 overflow-hidden ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="ml-2 text-xs text-slate-400 font-mono">{title}</span>
                </div>
                <div className="h-40 flex items-center justify-center">
                  <span className="text-5xl opacity-20">{icon}</span>
                </div>
                <div className="p-4 space-y-2 border-t border-slate-200">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className={`h-2 rounded-full bg-slate-200 ${j === 2 ? 'w-2/3' : 'w-full'}`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-slate-900">Ready to try Arivarangam?</h2>
          <p className="text-slate-500 mb-8">
            Start free — 100 credits on signup, no card required. Run your first task in 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
            >
              Start for free
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-200 bg-white text-center text-sm text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-6 mb-4">
          <Link href="/about" className="hover:text-slate-700 transition-colors">About</Link>
          <Link href="/pricing" className="hover:text-slate-700 transition-colors">Pricing</Link>
          <Link href="/changelog" className="hover:text-slate-700 transition-colors">Changelog</Link>
          <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
        </div>
        <p>© {new Date().getFullYear()} Arivarangam. Made for India.</p>
      </footer>
    </div>
  )
}
