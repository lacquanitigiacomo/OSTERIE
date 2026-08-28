export interface GameRng {
  rollDie: () => number
  drawChance: () => number
  shuffle: <T>(items: readonly T[]) => T[]
  pickArbiter: (candidates: readonly string[]) => string
}

export const createRandomRng = (): GameRng => ({
  rollDie: () => Math.floor(Math.random() * 6) + 1,
  drawChance: () => Math.random(),
  shuffle: (items) => {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
  },
  pickArbiter: (candidates) => candidates[Math.floor(Math.random() * candidates.length)]
})
