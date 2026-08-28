import type { PrivatePlayerState, PublicGameState } from '../../../../packages/protocol/src/index'
import type { GameState } from '../game/state'

const toPublicPendingEvent = (pendingEvent: GameState['pendingEvent']): PublicGameState['pendingEvent'] => {
  if (!pendingEvent) return null
  if (pendingEvent.phase === 'choosing-for-other') {
    return {
      cardId: pendingEvent.cardId,
      playerId: pendingEvent.playerId,
      phase: 'choosing-for-other',
      arbiterId: pendingEvent.arbiterId,
      options: [
        { id: pendingEvent.options[0].id, label: pendingEvent.options[0].label },
        { id: pendingEvent.options[1].id, label: pendingEvent.options[1].label }
      ]
    }
  }
  return pendingEvent
}

export const projectPublic = (state: GameState): PublicGameState => ({
  roomCode: state.roomCode,
  status: state.status,
  activePlayerId: state.activePlayerId,
  lastRoll: state.lastRoll,
  lastDice: state.lastDice,
  pendingEvent: toPublicPendingEvent(state.pendingEvent),
  players: state.playerOrder.map((playerId) => {
    const player = state.players[playerId]
    return {
      playerId: player.playerId,
      nickname: player.nickname,
      position: player.position
    }
  })
})

export const projectPrivate = (state: GameState, playerId: string): PrivatePlayerState | null => {
  const player = state.players[playerId]
  if (!player) return null

  return {
    roomCode: state.roomCode,
    playerId: player.playerId,
    status: state.status,
    activePlayerId: state.activePlayerId,
    isMyTurn: state.status === 'playing' && state.activePlayerId === playerId,
    lastRoll: state.lastRoll,
    lastDice: state.lastDice,
    budget: player.budget,
    drunkenness: player.drunkenness,
    dignity: player.dignity
  }
}
