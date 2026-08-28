export interface MotionSample {
  x: number
  y: number
  z: number
}

export function calculateImpulse(samples: readonly MotionSample[]): number {
  if (samples.length < 2) return 0

  let strongest = 0
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    const delta = Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
      current.z - previous.z
    )
    strongest = Math.max(strongest, delta)
  }

  return Math.min(100, strongest)
}
