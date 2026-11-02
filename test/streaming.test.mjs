/**
 * The streaming translation layer: SSE framing -> double envelope -> harness
 * StreamChunks. This is the code that turns bytes into the answer the user
 * reads and into the tool calls the agent runs, so each test pins one fact that
 * a regression would corrupt silently.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { DONE, createThinkingSplitter, mapFinishReason, parseQoderSse, translate } from '../dist/index.js'

/** Collect a chunk stream into an array. */
async function chunksOf(envelopes, reasoningEnabled = true) {
  const out = []
  for await (const chunk of translate(envelopes, reasoningEnabled)) out.push(chunk)
  return out
}

/** One SSE envelope carrying an inner chunk. */
function envelope(body, statusCodeValue = 200) {
  return { statusCodeValue, body: typeof body === 'string' ? body : JSON.stringify(body) }
}

/** The visible answer text a chunk stream produces. */
function textOf(chunks) {
  return chunks.filter(c => c.type === 'text-delta').map(c => c.text).join('')
}

/** The reasoning text a chunk stream produces. */
function reasoningOf(chunks) {
  return chunks.filter(c => c.type === 'reasoning-delta').map(c => c.text).join('')
}

function delta(content) {
  return envelope({ choices: [{ delta: { content } }] })
}

test('frames a byte stream split at arbitrary points into payloads', async () => {
  const payloads = ['{"statusCodeValue":200,"body":"{}"}', '{"statusCodeValue":200,"body":"{}"}']
  const wire = payloads.map(p => `data: ${p}\n\n`).join('') + `data: ${DONE}\n\n`
  const bytes = new TextEncoder().encode(wire)
  // Split mid-line so the reader has to reassemble across reads.
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
      controller.close()
    },
  })
  const seen = []
  for await (const payload of parseQoderSse(stream)) seen.push(payload)
  assert.deepEqual(seen, [...payloads, DONE])
})

test('treats a clean EOF after payloads as the sentinel, and rejects an empty feed', async () => {
  const encoder = new TextEncoder()
  const clean = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(envelope({ choices: [{ delta: { content: 'hi' } }] }))}\n\n`))
      controller.close()
    },
  })
  const seen = []
  for await (const payload of parseQoderSse(clean)) seen.push(payload)
  assert.equal(seen.at(-1), DONE)

  const empty = new ReadableStream({ start(controller) { controller.close() } })
  await assert.rejects(async () => {
    for await (const _ of parseQoderSse(empty)) { /* drain */ }
  }, error => error?.code === 'STREAM_CLOSED')
})

test('passes visible content through as one text block', async () => {
  const chunks = await chunksOf([delta('Hello'), delta(' world'), DONE])
  assert.deepEqual(chunks.map(c => c.type), [
    'block-start', 'text-delta', 'text-delta', 'block-end', 'finish',
  ])
  assert.equal(textOf(chunks), 'Hello world')
  assert.deepEqual(chunks.at(-1), { type: 'finish', reason: { kind: 'stop' } })
})

test('prefers the native reasoning channel over the tag fallback', async () => {
  const chunks = await chunksOf([
    envelope({ choices: [{ delta: { reasoning_content: 'weighing options' } }] }),
    delta('answer'),
    DONE,
  ])
  assert.equal(reasoningOf(chunks), 'weighing options')
  assert.equal(textOf(chunks), 'answer')
})

test('splits reasoning tags that arrive whole in one chunk', async () => {
  const chunks = await chunksOf([delta('<thinking>plan</thinking>Hello'), DONE])
  assert.equal(reasoningOf(chunks), 'plan')
  assert.equal(textOf(chunks), 'Hello')
})

test('keeps the tag state ACROSS chunks, so a split tag still splits', async () => {
  // The opening tag is cut in half by the transport. A per-chunk splitter sees
  // no tag at all here and leaks both the marker and the reasoning into the
  // visible answer, which is exactly the bug this pins.
  const chunks = await chunksOf([delta('<think'), delta('ing>plan</think'), delta('ing>Hello'), DONE])
  assert.equal(reasoningOf(chunks), 'plan')
  assert.equal(textOf(chunks), 'Hello')
  assert.equal(textOf(chunks).includes('<'), false, 'no raw tag may reach the answer')
})

test('closes an unterminated reasoning block at end of stream', async () => {
  const chunks = await chunksOf([delta('<thinking>half a thought'), delta(' and more'), DONE])
  assert.equal(reasoningOf(chunks), 'half a thought and more')
  assert.equal(textOf(chunks), '')
})

test('flushes a trailing half-received tag instead of dropping it', async () => {
  const splitter = createThinkingSplitter()
  assert.deepEqual(splitter.push('answer <thin'), [{ kind: 'text', text: 'answer ' }])
  // Never completed: the held fragment is still the user's text, not silence.
  assert.deepEqual(splitter.flush(), [{ kind: 'text', text: '<thin' }])
})

test('assembles streamed tool-call fragments into one block', async () => {
  const chunks = await chunksOf([
    envelope({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'echo', arguments: '{"va' } }] } }] }),
    envelope({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'lue":"hi"}' } }] } }] }),
    DONE,
  ])
  const ends = chunks.filter(c => c.type === 'block-end')
  assert.deepEqual(ends.map(c => c.block), [
    { type: 'tool-call', id: 'call_1', name: 'echo', arguments: '{"value":"hi"}' },
  ])
  assert.equal(chunks.filter(c => c.type === 'tool-call-delta').length, 2)
})

test('defers usage and finish until the sentinel so nothing follows finish', async () => {
  const chunks = await chunksOf([
    delta('done'),
    envelope({
      choices: [{ finish_reason: 'length' }],
      usage: { prompt_tokens: 20, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 8 } },
    }),
    DONE,
  ])
  const finishAt = chunks.findIndex(c => c.type === 'finish')
  const usageAt = chunks.findIndex(c => c.type === 'usage')
  assert.equal(chunks.at(-1).type, 'finish')
  assert.equal(usageAt < finishAt, true)
  assert.equal(finishAt, chunks.length - 1)
  assert.deepEqual(chunks.at(finishAt), { type: 'finish', reason: { kind: 'max-tokens' } })
  assert.deepEqual(chunks.at(usageAt).usage, { inputTokens: 12, outputTokens: 5, cacheReadTokens: 8 })
})

test('reports an empty completed response as an error instead of a clean stop', async () => {
  const chunks = await chunksOf([DONE])
  const finish = chunks.at(-1)
  assert.equal(finish.type, 'finish')
  assert.equal(finish.reason.kind, 'error')
})

test('surfaces an in-band upstream status as an UPSTREAM error', async () => {
  await assert.rejects(
    async () => { await chunksOf([{ statusCodeValue: 503, body: 'overloaded' }, DONE]) },
    error => error?.code === 'UPSTREAM',
  )
})

test('maps the wire finish vocabulary, unknown values included', () => {
  assert.deepEqual(mapFinishReason('stop'), { kind: 'stop' })
  assert.deepEqual(mapFinishReason('tool_calls'), { kind: 'tool-calls' })
  assert.deepEqual(mapFinishReason('length'), { kind: 'max-tokens' })
  assert.equal(mapFinishReason('content_filter').kind, 'error')
})
