import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { request as sendRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createDemoServer } from './server.mjs'

describe('UI demo server', () => {
  let root
  let server
  let baseURL

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'karkata-ui-demo-'))
    await writeFile(join(root, 'index.html'), '<h1>demo</h1>')
    await writeFile(join(root, 'app.js'), 'export const ready = true')
    server = createDemoServer({ root })
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    baseURL = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await rm(root, { recursive: true, force: true })
  })

  it('serves the index and module with correct GET/HEAD behavior', async () => {
    const index = await fetch(`${baseURL}/`)
    assert.equal(index.status, 200)
    assert.match(index.headers.get('content-type'), /^text\/html/)
    assert.equal(await index.text(), '<h1>demo</h1>')

    const module = await fetch(`${baseURL}/app.js`, { method: 'HEAD' })
    assert.equal(module.status, 200)
    assert.match(module.headers.get('content-type'), /^text\/javascript/)
    assert.equal(await module.text(), '')
  })

  it('returns explicit errors for unsupported, missing, malformed, and escaping requests', async () => {
    const unsupported = await fetch(`${baseURL}/`, { method: 'POST' })
    assert.equal(unsupported.status, 405)
    assert.equal(unsupported.headers.get('allow'), 'GET, HEAD')

    assert.equal((await fetch(`${baseURL}/missing.js`)).status, 404)
    assert.equal((await rawRequest(baseURL, '/%E0%A4%A')).statusCode, 400)
    assert.equal((await rawRequest(baseURL, '/..%2fsecret.txt')).statusCode, 403)
  })

  it('keeps the real demo bootstrap compatible with the self-only script policy', async () => {
    const html = await readFile(new URL('./index.html', import.meta.url), 'utf8')
    assert.match(html, /<script type="module" src="\/examples\/ui-demo\/app\.mjs"><\/script>/)
    assert.doesNotMatch(html, /<script type="module">/)
  })
})

function rawRequest(baseURL, path) {
  const target = new URL(baseURL)
  return new Promise((resolve, reject) => {
    const request = sendRequest({ hostname: target.hostname, port: target.port, path }, resolve)
    request.on('error', reject)
    request.end()
  })
}
