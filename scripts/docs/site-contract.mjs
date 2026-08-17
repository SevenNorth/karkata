import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pages } from '../../website/page-manifest.mjs'

export async function validatePagePairs(root, pageManifest = pages) {
  const errors = []
  for (const page of pageManifest) {
    await checkPage(root, page.id, 'Chinese', routeToMarkdown(page.zh), errors)
    await checkPage(root, page.id, 'English', routeToMarkdown(page.en), errors)
  }
  return errors
}

export async function validateSiteContent(root, pageManifest = pages) {
  const errors = []
  const routes = new Set(pageManifest.flatMap(({ zh, en }) => [normalizeRoute(zh), normalizeRoute(en)]))
  for (const page of pageManifest) {
    await checkContent(root, page.id, 'Chinese', routeToMarkdown(page.zh), routes, errors)
    await checkContent(root, page.id, 'English', routeToMarkdown(page.en), routes, errors)
  }
  return errors
}

export function routeToMarkdown(route) {
  const path = route.replace(/^\//, '')
  if (!path || path.endsWith('/')) return `${path}index.md`
  return `${path}.md`
}

async function checkPage(root, id, locale, relativePath, errors) {
  try {
    await access(resolve(root, relativePath))
  } catch {
    errors.push(`${id}: missing ${locale} page ${relativePath}`)
  }
}

async function checkContent(root, id, locale, relativePath, routes, errors) {
  let content
  try {
    content = await readFile(resolve(root, relativePath), 'utf8')
  } catch {
    return
  }

  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1] ?? ''
  if (!/^title:\s*\S.+$/m.test(frontmatter) || !/^description:\s*\S.+$/m.test(frontmatter)) {
    errors.push(`${id}: ${locale} page requires title and description frontmatter`)
  }

  for (const match of content.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1]
    if (!target?.startsWith('/') || target.startsWith('//')) continue
    const route = normalizeRoute(target.split(/[?#]/, 1)[0])
    if (!routes.has(route)) errors.push(`${id}: ${locale} page links to unknown route ${target}`)
  }

  for (const match of content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const [, alt = '', target = ''] = match
    if (!alt.trim()) errors.push(`${id}: ${locale} page image requires alt text: ${target}`)
    if (!target.startsWith('/') || target.startsWith('//')) continue
    const asset = target.replace(/^\//, '').split(/[?#]/, 1)[0]
    try {
      await access(resolve(root, 'public', asset))
    } catch {
      errors.push(`${id}: ${locale} page references missing image ${asset}`)
    }
  }

  if (/\bsk-[A-Za-z0-9_-]{16,}\b/.test(content)) {
    errors.push(`${id}: ${locale} page contains a suspected credential`)
  }
}

function normalizeRoute(route) {
  const withoutQuery = route.split(/[?#]/, 1)[0] || '/'
  if (withoutQuery === '/') return '/'
  return withoutQuery.replace(/\/$/, '')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve('website')
  const errors = [
    ...await validatePagePairs(root),
    ...await validateSiteContent(root),
  ]
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(`Documentation page pairs valid: ${pages.length}.\n`)
  }
}
