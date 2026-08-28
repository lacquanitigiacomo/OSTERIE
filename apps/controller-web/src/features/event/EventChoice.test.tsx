// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventChoice } from './EventChoice'

describe('EventChoice', () => {
  it('offers the card options and the three Salva il culo buttons to the active player', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'choosing' }}
        myPlayerId="p1"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).toContain('Pulizia dignitosa')
    expect(html).toContain('Continua così')
    expect(html).toContain('bevi un sorso')
  })

  it('shows the waiting panel for a bystander during a normal choice', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'choosing' }}
        myPlayerId="p2"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).toContain('Aspetta il tuo turno')
  })

  it('offers only the two delegated options to the assigned arbiter', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{
          cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
          options: [{ id: 'a', label: 'Opzione A' }, { id: 'b', label: 'Opzione B' }]
        }}
        myPlayerId="p2"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).toContain('Opzione A')
    expect(html).toContain('Opzione B')
  })

  it('lets a bystander vote once and then disables the vote buttons', () => {
    const onVote = vi.fn()
    render(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'voting', savingAttempt: 'bevi' }}
        myPlayerId="p2"
        onChoose={vi.fn()}
        onVote={onVote}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ci credo' }))

    expect(onVote).toHaveBeenCalledWith('valid')
    expect(screen.getByRole('button', { name: 'Ci credo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Non ci credo' })).toBeDisabled()
  })

  it('does not show vote buttons to the player being judged', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'voting', savingAttempt: 'bevi' }}
        myPlayerId="p1"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).not.toContain('Ci credo')
  })
})
