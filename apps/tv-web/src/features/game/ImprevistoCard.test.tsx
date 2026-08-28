import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ImprevistoCard } from './ImprevistoCard'

const players = [
  { playerId: 'p1', nickname: 'Mario', position: 3 },
  { playerId: 'p2', nickname: 'Luigi', position: 0 }
]

describe('ImprevistoCard', () => {
  it('shows the card title and description while the active player is choosing', () => {
    const html = renderToStaticMarkup(
      <ImprevistoCard pendingEvent={{ cardId: '01', playerId: 'p1', phase: 'choosing' }} players={players} />
    )
    expect(html).toContain('Il telefono al 2%')
    expect(html).toContain('Mario sta decidendo')
  })

  it('names the arbiter while a choosing-for-other delegation is pending', () => {
    const html = renderToStaticMarkup(
      <ImprevistoCard
        pendingEvent={{
          cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
          options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
        }}
        players={players}
      />
    )
    expect(html).toContain('Luigi')
    expect(html).toContain('Mario')
  })

  it('reveals the attempted save-yourself alternative during a vote', () => {
    const html = renderToStaticMarkup(
      <ImprevistoCard pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'voting', savingAttempt: 'fai' }} players={players} />
    )
    expect(html).toContain('attraversa la stanza camminando da pinguino')
  })
})
