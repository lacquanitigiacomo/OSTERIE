import { describe, expect, it } from 'vitest'
import { parseClientCommand } from './index'

describe('parseClientCommand', () => {
  it('accepts a versioned join command', () => {
    expect(parseClientCommand({
      type: 'player.join', protocolVersion: 1, commandId: 'c1',
      roomCode: 'ABCD', playerId: 'p1', nickname: 'Gino'
    }).type).toBe('player.join')
  })

  it('rejects commands without an id', () => {
    expect(() => parseClientCommand({ type: 'dice.roll' })).toThrow()
  })
})
