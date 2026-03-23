import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

/**
 * Gamma AI connector for presentation generation.
 *
 * Gamma's API creates decks from structured outlines.
 * We use Claude to first create a structured outline,
 * then Gamma renders it as a beautiful deck.
 *
 * Until Gamma opens their public API fully, this connector
 * generates a structured presentation outline as a markdown doc
 * that can be imported into Gamma.
 */
export class GammaConnector extends BaseConnector {
  readonly model: AIModel = 'gamma'
  readonly provider = 'gamma'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const start = Date.now()

    // Generate a well-structured presentation outline
    // This will be enhanced with Gamma's API when available
    const presentationContent = await this.generatePresentationStructure(input.prompt)

    return {
      type: 'json',
      content: presentationContent,
      costUsd: 0, // Gamma pricing TBD when API available
      latencyMs: Date.now() - start,
      metadata: { format: 'presentation_outline', importable: true },
    }
  }

  private async generatePresentationStructure(prompt: string): Promise<string> {
    // Use Claude as fallback to generate structured presentation
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.generateBasicOutline(prompt)
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: `You are a presentation designer. Create a structured, engaging presentation outline in JSON format.
Format: {"title": "...", "slides": [{"title": "...", "type": "cover|content|data|quote|cta", "bullets": ["..."], "notes": "..."}]}
Make slides visually interesting with clear hierarchy. 8-12 slides is ideal.`,
      messages: [{ role: 'user', content: `Create a presentation for: ${prompt}` }],
    })

    const content = response.content[0]
    return content.type === 'text' ? content.text : this.generateBasicOutline(prompt)
  }

  private generateBasicOutline(prompt: string): string {
    return JSON.stringify({
      title: 'Presentation',
      slides: [
        { title: 'Overview', type: 'cover', bullets: [prompt.slice(0, 100)], notes: '' },
        { title: 'Key Points', type: 'content', bullets: ['Point 1', 'Point 2', 'Point 3'], notes: '' },
        { title: 'Next Steps', type: 'cta', bullets: ['Action 1', 'Action 2'], notes: '' },
      ],
    }, null, 2)
  }

  async isAvailable(): Promise<boolean> {
    return true // always available (uses Claude fallback)
  }
}
