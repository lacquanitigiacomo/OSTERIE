import type { PublicGameState } from '@osterie/protocol'
import { DiceRoll } from './DiceRoll'
import { ImprevistoCard } from './ImprevistoCard'

interface RollResult { nickname: string; value: number; dice: [number, number] }

interface BoardScreenProps {
  state: PublicGameState
  rollResult: RollResult | null
  diceRolling: boolean
}

const spaces = Array.from({ length: 12 }, (_, index) => index)

export function BoardScreen({ state, rollResult, diceRolling }: BoardScreenProps) {
  const activePlayer = state.players.find((player) => player.playerId === state.activePlayerId)

  return (
    <main className="tv-shell board-screen">
      <header className="board-header">
        <div className="brand-lockup brand-lockup--small"><span>Osterie</span><strong>Extreme</strong><span>Survival</span></div>
        <h1>{activePlayer ? `È il turno di ${activePlayer.nickname}` : 'La serata è finita'}</h1>
        <div className="room-ticket room-ticket--small"><span>Stanza</span><strong>{state.roomCode}</strong></div>
      </header>

      <section className="board-map" aria-label="Percorso delle osterie">
        <div className="map-art" aria-hidden="true" />
        <ol className="route">
          {spaces.map((space) => (
            <li className={space === 8 ? 'venue-space' : ''} data-testid="board-space" key={space}>
              {space === 8 && <span>Osteria del Gallo</span>}
              <div className="pawns-at-space">
                {state.players.filter((player) => player.position === space).map((player, index) => (
                  <span className={`pawn pawn-${index % 4}`} title={player.nickname} key={player.playerId} />
                ))}
              </div>
            </li>
          ))}
        </ol>

        {rollResult && (
          <div className="comic-result" role="status" aria-live="polite">
            <span>{rollResult.nickname} ha lanciato </span>
            <DiceRoll dice={rollResult.dice} total={rollResult.value} rolling={diceRolling} />
          </div>
        )}
        {state.pendingEvent && <ImprevistoCard pendingEvent={state.pendingEvent} players={state.players} />}
      </section>

      <section className="player-rail player-rail--board" aria-label="Classifica">
        {state.players.map((player, index) => (
          <article className={`player-card pawn-${index % 4} ${player.playerId === state.activePlayerId ? 'is-active' : ''}`} data-testid={`player-${player.playerId}`} key={player.playerId}>
            <span className="pawn" aria-hidden="true" />
            <strong>{player.nickname}</strong>
            <span>Casella <b>{player.position}</b></span>
          </article>
        ))}
      </section>
    </main>
  )
}
