import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { validateStaticOutput } from './static-output.mjs'

const temporaryRoots = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('documentation static output', () => {
  it('accepts mirrored routes and base-prefixed local assets', async () => {
    const root = await createOutput({
      'index.html': '<script src="/karkata/assets/app.js"></script>',
      'en/index.html': '<link rel="stylesheet" href="/karkata/assets/app.css">',
      'guide/quick-start.html': '<a href="/karkata/ui/">UI</a>',
      'en/guide/quick-start.html': '<a href="/karkata/en/ui/">UI</a>',
      'ui/index.html': '<main>Karkata</main>',
      'en/ui/index.html': '<main>Karkata</main>',
      'guide/security.html': '<main>Security</main>',
      'en/guide/security.html': '<main>Security</main>',
    })

    assert.deepEqual(await validateStaticOutput(root, { base: '/karkata/' }), [])
  })

  it('rejects missing routes, unbased assets, and remote executable resources', async () => {
    const root = await createOutput({
      'index.html': [
        '<script src="/assets/app.js"></script>',
        '<link rel="stylesheet" href="https://cdn.example/app.css">',
      ].join(''),
    })

    const errors = await validateStaticOutput(root, { base: '/karkata/' })
    assert.ok(errors.some((error) => error.includes('en/index.html')))
    assert.ok(errors.some((error) => error.includes('/assets/app.js')))
    assert.ok(errors.some((error) => error.includes('https://cdn.example/app.css')))
  })
})

async function createOutput(files) {
  const root = await mkdtemp(join(tmpdir(), 'karkata-docs-output-'))
  temporaryRoots.push(root)
  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(root, relativePath)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, content)
  }
  return root
}
