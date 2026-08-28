import { useEffect, useState } from 'react'
import { getImprevistoCard } from '@osterie/game-content'
import type { PublicGameState } from '@osterie/protocol'

interface EventChoiceProps {
  pendingEvent: NonNullable<PublicGameState['pendingEvent']>
  myPlayerId: string
  onChoose: (choiceId: string) => void
  onVote: (vote: 'valid' | 'invalid') => void
}

export function EventChoice({ pendingEvent, myPlayerId, onChoose, onVote }: EventChoiceProps) {
  const [hasVoted, setHasVoted] = useState(false)
  useEffect(() => setHasVoted(false), [pendingEvent.cardId, pendingEvent.phase])

  const card = getImprevistoCard(pendingEvent.cardId)

  if (pendingEvent.phase === 'choosing' && pendingEvent.playerId === myPlayerId) {
    return (
      <section className="event-card" aria-labelledby="event-title">
        <p className="event-kicker">Imprevisto!</p>
        <h1 id="event-title">{card.title}</h1>
        <p>{card.description}</p>
        {card.options.map((option) => (
          <button type="button" key={option.id} onClick={() => onChoose(option.id)}>{option.label}</button>
        ))}
        <p className="save-yourself-hint">Salva il culo</p>
        <button type="button" onClick={() => onChoose('save:scomoda')}>Scomoda · {card.saveYourself.scomoda}</button>
        <button type="button" onClick={() => onChoose('save:fai')}>Fai · {card.saveYourself.fai}</button>
        <button type="button" onClick={() => onChoose('save:bevi')}>Bevi · {card.saveYourself.bevi}</button>
      </section>
    )
  }

  if (pendingEvent.phase === 'choosing-for-other' && pendingEvent.arbiterId === myPlayerId) {
    return (
      <section className="event-card" aria-labelledby="event-title">
        <p className="event-kicker">Decidi tu per lui</p>
        <h1 id="event-title">{card.title}</h1>
        {pendingEvent.options.map((option) => (
          <button type="button" key={option.id} onClick={() => onChoose(option.id)}>{option.label}</button>
        ))}
      </section>
    )
  }

  if (pendingEvent.phase === 'voting' && pendingEvent.playerId !== myPlayerId) {
    return (
      <section className="event-card" aria-labelledby="event-title">
        <p className="event-kicker">Il tavolo giudica</p>
        <h1 id="event-title">{card.saveYourself[pendingEvent.savingAttempt]}</h1>
        <button type="button" disabled={hasVoted} onClick={() => { setHasVoted(true); onVote('valid') }}>Ci credo</button>
        <button type="button" disabled={hasVoted} onClick={() => { setHasVoted(true); onVote('invalid') }}>Non ci credo</button>
      </section>
    )
  }

  return (
    <section className="waiting-panel"><h1>Aspetta il tuo turno</h1><p>Segui quello che succede sulla TV.</p></section>
  )
}
