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
  // Build filter string if filters provided
  let filterStr = ''
  if (filters) {
    const filterParts = Object.entries(filters)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}='${value}'`)

    if (filterParts.length > 0) {
      filterStr = filterParts.join(' AND ')
    }
  }

  // Query the vector store
  const idx = getIndex()
  const results = await idx.query({
    data: query,
    topK,
    filter: filterStr || undefined,
    includeMetadata: true,
    includeData: true,
  })

  return results
}