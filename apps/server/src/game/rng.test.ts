import { describe, expect, it } from 'vitest'
import { createRandomRng } from './rng'

describe('createRandomRng', () => {
  it('rolls a die between one and six', () => {
    const rng = createRandomRng()
    for (let i = 0; i < 50; i += 1) {
      const value = rng.rollDie()
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(6)
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('returns a draw chance between zero and one', () => {
    const rng = createRandomRng()
    const value = rng.drawChance()
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('shuffles without losing or duplicating items', () => {
    const rng = createRandomRng()
    const shuffled = rng.shuffle(['a', 'b', 'c', 'd'])
    expect(shuffled).toHaveLength(4)
    expect([...shuffled].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('picks an arbiter from the candidate list', () => {
    const rng = createRandomRng()
    expect(['p1', 'p2']).toContain(rng.pickArbiter(['p1', 'p2']))
  })
})
