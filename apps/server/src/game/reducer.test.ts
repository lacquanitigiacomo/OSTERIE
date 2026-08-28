import { describe, expect, it } from 'vitest'
import type { ClientCommand } from '../../../../packages/protocol/src/index'
import { applyCommand } from './reducer'
import type { GameRng } from './rng'
import { createGame } from './state'

const join = (playerId: string): ClientCommand => ({
  type: 'player.join',
  protocolVersion: 1,
  commandId: `join-${playerId}`,
  roomCode: 'ABCD',
  playerId,
  nickname: playerId
})

const start = (playerId: string): ClientCommand => ({
  type: 'game.start',
  protocolVersion: 1,
  commandId: 'start',
  roomCode: 'ABCD',
  playerId
})

const roll = (playerId: string, commandId = `roll-${playerId}`): ClientCommand => ({
  type: 'dice.roll',
  protocolVersion: 1,
  commandId,
  roomCode: 'ABCD',
  playerId,
  impulse: 42
})

const choose = (playerId: string, choiceId: string): ClientCommand => ({
  type: 'event.choose', protocolVersion: 1, commandId: `choose-${choiceId}`,
  roomCode: 'ABCD', playerId, choiceId
})

const vote = (playerId: string, voteValue: 'valid' | 'invalid', commandId = `vote-${playerId}`): ClientCommand => ({
  type: 'event.vote', protocolVersion: 1, commandId,
  roomCode: 'ABCD', playerId, vote: voteValue
})

const gameWithPlayers = (...playerIds: string[]) =>
  playerIds.reduce((game, playerId) => applyCommand(game, join(playerId), testRng()).state, createGame('ABCD'))

const sequenceDie = (...values: number[]) => {
  let index = 0
  return () => values[index++] ?? values.at(-1) ?? 1
}

const testRng = (overrides: Partial<GameRng> = {}): GameRng => ({
  rollDie: () => 1,
  drawChance: () => 1,
  shuffle: (items) => [...items],
  pickArbiter: (candidates) => candidates[0],
  ...overrides
})

