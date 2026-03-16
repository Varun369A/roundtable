interface ModelConfig {
  label: string
  color: string
  bg: string
  emoji: string
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  'claude-3-5-sonnet': { label: 'Claude',      color: '#F97316', bg: '#7C2D12', emoji: '🟠' },
  'claude-3-opus':     { label: 'Claude Opus', color: '#F97316', bg: '#7C2D12', emoji: '🟠' },
  'gpt-4o':            { label: 'GPT-4o',      color: '#22C55E', bg: '#14532D', emoji: '🟢' },
  'gpt-4-turbo':       { label: 'GPT-4',       color: '#22C55E', bg: '#14532D', emoji: '🟢' },
  'perplexity-sonar':  { label: 'Perplexity',  color: '#06B6D4', bg: '#164E63', emoji: '🔵' },
  'gemini-pro':        { label: 'Gemini',       color: '#3B82F6', bg: '#1E3A5F', emoji: '🔷' },
  'dalle-3':           { label: 'DALL-E 3',    color: '#EC4899', bg: '#831843', emoji: '🌸' },
  'midjourney-v6':     { label: 'Midjourney',  color: '#A855F7', bg: '#4C1D95', emoji: '🎨' },
  'stability-xl':      { label: 'Stability',   color: '#8B5CF6', bg: '#3B0764', emoji: '🎆' },
  'elevenlabs':        { label: 'ElevenLabs',  color: '#EAB308', bg: '#713F12', emoji: '🎵' },
  'runway-gen3':       { label: 'Runway',      color: '#F43F5E', bg: '#881337', emoji: '🎬' },
  'sarvam-1':          { label: 'Sarvam',      color: '#6366F1', bg: '#1E1B4B', emoji: '🇮🇳' },
  'gamma':             { label: 'Gamma',        color: '#14B8A6', bg: '#134E4A', emoji: '📊' },
}

export function getModelConfig(model: string): ModelConfig {
  return MODEL_CONFIG[model] || { label: model, color: '#A1A1AA', bg: '#27272A', emoji: '🤖' }
}

interface AIAvatarProps {
  model: string
  size?: 'sm' | 'md'
}

export function AIAvatar({ model, size = 'md' }: AIAvatarProps) {
  const config = getModelConfig(model)
  const dim = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-base'

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center shrink-0 font-bold`}
      style={{
        backgroundColor: config.bg,
        color: config.color,
        border: `1.5px solid ${config.color}40`,
      }}
      title={config.label}
    >
      {config.emoji}
    </div>
  )
}
