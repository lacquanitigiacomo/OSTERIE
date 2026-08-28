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
