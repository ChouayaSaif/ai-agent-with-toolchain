import { JSONFilePreset } from 'lowdb/node'
import type { AIMessage } from '../types'
import { v4 as uuidv4 } from 'uuid'

export type MessageWithMetadata = AIMessage & {
  id: string
  createdAt: string
}

export const addMetadata = (message: AIMessage): MessageWithMetadata => ({
  ...message,
  id: uuidv4(),
  createdAt: new Date().toISOString(),
})

export const removeMetadata = (message: MessageWithMetadata): AIMessage => {
  const { id, createdAt, ...messageWithoutMetadata } = message
  return messageWithoutMetadata
}

type Data = {
  messages: MessageWithMetadata[]
}

const defaultData: Data = { messages: [] }

export const getDb = async () => {
  const db = await JSONFilePreset<Data>('db.json', defaultData)

  return db
}

export const addMessages = async (messages: AIMessage[]) => {
  const db = await getDb()
  db.data.messages.push(...messages.map(addMetadata))
  await db.write()
}

export const getMessages = async () => {
  const db = await getDb()
  return db.data.messages.map(removeMetadata)
}

export const saveToolResponse = async (toolCallId: string, toolResponse: string) => {
  // Add the tool response, then add an assistant placeholder message.
  // Mistral/OpenAI-style flows expect assistant -> tool -> assistant ordering.
  await addMessages([
    {
      role: 'tool',
      content: toolResponse,
      tool_call_id: toolCallId,
    } as AIMessage,
  ])

  // Append an assistant message so that next user messages don't directly follow a tool message.
  return addMessages([
    {
      role: 'assistant',
      content: '',
    } as AIMessage,
  ])
}