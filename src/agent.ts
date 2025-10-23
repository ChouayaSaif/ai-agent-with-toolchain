import type { AIMessage } from '../types'
import { runLLM, runApprovalCheck } from './llm'
import { addMessages, getMessages, saveToolResponse } from './memory'
import { logMessage, showLoader } from './ui'
import { runTool } from './toolRunner'
import { generateImageToolDefinition } from './tools/generateImage'
import * as readline from 'readline'




// Interactive approval function that prompts the user
const promptUserForApproval = async (toolCall: any): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log('\n⚠️  APPROVAL REQUIRED ⚠️')
    console.log(`Tool: ${toolCall.function.name}`)
    console.log(`Arguments: ${JSON.stringify(toolCall.function.arguments, null, 2)}`)
    console.log('')

    rl.question('Do you approve this action? (yes/no): ', (answer) => {
      rl.close()
      const normalized = answer.trim().toLowerCase()
      const approved = ['yes', 'y', 'approve', 'ok', 'yeah'].includes(normalized)
      resolve(approved)
    })
  })
}

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

      // ✅ CHECK IF THIS IS AN IMAGE GENERATION REQUEST
      if (toolCall.function.name === generateImageToolDefinition.name) {
        loader.stop() // Stop loader before prompting
        
        // Prompt user interactively for approval
        const approved = await promptUserForApproval(toolCall)
        
        if (approved) {
          const execLoader = showLoader(`✅ Approved! Executing tool: ${toolCall.function.name}`)
          
          try {
            const toolResponse = await runTool(toolCall, userMessage)
            await saveToolResponse(toolCall.id, toolResponse)
            execLoader.update(`done executing tool: ${toolCall.function.name}, generating response...`)
            execLoader.stop()
          } catch (error: any) {
            console.error('Tool execution error:', error)
            await saveToolResponse(toolCall.id, `Tool execution failed: ${error?.message || 'Unknown error'}`)
            execLoader.stop()
          }
        } else {
          console.log('❌ Image generation denied by user')
          await saveToolResponse(
            toolCall.id,
            'User did not approve image generation at this time.'
          )
        }
        
        // Restart loader for next iteration
        loader.update('Generating response...')
        
        // Continue to get final response
        continue
      } else {
        // For non-image tools, execute normally
        loader.update(`executing tool: ${toolCall.function.name}...`)

        try {
          const toolResponse = await runTool(toolCall, userMessage)
          await saveToolResponse(toolCall.id, toolResponse)

          loader.update(`done executing tool: ${toolCall.function.name}, generating response...`)
        } catch (error: any) {
          console.error('Tool execution error:', error)
          await saveToolResponse(toolCall.id, `Tool execution failed: ${error?.message || 'Unknown error'}`)
        }
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