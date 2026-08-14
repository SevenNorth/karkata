import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const packageNames = ['core', 'openai-compatible', 'javascript', 'ui']
const repository = {
  type: 'git',
  url: 'git+https://github.com/SevenNorth/karkata.git',
}

describe('release package metadata', () => {
  it('publishes every workspace with complete and consistent metadata', async () => {
    for (const packageName of packageNames) {
      const packageRoot = join(repositoryRoot, 'packages', packageName)
      const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))

      assert.equal(manifest.license, 'MIT', `${packageName}: license`)
      assert.equal(manifest.engines?.node, '>=20', `${packageName}: Node engine`)
      assert.equal(manifest.publishConfig?.access, 'public', `${packageName}: public scope`)
      assert.deepEqual(manifest.repository, {
        ...repository,
        directory: `packages/${packageName}`,
      }, `${packageName}: repository`)
      assert.equal(manifest.homepage, 'https://github.com/SevenNorth/karkata#readme')
      assert.deepEqual(manifest.bugs, { url: 'https://github.com/SevenNorth/karkata/issues' })
      assert.equal(typeof manifest.description, 'string')
      assert.ok(manifest.description.length > 20, `${packageName}: description`)
      assert.ok(Array.isArray(manifest.keywords) && manifest.keywords.length >= 3, `${packageName}: keywords`)
      assert.deepEqual(manifest.files, ['dist', 'README.md', 'README.en.md', 'LICENSE'])
    }
  })

  it('ships identical licenses and bilingual package documentation', async () => {
    const rootLicense = await readFile(join(repositoryRoot, 'LICENSE'), 'utf8')
    assert.match(rootLicense, /MIT License/)

    for (const packageName of packageNames) {
      const packageRoot = join(repositoryRoot, 'packages', packageName)
      assert.equal(await readFile(join(packageRoot, 'LICENSE'), 'utf8'), rootLicense)

      const chineseReadme = await readFile(join(packageRoot, 'README.md'), 'utf8')
      const englishReadme = await readFile(join(packageRoot, 'README.en.md'), 'utf8')
      assert.match(chineseReadme, /English/)
      assert.match(englishReadme, /中文/)
      assert.match(chineseReadme, new RegExp(`@karkata/${escapeRegExp(packageName)}`))
      assert.match(englishReadme, new RegExp(`@karkata/${escapeRegExp(packageName)}`))
    }
  })
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
