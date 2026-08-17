import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pages } from '../../website/page-manifest.mjs'

const requiredRoutes = staticRoutesForPages(pages)

export function staticRoutesForPages(pageManifest) {
  return pageManifest.flatMap(({ zh, en }) => [routeToOutput(zh), routeToOutput(en)])
}

export async function validateStaticOutput(root, { base, routes = requiredRoutes }) {
  const errors = []
  const files = await listFiles(root)
  const fileSet = new Set(files)
  for (const route of routes) {
    if (!fileSet.has(route)) errors.push(`missing static route ${route}`)
  }

  for (const path of files.filter((file) => file.endsWith('.html'))) {
    const html = await readFile(join(root, path), 'utf8')
    for (const match of html.matchAll(/(?:src|href)="(\/(?!\/)[^"]*)"/g)) {
      const reference = match[1]
      if (!reference.startsWith(base)) errors.push(`${path}: unbased reference ${reference}`)
    }
    for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="(https?:\/\/[^"']+)"/gi)) {
      errors.push(`${path}: remote executable resource ${match[1]}`)
    }
  }
  return errors
}

function routeToOutput(route) {
  const path = route.replace(/^\//, '')
  if (!path || path.endsWith('/')) return `${path}index.html`
  return `${path}.html`
}

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(root, target))
    else if (entry.isFile()) files.push(relative(root, target).replaceAll('\\', '/'))
  }
  return files
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve('website/.vitepress/dist')
  const errors = await validateStaticOutput(root, { base: '/karkata/' })
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(`Documentation static output valid: ${requiredRoutes.length} routes.\n`)
  }
}
