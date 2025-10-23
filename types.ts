import OpenAI from 'openai'

export type AIMessage =
  | OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam
  | { role: 'user'; content: string }
  | { role: 'tool'; content: string; tool_call_id: string }

export interface ToolFn<A = any, T = any> {
  (input: { userMessage: string; toolArgs: A }): Promise<T>
}

// Types used by the dashboard and evals
export type Score = { name: string; score: number | null }

export type Run = {
  input: any
  output: any
  expected?: any
  scores: Score[]
  createdAt?: string
}

export type Set = {
  runs: Run[]
  score: number
  createdAt: string
}

export type Experiment = {
  name: string
  sets: Set[]
}

export type Results = {
  experiments: Experiment[]
}
