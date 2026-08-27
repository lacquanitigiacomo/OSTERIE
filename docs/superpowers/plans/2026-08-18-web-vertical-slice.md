# Web Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realizzare una partita minima completa con lobby TV, ingresso da smartphone, lancio tramite scuotimento, movimento e primo evento sincronizzato.

**Architecture:** Monorepo npm con protocollo TypeScript condiviso, server Node autorevole via WebSocket e due client React/Vite: TV e controller. Il protocollo JSON versionato resta indipendente dal rendering e sarà consumato anche da Unity.

**Tech Stack:** Node.js 22.12+, npm workspaces, TypeScript, React 19, Vite 8, ws 8.18, Zod, Vitest, Playwright.

## Global Constraints

- La TV non riceve obiettivi, carte o informazioni private.
- Lo stato autorevole vive esclusivamente sul server.
- Ogni comando contiene `commandId`, `roomCode`, `playerId` e `protocolVersion`.
- I comandi ripetuti con lo stesso `commandId` sono idempotenti.
- Lo scuotimento usa `DeviceMotionEvent` solo dopo consenso e dispone di un pulsante fallback.
- La vertical slice usa una sola osteria fittizia; i dati reali entrano dopo la validazione delle fonti.
- Nessuna azione reale obbliga al consumo di alcol.

---

### Task 1: Workspace e protocollo condiviso

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/src/index.ts`
- Test: `packages/protocol/src/index.test.ts`

**Interfaces:**
- Produces: `ClientCommand`, `ServerEvent`, `PublicGameState`, `PrivatePlayerState`, `parseClientCommand(input)`.

- [ ] **Step 1: Scrivere il test fallente**

```ts
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
```

- [ ] **Step 2: Eseguire `npm test -w @osterie/protocol`**

Expected: FAIL perché il package e `parseClientCommand` non esistono.

- [ ] **Step 3: Definire workspace, TypeScript strict e schema Zod discriminato**

```ts
const envelope = {
  protocolVersion: z.literal(1), commandId: z.string().min(1),
  roomCode: z.string().length(4), playerId: z.string().min(1)
}
export const clientCommandSchema = z.discriminatedUnion('type', [
  z.object({ ...envelope, type: z.literal('player.join'), nickname: z.string().trim().min(1).max(20) }),
  z.object({ ...envelope, type: z.literal('game.start') }),
  z.object({ ...envelope, type: z.literal('dice.roll'), impulse: z.number().min(0).max(100) }),
  z.object({ ...envelope, type: z.literal('event.choose'), choiceId: z.string().min(1) })
])
export const parseClientCommand = (input: unknown) => clientCommandSchema.parse(input)
export type ClientCommand = z.infer<typeof clientCommandSchema>
```

- [ ] **Step 4: Eseguire test e typecheck**

Run: `npm test -w @osterie/protocol && npm run typecheck -w @osterie/protocol`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.base.json packages/protocol
git commit -m "feat: define shared realtime protocol"
```

### Task 2: Motore di partita deterministico

**Files:**
- Create: `apps/server/src/game/state.ts`
- Create: `apps/server/src/game/reducer.ts`
- Create: `apps/server/src/game/reducer.test.ts`

**Interfaces:**
- Consumes: `ClientCommand`.
- Produces: `createGame(roomCode)`, `applyCommand(state, command, rollDie)` e stato pubblico/privato.

- [ ] **Step 1: Testare ingresso, ordine dei turni e dado iniettato**

```ts
it('moves only the active player', () => {
  let game = gameWithPlayers('p1', 'p2')
  game = applyCommand(game, start('p1'), () => 4)
  game = applyCommand(game, roll('p1'), () => 4)
  expect(game.players.p1.position).toBe(4)
  expect(game.activePlayerId).toBe('p2')
})
```

- [ ] **Step 2: Eseguire il test e verificare il fallimento**

Run: `npm test -w @osterie/server -- reducer.test.ts`

- [ ] **Step 3: Implementare reducer puro**

