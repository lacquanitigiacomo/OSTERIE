import type { DirectEffect } from '../../../../packages/game-content/src/index'
import type { GamePlayer, GameState } from './state'

export const applyDirectEffects = (state: GameState, playerId: string, effects: DirectEffect[]): GameState =>
  effects.reduce((current, effect) => applyOne(current, playerId, effect), state)

const applyOne = (state: GameState, playerId: string, effect: DirectEffect): GameState => {
  const player = state.players[playerId]

  switch (effect.type) {
    case 'statDelta':
      return withPlayer(state, playerId, { ...player, [effect.stat]: Math.max(0, player[effect.stat] + effect.delta) })
    case 'move':
      return withPlayer(state, playerId, { ...player, position: Math.max(0, player.position + effect.spaces) })
    case 'skipNextTurn':
      return withPlayer(state, playerId, { ...player, statusEffects: { ...player.statusEffects, skipNextTurn: true } })
    case 'delayNextInput':
      return withPlayer(state, playerId, { ...player, statusEffects: { ...player.statusEffects, inputDelayMs: effect.ms } })
    case 'nextRollModifier':
      return withPlayer(state, playerId, { ...player, statusEffects: { ...player.statusEffects, nextRollModifier: effect.delta } })
    case 'swapPositionWithPlayerBehind': {
      const behind = findPlayerBehind(state, playerId)
      if (!behind) return state
      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: { ...player, position: behind.position },
          [behind.playerId]: { ...behind, position: player.position }
        }
      }
    }
  }
}

const withPlayer = (state: GameState, playerId: string, player: GamePlayer): GameState => ({
  ...state,
  players: { ...state.players, [playerId]: player }
})

const findPlayerBehind = (state: GameState, playerId: string): GamePlayer | null => {
  const player = state.players[playerId]
  const candidates = state.playerOrder
    .filter((id) => id !== playerId)
    .map((id) => state.players[id])
    .filter((other) => other.position < player.position)

  if (candidates.length === 0) return null
  return candidates.reduce((closest, other) => (other.position > closest.position ? other : closest))
}
