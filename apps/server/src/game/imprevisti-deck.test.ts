import { describe, expect, it } from 'vitest'
import { createGame } from './state'
import { drawImprevistoCard } from './imprevisti-deck'
import type { GameRng } from './rng'

const identityRng: GameRng = {
  rollDie: () => 1,
  drawChance: () => 1,
  shuffle: (items) => [...items],
  pickArbiter: (candidates) => candidates[0]
}

describe('drawImprevistoCard', () => {
  it('reshuffles the discard into the deck on the very first draw', () => {
    const game = createGame('ABCD')
    const draw = drawImprevistoCard(game, identityRng)

    expect(draw.cardId).toBe('01')
    expect(draw.deck).toHaveLength(7)
    expect(draw.discard).toContain('01')
  })

  it('draws from an existing deck without reshuffling', () => {
    const game = { ...createGame('ABCD'), imprevistiDeck: ['22', '30'], imprevistiDiscard: ['01', '02', '03', '08', '27', '36'] }
    const draw = drawImprevistoCard(game, identityRng)

    expect(draw.cardId).toBe('22')
    expect(draw.deck).toEqual(['30'])
    expect(draw.discard).toEqual(['01', '02', '03', '08', '27', '36', '22'])
  })

  it('reshuffles once the deck runs out', () => {
    const game = { ...createGame('ABCD'), imprevistiDeck: [], imprevistiDiscard: ['08', '22'] }
    const draw = drawImprevistoCard(game, identityRng)

    expect(draw.cardId).toBe('08')
    expect(draw.deck).toEqual(['22'])
    expect(draw.discard).toEqual(['08'])
  })
})
