import { Index as UpstashIndex } from '@upstash/vector'

let index: UpstashIndex | null = null

function getIndex() {
  if (index) return index

  const url = process.env.UPSTASH_VECTOR_REST_URL
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN

  if (!url || !token) {
    throw new Error(
      'UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set to use RAG features'
    )
  }

  index = new UpstashIndex({ url, token })
  return index
}

type MovieMetadata = {
  title?: string
  year?: string
  genre?: string
  director?: string
  actors?: string
  rating?: string
  votes?: string
  revenue?: string
  metascore?: string
}

export const queryMovies = async (
  query: string,
  filters?: Partial<MovieMetadata>,
  topK: number = 5
) => {
  // Build a structured filter object if filters provided. Upstash expects
  // structured filter objects (for example in the `metadata` field), not a
  // SQL-like string. Send { metadata: filters } so Upstash can apply metadata
  // filtering.
  let filterObj: any = undefined
  if (filters) {
    const cleaned: any = {}
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined) cleaned[k] = v
    }
    if (Object.keys(cleaned).length > 0) {
      filterObj = { metadata: cleaned }
    }
  }

  // Query the vector store
  const idx = getIndex()
  const payload: any = {
    data: query,
    topK,
    filter: filterObj || undefined,
    includeMetadata: true,
    includeData: true,
  }

  // Debug: log payload being sent to Upstash (trim long fields)
  try {
    console.log('Upstash query payload:', JSON.stringify({
      data: String(payload.data).slice(0, 200),
      topK: payload.topK,
      filter: payload.filter,
    }, null, 2))

    const results = await idx.query(payload)
    return results
  } catch (err: any) {
    console.error('Upstash query failed:', err?.message || err)
    // Return empty results instead of throwing so the tool can respond gracefully
    return []
  }
}