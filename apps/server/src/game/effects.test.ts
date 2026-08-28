import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from './state'
import { applyDirectEffects } from './effects'

const withPlayers = (...ids: string[]): GameState => {
  let state = createGame('ABCD')
  for (const id of ids) {
    state = {
      ...state,
      playerOrder: [...state.playerOrder, id],
      players: {
        ...state.players,
        [id]: { playerId: id, nickname: id, position: 5, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} }
      }
    }
  }
  return state
}

describe('applyDirectEffects', () => {
  it('applies a statDelta and clamps at zero', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'statDelta', stat: 'budget', delta: -100 }])

    expect(result.players.p1.budget).toBe(0)
  })

  it('applies a move and clamps at zero', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'move', spaces: -100 }])

    expect(result.players.p1.position).toBe(0)
  })

  it('sets skipNextTurn', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'skipNextTurn' }])

    expect(result.players.p1.statusEffects.skipNextTurn).toBe(true)
  })

  it('sets delayNextInput', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'delayNextInput', ms: 3_000 }])

    expect(result.players.p1.statusEffects.inputDelayMs).toBe(3_000)
  })

  it('sets nextRollModifier', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'nextRollModifier', delta: -1 }])

    expect(result.players.p1.statusEffects.nextRollModifier).toBe(-1)
  })

  it('swaps position with the closest player behind', () => {
    let state = withPlayers('p1', 'p2', 'p3')
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, position: 10 },
        p2: { ...state.players.p2, position: 4 },
        p3: { ...state.players.p3, position: 7 }
      }
    }
    const result = applyDirectEffects(state, 'p1', [{ type: 'swapPositionWithPlayerBehind' }])

    expect(result.players.p1.position).toBe(7)
    expect(result.players.p3.position).toBe(10)
    expect(result.players.p2.position).toBe(4)
  })

  it('leaves position unchanged when swapping and no one is behind', () => {
    let state = withPlayers('p1', 'p2')
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, position: 0 }, p2: { ...state.players.p2, position: 10 } } }
    const result = applyDirectEffects(state, 'p1', [{ type: 'swapPositionWithPlayerBehind' }])

    expect(result.players.p1.position).toBe(0)
  })

  it('applies multiple effects in order', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [
      { type: 'statDelta', stat: 'dignity', delta: -2 },
      { type: 'move', spaces: 2 }
    ])

    expect(result.players.p1.dignity).toBe(8)
    expect(result.players.p1.position).toBe(7)
  })
})
