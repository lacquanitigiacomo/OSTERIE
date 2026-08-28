import type { ClientCommand } from '../../../../packages/protocol/src/index'
import { getImprevistoCard, type DirectEffect, type OpponentChoosesEffect } from '../../../../packages/game-content/src/index'
import { applyDirectEffects } from './effects'
import { drawImprevistoCard } from './imprevisti-deck'
import type { GameRng } from './rng'
import type { GamePlayer, GameState, RejectionCode } from './state'
import { advanceTurn } from './turn'

const IMPREVISTO_TILE_POSITIONS = new Set([3])
const IMPREVISTO_BASE_CHANCE = 0.15

export interface ApplyCommandResult {
  state: GameState
  rejection: RejectionCode | null
}

const withProcessedCommand = (state: GameState, commandId: string): GameState => ({
  ...state,
  processedCommandIds: [...state.processedCommandIds, commandId]
})

const accept = (state: GameState): ApplyCommandResult => ({
  state,
  rejection: null
})

const reject = (state: GameState, code: RejectionCode): ApplyCommandResult => ({
  state,
  rejection: code
})

const addPlayer = (state: GameState, command: Extract<ClientCommand, { type: 'player.join' }>): ApplyCommandResult => {
  if (state.status !== 'lobby') {
    return reject(state, 'GAME_ALREADY_STARTED')
  }

  if (state.players[command.playerId]) {
    return reject(state, 'ALREADY_JOINED')
  }

  const player: GamePlayer = {
    playerId: command.playerId,
    nickname: command.nickname,
    position: 0,
    budget: 30,
    drunkenness: 0,
    dignity: 10,
    energy: 10,
    stomach: 0,
    suspicion: 0,
    statusEffects: {}
  }

  return accept({
    ...withProcessedCommand(state, command.commandId),
    players: { ...state.players, [command.playerId]: player },
    playerOrder: [...state.playerOrder, command.playerId]
  })
}

const startGame = (state: GameState, command: Extract<ClientCommand, { type: 'game.start' }>): ApplyCommandResult => {
  if (!state.players[command.playerId]) {
    return reject(state, 'PLAYER_NOT_FOUND')
  }
  if (state.playerOrder[0] !== command.playerId) {
    return reject(state, 'NOT_HOST_PLAYER')
  }

  return accept({
    ...withProcessedCommand(state, command.commandId),
    status: 'playing',
    activePlayerId: state.playerOrder[0] ?? null
  })
}

const rollDice = (state: GameState, command: Extract<ClientCommand, { type: 'dice.roll' }>, rng: GameRng): ApplyCommandResult => {
  if (state.status !== 'playing' || state.activePlayerId !== command.playerId) {
    return reject(state, 'NOT_ACTIVE_PLAYER')
  }
  if (state.pendingEvent) {
    return reject(state, 'NOT_ACTIVE_PLAYER')
  }

  const dice: [number, number] = [rng.rollDie(), rng.rollDie()]
  if (dice.some((result) => !Number.isInteger(result) || result < 1 || result > 6)) {
    return reject(state, 'INVALID_DIE_ROLL')
  }

  const activePlayer = state.players[command.playerId]
  const modifier = activePlayer.statusEffects.nextRollModifier ?? 0
  const result = dice[0] + dice[1] + modifier
  const fromPosition = activePlayer.position
  const toPosition = Math.max(0, fromPosition + result)

  const moved = {
    ...withProcessedCommand(state, command.commandId),
    lastRoll: result,
    lastDice: dice,
    players: {
      ...state.players,
      [command.playerId]: {
        ...activePlayer,
        position: toPosition,
        statusEffects: { ...activePlayer.statusEffects, nextRollModifier: undefined }
      }
    }
  }

  const crossesImprevistoTile = [...IMPREVISTO_TILE_POSITIONS].some((tile) => fromPosition < tile && toPosition >= tile)
  const drawsRandomCard = !crossesImprevistoTile && rng.drawChance() < IMPREVISTO_BASE_CHANCE

  if (crossesImprevistoTile || drawsRandomCard) {
    const draw = drawImprevistoCard(moved, rng)
    return accept({
      ...moved,
      activePlayerId: command.playerId,
      imprevistiDeck: draw.deck,
      imprevistiDiscard: draw.discard,
      pendingEvent: { cardId: draw.cardId, playerId: command.playerId, phase: 'choosing' }
    })
  }

  const { nextPlayerId, state: advanced } = advanceTurn(moved, command.playerId)
  return accept({ ...advanced, activePlayerId: nextPlayerId })
}