Lo stato iniziale assegna `budget: 30`, `drunkenness: 0`, `dignity: 10`, `position: 0`. Un lancio valido produce un valore 1-6, muove soltanto il giocatore attivo e avanza il turno. Un comando fuori turno restituisce `NOT_ACTIVE_PLAYER` senza mutare lo stato.

- [ ] **Step 4: Testare comando duplicato**

```ts
const once = applyCommand(game, command, () => 3)
const twice = applyCommand(once, command, () => 6)
expect(twice).toEqual(once)
```

- [ ] **Step 5: Eseguire test e commit**

```bash
npm test -w @osterie/server
git add apps/server
git commit -m "feat: add deterministic game engine"
```

### Task 3: Server di stanze WebSocket

**Files:**
- Create: `apps/server/src/server.ts`
- Create: `apps/server/src/rooms/room-store.ts`
- Create: `apps/server/src/rooms/projections.ts`
- Test: `apps/server/src/server.test.ts`

**Interfaces:**
- Consumes: `parseClientCommand`, `applyCommand`.
- Produces: `createGameServer(httpServer)`, snapshot pubblico per TV e snapshot privato per controller.

- [ ] **Step 1: Scrivere test di integrazione con TV e controller**

Aprire due client WebSocket, inviare `player.join`, verificare che la TV riceva nickname/posizione e che solo il controller riceva budget, ubriachezza e dignità.

- [ ] **Step 2: Eseguire il test e verificare il fallimento**

Run: `npm test -w @osterie/server -- server.test.ts`

- [ ] **Step 3: Implementare stanza autorevole e proiezioni**

Ogni connessione si registra con ruolo `tv`, `host` o `player`. `projectPublic(state)` rimuove campi privati; `projectPrivate(state, playerId)` restituisce solo lo stato del proprietario. Il server valida ogni messaggio prima del reducer.

- [ ] **Step 4: Aggiungere heartbeat**

Impostare `isAlive`, rispondere a `pong`, inviare `ping` ogni 30 secondi e terminare connessioni non rispondenti, cancellando l'intervallo alla chiusura del server.

- [ ] **Step 5: Test, typecheck e commit**

```bash
npm test -w @osterie/server && npm run typecheck -w @osterie/server
git add apps/server
git commit -m "feat: synchronize authoritative game rooms"
```

### Task 4: Client TV web

**Files:**
- Create: `apps/tv-web/src/App.tsx`
- Create: `apps/tv-web/src/features/lobby/LobbyScreen.tsx`
- Create: `apps/tv-web/src/features/game/BoardScreen.tsx`
- Create: `apps/tv-web/src/lib/game-socket.ts`
- Test: `apps/tv-web/src/App.test.tsx`

**Interfaces:**
- Consumes: snapshot pubblico.
- Produces: lobby con codice/QR, tabellone, turno attivo e animazione del risultato.

- [ ] **Step 1: Testare lobby e tabellone**

```tsx
render(<App socket={fakeSocket(publicLobby)} />)
expect(screen.getByText('ABCD')).toBeVisible()
fakeSocket.emit(publicPlaying)
expect(screen.getByText('È il turno di Gino')).toBeVisible()
```

- [ ] **Step 2: Verificare il fallimento con `npm test -w @osterie/tv-web`**

- [ ] **Step 3: Implementare UI leggibile a tre metri**

Usare testo minimo 28px, focus visibile, layout 16:9 e nessun dato privato. Il QR punta a `/join/ABCD`; il tabellone iniziale contiene dodici caselle e una tappa osteria.

- [ ] **Step 4: Eseguire test, build e commit**

```bash
npm test -w @osterie/tv-web && npm run build -w @osterie/tv-web
git add apps/tv-web
git commit -m "feat: add web tv lobby and board"
```

### Task 5: Controller smartphone e gesto di lancio

