import type { ToolFn } from '../../types'
import { z } from 'zod'
import { queryMovies } from '../rag/query'

export const movieSearchToolDefinition = {
  name: 'movieSearch',
  parameters: z.object({
    query: z.string().describe('The search query for finding movies'),
    genre: z.string().optional().describe('Filter movies by genre'),
    director: z.string().optional().describe('Filter movies by director'),
  }),
  description:
    'Searches for movies and information about them, including title, year, genre, director, actors, rating, and description. Use this to answer questions about movies.',
}

type Args = z.infer<typeof movieSearchToolDefinition.parameters>

export const movieSearch: ToolFn<Args, string> = async ({ toolArgs, userMessage }) => {
  const { query, genre, director } = toolArgs || {}

  // If the tool call didn't include a query, fall back to the user's message.
  const searchQuery = (query && String(query).trim()) || (userMessage && String(userMessage).trim())
  if (!searchQuery) {
    return 'Error: No query provided for movie search'
  }

  const filters = {
    ...(genre && { genre }),
    ...(director && { director }),
  }

  let results
  try {
    results = await queryMovies(searchQuery, filters)
  } catch (error) {
    console.error(error)
    return 'Error: Failed to search for movies'
  }

  const formattedResults = results.map((result) => ({
    title: result.metadata?.title,
    year: result.metadata?.year,
    genre: result.metadata?.genre,
    director: result.metadata?.director,
    actors: result.metadata?.actors,
    rating: result.metadata?.rating,
    description: result.data,
  }))

  return JSON.stringify(formattedResults, null, 2)
}