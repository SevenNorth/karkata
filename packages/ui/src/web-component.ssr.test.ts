import { describe, expect, it } from 'vitest'
import { defineKarkataPanel } from './web-component.js'

describe('web component SSR entry', () => {
  it('can be imported without DOM globals and fails only when registration is requested', () => {
    expect(typeof defineKarkataPanel).toBe('function')
    expect(() => defineKarkataPanel()).toThrow('Custom Elements and Shadow DOM are required')
  })
})
