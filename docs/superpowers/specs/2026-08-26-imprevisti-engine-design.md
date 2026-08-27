# Motore Imprevisti — design

## 1. Contesto e obiettivo

Il motore di gioco gestisce oggi un solo evento hardcoded (`friend_round`,
due scelte fisse `offer`/`refuse`) in `apps/server/src/game/reducer.ts`. Il
catalogo reale di 50 carte Imprevisto vive solo come testo narrativo in
`docs/game-design/imprevisti-v1.md` e non è collegato al motore.

Obiettivo di questo sotto-progetto: generalizzare protocollo, stato di
gioco e UI (TV + controller) per pescare, presentare e risolvere una
qualsiasi carta Imprevisto, incluso il meccanismo "Salva il culo" con voto
di gruppo. Questo è il primo di tre sotto-progetti (gli altri due sono
"Board & animazioni" e "Osterie & minigiochi"); il motore qui descritto è
pensato per essere riusato dagli altri due.

## 2. Scope V1: 8 carte rappresentative

Il catalogo completo (50 carte) non viene convertito subito. Si parte da 8
carte scelte per coprire tutti i tipi di effetto necessari al motore,
escludendo esplicitamente due meccaniche non ancora progettate:

- carte che pescano una carta "Fortuna" (mazzo non ancora definito)
- carte con "mini-prova" che richiedono un vero minigioco (dipende dal
  sotto-progetto Osterie & minigiochi)

| ID | Titolo | Tipo di effetto introdotto |
|----|--------|------------------------------|
| 01 | Il telefono al 2% | `delayNextInput`, pagamento per evitare l'effetto |
| 02 | La scarpa traditrice | `statDelta` + `move`, caso base |
| 03 | Messaggio all'ex | `opponentChooses` |
| 08 | La cintura ha mollato | `statDelta` + `move` positivo |
| 22 | Pioggia bastarda | opzioni multiple con combinazioni budget/movimento |
| 27 | Google Maps ubriaco | `opponentChooses`, variante binaria |
| 30 | Lucchetto maledetto | `skipNextTurn` |
| 36 | Sedia traditrie | `swapPositionWithPlayerBehind` + `nextRollModifier` |

Le altre 42 carte sono data-entry meccanica successiva una volta che i tipi
di effetto sopra sono validati da test e uso reale; non richiedono nuovo
lavoro di motore.

## 3. Nuovo pacchetto `packages/game-content`

Nuovo workspace package, letto sia da `apps/server` (per calcolare gli
effetti) sia da `apps/tv-web` e `apps/controller-web` (per mostrare
titolo/descrizione/opzioni). Il protocollo di rete trasporta solo
`cardId` — mai il testo della carta — per evitare duplicazione tra wire
format e contenuto.

```ts
export type DirectEffect =
  | { type: 'statDelta'; stat: 'budget' | 'drunkenness' | 'dignity' | 'energy' | 'stomach' | 'suspicion'; delta: number }
  | { type: 'move'; spaces: number }
  | { type: 'skipNextTurn' }
  | { type: 'delayNextInput'; ms: number }
  | { type: 'nextRollModifier'; delta: number }
  | { type: 'swapPositionWithPlayerBehind' }

export type OpponentChoosesEffect = {
  type: 'opponentChooses'
  options: [
    { id: string; label: string; effects: DirectEffect[] },
    { id: string; label: string; effects: DirectEffect[] }
  ]
}

export type Effect = DirectEffect | OpponentChoosesEffect
```

**Nota di revisione (in fase di planning):** la prima bozza di questo
spec usava `betweenOptionIds: [string, string]`, un riferimento a id di
opzioni definite altrove nella stessa carta. In fase di stesura del piano
si è rivelato fragile per il caso della carta 27 (le due conseguenze
delegate non esistono come opzioni scelte direttamente dal giocatore
attivo). La versione finale incorpora le due sotto-opzioni direttamente
dentro l'effetto stesso — nessun riferimento a id esterni, ogni carta
resta autosufficiente.

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

