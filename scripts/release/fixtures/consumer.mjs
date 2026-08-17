import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createUnsafeJavaScriptTool } from '@karkata-ai/javascript'
import { createAgent } from '@karkata-ai/openai-compatible'
import { createAgentUIStore } from '@karkata-ai/ui'

const server = createServer((request, response) => {
  assert.equal(request.method, 'POST')
  assert.equal(request.url, '/v1/chat/completions')
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({
    choices: [{ message: { content: 'KARKATA_PACKAGE_OK' } }],
    usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
  }))
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

try {
  const address = server.address()
  const agent = createAgent({
    model: 'package-smoke',
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    apiKey: 'local-test-only',
  })
  const store = createAgentUIStore(agent)
  const result = await agent.send('Return the package smoke marker.')
  assert.deepEqual(result, {
    status: 'completed',
    runId: result.runId,
    content: 'KARKATA_PACKAGE_OK',
    steps: 1,
  })
  assert.equal(store.getSnapshot().items.at(-1)?.type, 'message')
  store.dispose()

  const javascript = createUnsafeJavaScriptTool()
  const output = await javascript.execute(
    { script: 'return { success: true }' },
    { signal: new AbortController().signal, runId: 'package-smoke', step: 1 },
  )
  assert.deepEqual(output, { success: true })
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}
