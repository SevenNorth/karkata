import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseRealProviderConfig, runRealProviderSmoke } from './real-provider-smoke.mjs'

const validEnvironment = {
  KARKATA_BASE_URL: 'https://provider.example/v1?private=value',
  KARKATA_API_KEY: 'secret-key-value',
  KARKATA_MODEL: 'example-model',
}

describe('real provider smoke', () => {
  it('requires named configuration without disclosing values', () => {
    assert.throws(
      () => parseRealProviderConfig({ KARKATA_API_KEY: 'must-not-appear' }),
      (error) => {
        assert.match(error.message, /KARKATA_BASE_URL/)
        assert.match(error.message, /KARKATA_MODEL/)
        assert.doesNotMatch(error.message, /must-not-appear/)
        return true
      },
    )
  })

  it('validates the endpoint and streaming switch', () => {
    assert.throws(
      () => parseRealProviderConfig({ ...validEnvironment, KARKATA_BASE_URL: 'file:///tmp/provider' }),
      /KARKATA_BASE_URL/,
    )
    assert.throws(
      () => parseRealProviderConfig({ ...validEnvironment, KARKATA_STREAMING: 'sometimes' }),
      /KARKATA_STREAMING/,
    )
    assert.equal(parseRealProviderConfig({ ...validEnvironment, KARKATA_STREAMING: 'true' }).streaming, true)
    assert.equal(parseRealProviderConfig(validEnvironment).safeTarget, 'https://provider.example')
  })

  it('reports only safe metadata for a completed response', async () => {
    const output = []
    const prompts = []
    let disposed = false
    await runRealProviderSmoke({
      env: validEnvironment,
      now: (() => { let value = 100; return () => value += 25 })(),
      output: (line) => output.push(line),
      createAgent: (config) => {
        assert.equal(config.apiKey, validEnvironment.KARKATA_API_KEY)
        return {
          async send(prompt) {
            prompts.push(prompt)
            return { status: 'completed', runId: 'run', content: 'private response body', steps: 1 }
          },
          async dispose() { disposed = true },
        }
      },
    })

    assert.equal(prompts.length, 1)
    assert.equal(disposed, true)
    assert.match(output.join('\n'), /provider\.example/)
    assert.match(output.join('\n'), /25ms/)
    assert.doesNotMatch(output.join('\n'), /secret-key-value|private response body|private=value/)
  })
})
