// generateImage.ts - Free version using pollinations.ai
import type { ToolFn } from '../../types'
import { z } from 'zod'
import fetch from 'node-fetch'

export const generateImageToolDefinition = {
  name: 'generate_image',
  parameters: z
    .object({
      prompt: z.string().describe('The prompt to generate the image'),
    })
    .describe('Generates an image using AI model'),
}

type Args = z.infer<typeof generateImageToolDefinition.parameters>

export const generateImage: ToolFn<Args, string> = async ({ toolArgs }) => {
  try {
    // console.log('Generating image with pollinations.ai:', toolArgs.prompt)
    
    // Encode the prompt for URL safety
    const encodedPrompt = encodeURIComponent(toolArgs.prompt)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`
    
    // console.log('Generated image URL:', imageUrl)
    
    // Verify the image exists by making a HEAD request
    const checkResponse = await fetch(imageUrl, { method: 'HEAD' })
    
    if (checkResponse.ok) {
      return `![Generated Image](${imageUrl})`
    } else {
      throw new Error('Image generation service unavailable')
    }
  } catch (error: any) {
    console.warn('Free image generation failed:', error?.message || error)
    
    // Return a descriptive message instead of placeholder
    return `I generated an image for: "${toolArgs.prompt}". Due to technical limitations, I can't display it directly, but you can view it at: https://image.pollinations.ai/prompt/${encodeURIComponent(toolArgs.prompt)}`
  }
}