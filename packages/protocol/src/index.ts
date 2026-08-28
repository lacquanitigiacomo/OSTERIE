import { z } from 'zod'

const envelope = {
  protocolVersion: z.literal(1),
  commandId: z.string().min(1),
  roomCode: z.string().length(4),
  playerId: z.string().min(1)
}

export const clientCommandSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelope,
    type: z.literal('player.join'),
    nickname: z.string().trim().min(1).max(20)
  }),
  z.object({ ...envelope, type: z.literal('game.start') }),
  z.object({
    ...envelope,
    type: z.literal('dice.roll'),
    impulse: z.number().min(0).max(100)
  }),
  z.object({
    ...envelope,
    type: z.literal('event.choose'),
    choiceId: z.string().min(1)
  }),
  z.object({
    ...envelope,
    type: z.literal('event.vote'),
    vote: z.enum(['valid', 'invalid'])
  })
])

export const parseClientCommand = (input: unknown) => clientCommandSchema.parse(input)

export type ClientCommand = z.infer<typeof clientCommandSchema>

export interface PublicPlayerState {
  playerId: string
  nickname: string
  position: number
}

export type PendingEvent =
  | { cardId: string; playerId: string; phase: 'choosing' }
  | {
      cardId: string
      playerId: string
      phase: 'choosing-for-other'
      arbiterId: string
      options: [{ id: string; label: string }, { id: string; label: string }]
    }
  | { cardId: string; playerId: string; phase: 'voting'; savingAttempt: 'scomoda' | 'fai' | 'bevi' }

export interface PublicGameState {
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  activePlayerId: string | null
  players: PublicPlayerState[]
  lastRoll: number | null
  lastDice: [number, number] | null
  pendingEvent: PendingEvent | null
}

export interface PrivatePlayerState {
  roomCode: string
  playerId: string
  status: 'lobby' | 'playing' | 'finished'
  activePlayerId: string | null
  isMyTurn: boolean
  lastRoll: number | null
  lastDice: [number, number] | null
  budget: number
  drunkenness: number
  dignity: number
}

export type ServerEvent =
  | {
      type: 'game.public-state'
      protocolVersion: 1
      state: PublicGameState
    }
  | {
      type: 'player.private-state'
      protocolVersion: 1
      state: PrivatePlayerState
    }
  | {
      type: 'command.rejected'
      protocolVersion: 1
      commandId: string
      code: string
    }