export const imprevistiCatalog: ImprevistoCard[]
```

`illustration` referenzia gli asset già presenti in
`assets/cards/imprevisti/NN-slug.png` (per la variante genere, vedi §8
"Fuori scope").

## 4. Stato del giocatore (`apps/server/src/game/state.ts`)

`GamePlayer` guadagna i tre campi statistica mancanti e un contenitore per
gli effetti ritardati, consumati al turno successivo del giocatore
proprietario:

```ts
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
```

`GameState` guadagna il mazzo Imprevisti:

```ts
imprevistiDeck: string[]      // id carte rimanenti, mescolate
imprevistiDiscard: string[]   // id carte già pescate
```

Il mazzo si rimescola (scarto → nuovo mazzo, shuffle con RNG iniettato,
stesso pattern di `RollDie`) quando si esaurisce.

## 5. Protocollo (`packages/protocol/src/index.ts`)

`pendingEvent` sostituisce la forma hardcoded `{ eventId: 'friend_round' }`
con un'unione discriminata su `phase`, per coprire anche il caso
`opponentChooses` (§6.3):

Lato server `pendingEvent` porta le due sotto-opzioni per intero (con i
loro `effects`); la proiezione pubblica (§7, `projections.ts`) le
riduce a `{ id, label }` prima di inviarle sul wire — l'arbitro sceglie
solo in base a id/etichetta, mai vedendo gli effetti in anticipo.

```ts
type PendingEvent =
  | { cardId: string; playerId: string; phase: 'choosing' }
  | {
      cardId: string; playerId: string; phase: 'choosing-for-other'; arbiterId: string
      options: [{ id: string; label: string }, { id: string; label: string }]  // versione pubblica, senza effects
    }
  | { cardId: string; playerId: string; phase: 'voting'; savingAttempt: 'scomoda' | 'fai' | 'bevi' }

