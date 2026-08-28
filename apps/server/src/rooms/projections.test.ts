import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from '../game/state'
import { projectPrivate, projectPublic } from './projections'

const baseState = (): GameState => ({
  ...createGame('ABCD'),
  status: 'playing',
  playerOrder: ['p1', 'p2'],
  activePlayerId: 'p1',
  players: {
    p1: { playerId: 'p1', nickname: 'Uno', position: 3, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} },
    p2: { playerId: 'p2', nickname: 'Due', position: 0, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} }
  }
})

describe('projectPublic', () => {
  it('passes a choosing pendingEvent through unchanged', () => {
    const state = { ...baseState(), pendingEvent: { cardId: '01', playerId: 'p1', phase: 'choosing' as const } }
    expect(projectPublic(state).pendingEvent).toEqual({ cardId: '01', playerId: 'p1', phase: 'choosing' })
  })

  it('strips effects from a choosing-for-other pendingEvent', () => {
    const state: GameState = {
      ...baseState(),
      pendingEvent: {
        cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
        options: [
          { id: 'a', label: 'Opzione A', effects: [{ type: 'statDelta', stat: 'dignity', delta: -1 }] },
          { id: 'b', label: 'Opzione B', effects: [{ type: 'statDelta', stat: 'suspicion', delta: 1 }] }
        ]
      }
    }
    expect(projectPublic(state).pendingEvent).toEqual({
      cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
      options: [{ id: 'a', label: 'Opzione A' }, { id: 'b', label: 'Opzione B' }]
    })
  })
})

describe('projectPrivate', () => {
  it('no longer exposes a pendingEvent field', () => {
    const state = { ...baseState(), pendingEvent: { cardId: '01', playerId: 'p1', phase: 'choosing' as const } }
    const result = projectPrivate(state, 'p1')

    expect(result).not.toHaveProperty('pendingEvent')
  })
})
