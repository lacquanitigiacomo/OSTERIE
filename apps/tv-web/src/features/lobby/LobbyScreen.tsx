import { QRCodeSVG } from 'qrcode.react'
import type { PublicGameState } from '@osterie/protocol'

interface LobbyScreenProps {
  state: PublicGameState
  joinUrl: string
}

export function LobbyScreen({ state, joinUrl }: LobbyScreenProps) {
  return (
    <main className="tv-shell lobby-screen">
      <header className="brand-lockup">
        <span>Osterie</span>
        <strong>Extreme</strong>
        <span>Survival</span>
      </header>

      <section className="lobby-paper" aria-labelledby="lobby-title">
        <div className="lobby-copy">
          <h1 id="lobby-title">Entra nella partita</h1>
          <p>Inquadra il codice con il telefono</p>
          <div className="room-ticket" aria-label={`Codice stanza ${state.roomCode}`}>
            <span>Stanza</span>
            <strong>{state.roomCode}</strong>
          </div>
        </div>

        <div className="qr-frame">
          <QRCodeSVG value={joinUrl} size={250} bgColor="#f4dfae" fgColor="#183622" role="img" aria-label={`QR per entrare nella stanza ${state.roomCode}`} />
          <p>{joinUrl}</p>
        </div>
      </section>

      <section className="player-rail" aria-label="Giocatori collegati">
        {state.players.length === 0 ? (
          <p className="waiting-copy">Aspettiamo i primi avventori…</p>
        ) : state.players.map((player, index) => (
          <article className={`player-card pawn-${index % 4}`} key={player.playerId}>
            <span className="pawn" aria-hidden="true" />
            <strong>{player.nickname}</strong>
            <span>Pronto!</span>
          </article>
        ))}
      </section>
    </main>
  )
}
