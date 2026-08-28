import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from './state'
import { advanceTurn } from './turn'

const withPlayers = (...ids: string[]): GameState => {
  let state = createGame('ABCD')
  for (const id of ids) {
    state = {
      ...state,
      playerOrder: [...state.playerOrder, id],
      players: {
        ...state.players,
        [id]: { playerId: id, nickname: id, position: 0, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} }
      }
    }
  }
  return state
}

describe('advanceTurn', () => {
  it('moves to the next player in order', () => {
    const state = withPlayers('p1', 'p2', 'p3')
    const { nextPlayerId } = advanceTurn(state, 'p1')

    expect(nextPlayerId).toBe('p2')
  })

  it('wraps around to the first player', () => {
    const state = withPlayers('p1', 'p2')
    const { nextPlayerId } = advanceTurn(state, 'p2')

    expect(nextPlayerId).toBe('p1')
  })

  it('skips a player flagged with skipNextTurn and clears the flag', () => {
    let state = withPlayers('p1', 'p2', 'p3')
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, statusEffects: { skipNextTurn: true } } } }

    const { nextPlayerId, state: resolved } = advanceTurn(state, 'p1')

    expect(nextPlayerId).toBe('p3')
    expect(resolved.players.p2.statusEffects.skipNextTurn).toBeUndefined()
  })

  it('keeps the turn with the current player instead of stalling when everyone is flagged skipNextTurn', () => {
    let state = withPlayers('p1', 'p2')
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, statusEffects: { skipNextTurn: true } },
        p2: { ...state.players.p2, statusEffects: { skipNextTurn: true } }
      }
    }

    const { nextPlayerId, state: resolved } = advanceTurn(state, 'p1')

    expect(nextPlayerId).toBe('p1')
    expect(resolved.players.p1.statusEffects.skipNextTurn).toBeUndefined()
    expect(resolved.players.p2.statusEffects.skipNextTurn).toBeUndefined()
  })
})
