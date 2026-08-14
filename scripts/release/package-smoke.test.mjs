import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertPackedFiles } from './package-smoke.mjs'

const baseFiles = [
  'LICENSE',
  'README.en.md',
  'README.md',
  'dist/index.d.ts',
  'dist/index.js',
  'package.json',
]

describe('release package smoke', () => {
  it('accepts the documented release file set', () => {
    assert.doesNotThrow(() => assertPackedFiles('core', baseFiles))
    assert.doesNotThrow(() => assertPackedFiles('ui', [
      ...baseFiles,
      'dist/web-component.d.ts',
      'dist/web-component.js',
    ]))
  })

  it('rejects missing documentation and unexpected package files', () => {
    assert.throws(
      () => assertPackedFiles('core', baseFiles.filter((path) => path !== 'README.en.md')),
      /README\.en\.md/,
    )
    for (const unexpected of ['src/Agent.ts', 'dist/Agent.test.js', '.env', 'tsconfig.tsbuildinfo']) {
      assert.throws(
        () => assertPackedFiles('core', [...baseFiles, unexpected]),
        new RegExp(unexpected.replaceAll('.', '\\.')),
      )
    }
  })
})
