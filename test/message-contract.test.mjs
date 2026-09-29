/**
 * Regression tests for the dsh-v0.1.7 message contract.
 *
 * The harness hands an adapter a rendered system prompt as a leading
 * `role: "system"` message, tool results as `role: "tool"` messages carrying
 * `toolCallId`, and tool-declaration bookkeeping as `role: "developer"`
 * messages. The Qoder wire needs the system prompt at request level, the tool
 * result as an OpenAI `role: "tool"` / `tool_call_id` entry answering the
 * preceding `tool_calls`, and nothing at all for developer bookkeeping.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { ToolCallId, createAssistantMessage, createDeveloperMessage, createSystemMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { mapUsage, serializeMessages, serializeRequest, systemTextOf } from '../dist/index.js'

const identity = { provider: 'qoder-cn', model: 'deepseek-v4-flash' }

function toolCallHistory() {
  return [
    createSystemMessage('You are a terse assistant.'),
    createUserMessage({ content: [{ type: 'text', text: 'Call the echo tool with value "hi".' }], source: { kind: 'user' } }),
    createAssistantMessage({
      content: [{
        type: 'tool-call',
        id: ToolCallId('call_00_echo'),
        name: 'echo',
        arguments: '{"value":"hi"}',
      }],
      source: identity,
    }),
    createToolResultMessage({
      callId: ToolCallId('call_00_echo'),
      content: [{ type: 'text', text: 'hi' }],
      isError: false,
    }),
  ]
}

test('lifts a leading system message into the request-level system field', async () => {
  const options = { provider: 'qoder-cn', model: 'deepseek-v4-flash', messages: toolCallHistory() }
  assert.equal(systemTextOf(options), 'You are a terse assistant.')
  const serialized = await serializeRequest(options)
  assert.equal(serialized.system, 'You are a terse assistant.')
  assert.equal(serialized.messages.some(message => message.role === 'user' && message.content === 'You are a terse assistant.'), false)
})

test('joins the explicit system option ahead of in-history system messages', () => {
  const options = {
    provider: 'qoder-cn',
    model: 'deepseek-v4-flash',
    system: 'one-shot prompt',
    messages: [createSystemMessage('in-history prompt')],
  }
  assert.equal(systemTextOf(options), 'one-shot prompt\n\nin-history prompt')
})

test('maps a tool-role message to the OpenAI tool result that answers tool_calls', async () => {
  const messages = await serializeMessages({ provider: 'qoder-cn', model: 'deepseek-v4-flash', messages: toolCallHistory() })
  assert.deepEqual(messages, [
    { role: 'user', content: 'Call the echo tool with value "hi".' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'call_00_echo', type: 'function', function: { name: 'echo', arguments: '{"value":"hi"}' } }],
    },
    { role: 'tool', tool_call_id: 'call_00_echo', content: 'hi' },
  ])
})

test('substitutes placeholder text for an empty tool result', async () => {
  const messages = await serializeMessages({
    provider: 'qoder-cn',
    model: 'deepseek-v4-flash',
    messages: [createToolResultMessage({ callId: ToolCallId('call_empty'), content: [], isError: false })],
  })
  assert.deepEqual(messages, [{ role: 'tool', tool_call_id: 'call_empty', content: '(no output)' }])
})

test('skips developer tool-declaration bookkeeping', async () => {
  const messages = await serializeMessages({
    provider: 'qoder-cn',
    model: 'deepseek-v4-flash',
    messages: [
      createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }),
      createDeveloperMessage({ source: { kind: 'tool-registry' }, content: [{ type: 'tool-addition', toolName: 'echo' }] }),
    ],
  })
  assert.deepEqual(messages, [{ role: 'user', content: 'hello' }])
})

test('keeps an assistant turn with text but no tool calls as a plain string', async () => {
  const messages = await serializeMessages({
    provider: 'qoder-cn',
    model: 'deepseek-v4-flash',
    messages: [createAssistantMessage({ content: [{ type: 'text', text: 'done' }], source: identity })],
  })
  assert.deepEqual(messages, [{ role: 'assistant', content: 'done' }])
})

test('reports prompt cache hits as disjoint, not double-counted input', () => {
  assert.deepEqual(mapUsage({
    prompt_tokens: 295,
    completion_tokens: 37,
    total_tokens: 332,
    prompt_tokens_details: { cached_tokens: 128 },
    completion_tokens_details: { reasoning_tokens: 0 },
  }), {
    inputTokens: 167,
    outputTokens: 37,
    totalTokens: 332,
    cacheReadTokens: 128,
  })
})

test('omits optional usage detail the gateway does not report', () => {
  assert.deepEqual(mapUsage({ prompt_tokens: 10, completion_tokens: 2 }), {
    inputTokens: 10,
    outputTokens: 2,
  })
})
