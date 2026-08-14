import { createReadStream, realpathSync } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '..', '..')
const DEFAULT_PORT = 4173
const HOST = '127.0.0.1'
const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
])

export function createDemoServer({ root, indexFile = 'index.html' }) {
  const resolvedRoot = realpathSync(resolve(root))
  return createServer(async (request, response) => {
    setSecurityHeaders(response)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD')
      respond(response, 405, 'Method Not Allowed')
      return
    }

    let pathname
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    } catch {
      respond(response, 400, 'Bad Request')
      return
    }

    const relativePath = pathname === '/' ? indexFile : `.${pathname}`
    const target = resolve(resolvedRoot, relativePath)
    if (!isWithinRoot(resolvedRoot, target)) {
      respond(response, 403, 'Forbidden')
      return
    }

    let file
    let details
    try {
      file = await realpath(target)
      details = await stat(file)
    } catch {
      respond(response, 404, 'Not Found')
      return
    }
    if (!isWithinRoot(resolvedRoot, file)) {
      respond(response, 403, 'Forbidden')
      return
    }
    if (!details.isFile()) {
      respond(response, 404, 'Not Found')
      return
    }

    response.statusCode = 200
    response.setHeader('Content-Type', CONTENT_TYPES.get(extname(file)) ?? 'application/octet-stream')
    response.setHeader('Content-Length', details.size)
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    createReadStream(file)
      .on('error', () => {
        if (!response.headersSent) respond(response, 500, 'Internal Server Error')
        else response.destroy()
      })
      .pipe(response)
  })
}

export async function startDemoServer({ port = DEFAULT_PORT } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('PORT must be an integer from 1 to 65535')
  const server = createDemoServer({
    root: repositoryRoot,
    indexFile: 'examples/ui-demo/index.html',
  })
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(port, HOST, resolvePromise)
  })
  console.log(`Karkata UI demo: http://${HOST}:${port}`)
  return server
}

function isWithinRoot(root, target) {
  return target === root || target.startsWith(`${root}${sep}`)
}

function setSecurityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'")
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

function respond(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(body)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = process.env.PORT === undefined ? DEFAULT_PORT : Number(process.env.PORT)
  startDemoServer({ port }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
