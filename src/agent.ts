import type { AIMessage } from '../types'
import { runLLM } from './llm'
import { addMessages, getMessages, saveToolResponse } from './memory'
import { logMessage, showLoader } from './ui'
import { runTool } from './toolRunner'

export const runAgent = async ({
  userMessage,
  tools,
}: {
  userMessage: string
  tools?: any[]
}) => {
  // Clean up any problematic message sequences
  const priorHistory = await getMessages()
  
  // Remove trailing empty assistant messages
  while (priorHistory.length > 0) {
    const last = priorHistory[priorHistory.length - 1]
    if (last.role === 'assistant' && (!last.content || (typeof last.content === 'string' && last.content.trim() === ''))) {
      priorHistory.pop()
    } else {
      break
    }
  }
  
  // If last message is a tool, we need an assistant response before continuing
  const last = priorHistory[priorHistory.length - 1]
  if (last && last.role === 'tool') {
    // This shouldn't happen with our new flow, but just in case
    console.warn('Warning: Found trailing tool message without assistant response')
  }

  await addMessages([
    {
      role: 'user',
      content: userMessage,
    },
  ])

  const loader = showLoader('🤔Thinking...')
  let iterations = 0
  const MAX_ITERATIONS = 10 // Prevent infinite loops

  // Loop to handle multiple tool calls if needed
  while (iterations < MAX_ITERATIONS) {
    iterations++
    
    const history = await getMessages()
    const response = await runLLM({
      messages: history,
      tools,
    })

    // Check if tool_calls exists and has at least one element
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0]
      
      // Save the assistant message with tool_call
      await addMessages([response as AIMessage])
      logMessage(response as AIMessage)
      
      loader.update(`executing tool: ${toolCall.function.name}...`)

      try {
        const toolResponse = await runTool(toolCall, userMessage)
        await saveToolResponse(toolCall.id, toolResponse)
        
        loader.update(`done executing tool: ${toolCall.function.name}, generating response...`)
      } catch (error: any) {
        console.error('Tool execution error:', error)
        await saveToolResponse(toolCall.id, `Tool execution failed: ${error?.message || 'Unknown error'}`)
      }
      
      // Loop continues - will call LLM again with tool result in history
      continue
    } else {
      // No tool calls - this is the final response
      await addMessages([response as AIMessage])
      logMessage(response as AIMessage)
      loader.stop()
      break
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.warn('Max iterations reached, stopping agent loop')
    loader.stop()
  }

  return getMessages()
}