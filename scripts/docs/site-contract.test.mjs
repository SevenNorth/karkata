import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { pages, normalizeDocsBase } from '../../website/page-manifest.mjs'
import { validatePagePairs, validateSiteContent } from './site-contract.mjs'

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

  it('declares the complete mirrored page IDs', () => {
    assert.deepEqual(pages.map((page) => page.id), [
      'home', 'quick-start', 'core', 'tools', 'streaming', 'human-input',
      'ui-overview', 'react', 'vue', 'web-component', 'openai-compatible', 'api', 'security',
    ])
    assert.deepEqual(pages.map(({ zh, en }) => ({ zh, en })), [
      { zh: '/', en: '/en/' },
      { zh: '/guide/quick-start', en: '/en/guide/quick-start' },
      { zh: '/guide/core', en: '/en/guide/core' },
      { zh: '/guide/tools', en: '/en/guide/tools' },
      { zh: '/guide/streaming', en: '/en/guide/streaming' },
      { zh: '/guide/human-input', en: '/en/guide/human-input' },
      { zh: '/ui/', en: '/en/ui/' },
      { zh: '/ui/react', en: '/en/ui/react' },
      { zh: '/ui/vue', en: '/en/ui/vue' },
      { zh: '/ui/web-component', en: '/en/ui/web-component' },
      { zh: '/provider/openai-compatible', en: '/en/provider/openai-compatible' },
      { zh: '/api/', en: '/en/api/' },
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

  it('reports invalid frontmatter, links, images, alt text, and suspected credentials', async () => {
    const root = await mkdtemp(join(tmpdir(), 'karkata-docs-content-'))
    temporaryRoots.push(root)
    await mkdir(join(root, 'en'), { recursive: true })
    await writeFile(join(root, 'index.md'), [
      '# Missing frontmatter',
      '[Broken](/missing)',
      '![](/images/missing.png)',
      'apiKey: sk-examplecredential123456',
    ].join('\n'))
    await writeFile(join(root, 'en', 'index.md'), [
      '---', 'title: English', 'description: Valid page', '---', '# English',
    ].join('\n'))

    const errors = await validateSiteContent(root, [{ id: 'home', zh: '/', en: '/en/' }])
    assert.deepEqual(errors, [
      'home: Chinese page requires title and description frontmatter',
      'home: Chinese page links to unknown route /missing',
      'home: Chinese page image requires alt text: /images/missing.png',
      'home: Chinese page references missing image images/missing.png',
      'home: Chinese page contains a suspected credential',
    ])
  })
})
