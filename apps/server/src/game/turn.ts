import type { GameState } from './state'

export interface AdvanceTurnResult {
  nextPlayerId: string | null
  state: GameState
}

export const advanceTurn = (state: GameState, fromPlayerId: string): AdvanceTurnResult => {
  const order = state.playerOrder
  if (order.length === 0) return { nextPlayerId: null, state }

  let current = state
  let index = order.indexOf(fromPlayerId)

  for (let step = 0; step < order.length; step += 1) {
    index = (index + 1) % order.length
    const candidateId = order[index]
    const candidate = current.players[candidateId]

    if (!candidate.statusEffects.skipNextTurn) {
      return { nextPlayerId: candidateId, state: current }
    }

    current = {
      ...current,
      players: {
        ...current.players,
        [candidateId]: { ...candidate, statusEffects: { ...candidate.statusEffects, skipNextTurn: undefined } }
      }
    }
  }

  return { nextPlayerId: fromPlayerId, state: current }
}
