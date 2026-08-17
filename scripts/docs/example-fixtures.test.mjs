import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

describe('documentation example fixtures', () => {
  it('type-checks every public integration example', () => {
    const tsc = resolve('node_modules/typescript/bin/tsc')
    const result = spawnSync(process.execPath, [tsc, '-p', 'website/examples/tsconfig.json'], {
      cwd: resolve('.'),
      encoding: 'utf8',
      windowsHide: true,
    })

    assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'))
  })
})
