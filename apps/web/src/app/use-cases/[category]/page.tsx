import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-static'

type Category =
  | 'finance'
  | 'legal'
  | 'healthcare'
  | 'education'
  | 'hr'
  | 'marketing'
  | 'research'
  | 'engineering'

interface UseCase {
  title: string
  description: string
}

interface CategoryData {
  title: string
  subtitle: string
  description: string
  icon: string
  useCases: UseCase[]
}

const CATEGORY_DATA: Record<Category, CategoryData> = {
  finance: {
    title: 'Finance',
    subtitle: 'AI for CAs, CFOs, and Finance Teams',
    description:
      'Arivarangam\'s Finance Pack brings multi-AI intelligence to Indian financial workflows — from GST filing to audit preparation, RBI compliance, and investment analysis. Pre-tuned for Indian tax law and regulatory frameworks.',
    icon: '📊',
    useCases: [
      {
        title: 'GST Analysis & Filing Prep',
        description:
          'Upload invoices and reconciliation sheets. Arivarangam identifies discrepancies, flags input tax credit mismatches, and generates a pre-filing summary aligned with GSTR-1 and GSTR-3B formats.',
      },
      {
        title: 'CA Audit Checklist Generation',
        description:
          'Given a client\'s industry, turnover, and audit scope, Arivarangam generates a comprehensive statutory audit checklist covering Companies Act 2013, SA standards, and sector-specific regulations.',
      },
      {
        title: 'Financial Statement Summarisation',
        description:
          'Paste a P&L or balance sheet and Arivarangam produces a plain-English executive summary highlighting key ratios, anomalies, and year-on-year trends — ready for board presentations.',
      },
      {
        title: 'RBI & SEBI Compliance Drafting',
        description:
          'Draft regulatory correspondence, board resolutions, and disclosures aligned with RBI circulars and SEBI listing obligations using Arivarangam\'s Finance-trained prompts.',
      },
      {
        title: 'Investment Research Reports',
        description:
          'Arivarangam combines Perplexity\'s live web search with Claude\'s analytical reasoning to produce structured equity research notes, including risk factors and valuation commentary.',
      },
      {
        title: 'Budget vs Actuals Variance Analysis',
        description:
          'Upload your budget and actuals spreadsheet. Arivarangam explains each significant variance, suggests root causes, and drafts a management commentary suitable for the board pack.',
      },
    ],
  },
  legal: {
    title: 'Legal',
    subtitle: 'AI for Lawyers, In-House Counsel, and Law Firms',
    description:
      'Arivarangam\'s Legal Pack assists Indian legal professionals with contract drafting, case research, litigation support, and compliance work — trained on Indian statutes, case law, and court procedures.',
    icon: '⚖️',
    useCases: [
      {
        title: 'Contract Drafting & Review',
        description:
          'Draft NDAs, service agreements, employment contracts, and vendor agreements using Indian law templates. Arivarangam flags unfair clauses, suggests balanced alternatives, and explains risks in plain language.',
      },
      {
        title: 'Indian Case Law Research',
        description:
          'Describe your legal issue and Arivarangam researches relevant Supreme Court, High Court, and tribunal judgments via Perplexity, then synthesises the key holdings and applicable precedents.',
      },
      {
        title: 'Legal Notice Drafting',
        description:
          'Generate formal legal notices for recovery, breach of contract, property disputes, or consumer complaints — structured for Indian courts with appropriate statutory references.',
      },
      {
        title: 'Vakalatnama & Court Filing Templates',
        description:
          'Generate vakalatnama forms, memo of appearances, and procedural filings formatted for district courts, High Courts, and NCLT/NCLAT.',
      },
      {
        title: 'Due Diligence Summaries',
        description:
          'Upload a bundle of contracts or corporate documents and Arivarangam produces a structured due diligence summary identifying key risks, unusual clauses, and missing standard protections.',
      },
    ],
  },
  healthcare: {
    title: 'Healthcare',
    subtitle: 'AI for Doctors, Hospitals, and Health Administrators',
    description:
      'Arivarangam\'s Health Pack supports Indian healthcare professionals with clinical documentation, patient communication, medical coding, and NABH compliance — built around Indian healthcare standards.',
    icon: '🏥',
    useCases: [
      {
        title: 'Patient Discharge Summary Drafting',
        description:
          'Provide clinical notes and Arivarangam generates a structured discharge summary including diagnosis, treatment summary, medications, follow-up instructions, and ICD-10 codes.',
      },
      {
        title: 'ICD-10 & SNOMED Coding Assistance',
        description:
          'Describe symptoms, diagnoses, or procedures and Arivarangam suggests the most accurate ICD-10 and SNOMED-CT codes with justifications — reducing coding errors and claim rejections.',
      },
      {
        title: 'NABH Accreditation Documentation',
        description:
          'Generate NABH-compliant policies, SOPs, and quality manuals for hospital departments — aligned with NABH Entry Level and Progressive standards.',
      },
      {
        title: 'Patient Communication Drafting',
        description:
          'Write clear, compassionate patient information leaflets, consent forms, and post-procedure instructions in English and Indian languages — at appropriate reading levels.',
      },
      {
        title: 'Clinical Research Summaries',
        description:
          'Arivarangam combines Claude\'s analytical reasoning with Perplexity\'s live PubMed search to produce structured literature reviews and evidence summaries for clinical questions.',
      },
      {
        title: 'Medical Insurance Pre-Auth Letters',
        description:
          'Draft pre-authorisation requests and supporting clinical justification letters for health insurance claims — formatted for TPA requirements and IRDAI guidelines.',
      },
    ],
  },
  education: {
    title: 'Education',
    subtitle: 'AI for Teachers, Educators, and EdTech Builders',
    description:
      'Arivarangam\'s Education Pack helps Indian educators create CBSE/NCERT-aligned content, personalised assessments, and lesson materials — supporting curriculum from Class 1 to competitive exam preparation.',
    icon: '📚',
    useCases: [
      {
        title: 'CBSE/NCERT Lesson Plan Generation',
        description:
          'Specify class, subject, chapter, and duration. Arivarangam generates a structured lesson plan with learning objectives, activities, formative assessments, and homework aligned to NCERT outcomes.',
      },
      {
        title: 'Question Paper & Assessment Creation',
        description:
          'Generate question papers with the right mix of MCQs, short answers, and long answers — calibrated to CBSE marking schemes, bloom\'s taxonomy levels, and difficulty distribution.',
      },
      {
        title: 'Personalised Explanation Generation',
        description:
          'Describe a student\'s learning gap and Arivarangam generates a personalised explanation using analogies, examples, and visual descriptions calibrated to their grade level and learning style.',
      },
      {
        title: 'Competitive Exam Prep Content',
        description:
          'Create study guides, topic summaries, and practice question sets for JEE, NEET, UPSC, and CAT — with marking schemes and detailed solution explanations.',
      },
      {
        title: 'Report Card Comment Generation',
        description:
          'Generate individualised, constructive report card comments for each student based on their performance data and teacher observations — in English or Hindi.',
      },
    ],
  },
  hr: {
    title: 'HR',
    subtitle: 'AI for HR Managers, People Teams, and Recruiters',
    description:
      'Arivarangam\'s HR Pack streamlines Indian HR workflows — from hiring and onboarding to appraisals, compliance, and employee communication — with templates aligned to Indian labour law.',
    icon: '👥',
    useCases: [
      {
        title: 'Job Description & JD Templates',
        description:
          'Generate structured, inclusive job descriptions for any role — calibrated to Indian market salary bands, skills demand, and seniority levels. Outputs are ATS-optimised.',
      },
      {
        title: 'Offer Letter & Appointment Letter Drafting',
        description:
          'Draft legally sound offer letters and appointment letters aligned with Indian labour law, Shops & Establishments Act requirements, and company-specific compensation structures.',
      },
      {
        title: 'Annual Appraisal Form Generation',
        description:
          'Create customised performance review forms with KRA/KPI frameworks, self-evaluation sections, and manager assessment rubrics tailored to the role and seniority.',
      },
      {
        title: 'POSH Policy & Compliance Documents',
        description:
          'Generate POSH Act-compliant policies, ICC constitution templates, complaint procedures, and annual report formats — aligned with the Sexual Harassment of Women at Workplace Act 2013.',
      },
      {
        title: 'Employee Handbook Sections',
        description:
          'Draft handbook sections covering leave policy, code of conduct, grievance procedures, and remote work policies — reflecting Indian statutory requirements and company culture.',
      },
      {
        title: 'Interview Question Banks',
        description:
          'Generate structured interview question banks with scoring rubrics for technical, behavioural, and situational questions — customised to role, seniority, and competency framework.',
      },
    ],
  },
  marketing: {
    title: 'Marketing',
    subtitle: 'AI for Marketing Teams, Agencies, and Brand Managers',
    description:
      'Arivarangam accelerates Indian marketing workflows — from campaign ideation and copywriting to SEO content, social media, and localisation across Indian languages and regional markets.',
    icon: '📣',
    useCases: [
      {
        title: 'Campaign Ideation & Concept Development',
        description:
          'Run a Arivarangam Roundtable with your brand brief. Multiple AIs generate independent campaign concepts, critique each other\'s ideas, and Arivarangam synthesises the strongest unified concept.',
      },
      {
        title: 'Multi-Language Ad Copy',
        description:
          'Generate ad copy in English and Indian languages simultaneously — with cultural adaptation, not just translation. Covers digital, print, and outdoor formats.',
      },
      {
        title: 'SEO Blog & Content Generation',
        description:
          'Produce SEO-optimised long-form articles, product pages, and landing page copy targeting Indian search intent — with keyword integration that reads naturally.',
      },
      {
        title: 'Social Media Content Calendar',
        description:
          'Generate a month\'s worth of social content for LinkedIn, Instagram, and Twitter/X — with captions, hashtags, and content themes tailored to Indian audiences and festivals.',
      },
      {
        title: 'Competitive Intelligence Reports',
        description:
          'Arivarangam uses Perplexity to research competitor positioning, pricing, and recent campaigns, then synthesises a structured competitive landscape report with strategic implications.',
      },
    ],
  },
  research: {
    title: 'Research',
    subtitle: 'AI for Researchers, Analysts, and Knowledge Workers',
    description:
      'Arivarangam dramatically accelerates research workflows — literature reviews, competitive analysis, policy research, and synthesis — by running multiple AI models in parallel and structuring their outputs.',
    icon: '🔬',
    useCases: [
      {
        title: 'Literature Review Acceleration',
        description:
          'Describe your research question and Arivarangam searches PubMed, Google Scholar, and web sources via Perplexity, then Claude synthesises the findings into a structured literature review with citations.',
      },
      {
        title: 'Competitive & Market Analysis',
        description:
          'Run a Arivarangam Roundtable on a market. Each AI researches different angles — market sizing, competitor mapping, consumer trends, regulatory environment — and Arivarangam synthesises a comprehensive report.',
      },
      {
        title: 'Policy & Regulatory Research',
        description:
          'Research Indian government policy, Ministry circulars, and regulatory frameworks with live web search and AI synthesis — useful for compliance teams, think tanks, and consultants.',
      },
      {
        title: 'Data Interpretation & Statistical Analysis',
        description:
          'Paste your dataset or statistical output and Arivarangam explains the findings in plain language, identifies anomalies, suggests further analyses, and drafts a results section.',
      },
      {
        title: 'Research Proposal Drafting',
        description:
          'Generate structured research proposals with problem statement, literature gap, methodology, expected outcomes, and timeline — aligned to DST, ICMR, or UGC grant formats.',
      },
      {
        title: 'Interview & Survey Design',
        description:
          'Design research instruments — interview guides, survey questionnaires, and focus group protocols — with question types, sequencing logic, and pilot testing recommendations.',
      },
    ],
  },
  engineering: {
    title: 'Engineering',
    subtitle: 'AI for Software Engineers, Architects, and DevOps Teams',
    description:
      'Arivarangam\'s engineering workflows combine Claude\'s code reasoning, GitHub integration, and multi-model review to help Indian engineering teams ship faster, review smarter, and document better.',
    icon: '⚙️',
    useCases: [
      {
        title: 'Multi-File Code Generation',
        description:
          'Describe a feature and Arivarangam generates the full implementation across multiple files — including tests, types, and API routes — with a clear explanation of every architectural decision.',
      },
      {
        title: 'Code Review & Refactoring',
        description:
          'Paste a PR diff or file and Arivarangam runs a multi-model review: Claude identifies logic issues, GPT-4o checks for security vulnerabilities, and Arivarangam synthesises a unified review with prioritised findings.',
      },
      {
        title: 'Architecture Decision Records',
        description:
          'Describe a technical decision and Arivarangam generates a structured ADR covering context, decision drivers, considered options, chosen solution, and consequences — ready for your wiki.',
      },
      {
        title: 'GitHub PR with AI Commit Messages',
        description:
          'Write code in Arivarangam\'s Code Workspace and push directly to GitHub with AI-generated commit messages that accurately describe the change — saving time and improving git history quality.',
      },
      {
        title: 'API Documentation Generation',
        description:
          'Upload your OpenAPI spec or codebase and Arivarangam generates human-readable API documentation with request/response examples, error codes, and integration guides.',
      },
      {
        title: 'Debugging & Root Cause Analysis',
        description:
          'Paste an error trace or describe a bug and Arivarangam runs multi-model diagnosis: each AI proposes a root cause, Arivarangam evaluates the hypotheses, and gives you the most likely fix with explanation.',
      },
    ],
  },
}

