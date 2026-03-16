'use client'

import { AIAvatar, getModelConfig } from './AIAvatar'

interface TypingIndicatorProps {
  model: string
  title: string
}

export function TypingIndicator({ model, title }: TypingIndicatorProps) {
  const config = getModelConfig(model)

  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <AIAvatar model={model} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: config.color }}>
            {config.label}
          </span>
          <span className="text-xs text-zinc-600">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl rounded-tl-sm bg-zinc-900 border border-zinc-800 w-fit">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{
                backgroundColor: config.color,
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
