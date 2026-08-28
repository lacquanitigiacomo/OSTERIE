import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PublicGameState } from '@osterie/protocol'
import { createGameSocket } from './game-socket'

const lobby: PublicGameState = { roomCode: 'ABCD', status: 'lobby', activePlayerId: null, lastRoll: null, lastDice: null, pendingEvent: null, players: [] }

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = []
  static OPEN = 1
  readyState = 0
  close = vi.fn()
  constructor(readonly url: string) { super(); FakeWebSocket.instances.push(this) }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')) }
  message(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })) }
  fail() { this.dispatchEvent(new Event('error')) }
  disconnect() { this.readyState = 3; this.dispatchEvent(new Event('close')) }
}

describe('game socket', () => {
  afterEach(() => { vi.useRealTimers(); FakeWebSocket.instances = [] })

  it('publishes connection changes and ignores private state', () => {
    const socket = createGameSocket('ws://game.test/ws', lobby, { WebSocket: FakeWebSocket as unknown as typeof WebSocket })
    const listener = vi.fn()
    socket.subscribe(listener)
    FakeWebSocket.instances[0]!.open()
    FakeWebSocket.instances[0]!.message({ type: 'player.private-state', protocolVersion: 1, state: { playerId: 'x', budget: 1, drunkenness: 2, dignity: 3 } })

    expect(socket.getConnectionState()).toBe('connected')
    expect(listener).toHaveBeenLastCalledWith(lobby, 'connected')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reconnects after a dropped connection', () => {
    vi.useFakeTimers()
    const socket = createGameSocket('ws://game.test/ws', lobby, { WebSocket: FakeWebSocket as unknown as typeof WebSocket, reconnectDelay: 100 })
    FakeWebSocket.instances[0]!.disconnect()
    expect(socket.getConnectionState()).toBe('reconnecting')
    vi.advanceTimersByTime(100)
    expect(FakeWebSocket.instances).toHaveLength(2)
    socket.close?.()
  })

  it('reports malformed server messages without replacing public state', () => {
    const socket = createGameSocket('ws://game.test/ws', lobby, { WebSocket: FakeWebSocket as unknown as typeof WebSocket })
    const listener = vi.fn()
    socket.subscribe(listener)
    FakeWebSocket.instances[0]!.message({ bad: 'payload' })
    expect(socket.getSnapshot()).toEqual(lobby)
    expect(socket.getConnectionState()).toBe('error')
  })
})
