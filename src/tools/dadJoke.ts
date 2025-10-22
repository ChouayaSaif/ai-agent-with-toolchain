import { z } from 'zod'
import type { ToolFn } from '../../types'
import fetch from 'node-fetch'

export const dadJokeToolDefinition = {
  name: 'dad_joke',
  parameters: z.object({}),
  description: "Get a random dad joke.",
}

type Args = z.infer<typeof dadJokeToolDefinition.parameters>

export const dadJoke: ToolFn<Args, string> = async ({ toolArgs }) => {
  try {
    const res = await fetch('https://icanhazdadjoke.com/', {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'agent-from-scratch/1.0 (+https://github.com)'
      },
      // set a reasonable timeout in environments that support AbortController
    })

    if (!res.ok) {
      console.warn(`dadJoke: non-OK response ${res.status}`)
      throw new Error(`dadJoke: status ${res.status}`)
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase()

    if (contentType.includes('application/json')) {
      const data = await res.json() as { joke?: string }
      if (data?.joke) return data.joke
      console.warn('dadJoke: JSON response missing joke field, falling back')
    } else {
      // If the API returned HTML (some CDNs or blockers may do this), try to extract text
      const text = await res.text()
      // Try a simple regex to capture a likely joke inside a <p> or <div>
      const match = text.match(/<p[^>]*>([^<]{10,}?)<\/p>/i) || text.match(/>([^<>]{10,}?)<\//i)
      if (match && match[1]) {
        const cleaned = match[1].replace(/\s+/g, ' ').trim()
        return cleaned
      }
      console.warn('dadJoke: non-JSON response, could not extract joke')
    }
  } catch (err: any) {
    console.warn('dadJoke: fetch failed', err?.message || err)
  }

  // Fallback jokes
  const fallbackJokes = [
    "Why don't scientists trust atoms? Because they make up everything!",
    'I would tell you a joke about construction, but I\'m still working on it.',
    'Why did the scarecrow win an award? Because he was outstanding in his field.',
  ]
  return fallbackJokes[Math.floor(Math.random() * fallbackJokes.length)]
}