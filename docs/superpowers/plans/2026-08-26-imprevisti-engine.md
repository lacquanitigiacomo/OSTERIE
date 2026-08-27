# Motore Imprevisti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded `friend_round` event with a data-driven Imprevisto card engine (8 representative cards covering every effect type), including the "Salva il culo" group-vote flow, wired end to end through the server reducer, the TV board and the phone controller.

**Architecture:** A new `packages/game-content` workspace package holds the card catalog as typed data (title, description, illustration, options, effects) and is the single source of truth read by both the server (to compute effects) and the two React apps (to render text/art) — the wire protocol only ever carries a `cardId`, never card text. The server reducer gains an injectable `GameRng` (dice, imprevisti draw chance, shuffle, arbiter pick) replacing the ad-hoc `RollDie` callback, a deck (`imprevistiDeck`/`imprevistiDiscard`) that reshuffles when exhausted, and a generic effect-application engine (`statDelta`, `move`, `skipNextTurn`, `delayNextInput`, `nextRollModifier`, `swapPositionWithPlayerBehind`, `opponentChooses`). `pendingEvent` becomes a discriminated union over `choosing` / `choosing-for-other` (arbiter) / `voting` (group vote) phases.

**Tech Stack:** TypeScript, React 19, Vitest, Zod (protocol schemas), npm workspaces (no build step for packages — `exports: "./src/index.ts"`).

**Spec:** `docs/superpowers/specs/2026-08-26-imprevisti-engine-design.md`

## Global Constraints

- No `Math.random()` calls anywhere in `apps/server/src/game/**` — all randomness goes through the injected `GameRng`, mirroring the existing `RollDie` pattern.
- No semicolons, single quotes, 2-space indentation — match the exact style already used in `apps/server/src/game/reducer.ts` and sibling files.
- `pendingEvent` carries no secret information — the controller UI derives its state entirely from `publicState.pendingEvent` plus the viewer's own `playerId`, never from a private per-player field.
- The 42 remaining catalog cards, the "Fortuna" deck, the minigame framework, avatar-based illustration variants, and a vote timeout are explicitly out of scope for this plan (see spec §8).
- `saveFallbackEffects` is uniform across all 8 cards: `[{ type: 'statDelta', stat: 'dignity', delta: -2 }, { type: 'statDelta', stat: 'suspicion', delta: 1 }]` — "the table wasn't convinced enough."
- A short window between Task 7 (protocol change) and the end of Task 12 (event.vote) is expected to leave `npm run typecheck` red in `apps/server` for files not yet touched by the task in progress — each task's own specified test command is the pass/fail gate during that window; Task 15 is the final all-green gate.
- `delayNextInput` (card 01, "Fai finta di niente") is stored on `GamePlayer.statusEffects.inputDelayMs` by the effect engine (Task 6) and never read back by anything else in this plan — no client-side delay UI, no server-side enforcement. The spec called this out as client-consumed, but wiring an actual artificial delay would mean either a real wall-clock delay inside a synchronous reducer (breaks its testability) or new protocol surface. That's more than this one card's effect is worth; storing the value keeps the type honest for a future follow-up without inventing that machinery now.

---

## Task 1: `packages/game-content` — card catalog package

**Files:**
- Create: `packages/game-content/package.json`
- Create: `packages/game-content/tsconfig.json`
- Create: `packages/game-content/src/index.ts`
- Test: `packages/game-content/src/index.test.ts`

**Interfaces:**
- Produces: `DirectEffect`, `OpponentChoosesEffect`, `Effect`, `ImprevistoOption`, `ImprevistoCard` types; `imprevistiCatalog: ImprevistoCard[]`; `getImprevistoCard(id: string): ImprevistoCard` (throws if unknown). Every later server/TV/controller task imports from here.

- [ ] **Step 1: Create the package manifest and tsconfig**

`packages/game-content/package.json`:

```json
{
  "name": "@osterie/game-content",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`packages/game-content/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": [
    "src"
  ]
}
```

- [ ] **Step 2: Write the failing catalog integrity test**

`packages/game-content/src/index.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/game-content && npx vitest run`
Expected: FAIL — `Cannot find module './index'` (file does not exist yet).

- [ ] **Step 4: Write the catalog**

`packages/game-content/src/index.ts`:

```ts
export type DirectEffect =
  | { type: 'statDelta'; stat: 'budget' | 'drunkenness' | 'dignity' | 'energy' | 'stomach' | 'suspicion'; delta: number }
  | { type: 'move'; spaces: number }
  | { type: 'skipNextTurn' }
  | { type: 'delayNextInput'; ms: number }
  | { type: 'nextRollModifier'; delta: number }
  | { type: 'swapPositionWithPlayerBehind' }

export interface OpponentChoosesEffect {
  type: 'opponentChooses'
  options: [
    { id: string; label: string; effects: DirectEffect[] },
    { id: string; label: string; effects: DirectEffect[] }
  ]
}

export type Effect = DirectEffect | OpponentChoosesEffect

export interface ImprevistoOption {
  id: string
  label: string
  effects: Effect[]
}

export interface ImprevistoCard {
  id: string
  title: string
  description: string
  illustration: string
  options: ImprevistoOption[]
  saveYourself: { scomoda: string; fai: string; bevi: string }
  saveFallbackEffects: DirectEffect[]
}

const saveFallbackEffects: DirectEffect[] = [
  { type: 'statDelta', stat: 'dignity', delta: -2 },
  { type: 'statDelta', stat: 'suspicion', delta: 1 }
]

export const imprevistiCatalog: ImprevistoCard[] = [
  {
    id: '01',
    title: 'Il telefono al 2%',
    description: 'Il tuo telefono emette il suo ultimo rantolo proprio quando tocca a te. Lo schermo si oscura lasciandoti come testamento un dignitosissimo 2%.',
    illustration: '/cards/imprevisti/01-telefono-al-2-percento.png',
    saveYourself: {
      scomoda: 'mostra al gruppo gli ultimi tre profili cercati sui social',
      fai: 'imita la vibrazione di un telefono morente',
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'modalita-aereo', label: 'Modalità aereo', effects: [{ type: 'statDelta', stat: 'energy', delta: 1 }] },
      { id: 'power-bank-del-tirchio', label: 'Power bank del tirchio', effects: [{ type: 'statDelta', stat: 'budget', delta: -2 }] },
      { id: 'fai-finta-di-niente', label: 'Fai finta di niente', effects: [{ type: 'delayNextInput', ms: 3_000 }] }
    ]
  },
  {
    id: '02',
    title: 'La scarpa traditrice',
    description: 'Hai pestato qualcosa di caldo, molle e filosoficamente discutibile. Non vuoi sapere cosa fosse, ma adesso cammini come un pinguino incazzato.',
    illustration: '/cards/imprevisti/02-la-scarpa-traditrice.png',
    saveYourself: {
      scomoda: 'lascia che il gruppo ispezioni e giudichi la suola delle tue scarpe',
      fai: 'attraversa la stanza camminando da pinguino',
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'pulizia-dignitosa', label: 'Pulizia dignitosa', effects: [{ type: 'statDelta', stat: 'budget', delta: -2 }, { type: 'statDelta', stat: 'dignity', delta: 1 }] },
      { id: 'continua-cosi', label: 'Continua così', effects: [{ type: 'statDelta', stat: 'dignity', delta: -1 }, { type: 'move', spaces: 1 }] }
    ]
  },
  {
    id: '03',
    title: "Messaggio all'ex",
    description: 'Hai scritto "mi manchi" alla persona sbagliata, usando pure il cuore rosso come un coglione. Tre puntini stanno lampeggiando e sembrano il conto alla rovescia della tua dignità.',
    illustration: '/cards/imprevisti/03-messaggio-allex.png',
    saveYourself: {
      scomoda: "mostra l'ultima conversazione in cui hai usato un cuore, nascondendo nomi e foto",
      fai: "recita una dichiarazione d'amore a una sedia",
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'cancella-e-nega-tutto', label: 'Cancella e nega tutto', effects: [{ type: 'statDelta', stat: 'suspicion', delta: 1 }] },
      { id: 'raddoppia-la-figura-di-merda', label: 'Raddoppia la figura di merda', effects: [{ type: 'statDelta', stat: 'dignity', delta: -2 }, { type: 'statDelta', stat: 'energy', delta: 1 }] },
      {
        id: 'passa-il-telefono',
        label: 'Passa il telefono',
        effects: [{
          type: 'opponentChooses',
          options: [
            { id: 'cancella-e-nega-tutto', label: 'Cancella e nega tutto', effects: [{ type: 'statDelta', stat: 'suspicion', delta: 1 }] },
            { id: 'raddoppia-la-figura-di-merda', label: 'Raddoppia la figura di merda', effects: [{ type: 'statDelta', stat: 'dignity', delta: -2 }, { type: 'statDelta', stat: 'energy', delta: 1 }] }
          ]
        }]
      }
    ]
  },
  {
    id: '08',
    title: 'La cintura ha mollato',
    description: 'Un bottone vola via con la velocità di un proiettile e colpisce un innocente. I pantaloni dichiarano ufficialmente conclusa la collaborazione con il tuo culo.',
    illustration: '/cards/imprevisti/08-la-cintura-ha-mollato.png',
    saveYourself: {
      scomoda: 'fai scegliere al gruppo il capo peggiore che indossi e difendilo come alta moda',
      fai: 'sfila come se i pantaloni stessero cadendo',
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'riparazione-creativa', label: 'Riparazione creativa', effects: [{ type: 'statDelta', stat: 'budget', delta: -1 }, { type: 'statDelta', stat: 'dignity', delta: 1 }] },
      { id: 'stile-libero', label: 'Stile libero', effects: [{ type: 'statDelta', stat: 'dignity', delta: -2 }, { type: 'move', spaces: 2 }] }
    ]
  },
  {
    id: '22',
    title: 'Pioggia bastarda',
    description: "Inizia a piovere soltanto sopra di voi, con precisione quasi personale. Il resto di Padova è asciutto e vi osserva mentre diventate una zuppa di studenti falliti.",
    illustration: '/cards/imprevisti/22-pioggia-bastarda.png',
    saveYourself: {
      scomoda: 'lascia che il gruppo valuti da uno a dieci quanto sei vestito male per il meteo',
      fai: 'interpreta un ombrello umano',
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'taxi', label: 'Taxi', effects: [{ type: 'statDelta', stat: 'budget', delta: -4 }, { type: 'move', spaces: 3 }] },
      { id: 'corsa-disperata', label: 'Corsa disperata', effects: [{ type: 'statDelta', stat: 'energy', delta: -2 }, { type: 'move', spaces: 2 }] },
      { id: 'aspetta', label: 'Aspetta', effects: [{ type: 'statDelta', stat: 'drunkenness', delta: -1 }] }
    ]
  },
  {
    id: '27',
    title: 'Google Maps ubriaco',
    description: "Il navigatore vi conduce davanti a un portone chiuso e annuncia trionfante: «Sei arrivato». Per lui l'osteria è dentro un appartamento al terzo piano e voi siete stronzi a dubitarne.",
    illustration: '/cards/imprevisti/27-google-maps-ubriaco.png',
    saveYourself: {
      scomoda: 'apri la mappa e mostra il luogo più inspiegabile salvato tra i preferiti',
      fai: 'dai indicazioni assurde al giocatore di fronte',
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'fidati-ancora', label: 'Fidati ancora', effects: [{ type: 'move', spaces: -2 }, { type: 'statDelta', stat: 'energy', delta: -1 }] },
      {
        id: 'chiedi-indicazioni',
        label: 'Chiedi indicazioni',
        effects: [{
          type: 'opponentChooses',
          options: [
            { id: 'avanza-di-uno', label: 'Fallo avanzare di 1', effects: [{ type: 'move', spaces: 1 }] },
            { id: 'perdi-due-euro', label: 'Fagli perdere 2€', effects: [{ type: 'statDelta', stat: 'budget', delta: -2 }] }
          ]
        }]
      }
    ]
  },
  {
    id: '30',
    title: 'Lucchetto maledetto',
    description: 'Qualcuno ha legato la propria bici alla tua con due catene e una convinzione incrollabile. È un capolavoro di coglionaggine urbana che neanche Leonardo avrebbe saputo progettare.',
    illustration: '/cards/imprevisti/30-lucchetto-maledetto.png',
    saveYourself: {
      scomoda: 'mostra una foto del caos nella tua camera, scrivania o borsa',
      fai: 'mima lo scasso del lucchetto senza toccare nulla',
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'aspetta-il-proprietario', label: 'Aspetta il proprietario', effects: [{ type: 'skipNextTurn' }, { type: 'statDelta', stat: 'suspicion', delta: -1 }] },
      { id: 'chiama-aiuto', label: 'Chiama aiuto', effects: [{ type: 'statDelta', stat: 'budget', delta: -3 }] }
    ]
  },
  {
    id: '36',
    title: 'Sedia traditrice',
    description: 'La sedia emette un rumore che sembra una dichiarazione di guerra internazionale. Tutto il locale si gira mentre tu cerchi di spiegare con gli occhi che non è stato il tuo culo.',
    illustration: '/cards/imprevisti/36-sedia-traditrice.png',
    saveYourself: {
      scomoda: 'lascia che il gruppo scelga quale tuo rumore corporeo ti rappresenta meglio',
      fai: 'riproduci il suono e attribuiscilo alla sedia',
      bevi: 'bevi un sorso'
    },
    saveFallbackEffects,
    options: [
      { id: 'cambia-posto', label: 'Cambia posto', effects: [{ type: 'swapPositionWithPlayerBehind' }] },
      { id: 'rimani-impassibile', label: 'Rimani impassibile', effects: [{ type: 'statDelta', stat: 'dignity', delta: 1 }, { type: 'nextRollModifier', delta: -1 }] }
    ]
  }
]

