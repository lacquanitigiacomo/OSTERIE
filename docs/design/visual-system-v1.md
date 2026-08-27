# Visual system V1

Baseline approvata: [`tv-phone-hybrid-osteria-comic-v2.png`](./concepts/tv-phone-hybrid-osteria-comic-v2.png).

## Direzione

La modalità **A — osteria illustrata** è dominante: carta ingiallita, inchiostro scuro, vino, verde bottiglia, bordi stampati e imperfezioni leggere. Deve occupare sfondi, mappa, pannelli e contenitori principali senza compromettere contrasto e leggibilità.

La UI del concept attuale governa la gerarchia: una sola azione primaria, stato del turno evidente, dati privati sul telefono e informazioni condivise sulla TV. Testo e controlli rimangono nativi, non incorporati in immagini.

La modalità **C — fumetto esagerato** è un accento temporaneo. `os-event-burst` è riservato a risultato dei dadi, imprevisti, penalità e reazioni. Non va usato per navigazione, pannelli permanenti, statistiche o sfondi.

Per le carte Imprevisto è approvata una deroga intenzionale: si usa la variante **B — fumetto esplosivo** come linguaggio dominante della carta. La cornice generale del gioco resta da osteria illustrata, mentre l'Imprevisto interrompe visivamente la partita con rosso, giallo, nero, balloon, vignette e caricature esagerate.

## Uso

```css
@import "@osterie/ui-theme";
```

Applicare `os-theme` alla radice. Le primitive disponibili sono `os-display`, `os-heading`, `os-label`, `os-panel`, `os-ink-panel`, `os-button`, `os-stat-row`, `os-stat-value` e `os-event-burst`.

I token hanno prefisso `--os-` e coprono palette, tipografia, spaziatura, raggi, bordi, ombre, movimento e texture CSS. TV e controller devono consumare gli stessi token; eventuali variazioni restano semantiche e non ridefiniscono i colori di base.

## Vincoli V1

- Nessun font o asset remoto nel package.
- Texture ottenute con gradienti CSS leggeri; l'illustrazione centrale resta un asset dedicato.
- Focus visibile e target primario alto almeno `3rem`.
- Numeri HUD tabulari; testo breve, mai decorazione sopra la leggibilità.
- Animazioni disattivate con `prefers-reduced-motion`.
- Raffinamenti futuri possono sostituire font e texture, mantenendo invariati i token semantici.
