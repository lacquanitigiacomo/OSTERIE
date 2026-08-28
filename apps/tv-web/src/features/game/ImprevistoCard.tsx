import { getImprevistoCard } from '@osterie/game-content'
import type { PublicGameState, PublicPlayerState } from '@osterie/protocol'

interface ImprevistoCardProps {
  pendingEvent: NonNullable<PublicGameState['pendingEvent']>
  players: PublicPlayerState[]
}

const nicknameOf = (players: PublicPlayerState[], playerId: string) =>
  players.find((player) => player.playerId === playerId)?.nickname ?? '???'

export function ImprevistoCard({ pendingEvent, players }: ImprevistoCardProps) {
  const card = getImprevistoCard(pendingEvent.cardId)
  const playerNickname = nicknameOf(players, pendingEvent.playerId)

  return (
    <aside className="public-event imprevisto-card" role="status" aria-live="polite">
      <span>Imprevisto!</span>
      <img className="imprevisto-illustration" src={card.illustration} alt="" aria-hidden="true" />
      <strong>{card.title}</strong>
      <p>{card.description}</p>
      {pendingEvent.phase === 'choosing' && <p>{playerNickname} sta decidendo…</p>}
      {pendingEvent.phase === 'choosing-for-other' && (
        <p>{nicknameOf(players, pendingEvent.arbiterId)} decide al posto di {playerNickname}…</p>
      )}
      {pendingEvent.phase === 'voting' && (
        <p>Il gruppo vota se {playerNickname} ha superato la prova: {card.saveYourself[pendingEvent.savingAttempt]}</p>
      )}
    </aside>
  )
}
