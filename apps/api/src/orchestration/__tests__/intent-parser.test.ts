/**
 * Unit tests for the intent parser.
 * These test the rule-based fallback (no API key needed).
 * Run with: npx jest
 */

import { parseIntent } from '../intent-parser'

// Temporarily remove API key for testing rule-based parser
const originalKey = process.env.ANTHROPIC_API_KEY
beforeAll(() => { delete process.env.ANTHROPIC_API_KEY })
afterAll(() => { if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey })

describe('parseIntent — rule-based', () => {
  test('marketing campaign goal', async () => {
    const result = await parseIntent('Create a marketing campaign for my chai brand targeting college students')
    expect(result.categories).toContain('strategy')
    expect(result.audience).toBeTruthy()
    expect(result.language).toBe('en')
    expect(result.urgency).toBe('normal')
  })

  test('urgent research task', async () => {
    const result = await parseIntent('Urgently research competitors for my startup')
    expect(result.categories).toContain('research')
    expect(result.urgency).toBe('high')
  })

  test('image generation task', async () => {
    const result = await parseIntent('Design a logo for my food startup')
    expect(result.categories).toContain('images')
  })

  test('code task', async () => {
    const result = await parseIntent('Build an API for user authentication')
    expect(result.categories).toContain('code')
    expect(result.assignedModels).toBeUndefined()
  })

  test('multi-category task', async () => {
    const result = await parseIntent('Research the market and write a blog post about AI trends')
    expect(result.categories).toContain('research')
    expect(result.categories).toContain('copywriting')
  })

  test('detects Hindi language', async () => {
    const result = await parseIntent('मेरे चाय ब्रांड के लिए मार्केटिंग कैंपेन बनाएं')
    expect(result.language).toBe('hi')
  })

  test('always returns required fields', async () => {
    const result = await parseIntent('do something')
    expect(result.goal).toBeDefined()
    expect(result.categories).toBeDefined()
    expect(result.categories.length).toBeGreaterThan(0)
    expect(result.language).toBeDefined()
    expect(result.urgency).toBeDefined()
    expect(result.deliverables).toBeDefined()
    expect(result.constraints).toBeDefined()
  })
})
