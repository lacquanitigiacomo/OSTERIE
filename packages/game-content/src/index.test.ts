import { describe, expect, it } from 'vitest'
import { getImprevistoCard, imprevistiCatalog } from './index'

describe('imprevistiCatalog', () => {
  it('has eight unique cards', () => {
    const ids = imprevistiCatalog.map((card) => card.id)
    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
  })

  it('gives every card at least two options plus the three save-yourself alternatives', () => {
    for (const card of imprevistiCatalog) {
      expect(card.options.length).toBeGreaterThanOrEqual(2)
      expect(card.saveYourself.scomoda).toBeTruthy()
      expect(card.saveYourself.fai).toBeTruthy()
      expect(card.saveYourself.bevi).toBeTruthy()
      expect(card.saveFallbackEffects.length).toBeGreaterThan(0)
    }
  })

  it('gives every option a unique id within its own card', () => {
    for (const card of imprevistiCatalog) {
      const optionIds = card.options.map((option) => option.id)
      expect(new Set(optionIds).size).toBe(optionIds.length)
    }
  })

  it('embeds two self-contained sub-options in every opponentChooses effect', () => {
    for (const card of imprevistiCatalog) {
      for (const option of card.options) {
        const delegated = option.effects.find((effect) => effect.type === 'opponentChooses')
        if (!delegated || delegated.type !== 'opponentChooses') continue
        expect(delegated.options).toHaveLength(2)
        expect(delegated.options[0].id).not.toBe(delegated.options[1].id)
      }
    }
  })
})

describe('getImprevistoCard', () => {
  it('finds a card by id', () => {
    expect(getImprevistoCard('01').title).toBe('Il telefono al 2%')
  })

  it('throws for an unknown id', () => {
    expect(() => getImprevistoCard('99')).toThrow('Unknown Imprevisto card id: 99')
  })
})
