import type { Metadata } from 'next'

const MODEL_NAMES: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'gemini-1-5-pro': 'Gemini 1.5 Pro',
  'gemini-1-5-flash': 'Gemini 1.5 Flash',
  'llama-3-3-70b': 'Llama 3.3 70B',
  'deepseek-r1': 'DeepSeek R1',
  'mistral-large': 'Mistral Large',
  'perplexity-sonar': 'Perplexity Sonar',
}

export async function generateMetadata({
  params,
}: {
  params: { model: string }
}): Promise<Metadata> {
  const modelName = MODEL_NAMES[params.model] ?? params.model.replace(/-/g, ' ')
  return {
    title: `${modelName} — Sabha AI Marketplace`,
    description: `Use ${modelName} in your Sabha AI roundtable. Compare capabilities, pricing, and integrate with 100+ language support.`,
    openGraph: {
      title: `${modelName} on Sabha`,
      description: `Leverage ${modelName} in collaborative AI workflows for Indian businesses.`,
    },
  }
}

export default function ModelLayout({ children }: { children: React.ReactNode }) {
  return children
}