export const getImprevistoCard = (id: string): ImprevistoCard => {
  const card = imprevistiCatalog.find((entry) => entry.id === id)
  if (!card) throw new Error(`Unknown Imprevisto card id: ${id}`)
  return card
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/game-content && npx vitest run`
Expected: PASS (6 tests)

- [ ] **Step 6: Link the new workspace package**

Run from the repo root: `npm install`
Expected: no errors; `node_modules/@osterie/game-content` is symlinked to `packages/game-content`.

- [ ] **Step 7: Commit**

```bash
git add packages/game-content
git commit -m "feat: add Imprevisti card catalog package"
```

---

## Task 2: Injectable `GameRng`

**Files:**
- Create: `apps/server/src/game/rng.ts`
- Modify: `apps/server/src/game/reducer.ts`
- Modify: `apps/server/src/rooms/room-store.ts`
- Modify: `apps/server/src/server.ts`
- Modify: `apps/server/src/game/reducer.test.ts`
- Modify: `apps/server/src/server.test.ts`

**Interfaces:**
- Produces: `GameRng` interface (`rollDie`, `drawChance`, `shuffle`, `pickArbiter`), `createRandomRng(): GameRng`. `applyCommand(state, command, rng: GameRng)` replaces the old third `rollDie: RollDie` parameter — every later reducer task calls through this same `rng`.
- Consumes: nothing new (pure refactor of the existing `RollDie` plumbing).

This task is a pure signature refactor: `rollDice`'s behavior is unchanged, it now reads `rng.rollDie()` instead of calling the injected function directly. No card/deck/vote logic yet.

- [ ] **Step 1: Write the failing rng test**

`apps/server/src/game/rng.ts` doesn't exist yet, so start with its test inline in the same step (small pure-function module, one file for both is wasteful here — write the test file directly):

Create `apps/server/src/game/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRandomRng } from './rng'

