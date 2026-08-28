import type { PublicGameState, ServerEvent } from '@osterie/protocol'

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface GameSocket {
  getSnapshot(): PublicGameState
  getConnectionState(): ConnectionState
  subscribe(listener: (state: PublicGameState, connection: ConnectionState) => void): () => void
  close?(): void
}

interface GameSocketOptions {
  WebSocket?: typeof globalThis.WebSocket
  reconnectDelay?: number
}

const isPublicStateEvent = (value: unknown): value is Extract<ServerEvent, { type: 'game.public-state' }> => {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  if (event.type !== 'game.public-state' || event.protocolVersion !== 1 || !event.state || typeof event.state !== 'object') return false
  const state = event.state as Record<string, unknown>
  return typeof state.roomCode === 'string'
    && (state.status === 'lobby' || state.status === 'playing' || state.status === 'finished')
    && (typeof state.activePlayerId === 'string' || state.activePlayerId === null)
    && Array.isArray(state.players)
    && state.players.every((player) => {
      if (!player || typeof player !== 'object') return false
      const entry = player as Record<string, unknown>
      return typeof entry.playerId === 'string' && typeof entry.nickname === 'string' && typeof entry.position === 'number'
    })
}

export const createGameSocket = (
  url: string,
  initialState: PublicGameState,
  options: GameSocketOptions = {}
): GameSocket => {
  let snapshot = initialState
  let connection: ConnectionState = 'connecting'
  let stopped = false
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let webSocket: WebSocket | undefined
  const listeners = new Set<(state: PublicGameState, connection: ConnectionState) => void>()
  const WebSocketCtor = options.WebSocket ?? globalThis.WebSocket
  const reconnectDelay = options.reconnectDelay ?? 1_500

  const publish = () => listeners.forEach((listener) => listener(snapshot, connection))

  const connect = () => {
    try {
      webSocket = new WebSocketCtor(url)
    } catch {
      connection = 'error'
      publish()
      return
    }

    webSocket.addEventListener('open', () => {
      connection = 'connected'
      publish()
    })
    webSocket.addEventListener('message', (message) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(message.data))
      } catch {
        connection = 'error'
        publish()
        return
      }
      if (parsed && typeof parsed === 'object' && (parsed as { type?: unknown }).type === 'player.private-state') return
      if (!isPublicStateEvent(parsed)) {
        connection = 'error'
        publish()
        return
      }
      snapshot = parsed.state
      publish()
    })
    webSocket.addEventListener('error', () => {
      connection = 'error'
      publish()
    })
    webSocket.addEventListener('close', () => {
      if (stopped) return
      connection = 'reconnecting'
      publish()
      reconnectTimer = setTimeout(connect, reconnectDelay)
    })
  }

  connect()

  return {
    getSnapshot: () => snapshot,
    getConnectionState: () => connection,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close: () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      webSocket?.close()
      listeners.clear()
    }
  }
}
