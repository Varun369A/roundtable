interface ModelConfig {
  label: string
  color: string
  bg: string
  emoji: string
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  // Arivarangam AI — orchestrator
  'sabha-ai':          { label: 'Arivarangam AI', color: '#6366F1', bg: '#EEF2FF', emoji: '✦'  },
  'arivarangam-ai':    { label: 'Arivarangam AI', color: '#6366F1', bg: '#EEF2FF', emoji: '✦'  },

  // Code
  'claude-3-5-sonnet': { label: 'Claude',         color: '#EA580C', bg: '#FFF7ED', emoji: '🟠' },
  'claude-3-opus':     { label: 'Claude Opus',    color: '#EA580C', bg: '#FFF7ED', emoji: '🟠' },

  // Reasoning
  'gpt-4o':            { label: 'GPT-4o',         color: '#16A34A', bg: '#F0FDF4', emoji: '🟢' },

  // Analysis
  'gemini-2.5-pro':    { label: 'Gemini',         color: '#2563EB', bg: '#EFF6FF', emoji: '🔷' },

  // Research
  'perplexity-sonar':  { label: 'Perplexity',     color: '#0891B2', bg: '#ECFEFF', emoji: '🔵' },

  // Indian languages
  'sarvam-1':          { label: 'Sarvam',          color: '#7C3AED', bg: '#F5F3FF', emoji: '🇮🇳' },

  // Voice output
  'elevenlabs':        { label: 'ElevenLabs',     color: '#CA8A04', bg: '#FEFCE8', emoji: '🎵' },

  // Voice input
  'whisper':           { label: 'Whisper',         color: '#475569', bg: '#F8FAFC', emoji: '🎤' },

  // Image
  'gpt-image-1':       { label: 'GPT Image',      color: '#DB2777', bg: '#FDF2F8', emoji: '🎨' },
}

export function getModelConfig(model: string): ModelConfig {
  return MODEL_CONFIG[model] || { label: model, color: '#64748B', bg: '#F8FAFC', emoji: '🤖' }
}

interface AIAvatarProps {
  model: string
  size?: 'sm' | 'md' | 'lg'
}

export function AIAvatar({ model, size = 'md' }: AIAvatarProps) {
  const config = getModelConfig(model)
  const dim =
    size === 'sm' ? 'w-7 h-7 text-sm' :
    size === 'lg' ? 'w-12 h-12 text-xl' :
                    'w-9 h-9 text-base'

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center shrink-0 font-bold`}
      style={{
        backgroundColor: config.bg,
        color: config.color,
        border: `1.5px solid ${config.color}30`,
      }}
      title={config.label}
    >
      {config.emoji}
    </div>
  )
}
