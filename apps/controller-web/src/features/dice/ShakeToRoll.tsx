import { useCallback, useEffect, useRef, useState } from 'react'
import { calculateImpulse, type MotionSample } from '../../lib/shake-detector'
import { createRollCooldown, requestMotionPermission, type MotionPermissionApi } from './motion-control'

interface ShakeToRollProps {
  isActive: boolean
  onRoll: (impulse: number) => void
  lastDice?: [number, number] | null
}

type DeviceMotionConstructor = typeof DeviceMotionEvent & MotionPermissionApi

const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'] as const

export function ShakeToRoll({ isActive, onRoll, lastDice = null }: ShakeToRollProps) {
  const [motionEnabled, setMotionEnabled] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [rolling, setRolling] = useState(false)
  const samples = useRef<MotionSample[]>([])
  const mayRoll = useRef(createRollCooldown(1_500))

  const roll = useCallback((impulse: number) => {
    if (!isActive || rolling || !mayRoll.current(performance.now())) return
    setRolling(true)
    onRoll(Math.max(0, Math.min(100, impulse)))
  }, [isActive, onRoll, rolling])

  useEffect(() => {
    if (!rolling || !lastDice) return undefined
    const timeout = globalThis.setTimeout(() => setRolling(false), 900)
    return () => globalThis.clearTimeout(timeout)
  }, [lastDice, rolling])

  const enableMotion = async () => {
    const constructor = globalThis.DeviceMotionEvent as DeviceMotionConstructor | undefined
    try {
      const granted = await requestMotionPermission(constructor)
      setMotionEnabled(granted)
      setPermissionDenied(!granted)
    } catch {
      setPermissionDenied(true)
    }
  }

  useEffect(() => {
    if (!motionEnabled || !isActive) return undefined
    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity
      if (!acceleration) return
      samples.current.push({
        x: acceleration.x ?? 0,
        y: acceleration.y ?? 0,
        z: acceleration.z ?? 0
      })
      samples.current = samples.current.slice(-4)
      const impulse = calculateImpulse(samples.current)
      if (impulse >= 20) {
        roll(impulse)
        samples.current = []
      }
    }
    globalThis.addEventListener('devicemotion', handleMotion)
    return () => globalThis.removeEventListener('devicemotion', handleMotion)
  }, [isActive, motionEnabled, roll])

  return (
    <section className="roll-panel" aria-labelledby="shake-title">
      <div className="motion-art" aria-hidden="true">
        <span className="motion-lines">)))</span>
        <span className="dice-cup">♜</span>
        <span className={`tiny-dice${rolling ? ' tiny-dice--rolling' : ''}`}>
          <span>{diceFaces[(lastDice?.[0] ?? 5) - 1]}</span>
          <span>{diceFaces[(lastDice?.[1] ?? 3) - 1]}</span>
        </span>
      </div>
      <h1 id="shake-title">{isActive ? 'Scuoti il telefono' : 'Aspetta il tuo turno'}</h1>
      <p className="roll-hint">
        {motionEnabled ? 'Il movimento è attivo' : 'Attiva il movimento oppure usa il pulsante'}
      </p>
      {!motionEnabled && (
        <button className="motion-button" type="button" onClick={enableMotion}>
          Attiva movimento
        </button>
      )}
      {permissionDenied && <p className="permission-note" role="status">Movimento non disponibile: usa il pulsante.</p>}
      {(rolling || lastDice) && (
        <p className="dice-status" role="status" aria-live="polite">
          {rolling ? 'Dadi in movimento…' : `Risultato: ${lastDice![0]} + ${lastDice![1]} = ${lastDice![0] + lastDice![1]}`}
        </p>
      )}
      <button
        className="roll-button"
        type="button"
        disabled={!isActive || rolling}
        onClick={() => roll(35)}
      >
        {rolling ? 'Dadi in movimento…' : 'Lancia i dadi'}
      </button>
    </section>
  )
}
