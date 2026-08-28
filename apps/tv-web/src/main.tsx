import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { PublicGameState } from '@osterie/protocol'
import { App } from './App'
import { createGameSocket } from './lib/game-socket'
import { createRuntimeConfig } from './lib/runtime-config'

const { roomCode, socketUrl, joinUrl } = createRuntimeConfig({ location: new URL(window.location.href), env: import.meta.env })
const initialState: PublicGameState = { roomCode, status: 'lobby', activePlayerId: null, lastRoll: null, lastDice: null, pendingEvent: null, players: [] }
const socket = createGameSocket(socketUrl, initialState)

createRoot(document.getElementById('root')!).render(
  <StrictMode><App socket={socket} joinUrl={joinUrl} /></StrictMode>
)