const chooseEvent = (state: GameState, command: Extract<ClientCommand, { type: 'event.choose' }>, rng: GameRng): ApplyCommandResult => {
  const event = state.pendingEvent
  if (!event) return reject(state, 'NO_PENDING_EVENT')

  if (event.phase === 'choosing-for-other') {
    if (event.arbiterId !== command.playerId) return reject(state, 'NO_PENDING_EVENT')

    const chosen = event.options.find((option) => option.id === command.choiceId)
    if (!chosen) return reject(state, 'INVALID_EVENT_CHOICE')

    const stamped = withProcessedCommand(state, command.commandId)
    const resolvedState = applyDirectEffects(stamped, event.playerId, chosen.effects)
    const { nextPlayerId, state: advanced } = advanceTurn(resolvedState, event.playerId)

    return accept({ ...advanced, pendingEvent: null, activePlayerId: nextPlayerId })
  }

  if (event.phase !== 'choosing' || event.playerId !== command.playerId) {
    return reject(state, 'NO_PENDING_EVENT')
  }

  if (command.choiceId === 'save:scomoda' || command.choiceId === 'save:fai' || command.choiceId === 'save:bevi') {
    const savingAttempt = command.choiceId.slice('save:'.length) as 'scomoda' | 'fai' | 'bevi'
    return accept({
      ...withProcessedCommand(state, command.commandId),
      pendingVotes: {},
      pendingEvent: { cardId: event.cardId, playerId: event.playerId, phase: 'voting', savingAttempt }
    })
  }

  const card = getImprevistoCard(event.cardId)
  const option = card.options.find((candidate) => candidate.id === command.choiceId)
  if (!option) return reject(state, 'INVALID_EVENT_CHOICE')

  const delegated = option.effects.find((effect): effect is OpponentChoosesEffect => effect.type === 'opponentChooses')
  if (delegated) {
    const arbiterCandidates = state.playerOrder.filter((id) => id !== event.playerId)

    if (arbiterCandidates.length === 0) {
      // No one else at the table to delegate to (e.g. a one-player game): the
      // drawer decides for themselves, applying the first sub-option's effects.
      const stamped = withProcessedCommand(state, command.commandId)
      const resolvedState = applyDirectEffects(stamped, event.playerId, delegated.options[0].effects)
      const { nextPlayerId, state: advanced } = advanceTurn(resolvedState, event.playerId)

      return accept({ ...advanced, pendingEvent: null, activePlayerId: nextPlayerId })
    }

    const arbiterId = rng.pickArbiter(arbiterCandidates)
    return accept({
      ...withProcessedCommand(state, command.commandId),
      pendingEvent: {
        cardId: event.cardId,
        playerId: event.playerId,
        phase: 'choosing-for-other',
        arbiterId,
        options: delegated.options
      }
    })
  }

  const stamped = withProcessedCommand(state, command.commandId)
  const resolvedState = applyDirectEffects(stamped, event.playerId, option.effects as DirectEffect[])
  const { nextPlayerId, state: advanced } = advanceTurn(resolvedState, event.playerId)

  return accept({ ...advanced, pendingEvent: null, activePlayerId: nextPlayerId })
}

const tallyVotes = (votes: Record<string, 'valid' | 'invalid'>, eligibleVoters: string[]): 'valid' | 'invalid' | 'pending' => {
  const cast = eligibleVoters.map((id) => votes[id]).filter((v): v is 'valid' | 'invalid' => v !== undefined)
  const validCount = cast.filter((v) => v === 'valid').length
  const invalidCount = cast.length - validCount
  const remaining = eligibleVoters.length - cast.length

  if (validCount > invalidCount + remaining) return 'valid'
  if (invalidCount >= validCount + remaining) return 'invalid'
  return 'pending'
}

const voteOnSave = (state: GameState, command: Extract<ClientCommand, { type: 'event.vote' }>, rng: GameRng): ApplyCommandResult => {
  const event = state.pendingEvent
  if (!event || event.phase !== 'voting') return reject(state, 'NO_PENDING_EVENT')
  if (command.playerId === event.playerId) return reject(state, 'NOT_ACTIVE_PLAYER')
  if (!state.players[command.playerId]) return reject(state, 'PLAYER_NOT_FOUND')

  const stamped = withProcessedCommand(state, command.commandId)
  const pendingVotes = { ...stamped.pendingVotes, [command.playerId]: command.vote }
  const eligibleVoters = stamped.playerOrder.filter((id) => id !== event.playerId)
  const tally = tallyVotes(pendingVotes, eligibleVoters)

  if (tally === 'pending') {
    return accept({ ...stamped, pendingVotes })
  }

  const card = getImprevistoCard(event.cardId)
  const withVotes = { ...stamped, pendingVotes }
  const resolvedState = tally === 'valid' ? withVotes : applyDirectEffects(withVotes, event.playerId, card.saveFallbackEffects)
  const { nextPlayerId, state: advanced } = advanceTurn(resolvedState, event.playerId)

  return accept({ ...advanced, pendingVotes: {}, pendingEvent: null, activePlayerId: nextPlayerId })
}

export const applyCommand = (state: GameState, command: ClientCommand, rng: GameRng): ApplyCommandResult => {
  if (state.processedCommandIds.includes(command.commandId)) {
    return accept(state)
  }

  if (command.roomCode !== state.roomCode) {
    return reject(state, 'ROOM_MISMATCH')
  }

  switch (command.type) {
    case 'player.join':
      return addPlayer(state, command)
    case 'game.start':
      return startGame(state, command)
    case 'dice.roll':
      return rollDice(state, command, rng)
    case 'event.choose':
      return chooseEvent(state, command, rng)
    case 'event.vote':
      return voteOnSave(state, command, rng)
  }
}