const ALL_CATEGORIES: Category[] = [
  'finance',
  'legal',
  'healthcare',
  'education',
  'hr',
  'marketing',
  'research',
  'engineering',
]

export function generateStaticParams() {
  return ALL_CATEGORIES.map((category) => ({ category }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const data = CATEGORY_DATA[category as Category]

  if (!data) {
    return { title: 'Use Cases — Arivarangam' }
  }

  return {
    title: `${data.title} Use Cases — Arivarangam`,
    description: data.description,
    alternates: { canonical: `https://arivarangam.com/use-cases/${category}` },
  }
}

export default async function UseCasesPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const data = CATEGORY_DATA[category as Category]

  if (!data) {
    notFound()
  }

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
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Category nav */}
      <div className="pt-24 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {ALL_CATEGORIES.map((cat) => {
              const catData = CATEGORY_DATA[cat]
              const isActive = cat === category
              return (
                <Link
                  key={cat}
                  href={`/use-cases/${cat}`}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <span>{catData.icon}</span>
                  <span>{catData.title}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-5xl mb-4">{data.icon}</div>
          <div className="text-sm text-indigo-400 font-medium mb-2">{data.subtitle}</div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Arivarangam for {data.title}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-2xl">{data.description}</p>
          <div className="flex gap-4 mt-8">
            <Link
              href="/signup"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors text-sm"
            >
              Try free
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-xl font-semibold transition-colors text-sm"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases Grid */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold text-zinc-300 mb-6">
            {data.useCases.length} use cases for {data.title.toLowerCase()} teams
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.useCases.map((useCase, idx) => (
              <div
                key={useCase.title}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-indigo-400 font-mono text-sm font-bold mt-0.5 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100 mb-2">{useCase.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{useCase.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-zinc-800 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">
            Ready to use Arivarangam for {data.title.toLowerCase()}?
          </h2>
          <p className="text-zinc-400 text-sm mb-6">
            Start free — no credit card required. The {data.title} Pack is available on Pro.
          </p>
          <Link
            href="/signup"
            className="inline-flex px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
          >
            Start for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-zinc-800 text-center text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} Arivarangam. Made for India.</p>
      </footer>
    </div>
  )
}
