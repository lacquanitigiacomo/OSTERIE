import type { ClientCommand, ServerEvent } from '../../../../packages/protocol/src/index'

type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
type CommandPayload = { impulse: number } | { choiceId: string } | { vote: 'valid' | 'invalid' } | Record<string, never>

interface SocketLike {
  readyState: number
  onopen: (() => void) | null
  onmessage: ((event: { data: string }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  send(message: string): void
  close(): void
}

type SocketConstructor = new (url: string) => SocketLike

export const getRoomCode = (url: URL) => {
  const pathMatch = url.pathname.match(/\/join\/([a-z0-9]{4})(?:\/|$)/i)
  return (pathMatch?.[1] ?? url.searchParams.get('roomCode') ?? url.searchParams.get('room') ?? '').toUpperCase()
}

export const makeCommandId = (playerId: string, now: () => number = Date.now, random: () => number = Math.random) =>
  `${playerId}-${now()}-${Math.floor(random() * 36).toString(36)}`

interface ControllerGameSocketOptions {
  endpoint: string
  roomCode: string
  playerId: string
  nickname: string
  WebSocketImpl?: SocketConstructor
  onEvent?: (event: ServerEvent) => void
  onStatus?: (status: SocketStatus) => void
  onError?: (message: string) => void
}

export class ControllerGameSocket {
  private playerSocket?: SocketLike
  private observerSocket?: SocketLike
  private stopped = false
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private readonly SocketImpl: SocketConstructor

  constructor(private readonly options: ControllerGameSocketOptions) {
    this.SocketImpl = options.WebSocketImpl ?? (WebSocket as unknown as SocketConstructor)
  }

  connect() { this.stopped = false; this.openChannels('connecting') }

  disconnect() {
    this.stopped = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.playerSocket?.close()
    this.observerSocket?.close()
    this.options.onStatus?.('disconnected')
  }

  send(type: 'game.start' | 'dice.roll' | 'event.choose' | 'event.vote', payload: CommandPayload = {}) {
    if (!this.playerSocket || this.playerSocket.readyState !== 1) {
      this.options.onError?.('Connessione non pronta. Riprova tra poco.')
      return false
    }
    const command = { protocolVersion: 1, commandId: makeCommandId(this.options.playerId), roomCode: this.options.roomCode, playerId: this.options.playerId, type, ...payload } as ClientCommand
    this.playerSocket.send(JSON.stringify(command))
    return true
  }

  private openChannels(status: SocketStatus) {
    this.options.onStatus?.(status)
    const player = new URL(this.options.endpoint)
    player.searchParams.set('role', 'player')
    player.searchParams.set('roomCode', this.options.roomCode)
    player.searchParams.set('playerId', this.options.playerId)
    this.playerSocket = this.open(player.toString(), true)
    const observer = new URL(this.options.endpoint)
    observer.searchParams.set('role', 'tv')
    observer.searchParams.set('roomCode', this.options.roomCode)
    this.observerSocket = this.open(observer.toString(), false)
  }

  private open(url: string, playerChannel: boolean) {
    const socket = new this.SocketImpl(url)
    socket.onopen = () => {
      if (!playerChannel) return
      this.options.onStatus?.('connected')
      const join: ClientCommand = { protocolVersion: 1, commandId: makeCommandId(this.options.playerId), roomCode: this.options.roomCode, playerId: this.options.playerId, type: 'player.join', nickname: this.options.nickname }
      socket.send(JSON.stringify(join))
    }
    socket.onmessage = ({ data }) => {
      try {
        const event = JSON.parse(data) as ServerEvent
        this.options.onEvent?.(event)
        if (event.type === 'command.rejected') this.options.onError?.(`Comando rifiutato: ${event.code}`)
      } catch { this.options.onError?.('Risposta del server non valida.') }
    }
    socket.onerror = () => this.options.onError?.('Connessione al tavolo interrotta.')
    socket.onclose = () => {
      if (!playerChannel || this.stopped || this.reconnectTimer) return
      this.options.onStatus?.('reconnecting')
      this.reconnectTimer = setTimeout(() => { this.reconnectTimer = undefined; this.openChannels('reconnecting') }, 1_500)
    }
    return socket
  }
}
