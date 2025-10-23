import { JSONFilePreset } from 'lowdb/node'
import type { AIMessage } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { summarizeMessages } from './llm'

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
  summary: string
}

const defaultData: Data = { messages: [], summary: '' }

export const getDb = async () => {
  const db = await JSONFilePreset<Data>('db.json', defaultData)

  return db
}

export const addMessages = async (messages: AIMessage[]) => {
  const db = await getDb()
  db.data.messages.push(...messages.map(addMetadata))

  if (db.data.messages.length >= 10) {
    const oldestMessages = db.data.messages.slice(0, 5).map(removeMetadata)
    const summary = await summarizeMessages(oldestMessages)
    db.data.summary = summary
  }

  await db.write()
}

export const getMessages = async () => {
  const db = await getDb()
  const messages = db.data.messages.map(removeMetadata)
  const lastFive = messages.slice(-5)

  // If first message is a tool response, get one more message before it
  if (lastFive[0]?.role === 'tool') {
    const sixthMessage = messages[messages.length - 6]
    if (sixthMessage) {
      return [...[sixthMessage], ...lastFive]
    }
  }

  return lastFive
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

export const getSummary = async () => {
  const db = await getDb()
  return db.data.summary
}