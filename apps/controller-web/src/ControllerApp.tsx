import { useEffect, useMemo, useState } from 'react'
import type { PrivatePlayerState, PublicGameState, ServerEvent } from '../../../packages/protocol/src/index'
import { App } from './App'
import { ControllerGameSocket, getRoomCode } from './lib/controller-game-socket'

const NICKNAME_KEY = 'osterie.nickname'
const PLAYER_KEY = 'osterie.playerId'

const makePlayerId = () => globalThis.crypto?.randomUUID?.() ?? `player-${Date.now()}-${Math.random().toString(36).slice(2)}`
export const getEndpoint = () => {
  const configured = import.meta.env.VITE_WS_URL
  if (!configured) return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8787/ws`
  const endpoint = new URL(configured)
  if (endpoint.hostname === 'localhost' || endpoint.hostname === '127.0.0.1') endpoint.hostname = location.hostname
  return endpoint.toString()
}

export function ControllerApp() {
  const routeRoom = useMemo(() => getRoomCode(new URL(location.href)), [])
  const [identity, setIdentity] = useState<{ nickname: string; roomCode: string; playerId: string } | null>(() => {
    const nickname = sessionStorage.getItem(NICKNAME_KEY)
    const playerId = sessionStorage.getItem(PLAYER_KEY)
    return nickname && playerId && routeRoom ? { nickname, playerId, roomCode: routeRoom } : null
  })
  const [privateState, setPrivateState] = useState<PrivatePlayerState>()
  const [publicState, setPublicState] = useState<PublicGameState>()
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('disconnected')
  const [error, setError] = useState('')
  const [socket, setSocket] = useState<ControllerGameSocket>()

  useEffect(() => {
    if (!identity) return undefined
    const receive = (event: ServerEvent) => {
      if (event.type === 'game.public-state') setPublicState(event.state)
      if (event.type === 'player.private-state') setPrivateState(event.state)
    }
    const connection = new ControllerGameSocket({
      endpoint: getEndpoint(), ...identity, onEvent: receive,
      onStatus: setConnectionStatus,
      onError: setError
    })
    setSocket(connection)
    connection.connect()
    return () => connection.disconnect()
  }, [identity])

  const join = ({ nickname, roomCode }: { nickname: string; roomCode: string }) => {
    const playerId = sessionStorage.getItem(PLAYER_KEY) ?? makePlayerId()
    sessionStorage.setItem(NICKNAME_KEY, nickname)
    sessionStorage.setItem(PLAYER_KEY, playerId)
    history.replaceState(null, '', `/join/${roomCode}`)
    setIdentity({ nickname, roomCode, playerId })
  }

  return <App
    nickname={identity?.nickname} initialRoomCode={routeRoom} privateState={privateState} publicState={publicState}
    connectionStatus={connectionStatus} error={error} onJoin={join}
    onStart={() => socket?.send('game.start')}
    onRoll={(impulse) => socket?.send('dice.roll', { impulse })}
    onChoose={(choiceId) => socket?.send('event.choose', { choiceId })}
    onVote={(voteValue) => socket?.send('event.vote', { vote: voteValue })}
  />
}
