import { describe, expect, it } from 'vitest'
import { calculateImpulse } from './shake-detector'

describe('calculateImpulse', () => {
  it('recognizes a strong directional change as a shake', () => {
    expect(calculateImpulse([
      { x: 0, y: 9.8, z: 0 },
      { x: 15, y: -8, z: 12 }
    ])).toBeGreaterThan(20)
  })

  it('ignores a single gravity sample', () => {
    expect(calculateImpulse([{ x: 0, y: 9.8, z: 0 }])).toBeLessThan(5)
  })

  it('caps the protocol impulse at one hundred', () => {
    expect(calculateImpulse([
      { x: -100, y: -100, z: -100 },
      { x: 100, y: 100, z: 100 }
    ])).toBe(100)
  })
})
