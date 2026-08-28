export interface MotionPermissionApi {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function createRollCooldown(durationMs: number) {
  let nextAllowedAt = Number.NEGATIVE_INFINITY
  return (now: number) => {
    if (now < nextAllowedAt) return false
    nextAllowedAt = now + durationMs
    return true
  }
}

export async function requestMotionPermission(api?: MotionPermissionApi): Promise<boolean> {
  if (!api?.requestPermission) return true
  return (await api.requestPermission()) === 'granted'
}