pendingEvent: PendingEvent | null
```

`playerId` identifica sempre il giocatore che ha pescato la carta (quello
i cui effetti verranno applicati), anche quando non è lui a scegliere.

Resta solo in `PublicGameState`. **`pendingEvent` viene rimosso da
`PrivatePlayerState`**: niente in questo flusso è realmente segreto (le
opzioni della carta sono nel pacchetto condiviso, quindi pubbliche in
senso tecnico); la UI del controller si deriva da `publicState.pendingEvent`
confrontando il proprio `playerId` con `activePlayerId` (turno),
`arbiterId` (fase `choosing-for-other`) o semplicemente sapendo di non
essere nessuno dei due (fase `voting`, mostra i pulsanti di voto).
Questo semplifica il protocollo invece di espanderlo.

Nuovo comando client:

```ts
z.object({ ...envelope, type: z.literal('event.vote'), vote: z.enum(['valid', 'invalid']) })
```

`event.choose` resta invariato nella forma (`choiceId: string`), ma ora
`choiceId` può essere l'id di una opzione normale della carta oppure uno
dei tre valori riservati `'save:scomoda' | 'save:fai' | 'save:bevi'`.

## 6. Motore server (`apps/server/src/game/reducer.ts`)

### Pesca

- Casella di tipo `imprevisto` sul percorso → pesca garantita dopo il
  movimento in `rollDice`.
- Casella normale → probabilità base 15% (costante `IMPREVISTO_BASE_CHANCE`,
  facilmente configurabile) di pescare comunque, decisa con lo stesso RNG
  iniettato usato per i dadi (mai `Math.random()` diretto, per restare
  testabile).
- La pesca imposta `pendingEvent = { cardId, playerId, phase: 'choosing' }`
  e **non** avanza subito il turno (il turno avanza solo alla risoluzione,
  §6.2).

### Risoluzione (`event.choose`)

- Se `choiceId` è un'opzione normale della carta (validata contro
  `imprevistiCatalog`): applica tutti gli `Effect` del `options[].effects`
  al giocatore attivo (e, per `opponentChooses`, a un avversario scelto —
  vedi sotto), pulisce `pendingEvent`, avanza `activePlayerId` al prossimo
  in `playerOrder` (stesso calcolo già esistente in `rollDice`).
- Se `choiceId` è `'save:scomoda' | 'save:fai' | 'save:bevi'`: transizione
  a `phase: 'voting', savingAttempt: <quello scelto>`. Il turno **non**
  avanza finché il voto non si risolve.

### `opponentChooses`

Quando l'opzione scelta dal giocatore attivo contiene un effetto
`opponentChooses`, il server seleziona con l'RNG iniettato un giocatore
diverso da lui come "arbitro" e passa `pendingEvent` a
`phase: 'choosing-for-other'` (§5), con `arbiterId` e le due sotto-opzioni
(id/etichetta, senza effetti) copiate dall'effetto. Il controller
dell'arbitro (unico a riconoscere
`arbiterId === myPlayerId`) mostra due pulsanti, uno per opzione; tutti
gli altri controller (incluso quello del giocatore originale) restano in
attesa. La scelta dell'arbitro applica gli effetti dell'opzione scelta al
giocatore originale (`pendingEvent.playerId`, non all'arbitro), pulisce
`pendingEvent` e avanza il turno a partire dal giocatore originale — non
dall'arbitro, che ha solo arbitrato senza giocare il proprio turno.

### Voto di gruppo (`event.vote`)

- Accettato solo da giocatori diversi dall'attivo, solo mentre
  `phase === 'voting'`.
- Un voto per giocatore per carta pescata (idempotente su `commandId`,
  stesso meccanismo di `processedCommandIds` già esistente).
- Risoluzione: appena la maggioranza è matematicamente determinata (non
  serve aspettare tutti i voti se lo scarto è già incolmabile) oppure
  quando tutti i giocatori non attivi hanno votato.
  - Maggioranza `valid` → nessun effetto applicato, carta scartata.
  - Maggioranza `invalid`, **o parità** (numero pari di votanti, metà e
    metà) → si applicano `saveFallbackEffects` della carta. In caso di
    dubbio il tavolo non è stato convinto abbastanza.
- Dopo la risoluzione del voto, `pendingEvent` si azzera e il turno
  avanza normalmente.

**Limite noto V1**: nessun timeout automatico sul voto. Se un giocatore
non vota mai, la partita resta bloccata in attesa. Non risolto in questo
design; è un follow-up esplicito, non un'omissione silenziosa.

### Consumo degli effetti ritardati

Il calcolo di "chi è il prossimo giocatore" è oggi duplicato inline in
`rollDice` e `chooseEvent` (stesso pattern `playerOrder.indexOf` +
modulo). Va estratto in un helper unico `advanceTurn(state, fromPlayerId)`
usato da tutti i punti di risoluzione (`rollDice`, `chooseEvent`, voto,
arbitraggio): scorre `playerOrder` a partire da `fromPlayerId` e salta
ogni giocatore con `statusEffects.skipNextTurn` attivo, consumando il
flag mentre lo salta, finché non trova il primo giocatore utilizzabile.
`inputDelayMs` e `nextRollModifier` restano sul giocatore proprietario e
sono letti/consumati dal client controller e dal calcolo del tiro
rispettivamente, alla prima occasione utile.

## 7. UI

### TV (`apps/tv-web`)

Nuovo componente `ImprevistoCard` (sostituisce il riquadro fisso
`friend_round` dentro `BoardScreen.tsx`): illustrazione, titolo,
descrizione, indicatore di fase (`choosing` → "sta decidendo…",
`voting` → "il gruppo vota se {savingAttempt} è valido"). Non mostra mai
quale opzione il giocatore attivo sta per scegliere prima della conferma.

### Controller (`apps/controller-web`)

Nuovo componente `EventChoice` sostituisce il blocco hardcoded in
`App.tsx`. Quattro stati derivati confrontando il proprio `playerId` con
i campi di `publicState.pendingEvent`:

- **Scelta attiva** (`phase === 'choosing' && playerId === myPlayerId`):
  pulsanti per ogni opzione della carta + tre pulsanti Salva il culo.
- **Arbitraggio** (`phase === 'choosing-for-other' && arbiterId === myPlayerId`):
  due pulsanti, uno per ciascuna delle due sotto-opzioni in `pendingEvent.options`.
- **Voto** (`phase === 'voting' && playerId !== myPlayerId`): due
  pulsanti Sì/No sulla prova tentata (`savingAttempt`), disabilitati dopo
  l'invio del voto (stato locale di componente, azzerato al cambio di
  `cardId`).
- **Attesa** (tutti gli altri casi, incluso nessun `pendingEvent`):
  schermata di attesa esistente, invariata.

## 8. Fuori scope (esplicito)

- Le 42 carte restanti del catalogo (data-entry meccanica successiva).
- Variante illustrazione per genere avatar (`assets/cards/imprevisti/femminili/`):
  non esiste ancora un sistema di selezione avatar collegato allo stato
  giocatore; V1 usa sempre il set base.
- Mazzo "Fortuna" citato in alcune carte del catalogo completo.
- Framework minigiochi per le carte con "mini-prova" (sotto-progetto
  "Osterie & minigiochi").
- Timeout automatico sul voto di gruppo (vedi limite in §6).
- Animazioni di movimento sul tabellone (sotto-progetto "Board &
  animazioni"); qui il movimento resta un aggiornamento di stato istantaneo.

## 9. Test

- Reducer: un test per ciascun tipo di `Effect` (non serve un test per
  ognuna delle 8 carte, i tipi di effetto sono il livello giusto di
  copertura), test sul mescolamento/esaurimento del mazzo, test sul
  flusso di voto (maggioranza valida, maggioranza bocciata, voto da
  giocatore attivo rifiutato), test su `opponentChooses` (assegnazione
  arbitro, applicazione effetto al giocatore originale).
- Componenti: `ImprevistoCard` (varianti di fase), `EventChoice` (tre
  stati derivati).
- Rimozione dei test esistenti legati a `friend_round`/`offer`/`refuse`,
  sostituiti dai nuovi.