describe('createRandomRng', () => {
  it('rolls a die between one and six', () => {
    const rng = createRandomRng()
    for (let i = 0; i < 50; i += 1) {
      const value = rng.rollDie()
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(6)
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('returns a draw chance between zero and one', () => {
    const rng = createRandomRng()
    const value = rng.drawChance()
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('shuffles without losing or duplicating items', () => {
    const rng = createRandomRng()
    const shuffled = rng.shuffle(['a', 'b', 'c', 'd'])
    expect(shuffled).toHaveLength(4)
    expect([...shuffled].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('picks an arbiter from the candidate list', () => {
    const rng = createRandomRng()
    expect(['p1', 'p2']).toContain(rng.pickArbiter(['p1', 'p2']))
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/server && npx vitest run src/game/rng.test.ts`
Expected: FAIL — `Cannot find module './rng'`

- [ ] **Step 3: Implement `rng.ts`**

`apps/server/src/game/rng.ts`:

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/server && npx vitest run src/game/rng.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Replace `RollDie` with `GameRng` in the reducer**

In `apps/server/src/game/reducer.ts`, replace:

```ts
export type RollDie = () => number
```

with:

```ts
import type { GameRng } from './rng'
```

(remove the `RollDie` type entirely — it moves into `rng.ts`).

Replace every `rollDie: RollDie` parameter with `rng: GameRng` in `ApplyCommandResult`'s producing functions:

```ts
const rollDice = (state: GameState, command: Extract<ClientCommand, { type: 'dice.roll' }>, rng: GameRng): ApplyCommandResult => {
  if (state.status !== 'playing' || state.activePlayerId !== command.playerId) {
    return reject(state, 'NOT_ACTIVE_PLAYER')
  }

  const dice: [number, number] = [rng.rollDie(), rng.rollDie()]
  if (dice.some((result) => !Number.isInteger(result) || result < 1 || result > 6)) {
    return reject(state, 'INVALID_DIE_ROLL')
  }

  const result = dice[0] + dice[1]

  const activePlayer = state.players[command.playerId]
  const activeIndex = state.playerOrder.indexOf(command.playerId)
  const nextPlayerId = state.playerOrder[(activeIndex + 1) % state.playerOrder.length] ?? null
  const position = activePlayer.position + result
  const pendingEvent = activePlayer.position < 3 && position >= 3
    ? { eventId: 'friend_round' as const, playerId: command.playerId }
    : null

  return accept({
    ...withProcessedCommand(state, command.commandId),
    activePlayerId: pendingEvent ? command.playerId : nextPlayerId,
    lastRoll: result,
    lastDice: dice,
    pendingEvent,
    players: {
      ...state.players,
      [command.playerId]: { ...activePlayer, position }
    }
  })
}
```

(body unchanged for now — only the parameter type changes from `rollDie: RollDie` to `rng: GameRng` and the call from `rollDie()` to `rng.rollDie()`; the `friend_round` logic itself is rewritten in Task 9, not here).

Update `chooseEvent`'s signature too, even though it doesn't use `rng` yet, so `applyCommand`'s switch stays uniform:

```ts
const chooseEvent = (state: GameState, command: Extract<ClientCommand, { type: 'event.choose' }>, rng: GameRng): ApplyCommandResult => {
```

(add the unused parameter now — Task 10 will use it for `pickArbiter`; leaving it unused would force a second signature-only edit later for no benefit).

Update `applyCommand`:

```ts
export const applyCommand = (state: GameState, command: ClientCommand, rng: GameRng): ApplyCommandResult => {
  if (state.processedCommandIds.includes(command.commandId)) {
    return accept(state)
  }

  if (command.roomCode !== state.roomCode) {
    return reject(state, 'ROOM_MISMATCH')
  }

  switch (command.type) {
    case 'player.join':
      return addPlayer(state, command)
    case 'game.start':
      return startGame(state, command)
    case 'dice.roll':
      return rollDice(state, command, rng)
    case 'event.choose':
      return chooseEvent(state, command, rng)
  }
}
```

- [ ] **Step 6: Update `room-store.ts` and `server.ts`**

`apps/server/src/rooms/room-store.ts` — replace the `RollDie` import and `apply` signature:

```ts
import type { ClientCommand } from '../../../../packages/protocol/src/index'
import { applyCommand, type ApplyCommandResult } from '../game/reducer'
import type { GameRng } from '../game/rng'
import { createGame, type GameState } from '../game/state'

interface GameRoom {
  state: GameState
}

export class RoomStore {
  private readonly rooms = new Map<string, GameRoom>()

  getState(roomCode: string): GameState {
    return this.getRoom(roomCode).state
  }

  apply(command: ClientCommand, rng: GameRng): ApplyCommandResult {
    const room = this.getRoom(command.roomCode)
    const result = applyCommand(room.state, command, rng)
    room.state = result.state
    return result
  }

  private getRoom(roomCode: string): GameRoom {
    const existing = this.rooms.get(roomCode)
    if (existing) return existing

    const room = { state: createGame(roomCode) }
    this.rooms.set(roomCode, room)
    return room
  }
}
```

`apps/server/src/server.ts` — replace the local `rollDie` default and the `randomDie` parameter:

```ts
import type { Server as HttpServer } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { parseClientCommand, type ServerEvent } from '../../../packages/protocol/src/index'
import { createRandomRng, type GameRng } from './game/rng'
import { projectPrivate, projectPublic } from './rooms/projections'
import { RoomStore } from './rooms/room-store'
```

(remove the `const rollDie = () => Math.floor(Math.random() * 6) + 1` line entirely)

```ts
export const createGameServer = (httpServer: HttpServer, rng: GameRng = createRandomRng()): GameServer => {
```

and inside `onMessage`, replace:

```ts
const result = rooms.apply(command, randomDie)
```

with:

```ts
const result = rooms.apply(command, rng)
```

- [ ] **Step 7: Update `reducer.test.ts` call sites**

In `apps/server/src/game/reducer.test.ts`, add a `testRng` helper right after the existing `sequenceDie` helper:

```ts
import type { GameRng } from './rng'

const testRng = (overrides: Partial<GameRng> = {}): GameRng => ({
  rollDie: () => 1,
  drawChance: () => 1,
  shuffle: (items) => [...items],
  pickArbiter: (candidates) => candidates[0],
  ...overrides
})
```

`drawChance: () => 1` means "never probabilistically draw a card" by default (the base chance is 0.15, and `1` is never below it) — every pre-existing test keeps its old deterministic behavior unless it explicitly overrides `drawChance`.

Replace every third argument to `applyCommand` that isn't already `sequenceDie(...)`-based:

- `applyCommand(game, join(playerId), () => 1).state` → `applyCommand(game, join(playerId), testRng()).state` (in `gameWithPlayers`)
- `applyCommand(gameWithPlayers('p1'), start('p1'), () => 1).state` → `..., testRng()).state` (every occurrence)
- `applyCommand(started, roll('p1'), sequenceDie(2, 5))` → `applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) }))`
- `applyCommand(rolled.state, roll('p1'), sequenceDie(1, 1))` and similar → wrap the same way
- `applyCommand(started, roll('p2'), () => 4)` → `testRng({ rollDie: () => 4 })`
- `applyCommand(once.state, command, () => 6)` → `testRng({ rollDie: () => 6 })`
- `applyCommand(started, roll('p1'), () => 7)` → `testRng({ rollDie: () => 7 })`
- `applyCommand(pending, choose('p1', 'offer'), () => 1)` and the `'refuse'` sibling → `testRng()`

Do **not** touch the three `friend_round`-specific tests yet (lines defining `'opens friend_round...'`, `'resolves friend_round offer...'`, `'resolves friend_round refusal...'`) beyond this same rng-wrapping — they still pass at the end of this task because the reducer's internal logic hasn't changed, only how the rng is threaded through. Task 9 deletes and replaces them.

- [ ] **Step 8: Update `server.test.ts` call sites**

In `apps/server/src/server.test.ts`, the two explicit calls:

```ts
const gameServer = createGameServer(httpServer, () => 1)
```

become:

```ts
const gameServer = createGameServer(httpServer, {
  rollDie: () => 1,
  drawChance: () => 1,
  shuffle: (items) => [...items],
  pickArbiter: (candidates) => candidates[0]
})
```

(the three call sites already using no second argument — `createGameServer(httpServer)` — need no change, they keep using the real `createRandomRng()` default).

- [ ] **Step 9: Run the full server test suite to verify everything still passes**

Run: `cd apps/server && npx vitest run`
Expected: PASS, same test count as before this task (no tests added or removed, only signatures changed).

- [ ] **Step 10: Typecheck**

Run: `cd apps/server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/server/src/game/rng.ts apps/server/src/game/rng.test.ts apps/server/src/game/reducer.ts apps/server/src/rooms/room-store.ts apps/server/src/server.ts apps/server/src/game/reducer.test.ts apps/server/src/server.test.ts
git commit -m "refactor: replace RollDie callback with an injectable GameRng"
```

---

## Task 3: Extend `GamePlayer` and `GameState`

**Files:**
- Modify: `apps/server/src/game/state.ts`
- Modify: `apps/server/src/game/reducer.ts`
- Test: `apps/server/src/game/state.test.ts` (new)

**Interfaces:**
- Produces: `GamePlayer.energy/stomach/suspicion/statusEffects`, `GameState.imprevistiDeck/imprevistiDiscard/pendingVotes`. Task 4 (deck), Task 5 (turn/statusEffects), Task 6 (effects) all read these fields. `pendingEvent`'s type is **not** touched in this task — that happens in Task 8, once the protocol change (Task 7) has landed.

- [ ] **Step 1: Write the failing state test**

`apps/server/src/game/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { imprevistiCatalog } from '../../../../packages/game-content/src/index'
import { createGame } from './state'

describe('createGame', () => {
  it('seeds the Imprevisti discard with the full catalog and starts with an empty deck', () => {
    const game = createGame('ABCD')

    expect(game.imprevistiDeck).toEqual([])
    expect(game.imprevistiDiscard.sort()).toEqual(imprevistiCatalog.map((card) => card.id).sort())
    expect(game.pendingVotes).toEqual({})
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/server && npx vitest run src/game/state.test.ts`
Expected: FAIL — `imprevistiDeck` is `undefined`.

- [ ] **Step 3: Extend `GamePlayer` and `GameState`**

In `apps/server/src/game/state.ts`, add the import and extend both interfaces:

```ts
import { imprevistiCatalog } from '../../../../packages/game-content/src/index'

export interface GamePlayer {
  playerId: string
  nickname: string
  position: number
  budget: number
  drunkenness: number
  dignity: number
  energy: number
  stomach: number
  suspicion: number
  statusEffects: {
    skipNextTurn?: boolean
    inputDelayMs?: number
    nextRollModifier?: number
  }
}

export type RejectionCode =
  | 'ALREADY_JOINED'
  | 'GAME_ALREADY_STARTED'
  | 'INVALID_DIE_ROLL'
  | 'NOT_ACTIVE_PLAYER'
  | 'NOT_HOST_PLAYER'
  | 'NO_PENDING_EVENT'
  | 'INVALID_EVENT_CHOICE'
  | 'PLAYER_NOT_FOUND'
  | 'ROOM_MISMATCH'
  | 'UNSUPPORTED_COMMAND'

export interface GameState {
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  activePlayerId: string | null
  players: Record<string, GamePlayer>
  playerOrder: string[]
  processedCommandIds: string[]
  lastRoll: number | null
  lastDice: [number, number] | null
  pendingEvent: { eventId: 'friend_round'; playerId: string } | null
  imprevistiDeck: string[]
  imprevistiDiscard: string[]
  pendingVotes: Record<string, 'valid' | 'invalid'>
}

export const createGame = (roomCode: string): GameState => ({
  roomCode,
  status: 'lobby',
  activePlayerId: null,
  players: {},
  playerOrder: [],
  processedCommandIds: [],
  lastRoll: null,
  lastDice: null,
  pendingEvent: null,
  imprevistiDeck: [],
  imprevistiDiscard: imprevistiCatalog.map((card) => card.id),
  pendingVotes: {}
})
```

(`pendingEvent`'s type is left exactly as it was — still the old `friend_round`-shaped inline type. It gets replaced in Task 8.)

- [ ] **Step 4: Initialize the new player fields in `addPlayer`**

In `apps/server/src/game/reducer.ts`, update the player literal inside `addPlayer`:

```ts
const player: GamePlayer = {
  playerId: command.playerId,
  nickname: command.nickname,
  position: 0,
  budget: 30,
  drunkenness: 0,
  dignity: 10,
  energy: 10,
  stomach: 0,
  suspicion: 0,
  statusEffects: {}
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run`
Expected: PASS (the new `state.test.ts` plus everything from Task 2, unchanged — the existing `'initializes joined players with the default private state'` test uses `toMatchObject`, so it stays green with the extra fields).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/game/state.ts apps/server/src/game/state.test.ts apps/server/src/game/reducer.ts
git commit -m "feat: extend GamePlayer and GameState for the Imprevisti engine"
```

---

## Task 4: Imprevisti deck (draw + reshuffle)

**Files:**
- Create: `apps/server/src/game/imprevisti-deck.ts`
- Test: `apps/server/src/game/imprevisti-deck.test.ts`

**Interfaces:**
- Consumes: `GameState.imprevistiDeck/imprevistiDiscard` (Task 3), `GameRng.shuffle` (Task 2).
- Produces: `drawImprevistoCard(state: GameState, rng: GameRng): { cardId: string; deck: string[]; discard: string[] }`. Task 9 (reducer draw trigger) calls this directly.

- [ ] **Step 1: Write the failing tests**

`apps/server/src/game/imprevisti-deck.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGame } from './state'
import { drawImprevistoCard } from './imprevisti-deck'
import type { GameRng } from './rng'

const identityRng: GameRng = {
  rollDie: () => 1,
  drawChance: () => 1,
  shuffle: (items) => [...items],
  pickArbiter: (candidates) => candidates[0]
}

describe('drawImprevistoCard', () => {
  it('reshuffles the discard into the deck on the very first draw', () => {
    const game = createGame('ABCD')
    const draw = drawImprevistoCard(game, identityRng)

    expect(draw.cardId).toBe('01')
    expect(draw.deck).toHaveLength(7)
    expect(draw.discard).toContain('01')
  })

  it('draws from an existing deck without reshuffling', () => {
    const game = { ...createGame('ABCD'), imprevistiDeck: ['22', '30'], imprevistiDiscard: ['01', '02', '03', '08', '27', '36'] }
    const draw = drawImprevistoCard(game, identityRng)

    expect(draw.cardId).toBe('22')
    expect(draw.deck).toEqual(['30'])
    expect(draw.discard).toEqual(['01', '02', '03', '08', '27', '36', '22'])
  })

  it('reshuffles once the deck runs out', () => {
    const game = { ...createGame('ABCD'), imprevistiDeck: [], imprevistiDiscard: ['08', '22'] }
    const draw = drawImprevistoCard(game, identityRng)

    expect(draw.cardId).toBe('08')
    expect(draw.deck).toEqual(['22'])
    expect(draw.discard).toEqual(['08'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && npx vitest run src/game/imprevisti-deck.test.ts`
Expected: FAIL — `Cannot find module './imprevisti-deck'`

- [ ] **Step 3: Implement the deck**

`apps/server/src/game/imprevisti-deck.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run src/game/imprevisti-deck.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/imprevisti-deck.ts apps/server/src/game/imprevisti-deck.test.ts
git commit -m "feat: add the Imprevisti deck draw/reshuffle helper"
```

---

## Task 5: `advanceTurn` helper (centralizes skip logic)

**Files:**
- Create: `apps/server/src/game/turn.ts`
- Test: `apps/server/src/game/turn.test.ts`
- Modify: `apps/server/src/game/reducer.ts`

**Interfaces:**
- Consumes: `GameState.playerOrder`, `GamePlayer.statusEffects.skipNextTurn` (Task 3).
- Produces: `advanceTurn(state: GameState, fromPlayerId: string): string | null` — returns the next active player id, consuming (clearing) `skipNextTurn` along the way. It does **not** return an updated `GameState` for the skipped players' flags — callers must fold the returned id into their own state update; the flag-clearing is folded into the same reducer step via `applyDirectEffects`-free direct mutation kept local to this helper is avoided on purpose (this helper is pure and only computes the id — Task 10/11/12 apply the flag-clear as part of the same state update they already build). To keep this simple and avoid two sources of truth, `advanceTurn` returns both the id **and** the state with cleared flags.

- [ ] **Step 1: Write the failing tests**

`apps/server/src/game/turn.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from './state'
import { advanceTurn } from './turn'

const withPlayers = (...ids: string[]): GameState => {
  let state = createGame('ABCD')
  for (const id of ids) {
    state = {
      ...state,
      playerOrder: [...state.playerOrder, id],
      players: {
        ...state.players,
        [id]: { playerId: id, nickname: id, position: 0, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} }
      }
    }
  }
  return state
}

describe('advanceTurn', () => {
  it('moves to the next player in order', () => {
    const state = withPlayers('p1', 'p2', 'p3')
    const { nextPlayerId } = advanceTurn(state, 'p1')

    expect(nextPlayerId).toBe('p2')
  })

  it('wraps around to the first player', () => {
    const state = withPlayers('p1', 'p2')
    const { nextPlayerId } = advanceTurn(state, 'p2')

    expect(nextPlayerId).toBe('p1')
  })

  it('skips a player flagged with skipNextTurn and clears the flag', () => {
    let state = withPlayers('p1', 'p2', 'p3')
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, statusEffects: { skipNextTurn: true } } } }

    const { nextPlayerId, state: resolved } = advanceTurn(state, 'p1')

    expect(nextPlayerId).toBe('p3')
    expect(resolved.players.p2.statusEffects.skipNextTurn).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && npx vitest run src/game/turn.test.ts`
Expected: FAIL — `Cannot find module './turn'`

- [ ] **Step 3: Implement `advanceTurn`**

`apps/server/src/game/turn.ts`:

```ts
import type { GameState } from './state'

export interface AdvanceTurnResult {
  nextPlayerId: string | null
  state: GameState
}

export const advanceTurn = (state: GameState, fromPlayerId: string): AdvanceTurnResult => {
  const order = state.playerOrder
  if (order.length === 0) return { nextPlayerId: null, state }

  let current = state
  let index = order.indexOf(fromPlayerId)

  for (let step = 0; step < order.length; step += 1) {
    index = (index + 1) % order.length
    const candidateId = order[index]
    const candidate = current.players[candidateId]

    if (!candidate.statusEffects.skipNextTurn) {
      return { nextPlayerId: candidateId, state: current }
    }

    current = {
      ...current,
      players: {
        ...current.players,
        [candidateId]: { ...candidate, statusEffects: { ...candidate.statusEffects, skipNextTurn: undefined } }
      }
    }
  }

  return { nextPlayerId: null, state: current }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run src/game/turn.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire `advanceTurn` into `rollDice` and `chooseEvent`**

In `apps/server/src/game/reducer.ts`, import it:

```ts
import { advanceTurn } from './turn'
```

Replace the inline next-player computation in `rollDice`:

```ts
const activePlayer = state.players[command.playerId]
const activeIndex = state.playerOrder.indexOf(command.playerId)
const nextPlayerId = state.playerOrder[(activeIndex + 1) % state.playerOrder.length] ?? null
const position = activePlayer.position + result
const pendingEvent = activePlayer.position < 3 && position >= 3
  ? { eventId: 'friend_round' as const, playerId: command.playerId }
  : null

return accept({
  ...withProcessedCommand(state, command.commandId),
  activePlayerId: pendingEvent ? command.playerId : nextPlayerId,
  lastRoll: result,
  lastDice: dice,
  pendingEvent,
  players: {
    ...state.players,
    [command.playerId]: { ...activePlayer, position }
  }
})
```

with:

```ts
const activePlayer = state.players[command.playerId]
const position = activePlayer.position + result
const pendingEvent = activePlayer.position < 3 && position >= 3
  ? { eventId: 'friend_round' as const, playerId: command.playerId }
  : null

const moved = {
  ...withProcessedCommand(state, command.commandId),
  lastRoll: result,
  lastDice: dice,
  pendingEvent,
  players: {
    ...state.players,
    [command.playerId]: { ...activePlayer, position }
  }
}

if (pendingEvent) {
  return accept({ ...moved, activePlayerId: command.playerId })
}

const { nextPlayerId, state: advanced } = advanceTurn(moved, command.playerId)
return accept({ ...advanced, activePlayerId: nextPlayerId })
```

(behavior is identical to before — this is a pure refactor; the `friend_round` logic itself is still untouched, Task 9 rewrites it).

Replace the inline next-player computation in `chooseEvent` the same way:

```ts
const chooseEvent = (state: GameState, command: Extract<ClientCommand, { type: 'event.choose' }>, rng: GameRng): ApplyCommandResult => {
  const event = state.pendingEvent
  if (!event || event.playerId !== command.playerId) return reject(state, 'NO_PENDING_EVENT')
  if (command.choiceId !== 'offer' && command.choiceId !== 'refuse') return reject(state, 'INVALID_EVENT_CHOICE')

  const player = state.players[command.playerId]
  const resolvedPlayer = command.choiceId === 'offer'
    ? { ...player, budget: Math.max(0, player.budget - 5) }
    : { ...player, dignity: Math.max(0, player.dignity - 2) }

  const resolved = {
    ...withProcessedCommand(state, command.commandId),
    pendingEvent: null,
    players: { ...state.players, [command.playerId]: resolvedPlayer }
  }
  const { nextPlayerId, state: advanced } = advanceTurn(resolved, command.playerId)
  return accept({ ...advanced, activePlayerId: nextPlayerId })
}
```

- [ ] **Step 6: Run the full server suite to verify everything still passes**

Run: `cd apps/server && npx vitest run`
Expected: PASS, same tests as after Task 3 plus the 3 new `turn.test.ts` tests.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/game/turn.ts apps/server/src/game/turn.test.ts apps/server/src/game/reducer.ts
git commit -m "refactor: centralize turn advancement in advanceTurn"
```

---

## Task 6: Direct effect application engine

**Files:**
- Create: `apps/server/src/game/effects.ts`
- Test: `apps/server/src/game/effects.test.ts`

**Interfaces:**
- Consumes: `DirectEffect` (Task 1, `packages/game-content`), `GameState`/`GamePlayer` (Task 3).
- Produces: `applyDirectEffects(state: GameState, playerId: string, effects: DirectEffect[]): GameState`. Tasks 9–12 (reducer resolution) call this for every non-`opponentChooses` effect list.

- [ ] **Step 1: Write the failing tests**

`apps/server/src/game/effects.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from './state'
import { applyDirectEffects } from './effects'

const withPlayers = (...ids: string[]): GameState => {
  let state = createGame('ABCD')
  for (const id of ids) {
    state = {
      ...state,
      playerOrder: [...state.playerOrder, id],
      players: {
        ...state.players,
        [id]: { playerId: id, nickname: id, position: 5, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} }
      }
    }
  }
  return state
}

describe('applyDirectEffects', () => {
  it('applies a statDelta and clamps at zero', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'statDelta', stat: 'budget', delta: -100 }])

    expect(result.players.p1.budget).toBe(0)
  })

  it('applies a move and clamps at zero', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'move', spaces: -100 }])

    expect(result.players.p1.position).toBe(0)
  })

  it('sets skipNextTurn', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'skipNextTurn' }])

    expect(result.players.p1.statusEffects.skipNextTurn).toBe(true)
  })

  it('sets delayNextInput', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'delayNextInput', ms: 3_000 }])

    expect(result.players.p1.statusEffects.inputDelayMs).toBe(3_000)
  })

  it('sets nextRollModifier', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [{ type: 'nextRollModifier', delta: -1 }])

    expect(result.players.p1.statusEffects.nextRollModifier).toBe(-1)
  })

  it('swaps position with the closest player behind', () => {
    let state = withPlayers('p1', 'p2', 'p3')
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, position: 10 },
        p2: { ...state.players.p2, position: 4 },
        p3: { ...state.players.p3, position: 7 }
      }
    }
    const result = applyDirectEffects(state, 'p1', [{ type: 'swapPositionWithPlayerBehind' }])

    expect(result.players.p1.position).toBe(7)
    expect(result.players.p3.position).toBe(10)
    expect(result.players.p2.position).toBe(4)
  })

  it('leaves position unchanged when swapping and no one is behind', () => {
    let state = withPlayers('p1', 'p2')
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, position: 0 }, p2: { ...state.players.p2, position: 10 } } }
    const result = applyDirectEffects(state, 'p1', [{ type: 'swapPositionWithPlayerBehind' }])

    expect(result.players.p1.position).toBe(0)
  })

  it('applies multiple effects in order', () => {
    const state = withPlayers('p1')
    const result = applyDirectEffects(state, 'p1', [
      { type: 'statDelta', stat: 'dignity', delta: -2 },
      { type: 'move', spaces: 2 }
    ])

    expect(result.players.p1.dignity).toBe(8)
    expect(result.players.p1.position).toBe(7)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && npx vitest run src/game/effects.test.ts`
Expected: FAIL — `Cannot find module './effects'`

- [ ] **Step 3: Implement the effect engine**

`apps/server/src/game/effects.ts`:

```ts
import type { DirectEffect } from '../../../../packages/game-content/src/index'
import type { GamePlayer, GameState } from './state'

export const applyDirectEffects = (state: GameState, playerId: string, effects: DirectEffect[]): GameState =>
  effects.reduce((current, effect) => applyOne(current, playerId, effect), state)

const applyOne = (state: GameState, playerId: string, effect: DirectEffect): GameState => {
  const player = state.players[playerId]

  switch (effect.type) {
    case 'statDelta':
      return withPlayer(state, playerId, { ...player, [effect.stat]: Math.max(0, player[effect.stat] + effect.delta) })
    case 'move':
      return withPlayer(state, playerId, { ...player, position: Math.max(0, player.position + effect.spaces) })
    case 'skipNextTurn':
      return withPlayer(state, playerId, { ...player, statusEffects: { ...player.statusEffects, skipNextTurn: true } })
    case 'delayNextInput':
      return withPlayer(state, playerId, { ...player, statusEffects: { ...player.statusEffects, inputDelayMs: effect.ms } })
    case 'nextRollModifier':
      return withPlayer(state, playerId, { ...player, statusEffects: { ...player.statusEffects, nextRollModifier: effect.delta } })
    case 'swapPositionWithPlayerBehind': {
      const behind = findPlayerBehind(state, playerId)
      if (!behind) return state
      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: { ...player, position: behind.position },
          [behind.playerId]: { ...behind, position: player.position }
        }
      }
    }
  }
}

const withPlayer = (state: GameState, playerId: string, player: GamePlayer): GameState => ({
  ...state,
  players: { ...state.players, [playerId]: player }
})

const findPlayerBehind = (state: GameState, playerId: string): GamePlayer | null => {
  const player = state.players[playerId]
  const candidates = state.playerOrder
    .filter((id) => id !== playerId)
    .map((id) => state.players[id])
    .filter((other) => other.position < player.position)

  if (candidates.length === 0) return null
  return candidates.reduce((closest, other) => (other.position > closest.position ? other : closest))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run src/game/effects.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/effects.ts apps/server/src/game/effects.test.ts
git commit -m "feat: add the direct effect application engine"
```

---

## Task 7: Protocol — `PendingEvent` union and `event.vote`

**Files:**
- Modify: `packages/protocol/src/index.ts`

**Interfaces:**
- Produces: `PendingEvent` type (exported), `PublicGameState.pendingEvent: PendingEvent | null`, `event.vote` client command. `PrivatePlayerState` no longer has a `pendingEvent` field.
- **Breaking change, expected:** after this task, `apps/server/src/game/state.ts` (still using the old inline `{ eventId, playerId }` shape), `apps/server/src/rooms/projections.ts`, `apps/controller-web/src/App.tsx` and `apps/tv-web/src/features/game/BoardScreen.tsx` no longer type-check against `PublicGameState`/`PrivatePlayerState`. This is resolved by the end of Task 12 (server side) and Tasks 13–14 (client side) — see the Global Constraints note.

- [ ] **Step 1: Edit `packages/protocol/src/index.ts`**

Replace the whole file with:

```ts
import { z } from 'zod'

const envelope = {
  protocolVersion: z.literal(1),
  commandId: z.string().min(1),
  roomCode: z.string().length(4),
  playerId: z.string().min(1)
}

export const clientCommandSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelope,
    type: z.literal('player.join'),
    nickname: z.string().trim().min(1).max(20)
  }),
  z.object({ ...envelope, type: z.literal('game.start') }),
  z.object({
    ...envelope,
    type: z.literal('dice.roll'),
    impulse: z.number().min(0).max(100)
  }),
  z.object({
    ...envelope,
    type: z.literal('event.choose'),
    choiceId: z.string().min(1)
  }),
  z.object({
    ...envelope,
    type: z.literal('event.vote'),
    vote: z.enum(['valid', 'invalid'])
  })
])

export const parseClientCommand = (input: unknown) => clientCommandSchema.parse(input)

export type ClientCommand = z.infer<typeof clientCommandSchema>

export interface PublicPlayerState {
  playerId: string
  nickname: string
  position: number
}

export type PendingEvent =
  | { cardId: string; playerId: string; phase: 'choosing' }
  | {
      cardId: string
      playerId: string
      phase: 'choosing-for-other'
      arbiterId: string
      options: [{ id: string; label: string }, { id: string; label: string }]
    }
  | { cardId: string; playerId: string; phase: 'voting'; savingAttempt: 'scomoda' | 'fai' | 'bevi' }

export interface PublicGameState {
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  activePlayerId: string | null
  players: PublicPlayerState[]
  lastRoll: number | null
  lastDice: [number, number] | null
  pendingEvent: PendingEvent | null
}

export interface PrivatePlayerState {
  roomCode: string
  playerId: string
  status: 'lobby' | 'playing' | 'finished'
  activePlayerId: string | null
  isMyTurn: boolean
  lastRoll: number | null
  lastDice: [number, number] | null
  budget: number
  drunkenness: number
  dignity: number
}

export type ServerEvent =
  | {
      type: 'game.public-state'
      protocolVersion: 1
      state: PublicGameState
    }
  | {
      type: 'player.private-state'
      protocolVersion: 1
      state: PrivatePlayerState
    }
  | {
      type: 'command.rejected'
      protocolVersion: 1
      commandId: string
      code: string
    }
```

- [ ] **Step 2: Run the protocol test suite**

Run: `cd packages/protocol && npx vitest run`
Expected: PASS (2 tests, unchanged — `parseClientCommand` behavior for `player.join`/`dice.roll` isn't affected).

- [ ] **Step 3: Commit**

```bash
git add packages/protocol/src/index.ts
git commit -m "feat: generalize pendingEvent protocol and add event.vote"
```

(Downstream files are intentionally left red until Task 8 — do not attempt to fix `state.ts`/`projections.ts`/the two apps in this task.)

---

## Task 8: Wire the new `PendingEvent` through server state and projections

**Files:**
- Modify: `apps/server/src/game/state.ts`
- Modify: `apps/server/src/rooms/projections.ts`
- Modify: `apps/server/src/server.test.ts`
- Test: `apps/server/src/rooms/projections.test.ts` (new)

**Interfaces:**
- Produces: `GameState.pendingEvent` typed as the richer server-internal union (below) — `phase: 'choosing-for-other'` carries full `effects` arrays server-side, stripped to `{id,label}` in the public projection. Tasks 9–12 build/read this shape directly.
- Consumes: `DirectEffect` (Task 1).

- [ ] **Step 1: Retype `GameState.pendingEvent` in `state.ts`**

In `apps/server/src/game/state.ts`, add the import and replace the `pendingEvent` field's type:

```ts
import type { DirectEffect } from '../../../../packages/game-content/src/index'
```

```ts
export type PendingEvent =
  | { cardId: string; playerId: string; phase: 'choosing' }
  | {
      cardId: string
      playerId: string
      phase: 'choosing-for-other'
      arbiterId: string
      options: [
        { id: string; label: string; effects: DirectEffect[] },
        { id: string; label: string; effects: DirectEffect[] }
      ]
    }
  | { cardId: string; playerId: string; phase: 'voting'; savingAttempt: 'scomoda' | 'fai' | 'bevi' }

export interface GameState {
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  activePlayerId: string | null
  players: Record<string, GamePlayer>
  playerOrder: string[]
  processedCommandIds: string[]
  lastRoll: number | null
  lastDice: [number, number] | null
  pendingEvent: PendingEvent | null
  imprevistiDeck: string[]
  imprevistiDiscard: string[]
  pendingVotes: Record<string, 'valid' | 'invalid'>
}
```

(`createGame`'s object literal is unchanged — `pendingEvent: null` still satisfies the new type.)

- [ ] **Step 2: Write the failing projections tests**

`apps/server/src/rooms/projections.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from '../game/state'
import { projectPrivate, projectPublic } from './projections'

const baseState = (): GameState => ({
  ...createGame('ABCD'),
  status: 'playing',
  playerOrder: ['p1', 'p2'],
  activePlayerId: 'p1',
  players: {
    p1: { playerId: 'p1', nickname: 'Uno', position: 3, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} },
    p2: { playerId: 'p2', nickname: 'Due', position: 0, budget: 30, drunkenness: 0, dignity: 10, energy: 10, stomach: 0, suspicion: 0, statusEffects: {} }
  }
})

describe('projectPublic', () => {
  it('passes a choosing pendingEvent through unchanged', () => {
    const state = { ...baseState(), pendingEvent: { cardId: '01', playerId: 'p1', phase: 'choosing' as const } }
    expect(projectPublic(state).pendingEvent).toEqual({ cardId: '01', playerId: 'p1', phase: 'choosing' })
  })

  it('strips effects from a choosing-for-other pendingEvent', () => {
    const state: GameState = {
      ...baseState(),
      pendingEvent: {
        cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
        options: [
          { id: 'a', label: 'Opzione A', effects: [{ type: 'statDelta', stat: 'dignity', delta: -1 }] },
          { id: 'b', label: 'Opzione B', effects: [{ type: 'statDelta', stat: 'suspicion', delta: 1 }] }
        ]
      }
    }
    expect(projectPublic(state).pendingEvent).toEqual({
      cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
      options: [{ id: 'a', label: 'Opzione A' }, { id: 'b', label: 'Opzione B' }]
    })
  })
})

describe('projectPrivate', () => {
  it('no longer exposes a pendingEvent field', () => {
    const state = { ...baseState(), pendingEvent: { cardId: '01', playerId: 'p1', phase: 'choosing' as const } }
    const result = projectPrivate(state, 'p1')

    expect(result).not.toHaveProperty('pendingEvent')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/server && npx vitest run src/rooms/projections.test.ts`
Expected: FAIL — `projectPublic`/`projectPrivate` still build the old `eventId`-shaped object, so the new assertions don't match (and `state.ts`'s type change already makes this file fail to compile at the type level, which is expected per Task 7's note).

- [ ] **Step 4: Update `projections.ts`**

`apps/server/src/rooms/projections.ts`:

```ts
import type { PrivatePlayerState, PublicGameState } from '../../../../packages/protocol/src/index'
import type { GameState } from '../game/state'

const toPublicPendingEvent = (pendingEvent: GameState['pendingEvent']): PublicGameState['pendingEvent'] => {
  if (!pendingEvent) return null
  if (pendingEvent.phase === 'choosing-for-other') {
    return {
      cardId: pendingEvent.cardId,
      playerId: pendingEvent.playerId,
      phase: 'choosing-for-other',
      arbiterId: pendingEvent.arbiterId,
      options: [
        { id: pendingEvent.options[0].id, label: pendingEvent.options[0].label },
        { id: pendingEvent.options[1].id, label: pendingEvent.options[1].label }
      ]
    }
  }
  return pendingEvent
}

export const projectPublic = (state: GameState): PublicGameState => ({
  roomCode: state.roomCode,
  status: state.status,
  activePlayerId: state.activePlayerId,
  lastRoll: state.lastRoll,
  lastDice: state.lastDice,
  pendingEvent: toPublicPendingEvent(state.pendingEvent),
  players: state.playerOrder.map((playerId) => {
    const player = state.players[playerId]
    return {
      playerId: player.playerId,
      nickname: player.nickname,
      position: player.position
    }
  })
})

export const projectPrivate = (state: GameState, playerId: string): PrivatePlayerState | null => {
  const player = state.players[playerId]
  if (!player) return null

  return {
    roomCode: state.roomCode,
    playerId: player.playerId,
    status: state.status,
    activePlayerId: state.activePlayerId,
    isMyTurn: state.status === 'playing' && state.activePlayerId === playerId,
    lastRoll: state.lastRoll,
    lastDice: state.lastDice,
    budget: player.budget,
    drunkenness: player.drunkenness,
    dignity: player.dignity
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run src/rooms/projections.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Fix the `server.test.ts` private-state assertion**

In `apps/server/src/server.test.ts`, remove the `pendingEvent: null,` line from the expected private-state object:

```ts
await expect(privateState).resolves.toEqual({
  type: 'player.private-state',
  protocolVersion: 1,
  state: {
    roomCode, playerId: 'mario', status: 'lobby', activePlayerId: null,
    isMyTurn: false, lastRoll: null, lastDice: null,
    budget: 30, drunkenness: 0, dignity: 10
  }
})
```

- [ ] **Step 7: Run the full server suite**

Run: `cd apps/server && npx vitest run`
Expected: `reducer.ts` still references the pre-Task-9 `friend_round` literal (`{ eventId: 'friend_round' as const, playerId: ... }`), which no longer matches `GameState['pendingEvent']`'s type — `npx tsc --noEmit` is red at this point (expected, per Global Constraints), but `vitest run` uses esbuild transforms and does not type-check, so all currently-passing tests (including the two still-unmodified `friend_round` reducer tests) keep passing at runtime. Confirm no test regressions: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/game/state.ts apps/server/src/rooms/projections.ts apps/server/src/rooms/projections.test.ts apps/server/src/server.test.ts
git commit -m "feat: project the generalized pendingEvent to clients"
```

---

## Task 9: Reducer — draw trigger (tile + probability)

**Files:**
- Modify: `apps/server/src/game/reducer.ts`
- Modify: `apps/server/src/game/reducer.test.ts`

**Interfaces:**
- Consumes: `drawImprevistoCard` (Task 4), `advanceTurn` (Task 5), `GameRng.drawChance` (Task 2).
- Produces: `rollDice` now sets `pendingEvent: { cardId, playerId, phase: 'choosing' }` instead of the `friend_round` literal. This is what Task 10 resolves.

This task removes the last two references to the old `friend_round` shape inside `rollDice`, restoring full type-correctness for this function (though `chooseEvent` is still red until Task 10).

- [ ] **Step 1: Delete the obsolete `friend_round` draw test and write the new ones**

In `apps/server/src/game/reducer.test.ts`, delete this test entirely:

```ts
it('opens friend_round on tile three and waits for a choice before advancing', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), () => 1).state
  const rolled = applyCommand(started, roll('p1'), () => 3)

  expect(rolled.state.pendingEvent).toEqual({ eventId: 'friend_round', playerId: 'p1' })
  expect(rolled.state.activePlayerId).toBe('p1')
})
```

Replace it with:

```ts
it('draws a card when crossing the dedicated Imprevisto tile and waits before advancing', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
  const rolled = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) }))

  expect(rolled.state.pendingEvent).toEqual({ cardId: '01', playerId: 'p1', phase: 'choosing' })
  expect(rolled.state.activePlayerId).toBe('p1')
})

it('rejects a second dice.roll while an Imprevisto is still pending', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
  const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
  const original = structuredClone(pending)

  const rejected = applyCommand(pending, roll('p1', 'second-roll'), testRng())

  expect(rejected.rejection).toBe('NOT_ACTIVE_PLAYER')
  expect(rejected.state).toEqual(original)
})

it('does not draw a card when neither the tile nor the random chance trigger', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
  const rolled = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 1) }))

  expect(rolled.state.pendingEvent).toBeNull()
  expect(rolled.state.activePlayerId).toBe('p2')
})

it('draws a card probabilistically on a normal tile when the random chance succeeds', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
  const drewCard = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
  const resolved = applyCommand(drewCard, choose('p1', 'modalita-aereo'), testRng()).state

  const rolled = applyCommand(resolved, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 }))

  expect(rolled.state.pendingEvent).toMatchObject({ cardId: '02', playerId: 'p2', phase: 'choosing' })
  expect(rolled.state.activePlayerId).toBe('p2')
})
```

(the last test relies on Task 10's `chooseEvent` resolution already existing to clear the first pendingEvent — write it now, it starts green once Task 10 lands, and stays red for this one test until then; every other test in this step is fully satisfied by this task alone).

Update the `choose` helper's type to accept any string, since the old `'offer' | 'refuse'` union no longer applies:

```ts
const choose = (playerId: string, choiceId: string): ClientCommand => ({
  type: 'event.choose', protocolVersion: 1, commandId: `choose-${choiceId}`,
  roomCode: 'ABCD', playerId, choiceId
})
```

- [ ] **Step 2: Run the new tests to verify they fail (the probabilistic-draw test is expected to fail until Task 10)**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "Imprevisto tile"`
Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "still pending"`
Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "random chance triggers"`
Expected: the first FAILs because `pendingEvent` is still `{ eventId: 'friend_round', playerId }`; the second FAILs because the old code has no guard against rolling again while an event is pending (it silently re-rolls instead of rejecting).

- [ ] **Step 3: Replace the draw trigger in `rollDice`**

In `apps/server/src/game/reducer.ts`, add the imports and constants:

```ts
import { drawImprevistoCard } from './imprevisti-deck'

const IMPREVISTO_TILE_POSITIONS = new Set([3])
const IMPREVISTO_BASE_CHANCE = 0.15
```

Replace the body of `rollDice` (from Task 5's version) with:

```ts
const rollDice = (state: GameState, command: Extract<ClientCommand, { type: 'dice.roll' }>, rng: GameRng): ApplyCommandResult => {
  if (state.status !== 'playing' || state.activePlayerId !== command.playerId) {
    return reject(state, 'NOT_ACTIVE_PLAYER')
  }
  if (state.pendingEvent) {
    return reject(state, 'NOT_ACTIVE_PLAYER')
  }

  const dice: [number, number] = [rng.rollDie(), rng.rollDie()]
  if (dice.some((result) => !Number.isInteger(result) || result < 1 || result > 6)) {
    return reject(state, 'INVALID_DIE_ROLL')
  }

  const activePlayer = state.players[command.playerId]
  const modifier = activePlayer.statusEffects.nextRollModifier ?? 0
  const result = dice[0] + dice[1] + modifier
  const fromPosition = activePlayer.position
  const toPosition = Math.max(0, fromPosition + result)

  const moved = {
    ...withProcessedCommand(state, command.commandId),
    lastRoll: result,
    lastDice: dice,
    players: {
      ...state.players,
      [command.playerId]: {
        ...activePlayer,
        position: toPosition,
        statusEffects: { ...activePlayer.statusEffects, nextRollModifier: undefined }
      }
    }
  }

  const crossesImprevistoTile = [...IMPREVISTO_TILE_POSITIONS].some((tile) => fromPosition < tile && toPosition >= tile)
  const drawsRandomCard = !crossesImprevistoTile && rng.drawChance() < IMPREVISTO_BASE_CHANCE

  if (crossesImprevistoTile || drawsRandomCard) {
    const draw = drawImprevistoCard(moved, rng)
    return accept({
      ...moved,
      activePlayerId: command.playerId,
      imprevistiDeck: draw.deck,
      imprevistiDiscard: draw.discard,
      pendingEvent: { cardId: draw.cardId, playerId: command.playerId, phase: 'choosing' }
    })
  }

  const { nextPlayerId, state: advanced } = advanceTurn(moved, command.playerId)
  return accept({ ...advanced, activePlayerId: nextPlayerId })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "Imprevisto tile"`
Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "still pending"`
Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "random chance triggers"`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/reducer.ts apps/server/src/game/reducer.test.ts
git commit -m "feat: draw an Imprevisto card on a dedicated tile or by chance"
```

---

## Task 10: Reducer — resolve a normal choice or delegate via `opponentChooses`

**Files:**
- Modify: `apps/server/src/game/reducer.ts`
- Modify: `apps/server/src/game/reducer.test.ts`

**Interfaces:**
- Consumes: `getImprevistoCard` (Task 1), `applyDirectEffects` (Task 6), `advanceTurn` (Task 5).
- Produces: `chooseEvent` now resolves a normal option (applying its effects and advancing the turn), transitions to `phase: 'voting'` for the three `save:*` choices, or transitions to `phase: 'choosing-for-other'` when the chosen option delegates via `opponentChooses`. This makes the third test from Task 9 (probabilistic draw) pass.

- [ ] **Step 1: Delete the two obsolete `friend_round` resolution tests**

In `apps/server/src/game/reducer.test.ts`, delete:

```ts
it('resolves friend_round offer by spending five euros and advancing the turn', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), () => 1).state
  const pending = applyCommand(started, roll('p1'), () => 3).state
  const resolved = applyCommand(pending, choose('p1', 'offer'), () => 1)

  expect(resolved.rejection).toBeNull()
  expect(resolved.state.players.p1).toMatchObject({ budget: 25, dignity: 10 })
  expect(resolved.state.pendingEvent).toBeNull()
  expect(resolved.state.activePlayerId).toBe('p2')
})

it('resolves friend_round refusal by losing two dignity and advancing the turn', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), () => 1).state
  const pending = applyCommand(started, roll('p1'), () => 3).state
  const resolved = applyCommand(pending, choose('p1', 'refuse'), () => 1)

  expect(resolved.state.players.p1).toMatchObject({ budget: 30, dignity: 8 })
  expect(resolved.state.activePlayerId).toBe('p2')
})
```

Replace them with:

```ts
it('resolves a normal option by applying its effects and advancing the turn', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
  const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
  const resolved = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng())

  expect(resolved.rejection).toBeNull()
  expect(resolved.state.players.p1.budget).toBe(28)
  expect(resolved.state.pendingEvent).toBeNull()
  expect(resolved.state.activePlayerId).toBe('p2')
})

it('rejects an unknown option id for the pending card', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
  const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
  const rejected = applyCommand(pending, choose('p1', 'nonexistent'), testRng())

  expect(rejected.rejection).toBe('INVALID_EVENT_CHOICE')
})

it('opens a group vote when the active player picks a Salva il culo alternative', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
  const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
  const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng())

  expect(voting.state.pendingEvent).toEqual({ cardId: '01', playerId: 'p1', phase: 'voting', savingAttempt: 'bevi' })
  expect(voting.state.activePlayerId).toBe('p1')
})

it('delegates the outcome to an arbiter for an opponentChooses option', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
  const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 2) })).state
  const clearedFirstCard = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng())
  expect(clearedFirstCard.state.pendingEvent).toBeNull()

  const nextRoll = applyCommand(clearedFirstCard.state, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
  expect(nextRoll.pendingEvent).toMatchObject({ cardId: '02' })

  const clearSecond = applyCommand(nextRoll, choose('p2', 'continua-cosi'), testRng()).state
  expect(clearSecond.pendingEvent).toBeNull()

  const thirdRoll = applyCommand(clearSecond, roll('p3', 'roll-p3'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
  expect(thirdRoll.pendingEvent).toMatchObject({ cardId: '03' })

  const delegated = applyCommand(thirdRoll, choose('p3', 'passa-il-telefono'), testRng({ pickArbiter: (candidates) => candidates[0] }))

  expect(delegated.state.pendingEvent).toEqual({
    cardId: '03',
    playerId: 'p3',
    phase: 'choosing-for-other',
    arbiterId: 'p1',
    options: [
      { id: 'cancella-e-nega-tutto', label: 'Cancella e nega tutto' },
      { id: 'raddoppia-la-figura-di-merda', label: 'Raddoppia la figura di merda' }
    ]
  })
})
```

(the last test drives the deck through cards `01` → `02` → `03` deterministically using the default identity-shuffle `testRng`; `pickArbiter` is overridden to a stable `candidates[0]` so the assertion is deterministic — `candidates` here excludes `p3`, the drawer, leaving `['p1', 'p2']`, so `p1` is picked).

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "resolves a normal option"`
Expected: FAIL — `chooseEvent` still hardcodes `'offer'`/`'refuse'`.

- [ ] **Step 3: Rewrite `chooseEvent`**

In `apps/server/src/game/reducer.ts`, add the imports:

```ts
import { getImprevistoCard, type DirectEffect, type OpponentChoosesEffect } from '../../../../packages/game-content/src/index'
import { applyDirectEffects } from './effects'
```

Replace `chooseEvent` entirely with:

```ts
const chooseEvent = (state: GameState, command: Extract<ClientCommand, { type: 'event.choose' }>, rng: GameRng): ApplyCommandResult => {
  const event = state.pendingEvent
  if (!event) return reject(state, 'NO_PENDING_EVENT')

  if (event.phase !== 'choosing' || event.playerId !== command.playerId) {
    return reject(state, 'NO_PENDING_EVENT')
  }

  if (command.choiceId === 'save:scomoda' || command.choiceId === 'save:fai' || command.choiceId === 'save:bevi') {
    const savingAttempt = command.choiceId.slice('save:'.length) as 'scomoda' | 'fai' | 'bevi'
    return accept({
      ...withProcessedCommand(state, command.commandId),
      pendingVotes: {},
      pendingEvent: { cardId: event.cardId, playerId: event.playerId, phase: 'voting', savingAttempt }
    })
  }

  const card = getImprevistoCard(event.cardId)
  const option = card.options.find((candidate) => candidate.id === command.choiceId)
  if (!option) return reject(state, 'INVALID_EVENT_CHOICE')

  const delegated = option.effects.find((effect): effect is OpponentChoosesEffect => effect.type === 'opponentChooses')
  if (delegated) {
    const arbiterId = rng.pickArbiter(state.playerOrder.filter((id) => id !== event.playerId))
    return accept({
      ...withProcessedCommand(state, command.commandId),
      pendingEvent: {
        cardId: event.cardId,
        playerId: event.playerId,
        phase: 'choosing-for-other',
        arbiterId,
        options: delegated.options
      }
    })
  }

  const stamped = withProcessedCommand(state, command.commandId)
  const resolvedState = applyDirectEffects(stamped, event.playerId, option.effects as DirectEffect[])
  const { nextPlayerId, state: advanced } = advanceTurn(resolvedState, event.playerId)

  return accept({ ...advanced, pendingEvent: null, activePlayerId: nextPlayerId })
}
```

- [ ] **Step 4: Run the reducer suite to verify the new tests pass**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts`
Expected: PASS, including the probabilistic-draw test carried over from Task 9 (its `choose('p1', 'modalita-aereo')` step now resolves correctly).

- [ ] **Step 5: Typecheck**

Run: `cd apps/server && npx tsc --noEmit`
Expected: still red — `event.vote` isn't handled by `applyCommand`'s switch yet (Task 12), and the `'choosing-for-other'` phase isn't resolved by a player choosing yet (Task 11). This is expected.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/game/reducer.ts apps/server/src/game/reducer.test.ts
git commit -m "feat: resolve normal Imprevisto options and opponentChooses delegation"
```

---

## Task 11: Reducer — arbiter resolves a delegated choice

**Files:**
- Modify: `apps/server/src/game/reducer.ts`
- Modify: `apps/server/src/game/reducer.test.ts`

**Interfaces:**
- Consumes: everything from Task 10, plus the `choosing-for-other` shape already produced there.
- Produces: `chooseEvent` now also accepts an `event.choose` from the arbiter, applying the chosen sub-option's effects to the **original drawer**, then advancing the turn from the drawer (not the arbiter).

- [ ] **Step 1: Write the failing test**

Add to `apps/server/src/game/reducer.test.ts`:

```ts
it('lets the arbiter resolve a delegated choice, applying effects to the original player', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
  const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 2) })).state
  const clearedFirstCard = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng()).state

  const secondRoll = applyCommand(clearedFirstCard, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
  const clearSecond = applyCommand(secondRoll, choose('p2', 'continua-cosi'), testRng()).state

  const thirdRoll = applyCommand(clearSecond, roll('p3', 'roll-p3'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
  const delegated = applyCommand(thirdRoll, choose('p3', 'passa-il-telefono'), testRng({ pickArbiter: (candidates) => candidates[0] })).state

  expect(delegated.activePlayerId).toBe('p3')

  const resolved = applyCommand(delegated, {
    type: 'event.choose', protocolVersion: 1, commandId: 'arbiter-choice',
    roomCode: 'ABCD', playerId: 'p1', choiceId: 'raddoppia-la-figura-di-merda'
  }, testRng())

  expect(resolved.rejection).toBeNull()
  expect(resolved.state.players.p3).toMatchObject({ dignity: 8, energy: 11 })
  expect(resolved.state.pendingEvent).toBeNull()
  expect(resolved.state.activePlayerId).toBe('p1')
})

it('rejects an event.choose from someone other than the assigned arbiter', () => {
  const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
  const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(1, 2) })).state
  const rolledToCard02 = applyCommand(pending, choose('p1', 'power-bank-del-tirchio'), testRng()).state
  const secondRoll = applyCommand(rolledToCard02, roll('p2', 'roll-p2'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
  const clearSecond = applyCommand(secondRoll, choose('p2', 'continua-cosi'), testRng()).state
  const thirdRoll = applyCommand(clearSecond, roll('p3', 'roll-p3'), testRng({ rollDie: sequenceDie(1, 1), drawChance: () => 0 })).state
  const delegated = applyCommand(thirdRoll, choose('p3', 'passa-il-telefono'), testRng({ pickArbiter: (candidates) => candidates[0] })).state

  const rejected = applyCommand(delegated, choose('p2', 'raddoppia-la-figura-di-merda'), testRng())

  expect(rejected.rejection).toBe('NO_PENDING_EVENT')
})
```

(`p3` starts with `dignity: 10, energy: 10`; `raddoppia-la-figura-di-merda` applies `dignity -2, energy +1`, matching the assertion.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "arbiter"`
Expected: FAIL — `chooseEvent` rejects with `NO_PENDING_EVENT` for every phase other than `'choosing'` from the drawer.

- [ ] **Step 3: Extend `chooseEvent` with the arbiter branch**

In `apps/server/src/game/reducer.ts`, add a new branch at the very top of `chooseEvent`, before the existing `if (event.phase !== 'choosing' ...)` check:

```ts
const chooseEvent = (state: GameState, command: Extract<ClientCommand, { type: 'event.choose' }>, rng: GameRng): ApplyCommandResult => {
  const event = state.pendingEvent
  if (!event) return reject(state, 'NO_PENDING_EVENT')

  if (event.phase === 'choosing-for-other') {
    if (event.arbiterId !== command.playerId) return reject(state, 'NO_PENDING_EVENT')

    const chosen = event.options.find((option) => option.id === command.choiceId)
    if (!chosen) return reject(state, 'INVALID_EVENT_CHOICE')

    const stamped = withProcessedCommand(state, command.commandId)
    const resolvedState = applyDirectEffects(stamped, event.playerId, chosen.effects)
    const { nextPlayerId, state: advanced } = advanceTurn(resolvedState, event.playerId)

    return accept({ ...advanced, pendingEvent: null, activePlayerId: nextPlayerId })
  }

  if (event.phase !== 'choosing' || event.playerId !== command.playerId) {
    return reject(state, 'NO_PENDING_EVENT')
  }

  // ... rest of the function unchanged from Task 10
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts`
Expected: PASS, full file.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/reducer.ts apps/server/src/game/reducer.test.ts
git commit -m "feat: let the assigned arbiter resolve a delegated Imprevisto choice"
```

---

## Task 12: Reducer — `event.vote` (group vote on Salva il culo)

**Files:**
- Modify: `apps/server/src/game/reducer.ts`
- Modify: `apps/server/src/game/reducer.test.ts`

**Interfaces:**
- Consumes: `GameState.pendingVotes` (Task 3), `getImprevistoCard` (Task 1), `applyDirectEffects` (Task 6), `advanceTurn` (Task 5).
- Produces: `applyCommand` now handles `'event.vote'`. This is the last reducer task — `npx tsc --noEmit` for `apps/server` is fully green again after this task.

- [ ] **Step 1: Write the failing tests**

Add to `apps/server/src/game/reducer.test.ts`:

```ts
const vote = (playerId: string, voteValue: 'valid' | 'invalid', commandId = `vote-${playerId}`): ClientCommand => ({
  type: 'event.vote', protocolVersion: 1, commandId,
  roomCode: 'ABCD', playerId, vote: voteValue
})

describe('event.vote', () => {
  it('clears the pendingEvent without effects when the group votes valid', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const firstVote = applyCommand(voting, vote('p2', 'valid'), testRng()).state
    const secondVote = applyCommand(firstVote, vote('p3', 'valid'), testRng())

    expect(secondVote.state.pendingEvent).toBeNull()
    expect(secondVote.state.players.p1).toMatchObject({ dignity: 10, suspicion: 0 })
    expect(secondVote.state.activePlayerId).toBe('p2')
  })

  it('applies the fallback effects when the group votes invalid', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const firstVote = applyCommand(voting, vote('p2', 'invalid'), testRng()).state
    const secondVote = applyCommand(firstVote, vote('p3', 'invalid'), testRng())

    expect(secondVote.state.pendingEvent).toBeNull()
    expect(secondVote.state.players.p1).toMatchObject({ dignity: 8, suspicion: 1 })
    expect(secondVote.state.activePlayerId).toBe('p2')
  })

  it('resolves as soon as the majority is mathematically certain, without waiting for every voter', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3', 'p4', 'p5'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const v1 = applyCommand(voting, vote('p2', 'valid'), testRng()).state
    const v2 = applyCommand(v1, vote('p3', 'valid'), testRng()).state
    const v3 = applyCommand(v2, vote('p4', 'valid'), testRng())

    expect(v3.state.pendingEvent).toBeNull()
  })

  it('treats a tie as invalid once every eligible voter has voted', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2', 'p3'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const firstVote = applyCommand(voting, vote('p2', 'valid'), testRng()).state
    const secondVote = applyCommand(firstVote, vote('p3', 'invalid'), testRng())

    expect(secondVote.state.players.p1).toMatchObject({ dignity: 8, suspicion: 1 })
  })

  it('rejects a vote from the player who is being judged', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const pending = applyCommand(started, roll('p1'), testRng({ rollDie: sequenceDie(2, 5) })).state
    const voting = applyCommand(pending, choose('p1', 'save:bevi'), testRng()).state

    const rejected = applyCommand(voting, vote('p1', 'valid'), testRng())

    expect(rejected.rejection).toBe('NOT_ACTIVE_PLAYER')
  })

  it('rejects a vote when there is no pending vote', () => {
    const started = applyCommand(gameWithPlayers('p1', 'p2'), start('p1'), testRng()).state
    const rejected = applyCommand(started, vote('p2', 'valid'), testRng())

    expect(rejected.rejection).toBe('NO_PENDING_EVENT')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts -t "event.vote"`
Expected: FAIL — `applyCommand` has no `'event.vote'` case, so `command.type` never matches and TypeScript would flag it; at runtime the switch falls through returning `undefined`, so `rejected.rejection` throws on the `undefined` access. Either way: FAIL.

- [ ] **Step 3: Implement `voteOnSave` and the tally**

In `apps/server/src/game/reducer.ts`, add:

```ts
const tallyVotes = (votes: Record<string, 'valid' | 'invalid'>, eligibleVoters: string[]): 'valid' | 'invalid' | 'pending' => {
  const cast = eligibleVoters.map((id) => votes[id]).filter((v): v is 'valid' | 'invalid' => v !== undefined)
  const validCount = cast.filter((v) => v === 'valid').length
  const invalidCount = cast.length - validCount
  const remaining = eligibleVoters.length - cast.length

  if (validCount > invalidCount + remaining) return 'valid'
  if (invalidCount >= validCount + remaining) return 'invalid'
  return 'pending'
}

const voteOnSave = (state: GameState, command: Extract<ClientCommand, { type: 'event.vote' }>, rng: GameRng): ApplyCommandResult => {
  const event = state.pendingEvent
  if (!event || event.phase !== 'voting') return reject(state, 'NO_PENDING_EVENT')
  if (command.playerId === event.playerId) return reject(state, 'NOT_ACTIVE_PLAYER')
  if (!state.players[command.playerId]) return reject(state, 'PLAYER_NOT_FOUND')

  const stamped = withProcessedCommand(state, command.commandId)
  const pendingVotes = { ...stamped.pendingVotes, [command.playerId]: command.vote }
  const eligibleVoters = stamped.playerOrder.filter((id) => id !== event.playerId)
  const tally = tallyVotes(pendingVotes, eligibleVoters)

  if (tally === 'pending') {
    return accept({ ...stamped, pendingVotes })
  }

  const card = getImprevistoCard(event.cardId)
  const withVotes = { ...stamped, pendingVotes }
  const resolvedState = tally === 'valid' ? withVotes : applyDirectEffects(withVotes, event.playerId, card.saveFallbackEffects)
  const { nextPlayerId, state: advanced } = advanceTurn(resolvedState, event.playerId)

  return accept({ ...advanced, pendingVotes: {}, pendingEvent: null, activePlayerId: nextPlayerId })
}
```

Note `tallyVotes` treats a completed tie as `invalid`: once `remaining === 0` and `validCount === invalidCount`, the `invalidCount >= validCount + remaining` check (`invalidCount >= validCount + 0`) is already true, so ties resolve to `'invalid'` without a separate branch.

Update `applyCommand`'s switch:

```ts
switch (command.type) {
  case 'player.join':
    return addPlayer(state, command)
  case 'game.start':
    return startGame(state, command)
  case 'dice.roll':
    return rollDice(state, command, rng)
  case 'event.choose':
    return chooseEvent(state, command, rng)
  case 'event.vote':
    return voteOnSave(state, command, rng)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/server && npx vitest run src/game/reducer.test.ts`
Expected: PASS, full file (25+ tests).

- [ ] **Step 5: Run the full server suite and typecheck**

Run: `cd apps/server && npx vitest run`
Expected: PASS.

Run: `cd apps/server && npx tsc --noEmit`
Expected: no errors — this is the point where the server package is fully consistent again.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/game/reducer.ts apps/server/src/game/reducer.test.ts
git commit -m "feat: resolve Salva il culo through a group vote"
```

---

## Task 13: TV — `ImprevistoCard` component

**Files:**
- Create: `apps/tv-web/src/features/game/ImprevistoCard.tsx`
- Test: `apps/tv-web/src/features/game/ImprevistoCard.test.tsx`
- Modify: `apps/tv-web/src/features/game/BoardScreen.tsx`
- Modify: `apps/tv-web/package.json`
- Create (binary): `apps/tv-web/public/cards/imprevisti/*.png` (8 files, copied)

**Interfaces:**
- Consumes: `getImprevistoCard` (Task 1, via `@osterie/game-content`), `PublicGameState['pendingEvent']`/`PublicPlayerState` (Task 7, via `@osterie/protocol`).
- Produces: `<ImprevistoCard pendingEvent players />`, replacing the hardcoded `friend_round` `aside` block in `BoardScreen.tsx`.

- [ ] **Step 1: Add the workspace dependency and copy the illustrations**

In `apps/tv-web/package.json`, add to `dependencies` (alongside the existing `"@osterie/protocol": "0.0.0"` line):

```json
"@osterie/game-content": "0.0.0",
```

Run from the repo root:

```bash
npm install
mkdir -p apps/tv-web/public/cards/imprevisti
cp "assets/cards/imprevisti/01-telefono-al-2-percento.png" apps/tv-web/public/cards/imprevisti/
cp "assets/cards/imprevisti/02-la-scarpa-traditrice.png" apps/tv-web/public/cards/imprevisti/
cp "assets/cards/imprevisti/03-messaggio-allex.png" apps/tv-web/public/cards/imprevisti/
cp "assets/cards/imprevisti/08-la-cintura-ha-mollato.png" apps/tv-web/public/cards/imprevisti/
cp "assets/cards/imprevisti/22-pioggia-bastarda.png" apps/tv-web/public/cards/imprevisti/
cp "assets/cards/imprevisti/27-google-maps-ubriaco.png" apps/tv-web/public/cards/imprevisti/
cp "assets/cards/imprevisti/30-lucchetto-maledetto.png" apps/tv-web/public/cards/imprevisti/
cp "assets/cards/imprevisti/36-sedia-traditrice.png" apps/tv-web/public/cards/imprevisti/
```

- [ ] **Step 2: Write the failing component tests**

`apps/tv-web/src/features/game/ImprevistoCard.test.tsx`:

```ts
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ImprevistoCard } from './ImprevistoCard'

const players = [
  { playerId: 'p1', nickname: 'Mario', position: 3 },
  { playerId: 'p2', nickname: 'Luigi', position: 0 }
]

describe('ImprevistoCard', () => {
  it('shows the card title and description while the active player is choosing', () => {
    const html = renderToStaticMarkup(
      <ImprevistoCard pendingEvent={{ cardId: '01', playerId: 'p1', phase: 'choosing' }} players={players} />
    )
    expect(html).toContain('Il telefono al 2%')
    expect(html).toContain('Mario sta decidendo')
  })

  it('names the arbiter while a choosing-for-other delegation is pending', () => {
    const html = renderToStaticMarkup(
      <ImprevistoCard
        pendingEvent={{
          cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
          options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
        }}
        players={players}
      />
    )
    expect(html).toContain('Luigi')
    expect(html).toContain('Mario')
  })

  it('reveals the attempted save-yourself alternative during a vote', () => {
    const html = renderToStaticMarkup(
      <ImprevistoCard pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'voting', savingAttempt: 'fai' }} players={players} />
    )
    expect(html).toContain('attraversa la stanza camminando da pinguino')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/tv-web && npx vitest run src/features/game/ImprevistoCard.test.tsx`
Expected: FAIL — `Cannot find module './ImprevistoCard'`

- [ ] **Step 4: Implement the component**

`apps/tv-web/src/features/game/ImprevistoCard.tsx`:

```tsx
import { getImprevistoCard } from '@osterie/game-content'
import type { PublicGameState, PublicPlayerState } from '@osterie/protocol'

interface ImprevistoCardProps {
  pendingEvent: NonNullable<PublicGameState['pendingEvent']>
  players: PublicPlayerState[]
}

const nicknameOf = (players: PublicPlayerState[], playerId: string) =>
  players.find((player) => player.playerId === playerId)?.nickname ?? '???'

export function ImprevistoCard({ pendingEvent, players }: ImprevistoCardProps) {
  const card = getImprevistoCard(pendingEvent.cardId)
  const playerNickname = nicknameOf(players, pendingEvent.playerId)

  return (
    <aside className="public-event imprevisto-card" role="status" aria-live="polite">
      <span>Imprevisto!</span>
      <img className="imprevisto-illustration" src={card.illustration} alt="" aria-hidden="true" />
      <strong>{card.title}</strong>
      <p>{card.description}</p>
      {pendingEvent.phase === 'choosing' && <p>{playerNickname} sta decidendo…</p>}
      {pendingEvent.phase === 'choosing-for-other' && (
        <p>{nicknameOf(players, pendingEvent.arbiterId)} decide al posto di {playerNickname}…</p>
      )}
      {pendingEvent.phase === 'voting' && (
        <p>Il gruppo vota se {playerNickname} ha superato la prova: {card.saveYourself[pendingEvent.savingAttempt]}</p>
      )}
    </aside>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/tv-web && npx vitest run src/features/game/ImprevistoCard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Wire it into `BoardScreen.tsx`**

In `apps/tv-web/src/features/game/BoardScreen.tsx`, add the import:

```ts
import { ImprevistoCard } from './ImprevistoCard'
```

Replace:

```tsx
{state.pendingEvent?.eventId === 'friend_round' && (
  <aside className="public-event" role="status" aria-live="polite">
    <span>Imprevisto!</span>
    <strong>L'amico povero</strong>
    <p>Qualcuno sta decidendo se offrire da bere…</p>
  </aside>
)}
```

with:

```tsx
{state.pendingEvent && <ImprevistoCard pendingEvent={state.pendingEvent} players={state.players} />}
```

- [ ] **Step 7: Run the full tv-web suite and typecheck**

Run: `cd apps/tv-web && npx vitest run`
Expected: PASS.

Run: `cd apps/tv-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/tv-web/src/features/game/ImprevistoCard.tsx apps/tv-web/src/features/game/ImprevistoCard.test.tsx apps/tv-web/src/features/game/BoardScreen.tsx apps/tv-web/package.json apps/tv-web/public/cards/imprevisti package-lock.json
git commit -m "feat: show the drawn Imprevisto card on the TV board"
```

---

## Task 14: Controller — `EventChoice` component

**Files:**
- Create: `apps/controller-web/src/features/event/EventChoice.tsx`
- Test: `apps/controller-web/src/features/event/EventChoice.test.tsx`
- Modify: `apps/controller-web/src/App.tsx`
- Modify: `apps/controller-web/src/ControllerApp.tsx`
- Modify: `apps/controller-web/src/lib/controller-game-socket.ts`
- Modify: `apps/controller-web/package.json`

**Interfaces:**
- Consumes: `getImprevistoCard` (Task 1, via `@osterie/game-content`), `PublicGameState['pendingEvent']` (Task 7, via `@osterie/protocol`).
- Produces: `<EventChoice pendingEvent myPlayerId onChoose onVote />`, replacing the hardcoded `friend_round` block in `App.tsx`. `ControllerGameSocket.send` now also accepts `'event.vote'`.

- [ ] **Step 1: Add the workspace dependency**

In `apps/controller-web/package.json`, add to `dependencies` (alongside the existing `"@osterie/protocol": "*"` line):

```json
"@osterie/game-content": "*",
```

Run from the repo root: `npm install`

- [ ] **Step 2: Write the failing component tests**

`apps/controller-web/src/features/event/EventChoice.test.tsx`:

```ts
// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventChoice } from './EventChoice'

describe('EventChoice', () => {
  it('offers the card options and the three Salva il culo buttons to the active player', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'choosing' }}
        myPlayerId="p1"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).toContain('Pulizia dignitosa')
    expect(html).toContain('Continua così')
    expect(html).toContain('bevi un sorso')
  })

  it('shows the waiting panel for a bystander during a normal choice', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'choosing' }}
        myPlayerId="p2"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).toContain('Aspetta il tuo turno')
  })

  it('offers only the two delegated options to the assigned arbiter', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{
          cardId: '03', playerId: 'p1', phase: 'choosing-for-other', arbiterId: 'p2',
          options: [{ id: 'a', label: 'Opzione A' }, { id: 'b', label: 'Opzione B' }]
        }}
        myPlayerId="p2"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).toContain('Opzione A')
    expect(html).toContain('Opzione B')
  })

  it('lets a bystander vote once and then disables the vote buttons', () => {
    const onVote = vi.fn()
    render(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'voting', savingAttempt: 'bevi' }}
        myPlayerId="p2"
        onChoose={vi.fn()}
        onVote={onVote}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ci credo' }))

    expect(onVote).toHaveBeenCalledWith('valid')
    expect(screen.getByRole('button', { name: 'Ci credo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Non ci credo' })).toBeDisabled()
  })

  it('does not show vote buttons to the player being judged', () => {
    const html = renderToStaticMarkup(
      <EventChoice
        pendingEvent={{ cardId: '02', playerId: 'p1', phase: 'voting', savingAttempt: 'bevi' }}
        myPlayerId="p1"
        onChoose={vi.fn()}
        onVote={vi.fn()}
      />
    )
    expect(html).not.toContain('Ci credo')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/controller-web && npx vitest run src/features/event/EventChoice.test.tsx`
Expected: FAIL — `Cannot find module './EventChoice'`

- [ ] **Step 4: Implement the component**

`apps/controller-web/src/features/event/EventChoice.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { getImprevistoCard } from '@osterie/game-content'
import type { PublicGameState } from '@osterie/protocol'

interface EventChoiceProps {
  pendingEvent: NonNullable<PublicGameState['pendingEvent']>
  myPlayerId: string
  onChoose: (choiceId: string) => void
  onVote: (vote: 'valid' | 'invalid') => void
}

export function EventChoice({ pendingEvent, myPlayerId, onChoose, onVote }: EventChoiceProps) {
  const [hasVoted, setHasVoted] = useState(false)
  useEffect(() => setHasVoted(false), [pendingEvent.cardId, pendingEvent.phase])

  const card = getImprevistoCard(pendingEvent.cardId)

  if (pendingEvent.phase === 'choosing' && pendingEvent.playerId === myPlayerId) {
    return (
      <section className="event-card" aria-labelledby="event-title">
        <p className="event-kicker">Imprevisto!</p>
        <h1 id="event-title">{card.title}</h1>
        <p>{card.description}</p>
        {card.options.map((option) => (
          <button type="button" key={option.id} onClick={() => onChoose(option.id)}>{option.label}</button>
        ))}
        <p className="save-yourself-hint">Salva il culo</p>
        <button type="button" onClick={() => onChoose('save:scomoda')}>Scomoda · {card.saveYourself.scomoda}</button>
        <button type="button" onClick={() => onChoose('save:fai')}>Fai · {card.saveYourself.fai}</button>
        <button type="button" onClick={() => onChoose('save:bevi')}>Bevi · {card.saveYourself.bevi}</button>
      </section>
    )
  }

  if (pendingEvent.phase === 'choosing-for-other' && pendingEvent.arbiterId === myPlayerId) {
    return (
      <section className="event-card" aria-labelledby="event-title">
        <p className="event-kicker">Decidi tu per lui</p>
        <h1 id="event-title">{card.title}</h1>
        {pendingEvent.options.map((option) => (
          <button type="button" key={option.id} onClick={() => onChoose(option.id)}>{option.label}</button>
        ))}
      </section>
    )
  }

  if (pendingEvent.phase === 'voting' && pendingEvent.playerId !== myPlayerId) {
    return (
      <section className="event-card" aria-labelledby="event-title">
        <p className="event-kicker">Il tavolo giudica</p>
        <h1 id="event-title">{card.saveYourself[pendingEvent.savingAttempt]}</h1>
        <button type="button" disabled={hasVoted} onClick={() => { setHasVoted(true); onVote('valid') }}>Ci credo</button>
        <button type="button" disabled={hasVoted} onClick={() => { setHasVoted(true); onVote('invalid') }}>Non ci credo</button>
      </section>
    )
  }

  return (
    <section className="waiting-panel"><h1>Aspetta il tuo turno</h1><p>Segui quello che succede sulla TV.</p></section>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/controller-web && npx vitest run src/features/event/EventChoice.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Wire `event.vote` through the socket**

In `apps/controller-web/src/lib/controller-game-socket.ts`, widen the payload and send-type unions:

```ts
type CommandPayload = { impulse: number } | { choiceId: string } | { vote: 'valid' | 'invalid' } | Record<string, never>
```

```ts
send(type: 'game.start' | 'dice.roll' | 'event.choose' | 'event.vote', payload: CommandPayload = {}) {
```

- [ ] **Step 7: Wire the component into `App.tsx`**

In `apps/controller-web/src/App.tsx`, replace the `onChooseEvent` prop with `onChoose`/`onVote` and swap the hardcoded branch:

```tsx
interface AppProps {
  nickname?: string
  privateState?: PrivatePlayerState
  publicState?: PublicGameState
  connectionStatus?: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  error?: string
  initialRoomCode?: string
  onJoin?: (details: { nickname: string; roomCode: string }) => void
  onRoll?: (impulse: number) => void
  onStart?: () => void
  onChoose?: (choiceId: string) => void
  onVote?: (vote: 'valid' | 'invalid') => void
}

export function App({ nickname, privateState, publicState, connectionStatus = 'disconnected', error, initialRoomCode, onJoin, onRoll, onStart, onChoose, onVote }: AppProps) {
  if (!nickname) {
    return <main className="controller-shell"><JoinForm initialRoomCode={initialRoomCode} onJoin={onJoin ?? (() => undefined)} /></main>
  }

  const isActive = publicState?.status === 'playing' && publicState.activePlayerId === privateState?.playerId
  const haze = Math.min(5, Math.max(0, (privateState?.drunkenness ?? 0) * 0.35))
  return (
    <main className="controller-shell">
      <div className="paper-grain" style={{ filter: `blur(${haze}px)` }} aria-hidden="true" />
      <header className="player-banner">{nickname}</header>
      <p className={`connection-status connection-status--${connectionStatus}`} role="status">
        {connectionStatus === 'connected' ? `Tavolo ${publicState?.roomCode ?? initialRoomCode ?? ''} connesso` : connectionStatus === 'reconnecting' ? 'Riconnessione…' : connectionStatus === 'connecting' ? 'Ingresso al tavolo…' : 'Disconnesso'}
      </p>
      {error && <p className="connection-error" role="alert">{error}</p>}
      {!privateState || !publicState ? (
        <section className="waiting-panel"><h1>Un attimo, oste!</h1><p>Stiamo preparando il tuo posto al tavolo.</p></section>
      ) : publicState.status === 'lobby' ? (
        <section className="lobby-panel">
          <h1>Siete in {publicState.players.length}</h1>
          <p>{publicState.players.map((player) => player.nickname).join(' · ')}</p>
          <button className="start-button" type="button" disabled={connectionStatus !== 'connected'} onClick={onStart}>Avvia partita</button>
        </section>
      ) : publicState.pendingEvent ? (
        <EventChoice
          pendingEvent={publicState.pendingEvent}
          myPlayerId={privateState.playerId}
          onChoose={onChoose ?? (() => undefined)}
          onVote={onVote ?? (() => undefined)}
        />
      ) : (
        <ShakeToRoll isActive={isActive} onRoll={onRoll ?? (() => undefined)} lastDice={privateState.lastDice} />
      )}
      {privateState && <section className="private-stats" aria-label="Le tue statistiche">
        <dl>
          <div><dt>Budget</dt><dd>€{privateState.budget}</dd></div>
          <div><dt>Ubriachezza</dt><dd>{privateState.drunkenness}/10</dd></div>
          <div><dt>Dignità</dt><dd>{privateState.dignity}</dd></div>
        </dl>
      </section>}
    </main>
  )
}
```

Add the import at the top of the file:

```ts
import { EventChoice } from './features/event/EventChoice'
```

- [ ] **Step 8: Wire `ControllerApp.tsx`**

In `apps/controller-web/src/ControllerApp.tsx`, replace:

```tsx
onChooseEvent={(choiceId) => socket?.send('event.choose', { choiceId })}
```

with:

```tsx
onChoose={(choiceId) => socket?.send('event.choose', { choiceId })}
onVote={(voteValue) => socket?.send('event.vote', { vote: voteValue })}
```

- [ ] **Step 9: Run the full controller-web suite and typecheck**

Run: `cd apps/controller-web && npx vitest run`
Expected: PASS.

Run: `cd apps/controller-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/controller-web/src/features/event/EventChoice.tsx apps/controller-web/src/features/event/EventChoice.test.tsx apps/controller-web/src/App.tsx apps/controller-web/src/ControllerApp.tsx apps/controller-web/src/lib/controller-game-socket.ts apps/controller-web/package.json package-lock.json
git commit -m "feat: let the controller resolve Imprevisto choices and group votes"
```

---

## Task 15: Full workspace verification

**Files:** none (verification only)

**Interfaces:** none — this task only runs the aggregate scripts already defined in the root `package.json`.

- [ ] **Step 1: Typecheck every workspace**

Run from the repo root: `npm run typecheck`
Expected: no errors in `@osterie/game-content`, `@osterie/protocol`, `@osterie/server`, `@osterie/controller-web`, `@osterie/tv-web`.

- [ ] **Step 2: Run every workspace's test suite**

Run from the repo root: `npm test`
Expected: PASS across all five workspaces.

- [ ] **Step 3: Manual smoke check (recommended, not scripted)**

Run: `npm run demo` (starts the existing local demo per `scripts/dev-demo.sh`) and, from a phone or a second browser tab acting as a controller, play until a dice roll crosses the dedicated tile (position 3) and confirm: the TV shows the drawn card's illustration and title, the active player's controller shows its options plus the three Salva il culo buttons, and picking one of the three flips every other controller into the Sì/No vote screen.

- [ ] **Step 4: Commit (only if Steps 1–2 required fixes)**

If everything was already green, there is nothing to commit here — the plan is complete as of Task 14's commit.
