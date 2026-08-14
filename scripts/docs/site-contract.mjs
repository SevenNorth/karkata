import { access } from 'node:fs/promises'
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve('website')
  const errors = await validatePagePairs(root)
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(`Documentation page pairs valid: ${pages.length}.\n`)
  }
}
