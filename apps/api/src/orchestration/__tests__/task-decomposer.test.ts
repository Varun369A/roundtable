import { decomposeTask } from '../task-decomposer'
import type { ParsedIntent } from '@sabha/types'

const baseIntent: ParsedIntent = {
  goal: 'Create a marketing campaign for my chai brand',
  categories: ['research', 'strategy', 'copywriting', 'images'],
  subject: 'chai brand marketing',
  audience: 'college students',
  deliverables: ['Research report', 'Strategy doc', 'Content', 'Visuals'],
  language: 'en',
  urgency: 'normal',
  constraints: [],
}

describe('decomposeTask', () => {
  test('produces correct number of subtasks', () => {
    const subtasks = decomposeTask(baseIntent)
    expect(subtasks).toHaveLength(4)
  })

  test('research has no dependencies', () => {
    const subtasks = decomposeTask(baseIntent)
    const research = subtasks.find((s) => s.category === 'research')
    expect(research?.dependsOn).toHaveLength(0)
  })

  test('strategy depends on research', () => {
    const subtasks = decomposeTask(baseIntent)
    const strategyIdx = subtasks.findIndex((s) => s.category === 'strategy')
    const researchIdx = subtasks.findIndex((s) => s.category === 'research')
    const strategy = subtasks[strategyIdx]

    // Strategy should depend on research (by index reference)
    expect(strategy?.dependsOn).toContain(String(researchIdx))
  })

  test('images depends on strategy', () => {
    const subtasks = decomposeTask(baseIntent)
    const imagesIdx = subtasks.findIndex((s) => s.category === 'images')
    const strategyIdx = subtasks.findIndex((s) => s.category === 'strategy')
    const images = subtasks[imagesIdx]

    expect(images?.dependsOn).toContain(String(strategyIdx))
  })

  test('assigns correct models', () => {
    const subtasks = decomposeTask(baseIntent)
    const research = subtasks.find((s) => s.category === 'research')
    const copy = subtasks.find((s) => s.category === 'copywriting')
    const images = subtasks.find((s) => s.category === 'images')

    expect(research?.assignedModel).toBe('perplexity-sonar')
    expect(copy?.assignedModel).toBe('claude-3-5-sonnet')
    expect(images?.assignedModel).toBe('dalle-3')
  })

  test('execution order is set', () => {
    const subtasks = decomposeTask(baseIntent)
    subtasks.forEach((s, i) => {
      expect(s.executionOrder).toBe(i)
    })
  })

  test('each subtask has an input instruction', () => {
    const subtasks = decomposeTask(baseIntent)
    subtasks.forEach((s) => {
      expect(s.inputInstruction).toBeTruthy()
      expect(s.inputInstruction.length).toBeGreaterThan(20)
    })
  })

  test('single category produces single subtask', () => {
    const intent: ParsedIntent = { ...baseIntent, categories: ['code'] }
    const subtasks = decomposeTask(intent)
    expect(subtasks).toHaveLength(1)
    expect(subtasks[0].assignedModel).toBe('claude-3-5-sonnet')
  })
})
