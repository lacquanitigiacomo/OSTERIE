import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DiceRoll } from './DiceRoll'

describe('DiceRoll', () => {
  it('renders both authoritative dice and their total', () => {
    const html = renderToStaticMarkup(<DiceRoll dice={[2, 5]} total={7} rolling={false} />)
    expect(html).toContain('Dado 1: 2')
    expect(html).toContain('Dado 2: 5')
    expect(html).toContain('Totale 7')
  })

  it('marks dice as rolling while the reveal animation runs', () => {
    expect(renderToStaticMarkup(<DiceRoll dice={[1, 1]} total={2} rolling />)).toContain('dice-stage--rolling')
  })
})
