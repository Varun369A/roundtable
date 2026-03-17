/**
 * API Key Tester — makes a minimal (cheap) test call to verify a user's API key.
 * Uses the smallest/cheapest model available for each provider.
 */

interface TestResult {
  valid: boolean
  error?: string
}

export async function testApiKey(provider: string, apiKey: string): Promise<TestResult> {
  try {
    switch (provider) {
      case 'anthropic': return await testAnthropic(apiKey)
      case 'openai':    return await testOpenAI(apiKey)
      case 'google':    return await testGoogle(apiKey)
      case 'perplexity': return await testPerplexity(apiKey)
      case 'elevenlabs': return await testElevenLabs(apiKey)
      case 'stability':  return await testStability(apiKey)
      case 'groq':       return await testGroq(apiKey)
      case 'cohere':     return await testCohere(apiKey)
      case 'sarvam':     return { valid: true } // Sarvam doesn't have a cheap test endpoint
      case 'runway':     return { valid: true } // Runway — skip test for now
      default:           return { valid: false, error: 'Unknown provider' }
    }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Verification failed' }
  }
}

async function testAnthropic(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
  })
  if (res.status === 401 || res.status === 403) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}

async function testOpenAI(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] }),
  })
  if (res.status === 401) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}

async function testGoogle(apiKey: string): Promise<TestResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }], generationConfig: { maxOutputTokens: 5 } }),
    }
  )
  if (res.status === 400 || res.status === 403) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}

async function testPerplexity(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.1-sonar-small-128k-online', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] }),
  })
  if (res.status === 401) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}

async function testElevenLabs(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': apiKey },
  })
  if (res.status === 401) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}

async function testStability(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.stability.ai/v1/user/account', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (res.status === 401) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}

async function testGroq(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (res.status === 401) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}

async function testCohere(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.cohere.com/v1/tokenize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hi', model: 'command' }),
  })
  if (res.status === 401) return { valid: false, error: 'Invalid API key' }
  if (!res.ok) return { valid: false, error: `API returned ${res.status}` }
  return { valid: true }
}
