/**
 * Static registry of all supported external AI providers for BYOAI.
 * Each entry defines how to display it, what models it unlocks, and key format hints.
 */

export interface ProviderDef {
  key: string           // unique identifier, matches connector.provider
  displayName: string
  icon: string          // emoji
  description: string
  apiKeyLabel: string
  apiKeyHint: string    // placeholder text for input field
  docsUrl: string       // where to get API key
  models: string[]      // AIModel values this provider unlocks
  categories: string[]  // TaskCategory values best suited for this provider
  color: string         // tailwind color for UI
}

export const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    key: 'anthropic',
    displayName: 'Anthropic Claude',
    icon: '🟠',
    description: 'Claude 3.5 Sonnet & Opus — best for code, strategy, and complex reasoning',
    apiKeyLabel: 'Anthropic API Key',
    apiKeyHint: 'sk-ant-api03-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-3-5-sonnet', 'claude-3-opus'],
    categories: ['code', 'strategy', 'copywriting', 'general'],
    color: 'orange',
  },
  {
    key: 'openai',
    displayName: 'OpenAI',
    icon: '🟢',
    description: 'GPT-4o & GPT-4 Turbo — excellent creative writing and data analysis',
    apiKeyLabel: 'OpenAI API Key',
    apiKeyHint: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o', 'gpt-4-turbo', 'dalle-3'],
    categories: ['copywriting', 'data_analysis', 'images', 'general'],
    color: 'green',
  },
  {
    key: 'google',
    displayName: 'Google Gemini',
    icon: '🔵',
    description: 'Gemini Pro — multimodal, great for learning content and research',
    apiKeyLabel: 'Google AI API Key',
    apiKeyHint: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-pro'],
    categories: ['research', 'learning', 'data_analysis'],
    color: 'blue',
  },
  {
    key: 'perplexity',
    displayName: 'Perplexity',
    icon: '🔮',
    description: 'Perplexity Sonar — real-time web search with citations',
    apiKeyLabel: 'Perplexity API Key',
    apiKeyHint: 'pplx-...',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    models: ['perplexity-sonar'],
    categories: ['research'],
    color: 'purple',
  },
  {
    key: 'elevenlabs',
    displayName: 'ElevenLabs',
    icon: '🎙️',
    description: 'ElevenLabs — most natural text-to-speech and voice generation',
    apiKeyLabel: 'ElevenLabs API Key',
    apiKeyHint: 'xi_...',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
    models: ['elevenlabs'],
    categories: ['audio'],
    color: 'yellow',
  },
  {
    key: 'stability',
    displayName: 'Stability AI',
    icon: '🎨',
    description: 'Stable Diffusion XL — high quality image generation',
    apiKeyLabel: 'Stability AI API Key',
    apiKeyHint: 'sk-...',
    docsUrl: 'https://platform.stability.ai/account/keys',
    models: ['stability-xl'],
    categories: ['images'],
    color: 'pink',
  },
  {
    key: 'groq',
    displayName: 'Groq',
    icon: '⚡',
    description: 'Groq — ultra-fast inference for Llama and Mixtral models',
    apiKeyLabel: 'Groq API Key',
    apiKeyHint: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    models: ['groq'],
    categories: ['general', 'code'],
    color: 'cyan',
  },
  {
    key: 'cohere',
    displayName: 'Cohere',
    icon: '🌊',
    description: 'Cohere Command R+ — powerful RAG and enterprise NLP',
    apiKeyLabel: 'Cohere API Key',
    apiKeyHint: 'co_...',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    models: ['cohere'],
    categories: ['research', 'copywriting'],
    color: 'teal',
  },
  {
    key: 'sarvam',
    displayName: 'Sarvam AI',
    icon: '🇮🇳',
    description: 'Sarvam-1 — Indian language specialist (Hindi, Tamil, Telugu, etc.)',
    apiKeyLabel: 'Sarvam API Key',
    apiKeyHint: 'your-sarvam-key',
    docsUrl: 'https://dashboard.sarvam.ai',
    models: ['sarvam-1'],
    categories: ['translation'],
    color: 'orange',
  },
  {
    key: 'runway',
    displayName: 'Runway ML',
    icon: '🎬',
    description: 'Runway Gen3 — AI video generation',
    apiKeyLabel: 'Runway API Key',
    apiKeyHint: 'your-runway-key',
    docsUrl: 'https://dev.runwayml.com',
    models: ['runway-gen3'],
    categories: ['video'],
    color: 'red',
  },
]

export function getProviderForModel(model: string): string | null {
  for (const p of PROVIDER_REGISTRY) {
    if (p.models.includes(model)) return p.key
  }
  return null
}
