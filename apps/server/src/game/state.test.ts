import { describe, expect, it } from 'vitest'
import { imprevistiCatalog } from '../../../../packages/game-content/src/index'
import { createGame } from './state'

describe('createGame', () => {
  it('seeds the Imprevisti discard with the full catalog and starts with an empty deck', () => {
    const game = createGame('ABCD')

    expect(game.imprevistiDeck).toEqual([])
    expect(game.imprevistiDiscard.sort()).toEqual(imprevistiCatalog.map((card) => card.id).sort())
    expect(game.pendingVotes).toEqual({})
  })
})
