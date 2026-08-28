interface DiceRollProps {
  dice: [number, number]
  total: number
  rolling: boolean
}

const pips = Array.from({ length: 6 }, (_, index) => index + 1)

export function DiceRoll({ dice, total, rolling }: DiceRollProps) {
  return (
    <div className={`dice-stage ${rolling ? 'dice-stage--rolling' : ''}`} role="status" aria-live="polite">
      <div className="dice-pair" aria-label={`Dado 1: ${dice[0]}; Dado 2: ${dice[1]}`}>
        {dice.map((value, dieIndex) => (
          <div className={`die die--${value}`} aria-hidden="true" key={dieIndex}>
            {pips.map((pip) => <i className={`pip pip--${pip}`} key={pip} />)}
          </div>
        ))}
      </div>
      <strong>Totale {total}</strong>
    </div>
  )
}
