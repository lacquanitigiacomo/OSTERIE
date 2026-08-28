import type { PrivatePlayerState, PublicGameState } from '../../../packages/protocol/src/index'
import { EventChoice } from './features/event/EventChoice'
import { ShakeToRoll } from './features/dice/ShakeToRoll'
import { JoinForm } from './features/join/JoinForm'
import './styles.css'

interface AppProps {
  nickname?: string
  privateState?: PrivatePlayerState
  publicState?: PublicGameState
  connectionStatus?: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  error?: string
  initialRoomCode?: string
  onJoin?: (details: { nickname: string; roomCode: string }) => void
  onRoll?: (impulse: number) => void
  onStart?: () => void
  onChoose?: (choiceId: string) => void
  onVote?: (vote: 'valid' | 'invalid') => void
}

export function App({ nickname, privateState, publicState, connectionStatus = 'disconnected', error, initialRoomCode, onJoin, onRoll, onStart, onChoose, onVote }: AppProps) {
  if (!nickname) {
    return <main className="controller-shell"><JoinForm initialRoomCode={initialRoomCode} onJoin={onJoin ?? (() => undefined)} /></main>
  }

  const isActive = publicState?.status === 'playing' && publicState.activePlayerId === privateState?.playerId
  const haze = Math.min(5, Math.max(0, (privateState?.drunkenness ?? 0) * 0.35))
  return (
    <main className="controller-shell">
      <div className="paper-grain" style={{ filter: `blur(${haze}px)` }} aria-hidden="true" />
      <header className="player-banner">{nickname}</header>
      <p className={`connection-status connection-status--${connectionStatus}`} role="status">
        {connectionStatus === 'connected' ? `Tavolo ${publicState?.roomCode ?? initialRoomCode ?? ''} connesso` : connectionStatus === 'reconnecting' ? 'Riconnessione…' : connectionStatus === 'connecting' ? 'Ingresso al tavolo…' : 'Disconnesso'}
      </p>
      {error && <p className="connection-error" role="alert">{error}</p>}
      {!privateState || !publicState ? (
        <section className="waiting-panel"><h1>Un attimo, oste!</h1><p>Stiamo preparando il tuo posto al tavolo.</p></section>
      ) : publicState.status === 'lobby' ? (
        <section className="lobby-panel">
          <h1>Siete in {publicState.players.length}</h1>
          <p>{publicState.players.map((player) => player.nickname).join(' · ')}</p>
          <button className="start-button" type="button" disabled={connectionStatus !== 'connected'} onClick={onStart}>Avvia partita</button>
        </section>
      ) : publicState.pendingEvent ? (
        <EventChoice
          pendingEvent={publicState.pendingEvent}
          myPlayerId={privateState.playerId}
          onChoose={onChoose ?? (() => undefined)}
          onVote={onVote ?? (() => undefined)}
        />
      ) : (
        <ShakeToRoll isActive={isActive} onRoll={onRoll ?? (() => undefined)} lastDice={privateState.lastDice} />
      )}
      {privateState && <section className="private-stats" aria-label="Le tue statistiche">
        <dl>
          <div><dt>Budget</dt><dd>€{privateState.budget}</dd></div>
          <div><dt>Ubriachezza</dt><dd>{privateState.drunkenness}/10</dd></div>
          <div><dt>Dignità</dt><dd>{privateState.dignity}</dd></div>
        </dl>
      </section>}
    </main>
  )
}
