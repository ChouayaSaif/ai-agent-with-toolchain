import 'dotenv/config'
import { runLLM } from './src/llm'
import type { AIMessage } from './types'
import { addMessages, getMessages } from './src/memory'
import { runAgent } from './src/agent'
import { tools } from './src/tools'


const userMessage = process.argv[2]

if (!userMessage) {
  console.error('Please provide a message')
  process.exit(1)
}

// saving messages to memory
// await addMessages([{ role: 'user', content: userMessage } as AIMessage])
// const messages = await getMessages()

// const response = await runLLM({
// 	messages,
//   tools: []
// })

// await addMessages([{ role: 'assistant', content: response.content } as AIMessage])



await runAgent({ userMessage, tools })