describe('applyCommand', () => {
  it('rolls two independent dice and moves by their total', () => {
    const started = applyCommand(gameWithPlayers('p1'), start('p1'), testRng()).state
    const rolled = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) }))

    expect(rolled.state.lastDice).toEqual([2, 5])
    expect(rolled.state.lastRoll).toBe(7)
    expect(rolled.state.players.p1.position).toBe(7)
  })
  it('initializes joined players with the default private state', () => {
    const game = gameWithPlayers('p1')

    expect(game.players.p1).toMatchObject({
      playerId: 'p1',
      nickname: 'p1',
      budget: 30,
      drunkenness: 0,
      dignity: 10,
      position: 0
    })
  })

  it('moves only the active player', () => {
    let game = gameWithPlayers('p1', 'p2')
    const started = applyCommand(game, start('p1'), testRng())
    const rolled = applyCommand(started.state, roll('p1'), testRng({ rollDie: sequenceDie(1, 1) }))
    game = rolled.state

    expect(started.rejection).toBeNull()
    expect(rolled.rejection).toBeNull()
    expect(game.players.p1.position).toBe(2)
    expect(game.players.p2.position).toBe(0)
    expect(game.activePlayerId).toBe('p2')
  })

  it('returns NOT_ACTIVE_PLAYER for an inactive roll without changing state', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const original = structuredClone(started)
    const rejected = applyCommand(started, roll('p2'), testRng({ rollDie: () => 4 }))

    expect(rejected.rejection).toBe('NOT_ACTIVE_PLAYER')
    expect(rejected.state).toEqual(original)
  })

  it('is idempotent for duplicate command ids', () => {
    const game = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const command = roll('p1', 'roll-once')

    const once = applyCommand(game, command, testRng({ rollDie: () => 3 }))
    const twice = applyCommand(once.state, command, testRng({ rollDie: () => 6 }))

    expect(twice).toEqual(once)
  })

  it('rejects die results outside one through six', () => {
    const started = applyCommand(gameWithPlayers('p1'), start('p1'), testRng()).state
    const rejected = applyCommand(started, roll('p1'), testRng({ rollDie: () => 7 }))

    expect(rejected.rejection).toBe('INVALID_DIE_ROLL')
    expect(rejected.state.players.p1.position).toBe(0)
    expect(rejected.state.activePlayerId).toBe('p1')
  })

  it('lets the first joined player start a one-player game', () => {
    const started = applyCommand(gameWithPlayers('p1'), start('p1'), testRng())

    expect(started.rejection).toBeNull()
    expect(started.state).toMatchObject({ status: 'playing', activePlayerId: 'p1' })
  })

  it('only lets the first joined player start the game', () => {
    const game = gameWithPlayers('p1', 'p2')

    expect(applyCommand(game, start('p2'), testRng()).rejection).toBe('NOT_HOST_PLAYER')
  })

  it('draws a card when crossing the dedicated Imprevisto tile and waits before advancing', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const rolled = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) }))

    expect(rolled.state.pendingEvent).toEqual({ cardId: '01', playerId: 'p1', phase: 'choosing' })
    expect(rolled.state.activePlayerId).toBe('p1')
  })

  it('rejects a second dice.roll while an Imprevisto is still pending', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const original = structuredClone(pending)

    const rejected = applyCommand(pending, roll('p1', 'second-roll'), testRng())

    expect(rejected.rejection).toBe('NOT_ACTIVE_PLAYER')
    expect(rejected.state).toEqual(original)
  })

  it('does not draw a card when neither the tile nor the random chance trigger', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const rolled = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 1) }))

    expect(rolled.state.pendingEvent).toBeNull()
    expect(rolled.state.activePlayerId).toBe('p2')
  })

  it('draws a card probabilistically on a normal tile when the random chance succeeds', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const drewCard = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const resolved = applyCommand(drewCard, choose('p1', 'modalita-aereo'), testRng()).state

    const rolled = applyCommand(resolved, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 }))

    expect(rolled.state.pendingEvent).toMatchObject({ cardId: '02', playerId: 'p2', phase: 'choosing' })
    expect(rolled.state.activePlayerId).toBe('p2')
  })

  it('resolves a normal option by applying its effects and advancing the turn', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const resolved = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng())

    expect(resolved.rejection).toBeNull()
    expect(resolved.state.players.p1.budget).toBe(28)
    expect(resolved.state.pendingEvent).toBeNull()
    expect(resolved.state.activePlayerId).toBe('p2')
  })

  it('rejects an unknown option id for the pending card', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const rejected = applyCommand(pending, choose('p1', 'nonexistent'), testRng())

    expect(rejected.rejection).toBe('INVALID_EVENT_CHOICE')
  })

  it('opens a group vote when the active player picks a Salva il culo alternative', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng())

    expect(voting.state.pendingEvent).toEqual({ cardId: '01', playerId: 'p1', phase: 'voting', savingAttempt: 'bevi' })
    expect(voting.state.activePlayerId).toBe('p1')
  })

  it('delegates the outcome to an arbiter for an opponentChooses option', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 2) })).state
    const clearedFirstCard = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng())
    expect(clearedFirstCard.state.pendingEvent).toBeNull()

    const nextRoll = applyCommand(clearedFirstCard.state, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    expect(nextRoll.pendingEvent).toMatchObject({ cardId: '02' })

    const clearSecond = applyCommand(nextRoll, choose('p2', 'continua-cosi'), testRng()).state
    expect(clearSecond.pendingEvent).toBeNull()

    const thirdRoll = applyCommand(clearSecond, roll('p3', 'roll-p3'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    expect(thirdRoll.pendingEvent).toMatchObject({ cardId: '03' })

    const delegated = applyCommand(thirdRoll, choose('p3', 'passa-il-telefono'), testRng({ pickArbiter: (candidates) => candidates[0] }))

    expect(delegated.state.pendingEvent).toEqual({
      cardId: '03',
      playerId: 'p3',
      phase: 'choosing-for-other',
      arbiterId: 'p1',
      options: [
        { id: 'cancella-e-nega-tutto', label: 'Cancella e nega tutto', effects: [{ type: 'statDelta', stat: 'suspicion', delta: 1 }] },
        { id: 'raddoppia-la-figura-di-merda', label: 'Raddoppia la figura di merda', effects: [{ type: 'statDelta', stat: 'dignity', delta: -2 }, { type: 'statDelta', stat: 'energy', delta: 1 }] }
      ]
    })
  })

  it('lets the arbiter resolve a delegated choice, applying effects to the original player', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 2) })).state
    const clearedFirstCard = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng()).state

    const secondRoll = applyCommand(clearedFirstCard, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    const clearSecond = applyCommand(secondRoll, choose('p2', 'continua-cosi'), testRng()).state

    const thirdRoll = applyCommand(clearSecond, roll('p3', 'roll-p3'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    const delegated = applyCommand(thirdRoll, choose('p3', 'passa-il-telefono'), testRng({ pickArbiter: (candidates) => candidates[0] })).state

    expect(delegated.activePlayerId).toBe('p3')

    const resolved = applyCommand(delegated, {
      type: 'event.choose', protocolVersion: 1, commandId: 'arbiter-choice',
      roomCode: 'ABCD', playerId: 'p1', choiceId: 'raddoppia-la-figura-di-merda'
    }, testRng())

    expect(resolved.rejection).toBeNull()
    expect(resolved.state.players.p3).toMatchObject({ dignity: 8, energy: 11 })
    expect(resolved.state.pendingEvent).toBeNull()
    expect(resolved.state.activePlayerId).toBe('p1')
  })

  it('resolves an opponentChooses option against the drawer instead of stalling in a one-player game', () => {
    const started = applyCommand(gameWithPlayers('p1'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 2) })).state
    const clearedFirstCard = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng()).state

    const secondRoll = applyCommand(clearedFirstCard, roll('p1', 'roll-p1-2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    const clearSecond = applyCommand(secondRoll, choose('p1', 'continua-cosi'), testRng()).state

    const thirdRoll = applyCommand(clearSecond, roll('p1', 'roll-p1-3'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    expect(thirdRoll.pendingEvent).toMatchObject({ cardId: '03' })

    const resolved = applyCommand(thirdRoll, choose('p1', 'passa-il-telefono'), testRng())

    expect(resolved.rejection).toBeNull()
    expect(resolved.state.pendingEvent).toBeNull()
    expect(resolved.state.players.p1.suspicion).toBe(1)
    expect(resolved.state.activePlayerId).toBe('p1')
  })

  it('rejects an event.choose from someone other than the assigned arbiter', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 2) })).state
    const rolledToCard02 = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng()).state
    const secondRoll = applyCommand(rolledToCard02, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    const clearSecond = applyCommand(secondRoll, choose('p2', 'continua-cosi'), testRng()).state
    const thirdRoll = applyCommand(clearSecond, roll('p3', 'roll-p3'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
    const delegated = applyCommand(thirdRoll, choose('p3', 'passa-il-telefono'), testRng({ pickArbiter: (candidates) => candidates[0] })).state

    const rejected = applyCommand(delegated, choose('p2', 'raddoppia-la-figura-di-merda'), testRng())

    expect(rejected.rejection).toBe('NO_PENDING_EVENT')
  })
})

