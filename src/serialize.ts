/**
 * Serialize harness messages into the Qoder CN wire vocabulary (OpenAI-style
 * roles with `content` strings / content parts and `tool_calls`), ported from
 * the pi provider extension. The chat endpoint expects the OpenAI-compatible
 * shape inside the agent-chat envelope; image content crosses as data URLs.
 *
 * The dsh-v0.1.7 message contract is what this module targets: the rendered
 * system prompt arrives as a leading `role: "system"` message (folded into the
 * request-level `system` field, not a user turn), tool results arrive as
 * `role: "tool"` messages carrying `toolCallId` (mapped to the OpenAI
 * `tool_call_id` that must answer the preceding `tool_calls`), and developer
 * messages carry only tool-declaration bookkeeping that this adapter never
 * needs because every request declares the complete tool list.
 *
 * @module dsh-llm-qoder/serialize
 */

import { contentHasImage, LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'

/** OpenAI-style tool definition sent to the Qoder API. */
interface QoderTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: unknown
  }
}

/** OpenAI-style tool call within an assistant message. */
interface QoderToolCall {
  id?: string
  type: 'function'
  function: { name?: string; arguments: string }
}

type QoderTextPart = { type: 'text'; text: string }
type QoderImagePart = { type: 'image_url'; image_url: { url: string } }
type QoderContent = string | Array<QoderTextPart | QoderImagePart>

/** OpenAI-style message sent to the Qoder API. */
export interface QoderMessage {
  role: 'user' | 'assistant' | 'tool'
  /**
   * Always a string. Qoder's algo layer drops a message whose `content` is
   * `null`, so a tool-call-only assistant turn must carry `""`; sending the
   * OpenAI-legal `null` there makes the gateway lose the `tool_calls` and then
   * reject the answering tool message as answering nothing.
   */
  content: QoderContent
  tool_calls?: QoderToolCall[]
  tool_call_id?: string
}

/** One fully serialized request: the request-level system prompt plus wire messages. */
export interface QoderSerializedRequest {
  /** Request-level system prompt (`system` field); empty when the history has none. */
  system: string
  /** Wire conversation in request order. */
  messages: QoderMessage[]
}

/** Flatten harness blocks to their visible text (text only). */
function getBlocksText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

/** Flatten text recursively, including nested tool-result content. */
function flattenBlocksText(blocks: readonly ContentBlock[]): string {
  return blocks.map((block) => {
    if (block.type === 'text') return block.text
    if (block.type === 'tool-result') return flattenBlocksText(block.content)
    return ''
  }).join('')
}

/**
 * Convert harness tool schemas to the wire shape.
 * @param options - the assembled request.
 * @returns the wire tools, or `undefined` when none are declared.
 */
export function transformTools(options: GenerateOptions): QoderTool[] | undefined {
  return options.tools !== undefined && options.tools.length > 0
    ? options.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
    : undefined
}

async function userContent(
  blocks: readonly ContentBlock[],
  attachments: AttachmentStore | undefined,
): Promise<QoderContent> {
  if (!contentHasImage(blocks)) return flattenBlocksText(blocks)

  const content: (QoderTextPart | QoderImagePart)[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if (block.text.length > 0) content.push({ type: 'text', text: block.text })
        break
      case 'image': {
        if (attachments === undefined) {
          throw new LlmError(
            'Qoder CN image content requires the durable attachment service',
            'UNSUPPORTED_CONTENT',
          )
        }
        const stored: StoredImageAttachment = await attachments.readImage(block.attachment)
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${stored.ref.mediaType};base64,${Buffer.from(stored.data).toString('base64')}`,
          },
        })
        break
      }
      default:
        break
    }
  }
  return content
}

/**
 * Collect every system-role message plus the caller's explicit `system` option
 * into the one request-level system prompt.
 *
 * dsh-v0.1.7 mounts the rendered system prompt as an in-history
 * `role: "system"` message (see `createSystemMessage`/`SystemPromptProjection`),
 * while one-shot callers pass {@link GenerateOptions.system}. Both routes carry
 * the same text and belong in Qoder's request-level `system` field, never in a
 * user turn.
 * @param options - the assembled request (history, system).
 * @returns the joined system prompt, or an empty string when there is none.
 */
export function systemTextOf(options: GenerateOptions): string {
  const parts: string[] = []
  if (options.system !== undefined && options.system.length > 0) {
    parts.push(options.system)
  }
  for (const msg of options.messages) {
    if (msg.role !== 'system') continue
    const text = getBlocksText(msg.content)
    if (text.length > 0) parts.push(text)
  }
  return parts.join('\n\n')
}

/**
 * Convert the harness conversation to wire messages. User messages carry text
 * plus optional images; assistant messages carry text, thinking tags, and tool
 * calls; tool results become role `tool` entries echoing their `toolCallId`.
 * System-role messages are lifted into {@link systemTextOf} instead of becoming
 * user turns, and developer messages (tool-declaration bookkeeping) are skipped
 * because this adapter always sends the complete tool list.
 * @param options - the assembled request (history, tools).
 * @param attachments - optional durable byte resolver for image references.
 * @returns the wire messages in order.
 */
export async function serializeMessages(
  options: GenerateOptions,
  attachments?: AttachmentStore,
): Promise<QoderMessage[]> {
  const normalizedMessages: QoderMessage[] = []

  for (const msg of options.messages) {
    if (msg.role === 'system' || msg.role === 'developer') {
      // The system prompt travels in the request-level `system` field, and tool
      // additions/removals are re-declared in full by every request.
      continue
    }

    if (msg.role === 'tool') {
      const content = await userContent(msg.content, attachments)
      normalizedMessages.push({
        role: 'tool',
        tool_call_id: String(msg.toolCallId),
        content: typeof content === 'string'
          ? content || '(no output)'
          : content,
      })
      continue
    }

    if (msg.role === 'user') {
      normalizedMessages.push({ role: 'user', content: await userContent(msg.content, attachments) })
      continue
    }

    if (msg.role === 'assistant') {
      let content = ''
      const toolCalls: QoderToolCall[] = []
      for (const block of msg.content) {
        if (block.type === 'text') {
          content += block.text
        } else if (block.type === 'reasoning') {
          content += `<thinking>${block.text}</thinking>\n\n`
        } else if (block.type === 'tool-call') {
          const call: QoderToolCall = {
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: block.arguments,
            },
          }
          toolCalls.push(call)
        }
      }
      const mapped: QoderMessage = { role: 'assistant', content }
      if (toolCalls.length > 0) {
        mapped.tool_calls = toolCalls
      }
      normalizedMessages.push(mapped)
      continue
    }
  }

  return normalizedMessages
}

/**
 * Serialize one assembled request in full: the request-level system prompt and
 * the wire conversation.
 * @param options - the assembled request (history, tools, system).
 * @param attachments - optional durable byte resolver for image references.
 * @returns the system prompt plus wire messages.
 */
export async function serializeRequest(
  options: GenerateOptions,
  attachments?: AttachmentStore,
): Promise<QoderSerializedRequest> {
  return {
    system: systemTextOf(options),
    messages: await serializeMessages(options, attachments),
  }
}

/**
 * Build the `chat_context` original-content text (last user text).
 * @param messages - the harness conversation, in order.
 * @returns the last non-empty user text, or an empty string.
 */
export function lastUserText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg !== undefined && msg.role === 'user') {
      return getBlocksText(msg.content.filter(block => block.type !== 'tool-result'))
    }
  }
  return ''
}
