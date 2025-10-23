import type { Scorer } from 'autoevals'

export const ToolCallMatch: Scorer<any, {}> = async ({
  output,
  expected,
}: {
  output: any
  expected?: any
}) => {
  const expectedName = expected?.tool_calls?.[0]?.function?.name
  const score =
    output?.role === 'assistant' &&
    Array.isArray(output.tool_calls) &&
    output.tool_calls.length === 1 &&
    output.tool_calls[0].function?.name === expectedName
      ? 1
      : 0

  return {
    name: 'ToolCallMatch',
    score,
  }
}