describe('event.vote', () => {
  it('clears the pendingEvent without effects when the group votes valid', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const firstVote = applyCommand(voting, vote('p2', 'valid'), testRng()).state
    const secondVote = applyCommand(firstVote, vote('p3', 'valid'), testRng())

    expect(secondVote.state.pendingEvent).toBeNull()
    expect(secondVote.state.players.p1).toMatchObject({ dignity: 10, suspicion: 0 })
    expect(secondVote.state.activePlayerId).toBe('p2')
  })

  it('applies the fallback effects when the group votes invalid', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const firstVote = applyCommand(voting, vote('p2', 'invalid'), testRng()).state
    const secondVote = applyCommand(firstVote, vote('p3', 'invalid'), testRng())

    expect(secondVote.state.pendingEvent).toBeNull()
    expect(secondVote.state.players.p1).toMatchObject({ dignity: 8, suspicion: 1 })
    expect(secondVote.state.activePlayerId).toBe('p2')
  })

  it('resolves as soon as the majority is mathematically certain, without waiting for every voter', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3', 'p4', 'p5'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const v1 = applyCommand(voting, vote('p2', 'valid'), testRng()).state
    const v2 = applyCommand(v1, vote('p3', 'valid'), testRng()).state
    const v3 = applyCommand(v2, vote('p4', 'valid'), testRng())

    expect(v3.state.pendingEvent).toBeNull()
  })

  it('treats a tie as invalid once every eligible voter has voted', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const firstVote = applyCommand(voting, vote('p2', 'valid'), testRng()).state
    const secondVote = applyCommand(firstVote, vote('p3', 'invalid'), testRng())

    expect(secondVote.state.players.p1).toMatchObject({ dignity: 8, suspicion: 1 })
  })

  it('rejects a vote from the player who is being judged', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const rejected = applyCommand(voting, vote('p1', 'valid'), testRng())

    expect(rejected.rejection).toBe('NOT_ACTIVE_PLAYER')
  })

  it('rejects a vote when there is no pending vote', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const rejected = applyCommand(started, vote('p2', 'valid'), testRng())

    expect(rejected.rejection).toBe('NO_PENDING_EVENT')
  })
})
