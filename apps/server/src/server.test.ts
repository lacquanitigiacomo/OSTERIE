import { createServer } from 'node:http'
import { once } from 'node:events'
import { afterEach, describe, expect, test } from 'vitest'
import WebSocket from 'ws'
import { createGameServer } from './server'

const roomCode = 'ABCD'

const connect = async (port: number, query: Record<string, string>) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?${new URLSearchParams(query)}`)
  const events: Array<{ type: string; state?: unknown }> = []
  const waiters: Array<{ type?: string; resolve: (event: { type: string; state?: unknown }) => void }> = []
  socket.on('message', (message) => {
    const event = JSON.parse(message.toString()) as { type: string; state?: unknown }
    const waiterIndex = waiters.findIndex((waiter) => !waiter.type || waiter.type === event.type)
    const waiter = waiterIndex >= 0 ? waiters.splice(waiterIndex, 1)[0] : undefined
    if (waiter) waiter.resolve(event)
    else events.push(event)
  })
  await once(socket, 'open')
  return {
    socket,
    nextEvent: (type?: string) => {
      const eventIndex = events.findIndex((event) => !type || event.type === type)
      const event = eventIndex >= 0 ? events.splice(eventIndex, 1)[0] : undefined
      if (event) return Promise.resolve(event)
      return new Promise<{ type: string; state?: unknown }>((resolve) => waiters.push({ type, resolve }))
    }
  }
}

describe('authoritative WebSocket game rooms', () => {
  const closeables: Array<{ close: () => void }> = []

  afterEach(async () => {
    for (const closeable of closeables.splice(0)) {
      closeable.close()
    }
  })

  test('sends public player state to TV and private stats only to its controller', async () => {
    const httpServer = createServer()
    const gameServer = createGameServer(httpServer, {
      rollDie: () => 1,
      drawChance: () => 1,
      shuffle: (items) => [...items],
      pickArbiter: (candidates) => candidates[0]
    })
    closeables.push(gameServer, httpServer)
    httpServer.listen(0)
    await once(httpServer, 'listening')
    const address = httpServer.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')

    const tv = await connect(address.port, { role: 'tv', roomCode })
    const controller = await connect(address.port, { role: 'player', roomCode, playerId: 'mario' })
    closeables.push(tv.socket, controller.socket)
    await tv.nextEvent()

    const publicState = tv.nextEvent()
    const playerPublicState = controller.nextEvent('game.public-state')
    const privateState = controller.nextEvent('player.private-state')

    controller.socket.send(JSON.stringify({
      type: 'player.join',
      protocolVersion: 1,
      commandId: 'join-mario',
      roomCode,
      playerId: 'mario',
      nickname: 'Mario'
    }))

    await expect(publicState).resolves.toEqual({
      type: 'game.public-state',
      protocolVersion: 1,
      state: {
        roomCode,
        status: 'lobby',
        activePlayerId: null,
        lastRoll: null, lastDice: null,
        pendingEvent: null,
        players: [{ playerId: 'mario', nickname: 'Mario', position: 0 }]
      }
    })
    await expect(privateState).resolves.toEqual({
      type: 'player.private-state',
      protocolVersion: 1,
      state: {
        roomCode, playerId: 'mario', status: 'lobby', activePlayerId: null,
        isMyTurn: false, lastRoll: null, lastDice: null,
        budget: 30, drunkenness: 0, dignity: 10
      }
    })
    await expect(playerPublicState).resolves.toMatchObject({
      type: 'game.public-state',
      state: { roomCode, status: 'lobby', activePlayerId: null }
    })

    tv.socket.close()
    controller.socket.close()
  })

  test('replays a rejected command without applying it after the game state changes', async () => {
    const httpServer = createServer()
    const gameServer = createGameServer(httpServer, {
      rollDie: () => 1,
      drawChance: () => 1,
      shuffle: (items) => [...items],
      pickArbiter: (candidates) => candidates[0]
    })
    closeables.push(gameServer, httpServer)
    httpServer.listen(0)
    await once(httpServer, 'listening')
    const address = httpServer.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')

    const tv = await connect(address.port, { role: 'tv', roomCode })
    const controller = await connect(address.port, { role: 'player', roomCode, playerId: 'mario' })
    closeables.push(tv.socket, controller.socket)
    await tv.nextEvent()

    const joinedPublic = tv.nextEvent()
    const joinedPrivate = controller.nextEvent('player.private-state')
    controller.socket.send(JSON.stringify({
      type: 'player.join', protocolVersion: 1, commandId: 'join-mario', roomCode, playerId: 'mario', nickname: 'Mario'
    }))
    await joinedPublic
    await joinedPrivate

    const rejectedRoll = {
      type: 'dice.roll', protocolVersion: 1, commandId: 'rejected-roll', roomCode, playerId: 'mario', impulse: 50
    }
    const initialRejection = controller.nextEvent('command.rejected')
    controller.socket.send(JSON.stringify(rejectedRoll))
    await expect(initialRejection).resolves.toMatchObject({
      type: 'command.rejected', commandId: 'rejected-roll', code: 'NOT_ACTIVE_PLAYER'
    })

    const startedPublic = tv.nextEvent()
    const startedPrivate = controller.nextEvent('player.private-state')
    controller.socket.send(JSON.stringify({
      type: 'game.start', protocolVersion: 1, commandId: 'start-game', roomCode, playerId: 'mario'
    }))
    await startedPublic
    await startedPrivate

    const repeatedRejection = controller.nextEvent('command.rejected')
    controller.socket.send(JSON.stringify(rejectedRoll))
    await expect(repeatedRejection).resolves.toMatchObject({
      type: 'command.rejected', commandId: 'rejected-roll', code: 'NOT_ACTIVE_PLAYER'
    })

    const rolledPublic = tv.nextEvent()
    const rolledPrivate = controller.nextEvent('player.private-state')
    controller.socket.send(JSON.stringify({
      type: 'dice.roll', protocolVersion: 1, commandId: 'accepted-roll', roomCode, playerId: 'mario', impulse: 50
    }))
    await expect(rolledPublic).resolves.toMatchObject({
      type: 'game.public-state',
      state: { activePlayerId: 'mario', players: [{ playerId: 'mario', nickname: 'Mario', position: 2 }] }
    })
    await rolledPrivate

    tv.socket.close()
    controller.socket.close()
  })

  test('caches an identifiable schema rejection before a later valid command can use its id', async () => {
    const httpServer = createServer()
    const gameServer = createGameServer(httpServer)
    closeables.push(gameServer, httpServer)
    httpServer.listen(0)
    await once(httpServer, 'listening')
    const address = httpServer.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')

    const controller = await connect(address.port, { role: 'player', roomCode, playerId: 'mario' })
    closeables.push(controller.socket)
    const invalidCommand = {
      type: 'player.join', protocolVersion: 1, commandId: 'invalid-then-valid', roomCode, playerId: 'mario', nickname: ''
    }

    const initialRejection = controller.nextEvent('command.rejected')
    controller.socket.send(JSON.stringify(invalidCommand))
    await expect(initialRejection).resolves.toMatchObject({
      type: 'command.rejected', commandId: 'invalid-then-valid', code: 'INVALID_COMMAND'
    })

    const replayedRejection = controller.nextEvent('command.rejected')
    controller.socket.send(JSON.stringify({ ...invalidCommand, nickname: 'Mario' }))
    await expect(replayedRejection).resolves.toMatchObject({
      type: 'command.rejected', commandId: 'invalid-then-valid', code: 'INVALID_COMMAND'
    })

    controller.socket.close()
  })

  test('replays a room mismatch across room connections with the same command id', async () => {
    const httpServer = createServer()
    const gameServer = createGameServer(httpServer)
    closeables.push(gameServer, httpServer)
    httpServer.listen(0)
    await once(httpServer, 'listening')
    const address = httpServer.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')

    const wrongRoomController = await connect(address.port, { role: 'player', roomCode: 'WXYZ', playerId: 'mario' })
    const correctRoomController = await connect(address.port, { role: 'player', roomCode, playerId: 'mario' })
    closeables.push(wrongRoomController.socket, correctRoomController.socket)
    const command = {
      type: 'player.join', protocolVersion: 1, commandId: 'cross-room-replay', roomCode, playerId: 'mario', nickname: 'Mario'
    }

    const initialRejection = wrongRoomController.nextEvent('command.rejected')
    wrongRoomController.socket.send(JSON.stringify(command))
    await expect(initialRejection).resolves.toMatchObject({
      type: 'command.rejected', commandId: 'cross-room-replay', code: 'ROOM_MISMATCH'
    })

    const replayedRejection = correctRoomController.nextEvent('command.rejected')
    correctRoomController.socket.send(JSON.stringify(command))
    await expect(replayedRejection).resolves.toMatchObject({
      type: 'command.rejected', commandId: 'cross-room-replay', code: 'ROOM_MISMATCH'
    })

    wrongRoomController.socket.close()
    correctRoomController.socket.close()
  })

  test('replays an accepted command instead of emitting a null rejection code', async () => {
    const httpServer = createServer()
    const gameServer = createGameServer(httpServer)
    closeables.push(gameServer, httpServer)
    httpServer.listen(0)
    await once(httpServer, 'listening')
    const address = httpServer.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')

    const controller = await connect(address.port, { role: 'player', roomCode, playerId: 'mario' })
    closeables.push(controller.socket)
    const acceptedCommand = {
      type: 'player.join', protocolVersion: 1, commandId: 'accepted-then-mismatch', roomCode, playerId: 'mario', nickname: 'Mario'
    }

    const initialPrivateState = controller.nextEvent('player.private-state')
    controller.socket.send(JSON.stringify(acceptedCommand))
    await expect(initialPrivateState).resolves.toMatchObject({
      type: 'player.private-state', state: { playerId: 'mario', budget: 30, drunkenness: 0, dignity: 10 }
    })

    const replayedPrivateState = controller.nextEvent('player.private-state')
    controller.socket.send(JSON.stringify({ ...acceptedCommand, roomCode: 'WXYZ' }))
    await expect(replayedPrivateState).resolves.toMatchObject({
      type: 'player.private-state', state: { playerId: 'mario', budget: 30, drunkenness: 0, dignity: 10 }
    })

    controller.socket.close()
  })
})
