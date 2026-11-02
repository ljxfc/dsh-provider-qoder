// Opt-in, one short real generation. Never prints credential or request headers.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parse } from 'yaml'
import { QoderAdapter, resolveAdapterOptions } from '../dist/index.js'
if (!process.argv.includes('--live')) throw new Error('Use --live to allow one short real request; optionally --stored-pat to use the existing DSH credential file.')
let pat = process.env.QODERCN_PERSONAL_ACCESS_TOKEN
if (!pat && process.argv.includes('--stored-pat')) {
  const candidates = []
  const scan = value => {
    if (typeof value === 'string' && value.startsWith('pt-')) candidates.push(value)
    else if (value && typeof value === 'object') Object.values(value).forEach(scan)
  }
  scan(parse(readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')))
  if (candidates.length !== 1) throw new Error('Cannot unambiguously choose the Qoder PAT; use QODERCN_PERSONAL_ACCESS_TOKEN instead.')
  pat = candidates[0]
}
if (!pat?.startsWith('pt-')) throw new Error('A Qoder PAT is required')
let values = { maxOutputTokens: 64 }
const adapter = new QoderAdapter({ options: () => resolveAdapterOptions(values), resolveApiKey: async () => pat, resolveAttachments: () => undefined })
const catalog = await adapter.getModelCapacities(AbortSignal.timeout(30000))
const model = catalog.find(model => model.contextWindows.includes(1000000) && /flash/i.test(model.id))
  ?? catalog.find(model => model.contextWindows.includes(1000000))
  ?? catalog.find(model => /flash/i.test(model.id))
  ?? catalog[0]
if (!model) throw new Error('No model available')
const selected = model.contextWindows.includes(1000000) ? 1000000 : model.contextWindows.at(-1)
values = { ...values, ...(selected === undefined ? {} : { contextWindowOverride: selected }) }
const resolved = await adapter.resolveModel('qoder-cn', model.id)
let text = ''
const chunks = []
const start = Date.now()
for await (const chunk of adapter.stream({ model: model.id, messages: [{ role: 'user', content: [{ type: 'text', text: 'Reply exactly OK.' }] }], reasoningEffort: 'off', signal: AbortSignal.timeout(60000) })) {
  chunks.push(chunk.type)
  if (chunk.type === 'text-delta') text += chunk.text
}
if (!text.trim() || !chunks.includes('finish')) throw new Error('No completed visible response')
const evidence = { timestamp: new Date().toISOString(), model: model.id, catalogModels: catalog.length, advertisedContextWindows: model.contextWindows, selectedContextWindow: selected ?? null, resolvedContextWindow: resolved.context.contextWindow, resolvedOutputTokens: resolved.defaultMaxTokens, response: text, elapsedMs: Date.now() - start, chunks, scope: 'Real adapter and Qoder public CN gateway; one short prompt. Does not test a full 1M prompt or Desktop UI.' }
mkdirSync('output/validation', { recursive: true })
writeFileSync('output/validation/live-gateway.json', JSON.stringify(evidence, null, 2))
console.log(JSON.stringify(evidence, null, 2))
