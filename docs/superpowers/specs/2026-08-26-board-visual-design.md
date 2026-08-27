# Tabellone TV — design grafico

## Obiettivo

Produrre il primo concept illustrato del tabellone di OSTERIE GAME. Il tabellone deve essere leggibile su TV in formato 16:9, rappresentare una Padova riconoscibile e mantenere esattamente il linguaggio visivo già approvato per carte Imprevisto e avatar.

Questo sottoprogetto riguarda soltanto la grafica del tabellone. Carte Obiettivo, interni delle nove osterie, adattamento completo della mappa allo smartphone e implementazione del movimento saranno trattati separatamente.

## Direzione approvata

- Riferimento estetico principale: stile C della tavola `Tre stili per il party game padovano.png`.
- Fumetto esplosivo e caricaturale, destinato a studenti e giovani adulti.
- Contorni neri molto spessi e irregolari.
- Palette dominante giallo, rosso, nero e crema.
- Espressività e deformazione coerenti con `assets/cards/imprevisti/` e `assets/avatars/characters/`.
- La cartografia storica fornisce forma urbana, canali, texture e atmosfera; non deve rendere il risultato elegante, realistico o museale.
- Nessuna componente neon o interfaccia notturna futuristica.

## Composizione TV

- Canvas principale 16:9, progettato per 1920×1080 e scalabile a 4K.
- La mappa occupa la zona centrale e la maggior parte dello schermo.
- Fasce HUD e pannelli informativi saranno sovrapposti dal codice e non devono essere incorporati nell'illustrazione di base.
- Il centro storico viene deformato per massimizzare leggibilità, dimensione delle osterie e separazione dei percorsi.
- Canali, mura e landmark formano una cornice visiva, evitando fondali vuoti.
- Piazza delle Erbe è il punto di partenza comune e deve essere immediatamente riconoscibile.

## Struttura del percorso

- Percorso libero a rete, con bivi, incroci, anelli e scorciatoie.
- Il giocatore si muove con due dadi classici.
- Il numero ottenuto determina le caselle percorse.
- Ai bivi il giocatore sceglie la direzione dal controller; la mappa deve quindi rendere ogni ramo inequivocabile anche a distanza.
- Il percorso non impone di visitare tutte le osterie: la destinazione dipende dalla carta Obiettivo segreta.
- Le nove osterie devono essere raggiungibili attraverso più combinazioni di percorso, senza creare una sequenza obbligatoria.

## Locali canonici

1. La Risorta Osteria del Re Fosco
2. Il Gottino
3. La Leggera
4. Agli Amici
5. Bar da Clistina
6. Hype Taproom
7. Ai Do Archi
8. La Yarda
9. Trattoria da CRAK

Ogni osteria sarà rappresentata come edificio caricaturale originale, basato su riferimenti fotografici ma non ricalcato. Nella prima tavola può usare un'insegna tipografica provvisoria; loghi reali non autorizzati non entrano nella build.

## Landmark padovani

La mappa deve includere pochi riferimenti grandi e leggibili, scelti per orientamento e identità:

- Piazza delle Erbe e Palazzo della Ragione;
- Basilica di Sant'Antonio;
- Prato della Valle;
- Torre dell'Orologio / Piazza dei Signori;
- canali e anse del Bacchiglione;
- Specola, se lo spazio lo consente.

I landmark sono caricature architettoniche, non ricostruzioni accurate. Non devono competere visivamente con le osterie.

## Sistema delle caselle

- Casella normale: crema o avorio, bordo nero, segno interno minimo.
- Casella Imprevisto: giallo vivo con esplosione rossa o simbolo `!`.
- Osteria: nodo più grande, rosso, collegato all'edificio corrispondente.
- Bivio: forma chiaramente distinta e connessioni visibili.
- Partenza: nodo speciale a Piazza delle Erbe.
- Eventuali tipi futuri devono poter essere aggiunti senza ridisegnare lo sfondo.

Caselle e connessioni non saranno dipinte definitivamente nello sfondo. Verranno prodotte come livello separato per consentire bilanciamento, animazioni, evidenziazione delle direzioni e modifiche al grafo.

## Livelli grafici

1. `background-city`: forma urbana, carta, canali e texture.
2. `landmarks`: monumenti padovani.
3. `osterie`: nove edifici/insegne separati.
4. `board-paths`: connessioni del grafo.
5. `board-nodes`: caselle normali, Imprevisto, bivi e partenza.
6. `effects`: esplosioni, frecce, evidenziazioni e particelle.
7. `players`: avatar/pedine gestiti dal gioco.
8. `hud`: statistiche e informazioni generate dall'interfaccia.

Questa separazione permette di mantenere una singola direzione artistica e di adattare in futuro la mappa allo smartphone senza ricreare l'illustrazione.

## Prima consegna grafica

La prima consegna sarà un concept unico del tabellone completo, non ancora un asset finale:

- formato 16:9;
- Piazza delle Erbe come partenza;
- nove osterie visibili;
- rete libera con più bivi;
- landmark principali;
- circa 50–70 segnaposto di casella rappresentativi;
- nessun HUD incorporato;
- nessun testo narrativo lungo;
- coerenza forte con carte e avatar.

Dopo l'approvazione del concept si procederà alla scomposizione nei livelli definitivi e alla produzione individuale degli edifici delle osterie.

## Riferimenti forniti

- `images.jpg`: pianta storica monocromatica.
- `images2.jpg`: mappa urbana d'epoca più leggibile.
- `images3.jpg`: semplificazione turistica colorata.
- `Mappa_Padova_del_600.jpg`: forma urbana, mura e atmosfera cartografica.
- `provamap2.jpg`: distribuzione dei punti e leggibilità stradale.
- `Caos nelle osterie di Padova.png`: esempio di composizione TV e pannelli.
- `Imprevisto all’osteria.png`: rapporto tra pergamena e personaggi.
- `Interfaccia mobile per osterie estreme.png`: riferimento futuro per controller.
- `Tre stili per il party game padovano.png`: stile C vincolante.

Le immagini fornite e le fotografie online saranno usate come riferimenti. Gli asset finali devono essere illustrazioni originali.

## Criteri di approvazione

- Padova è riconoscibile senza apparire come una mappa stradale realistica.
- Lo stile appartiene chiaramente allo stesso gioco delle carte Imprevisto.
- Osterie, bivi e caselle sono leggibili da una TV a distanza.
- Il percorso comunica libertà di scelta e non un circuito lineare.
- La scena è ricca e irriverente ma non confusa.
- Nessun elemento essenziale dipende da testo piccolo.
- La struttura può essere animata e modificata tramite livelli separati.
