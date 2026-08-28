import type { GameRng } from './rng'
import type { GameState } from './state'

export interface DrawnCard {
  cardId: string
  deck: string[]
  discard: string[]
}

export const drawImprevistoCard = (state: GameState, rng: GameRng): DrawnCard => {
  const deck = state.imprevistiDeck.length > 0 ? state.imprevistiDeck : rng.shuffle(state.imprevistiDiscard)
  const discard = state.imprevistiDeck.length > 0 ? state.imprevistiDiscard : []
  const [cardId, ...rest] = deck

  return { cardId, deck: rest, discard: [...discard, cardId] }
}
