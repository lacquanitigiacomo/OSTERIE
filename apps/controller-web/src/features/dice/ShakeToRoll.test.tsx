// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ShakeToRoll } from './ShakeToRoll'
import { createRollCooldown, requestMotionPermission } from './motion-control'

describe('ShakeToRoll', () => {
  it('keeps the accessible fallback disabled outside the player turn', () => {
    const html = renderToStaticMarkup(<ShakeToRoll isActive={false} onRoll={vi.fn()} />)
    expect(html).toContain('disabled=""')
    expect(html).toContain('Lancia i dadi')
  })

  it('sends one roll during the 1.5 second cooldown', () => {
    const mayRoll = createRollCooldown(1_500)
    expect(mayRoll(10_000)).toBe(true)
    expect(mayRoll(11_499)).toBe(false)
    expect(mayRoll(11_500)).toBe(true)
  })

  it('requests iOS motion permission only after the user presses enable', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    expect(requestPermission).not.toHaveBeenCalled()
    await requestMotionPermission({ requestPermission })
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('shows tumbling dice immediately after a roll request', () => {
    render(<ShakeToRoll isActive onRoll={vi.fn()} lastDice={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lancia i dadi' }))
    expect(screen.getByRole('status').textContent).toContain('Dadi in movimento')
  })
})
