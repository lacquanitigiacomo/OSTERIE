import { describe, expect, it } from 'vitest'
import { ControllerGameSocket, getRoomCode, makeCommandId } from './controller-game-socket'

class FakeSocket {
  static instances: FakeSocket[] = []
  static OPEN = 1
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(readonly url: string) { FakeSocket.instances.push(this) }
  send(message: string) { this.sent.push(message) }
  close() { this.onclose?.() }
  open() { this.readyState = 1; this.onopen?.() }
  receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }) }
}

describe('controller route', () => {
  it('reads and normalizes a room from join path before query string', () => {
    expect(getRoomCode(new URL('https://game.test/join/a1b2?roomCode=NOPE'))).toBe('A1B2')
    expect(getRoomCode(new URL('https://game.test/?room=zz99'))).toBe('ZZ99')
  })

  it('creates collision-resistant command ids associated with the player', () => {
    expect(makeCommandId('p-one', () => 42, () => 0.5)).toBe('p-one-42-i')
  })
})

describe('ControllerGameSocket', () => {
  it('joins through the player channel and observes public state through a tv channel', () => {
    FakeSocket.instances = []
    const events: unknown[] = []
    const client = new ControllerGameSocket({
      endpoint: 'wss://game.test/ws', roomCode: 'ABCD', playerId: 'p1', nickname: 'Gino',
      WebSocketImpl: FakeSocket as never,
      onEvent: (event) => events.push(event)
    })

    client.connect()
    expect(FakeSocket.instances.map((socket) => socket.url)).toEqual([
      'wss://game.test/ws?role=player&roomCode=ABCD&playerId=p1',
      'wss://game.test/ws?role=tv&roomCode=ABCD'
    ])
    FakeSocket.instances[0].open()
    expect(JSON.parse(FakeSocket.instances[0].sent[0])).toMatchObject({ type: 'player.join', roomCode: 'ABCD', playerId: 'p1', nickname: 'Gino' })
    FakeSocket.instances[1].receive({ type: 'game.public-state', protocolVersion: 1, state: { roomCode: 'ABCD' } })
    expect(events).toHaveLength(1)
  })

  it('sends gameplay commands only on the authenticated player channel', () => {
    FakeSocket.instances = []
    const client = new ControllerGameSocket({ endpoint: 'ws://localhost/ws', roomCode: 'ABCD', playerId: 'p1', nickname: 'Gino', WebSocketImpl: FakeSocket as never })
    client.connect()
    FakeSocket.instances[0].open()
    client.send('dice.roll', { impulse: 35 })
    expect(JSON.parse(FakeSocket.instances[0].sent[1])).toMatchObject({ type: 'dice.roll', impulse: 35, playerId: 'p1' })
    expect(FakeSocket.instances[1].sent).toHaveLength(0)
  })
})
