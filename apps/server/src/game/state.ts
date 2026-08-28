import { imprevistiCatalog } from '../../../../packages/game-content/src/index'
import type { DirectEffect } from '../../../../packages/game-content/src/index'

export interface GamePlayer {
  playerId: string
  nickname: string
  position: number
  budget: number
  drunkenness: number
  dignity: number
  energy: number
  stomach: number
  suspicion: number
  statusEffects: {
    skipNextTurn?: boolean
    inputDelayMs?: number
    nextRollModifier?: number
  }
}

export type RejectionCode =
  | 'ALREADY_JOINED'
  | 'GAME_ALREADY_STARTED'
  | 'INVALID_DIE_ROLL'
  | 'NOT_ACTIVE_PLAYER'
  | 'NOT_HOST_PLAYER'
  | 'NO_PENDING_EVENT'
  | 'INVALID_EVENT_CHOICE'
  | 'PLAYER_NOT_FOUND'
  | 'ROOM_MISMATCH'
  | 'UNSUPPORTED_COMMAND'

export type PendingEvent =
  | { cardId: string; playerId: string; phase: 'choosing' }
  | {
      cardId: string
      playerId: string
      phase: 'choosing-for-other'
      arbiterId: string
      options: [
        { id: string; label: string; effects: DirectEffect[] },
        { id: string; label: string; effects: DirectEffect[] }
      ]
    }
  | { cardId: string; playerId: string; phase: 'voting'; savingAttempt: 'scomoda' | 'fai' | 'bevi' }

export interface GameState {
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  activePlayerId: string | null
  players: Record<string, GamePlayer>
  playerOrder: string[]
  processedCommandIds: string[]
  lastRoll: number | null
  lastDice: [number, number] | null
  pendingEvent: PendingEvent | null
  imprevistiDeck: string[]
  imprevistiDiscard: string[]
  pendingVotes: Record<string, 'valid' | 'invalid'>
}

export const createGame = (roomCode: string): GameState => ({
  roomCode,
  status: 'lobby',
  activePlayerId: null,
  players: {},
  playerOrder: [],
  processedCommandIds: [],
  lastRoll: null,
  lastDice: null,
  pendingEvent: null,
  imprevistiDeck: [],
  imprevistiDiscard: imprevistiCatalog.map((card) => card.id),
  pendingVotes: {}
})
