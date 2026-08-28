import type { Server as HttpServer } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { parseClientCommand, type ServerEvent } from '../../../packages/protocol/src/index'
import { createRandomRng, type GameRng } from './game/rng'
import { projectPrivate, projectPublic } from './rooms/projections'
import { RoomStore } from './rooms/room-store'

type ConnectionRole = 'host' | 'player' | 'tv'

interface Connection {
  role: ConnectionRole
  roomCode: string
  playerId: string | null
}

interface HeartbeatWebSocket extends WebSocket {
  isAlive?: boolean
}

type CommandOutcome =
  | { kind: 'accepted'; roomCode: string }
  | { kind: 'rejected'; code: string }

export interface GameServer {
  close(): void
}

const send = (socket: WebSocket, event: ServerEvent) => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(event))
  }
}

const sendRejection = (socket: WebSocket, commandId: string, code: string) => {
  send(socket, { type: 'command.rejected', protocolVersion: 1, commandId, code })
}

const getCommandId = (input: unknown): string | null => {
  if (typeof input !== 'object' || input === null || !('commandId' in input)) return null
  return typeof input.commandId === 'string' && input.commandId.length > 0 ? input.commandId : null
}

const getConnection = (url: string | undefined): Connection | null => {
  const params = new URL(url ?? '/', 'http://localhost').searchParams
  const role = params.get('role')
  const roomCode = params.get('roomCode')
  const playerId = params.get('playerId')

  if ((role !== 'tv' && role !== 'host' && role !== 'player') || !roomCode || roomCode.length !== 4) {
    return null
  }

  if (role === 'player' && !playerId) return null

  return { role, roomCode, playerId }
}

export const createGameServer = (httpServer: HttpServer, rng: GameRng = createRandomRng()): GameServer => {
  const rooms = new RoomStore()
  const socketServer = new WebSocketServer({ noServer: true })
  const connections = new Map<WebSocket, Connection>()
  const outcomes = new Map<string, CommandOutcome>()

  const broadcastState = (roomCode: string) => {
    const state = rooms.getState(roomCode)
    for (const [socket, connection] of connections) {
      if (connection.roomCode !== roomCode) continue

      if (connection.role === 'tv' || connection.role === 'host') {
        send(socket, { type: 'game.public-state', protocolVersion: 1, state: projectPublic(state) })
        continue
      }

      send(socket, { type: 'game.public-state', protocolVersion: 1, state: projectPublic(state) })
      const privateState = projectPrivate(state, connection.playerId!)
      if (privateState) {
        send(socket, { type: 'player.private-state', protocolVersion: 1, state: privateState })
      }
    }
  }

  const onMessage = (socket: WebSocket, data: RawData) => {
    let input: unknown
    try {
      input = JSON.parse(data.toString())
    } catch {
      sendRejection(socket, 'unknown', 'INVALID_COMMAND')
      return
    }

    const commandId = getCommandId(input)
    if (commandId) {
      const outcome = outcomes.get(commandId)
      if (outcome) {
        if (outcome.kind === 'rejected') {
          sendRejection(socket, commandId, outcome.code)
        } else {
          broadcastState(outcome.roomCode)
        }
        return
      }
    }

    let command
    try {
      command = parseClientCommand(input)
    } catch {
      if (commandId) outcomes.set(commandId, { kind: 'rejected', code: 'INVALID_COMMAND' })
      sendRejection(socket, commandId ?? 'unknown', 'INVALID_COMMAND')
      return
    }

    const connection = connections.get(socket)
    if (!connection) return

    if (command.roomCode !== connection.roomCode) {
      outcomes.set(command.commandId, { kind: 'rejected', code: 'ROOM_MISMATCH' })
      sendRejection(socket, command.commandId, 'ROOM_MISMATCH')
      return
    }

    if (connection.role !== 'player' || connection.playerId !== command.playerId) {
      outcomes.set(command.commandId, { kind: 'rejected', code: 'UNAUTHORIZED' })
      sendRejection(socket, command.commandId, 'UNAUTHORIZED')
      return
    }

    const result = rooms.apply(command, rng)
    if (result.rejection) {
      outcomes.set(command.commandId, { kind: 'rejected', code: result.rejection })
      sendRejection(socket, command.commandId, result.rejection)
      return
    }

    outcomes.set(command.commandId, { kind: 'accepted', roomCode: command.roomCode })
    broadcastState(command.roomCode)
  }

  socketServer.on('connection', (socket: HeartbeatWebSocket, request) => {
    const connection = getConnection(request.url)
    if (!connection) {
      socket.terminate()
      return
    }

    socket.isAlive = true
    connections.set(socket, connection)
    socket.on('pong', () => {
      socket.isAlive = true
    })
    socket.on('message', (data) => onMessage(socket, data))
    socket.on('close', () => connections.delete(socket))

    if (connection.role === 'tv' || connection.role === 'host') {
      send(socket, { type: 'game.public-state', protocolVersion: 1, state: projectPublic(rooms.getState(connection.roomCode)) })
      return
    }

    const state = rooms.getState(connection.roomCode)
    send(socket, { type: 'game.public-state', protocolVersion: 1, state: projectPublic(state) })
    const privateState = projectPrivate(state, connection.playerId!)
    if (privateState) {
      send(socket, { type: 'player.private-state', protocolVersion: 1, state: privateState })
    }
  })

  const onUpgrade = (request: Parameters<HttpServer['emit']>[1], socket: Socket, head: Buffer) => {
    if (!request.url?.startsWith('/ws')) {
      socket.destroy()
      return
    }

    socketServer.handleUpgrade(request, socket, head, (webSocket) => {
      socketServer.emit('connection', webSocket, request)
    })
  }

  httpServer.on('upgrade', onUpgrade)

  const heartbeat = setInterval(() => {
    for (const socket of socketServer.clients as Set<HeartbeatWebSocket>) {
      if (socket.isAlive === false) {
        socket.terminate()
        continue
      }

      socket.isAlive = false
      socket.ping()
    }
  }, 30_000)

  return {
    close: () => {
      clearInterval(heartbeat)
      httpServer.off('upgrade', onUpgrade)
      for (const socket of socketServer.clients) socket.terminate()
      socketServer.close()
    }
  }
}
