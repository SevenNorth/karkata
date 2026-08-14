import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const requiredVariables = ['KARKATA_BASE_URL', 'KARKATA_API_KEY', 'KARKATA_MODEL']
const smokePrompt = 'Reply with a short acknowledgement that the integration is available. Do not include sensitive data.'

export function parseRealProviderConfig(environment) {
  const missing = requiredVariables.filter((name) => !readNonEmptyString(environment[name]))
  if (missing.length > 0) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)

  const baseURL = readNonEmptyString(environment.KARKATA_BASE_URL)
  let endpoint
  try {
    endpoint = new URL(baseURL)
  } catch {
    throw new Error('KARKATA_BASE_URL must be a valid HTTP(S) URL')
  }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error('KARKATA_BASE_URL must be an HTTP(S) URL without embedded credentials')
  }

  const streamingValue = readNonEmptyString(environment.KARKATA_STREAMING)?.toLowerCase()
  if (streamingValue !== undefined && !['true', 'false', '1', '0'].includes(streamingValue)) {
    throw new Error('KARKATA_STREAMING must be true, false, 1, or 0')
  }

  return Object.freeze({
    baseURL,
    apiKey: readNonEmptyString(environment.KARKATA_API_KEY),
    model: readNonEmptyString(environment.KARKATA_MODEL),
    streaming: streamingValue === 'true' || streamingValue === '1',
    safeTarget: endpoint.origin,
  })
}

export async function runRealProviderSmoke(options = {}) {
  const config = parseRealProviderConfig(options.env ?? process.env)
  const createAgent = options.createAgent ?? await loadCreateAgent()
  const now = options.now ?? Date.now
  const output = options.output ?? ((line) => process.stdout.write(`${line}\n`))
  const agent = createAgent({
    model: config.model,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    agent: config.streaming ? { streaming: {} } : {},
  })

  const startedAt = now()
  let result
  try {
    result = await agent.send(smokePrompt)
  } finally {
    await agent.dispose()
  }
  const durationMs = Math.max(0, now() - startedAt)
  if (result.status !== 'completed' || !result.content.trim()) {
    const code = result.status === 'error' ? result.error.code : result.status.toUpperCase()
    throw new Error(`Real provider smoke did not complete successfully (${code})`)
  }

  output(`Real provider smoke passed: ${config.safeTarget}, ${config.streaming ? 'streaming' : 'non-streaming'}, ${durationMs}ms.`)
}

async function loadCreateAgent() {
  const module = await import('../../packages/openai-compatible/dist/index.js')
  return module.createAgent
}

function readNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (invokedPath === import.meta.url) {
  runRealProviderSmoke().catch((error) => {
    process.stderr.write(`Real provider smoke failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
