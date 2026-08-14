import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { pages, normalizeDocsBase } from '../../website/page-manifest.mjs'
import { validatePagePairs } from './site-contract.mjs'

const temporaryRoots = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('documentation site contract', () => {
  it('normalizes local and GitHub project bases', () => {
    assert.equal(normalizeDocsBase(undefined), '/')
    assert.equal(normalizeDocsBase(''), '/')
    assert.equal(normalizeDocsBase('/'), '/')
    assert.equal(normalizeDocsBase('/karkata'), '/karkata/')
    assert.equal(normalizeDocsBase('karkata/'), '/karkata/')
    assert.throws(() => normalizeDocsBase('https://example.com/karkata'), /path/)
    assert.throws(() => normalizeDocsBase('/karkata?token=value'), /path/)
  })

  it('declares the first-stage mirrored page IDs', () => {
    assert.deepEqual(pages.map((page) => page.id), ['home', 'quick-start', 'ui-overview', 'security'])
    assert.deepEqual(pages.map(({ zh, en }) => ({ zh, en })), [
      { zh: '/', en: '/en/' },
      { zh: '/guide/quick-start', en: '/en/guide/quick-start' },
      { zh: '/ui/', en: '/en/ui/' },
      { zh: '/guide/security', en: '/en/guide/security' },
    ])
  })

  it('reports a missing locale file by page ID', async () => {
    const root = await mkdtemp(join(tmpdir(), 'karkata-docs-contract-'))
    temporaryRoots.push(root)
    await mkdir(join(root, 'en'), { recursive: true })
    await writeFile(join(root, 'index.md'), '# 中文\n')

    const errors = await validatePagePairs(root, [{ id: 'home', zh: '/', en: '/en/' }])
    assert.deepEqual(errors, ['home: missing English page en/index.md'])
  })
})
