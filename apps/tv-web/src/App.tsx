import { useEffect, useRef, useState } from 'react'
import type { PublicGameState } from '@osterie/protocol'
import { BoardScreen } from './features/game/BoardScreen'
import { LobbyScreen } from './features/lobby/LobbyScreen'
import type { ConnectionState, GameSocket } from './lib/game-socket'
import './styles.css'

interface AppProps { socket: GameSocket; joinUrl?: string }
interface RollResult { nickname: string; value: number; dice: [number, number] }

const connectionCopy: Record<ConnectionState, string> = {
  connecting: 'Connessione alla partita…',
  connected: 'TV collegata',
  reconnecting: 'Riconnessione in corso…',
  error: 'Connessione instabile: nuovo tentativo in corso…'
}

export function App({ socket, joinUrl = `${window.location.origin}/?room=${socket.getSnapshot().roomCode}` }: AppProps) {
  const [state, setState] = useState(() => socket.getSnapshot())
  const [connection, setConnection] = useState(() => socket.getConnectionState())
  const previous = useRef(state)
  const [rollResult, setRollResult] = useState<RollResult | null>(null)
  const [diceRolling, setDiceRolling] = useState(false)

  useEffect(() => socket.subscribe((next, nextConnection) => {
    const changedPlayer = next.players.find((player) => {
      const oldPlayer = previous.current.players.find((old) => old.playerId === player.playerId)
      return oldPlayer && player.position > oldPlayer.position
    })
    if (changedPlayer) {
      const oldPosition = previous.current.players.find((player) => player.playerId === changedPlayer.playerId)?.position ?? 0
      setRollResult({
        nickname: changedPlayer.nickname,
        value: next.lastRoll ?? changedPlayer.position - oldPosition,
        dice: next.lastDice ?? [1, 1]
      })
      setDiceRolling(true)
      window.setTimeout(() => setDiceRolling(false), 900)
    }
    previous.current = next
    setState(next)
    setConnection(nextConnection)
  }), [socket])

  return <>
    <div className={`connection-state connection-state--${connection}`} role="status" aria-live="polite">
      <span aria-hidden="true" />{connectionCopy[connection]}
    </div>
    {state.status === 'lobby'
      ? <LobbyScreen state={state} joinUrl={joinUrl} />
      : <BoardScreen state={state} rollResult={rollResult} diceRolling={diceRolling} />}
  </>
}