**Files:**
- Create: `apps/controller-web/src/App.tsx`
- Create: `apps/controller-web/src/features/join/JoinForm.tsx`
- Create: `apps/controller-web/src/features/dice/ShakeToRoll.tsx`
- Create: `apps/controller-web/src/lib/shake-detector.ts`
- Test: `apps/controller-web/src/lib/shake-detector.test.ts`

**Interfaces:**
- Consumes: snapshot privato e turno attivo.
- Produces: `calculateImpulse(samples)`, comando `dice.roll`, pulsante fallback.

- [ ] **Step 1: Testare il rilevatore**

```ts
expect(calculateImpulse([{ x: 0, y: 9.8, z: 0 }, { x: 15, y: -8, z: 12 }])).toBeGreaterThan(20)
expect(calculateImpulse([{ x: 0, y: 9.8, z: 0 }])).toBeLessThan(5)
```

- [ ] **Step 2: Verificare il fallimento**

Run: `npm test -w @osterie/controller-web -- shake-detector.test.ts`

- [ ] **Step 3: Implementare consenso, soglia e fallback**

Richiedere il permesso da un gesto utente su iOS, campionare `devicemotion`, inviare un solo comando oltre soglia e applicare cooldown di 1.5 secondi. Mostrare sempre “Lancia i dadi” come alternativa accessibile.

- [ ] **Step 4: Testare che il fuori-turno sia disabilitato**

```tsx
render(<ShakeToRoll isActive={false} onRoll={vi.fn()} />)
expect(screen.getByRole('button', { name: 'Lancia i dadi' })).toBeDisabled()
```

- [ ] **Step 5: Test, build e commit**

```bash
npm test -w @osterie/controller-web && npm run build -w @osterie/controller-web
git add apps/controller-web
git commit -m "feat: add motion-controlled dice controller"
```

### Task 6: Prima osteria, consumazione e imprevisto

**Files:**
- Create: `packages/content/src/venues/demo-venue.ts`
- Create: `packages/content/src/events/demo-events.ts`
- Modify: `apps/server/src/game/reducer.ts`
- Test: `apps/server/src/game/venue-flow.test.ts`

**Interfaces:**
- Produces: evento `friend_round` con scelte `offer` e `refuse`.

- [ ] **Step 1: Testare la risoluzione dell'evento**

```ts
const resolved = applyCommand(atFriendEvent('p1'), choose('p1', 'offer'), () => 1)
expect(resolved.players.p1.budget).toBe(24)
expect(resolved.players.p1.dignity).toBe(12)
```

- [ ] **Step 2: Eseguire il test e verificare il fallimento**

- [ ] **Step 3: Implementare contenuto dichiarativo**

La consumazione costa 3 e aumenta ubriachezza di 2. `offer` costa altri 3 e aumenta dignità di 2; `refuse` non costa e riduce dignità di 1. Testi e numeri vivono in `packages/content`, non nei componenti UI.

- [ ] **Step 4: Eseguire tutti i controlli**

Run: `npm test && npm run typecheck && npm run build`

- [ ] **Step 5: Commit**

```bash
git add packages/content apps/server
git commit -m "feat: add first venue event loop"
```

### Task 7: Test end-to-end della vertical slice

**Files:**
- Create: `e2e/vertical-slice.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: server, TV web e controller web.
- Produces: prova automatica dell'intero percorso critico.

- [ ] **Step 1: Scrivere scenario Playwright**

Aprire TV e due controller, entrare come Gino e Marta, avviare, usare il fallback del dado, verificare movimento sulla TV, scegliere `offer` e verificare budget/dignità sul solo controller di Gino.

- [ ] **Step 2: Eseguire `npm run test:e2e` e verificare il fallimento**

- [ ] **Step 3: Correggere soltanto i difetti osservati nello scenario**

- [ ] **Step 4: Eseguire suite completa**

Run: `npm test && npm run typecheck && npm run build && npm run test:e2e`

Expected: tutti i comandi terminano con codice 0.

- [ ] **Step 5: Commit**

```bash
git add e2e playwright.config.ts
git commit -m "test: cover complete web vertical slice"
```
