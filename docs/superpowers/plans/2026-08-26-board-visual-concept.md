# TV Board Visual Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produrre e archiviare nel progetto il primo concept illustrato 16:9 del tabellone TV di OSTERIE GAME.

**Architecture:** Il concept viene generato come singola tavola raster per validare composizione e direzione artistica prima della scomposizione produttiva. Le fonti cartografiche definiscono Padova e la rete libera; una carta Imprevisto e un avatar vincolano stile, palette e tratto.

**Tech Stack:** built-in `image_gen`, PNG 16:9, ImageMagick `identify`, asset raster esistenti.

**Spec:** `docs/superpowers/specs/2026-08-26-board-visual-design.md`

## Global Constraints

- Canvas TV in formato 16:9, senza HUD incorporato.
- Piazza delle Erbe è la partenza comune.
- Nove osterie canoniche, percorso libero con bivi, incroci, anelli e scorciatoie.
- Stile C della tavola fornita: fumetto esplosivo, contorni neri, giallo, rosso, nero e crema.
- Cartografia storica usata come riferimento di forma e texture, non ricalcata.
- Asset finale originale; niente loghi reali non autorizzati o fotografie riconoscibili nella build.
- Non modificare o sovrascrivere carte, avatar o riferimenti esistenti.

---

### Task 1: Pacchetto riferimenti del concept

**Files:**
- Create: `assets/board/references/README.md`
- Create: `assets/board/concepts/`
- Copy: `assets/board/references/padova-seicento.jpg`
- Copy: `assets/board/references/posizioni-osterie.jpg`
- Copy: `assets/board/references/stile-c-party-game.png`

**Interfaces:**
- Consumes: file forniti dall'utente in `/Users/giacomolacquaniti/Downloads/`.
- Produces: tre riferimenti locali stabili letti dal Task 2.

- [ ] **Step 1: Creare le directory senza alterare gli asset esistenti**

Run:

```bash
mkdir -p assets/board/references assets/board/concepts
```

Expected: entrambe le directory esistono e sono vuote.

- [ ] **Step 2: Copiare i tre riferimenti vincolanti**

Run:

```bash
cp '/Users/giacomolacquaniti/Downloads/Mappa_Padova_del_600.jpg' assets/board/references/padova-seicento.jpg
cp '/Users/giacomolacquaniti/Downloads/provamap2.jpg' assets/board/references/posizioni-osterie.jpg
cp '/Users/giacomolacquaniti/Downloads/Tre stili per il party game padovano.png' assets/board/references/stile-c-party-game.png
```

Expected: tre file immagine leggibili nella directory `references`.

- [ ] **Step 3: Documentare ruolo e limiti delle fonti**

Create `assets/board/references/README.md` with:

```markdown
# Riferimenti tabellone

- `padova-seicento.jpg`: forma urbana, mura, canali e texture cartografica.
- `posizioni-osterie.jpg`: distribuzione indicativa dei locali e leggibilità stradale.
- `stile-c-party-game.png`: palette, deformazione fumettistica, contrasto e tono visivo.

Le immagini sono riferimenti di progettazione. Non devono essere ricalcate o distribuite come asset finali. Il concept e gli asset di produzione devono essere illustrazioni originali.
```

- [ ] **Step 4: Verificare le immagini**

Run:

```bash
/opt/ImageMagick/bin/identify assets/board/references/*
```

Expected: tre immagini valide, senza errori di decodifica.

- [ ] **Step 5: Commit del pacchetto di lavoro**

```bash
git add assets/board/references
git commit -m "chore: archive board visual references"
```

### Task 2: Generare il primo concept 16:9

**Files:**
- Read: `assets/board/references/padova-seicento.jpg`
- Read: `assets/board/references/posizioni-osterie.jpg`
- Read: `assets/board/references/stile-c-party-game.png`
- Read: `assets/cards/imprevisti/01-telefono-al-2-percento.png`
- Read: `assets/avatars/characters/08-il-tamarro-palestrato-base.png`
- Create: `assets/board/concepts/tabellone-tv-v1.png`

**Interfaces:**
- Consumes: cinque immagini di riferimento e la specifica grafica approvata.
- Produces: un concept raster 16:9 pronto per revisione visiva.

- [ ] **Step 1: Ispezionare tutti i riferimenti con `view_image`**

Expected: forma urbana, distribuzione, stile C, tratto della carta e tratto dell'avatar sono visibili prima della generazione.

- [ ] **Step 2: Generare una singola tavola con built-in `image_gen`**

Use the five inspected images as style/supporting references and this exact normalized prompt:

```text
Use case: stylized-concept.
Asset type: first visual concept for a party videogame board displayed on a television, landscape 16:9.
Primary request: create an original illustrated board map of Padua for OSTERIE GAME. Piazza delle Erbe is the shared starting point. Nine distinct tavern buildings are distributed across a free network of streets with forks, crossings, loops and shortcuts. Show roughly 50–70 readable board spaces, including normal cream spaces and explosive yellow-red “!” event spaces. The route must not be a single circuit.
Input images: Padua seventeenth-century map for urban silhouette, walls, waterways and parchment texture; annotated modern map for approximate distribution and street readability; rightmost style C panel for dominant visual direction; existing event card and avatar for exact line quality and character universe.
Scene/backdrop: a heavily caricatured bird's-eye Padua, with Piazza delle Erbe and Palazzo della Ragione, Basilica del Santo, Prato della Valle, Torre dell'Orologio, waterways and optionally the Specola. Landmarks guide orientation but remain secondary to taverns and routes.
Style/medium: outrageous European pop-comic board-game illustration, punk poster energy, thick irregular black ink, grotesque playful architecture, bold flat colors, halftone texture, worn cream paper. Use yellow, red, black and cream with small cyan/green accents. Match the impact and playful exaggeration of the existing cards and avatars.
Composition/framing: clean 16:9 television composition; map fills the canvas; strong visual hierarchy; large readable tavern nodes; clear branching connections; safe margins for future HUD overlays. No HUD, no player panels and no mobile frame baked into the artwork.
Text: only short provisional tavern labels if legible; no paragraphs, no invented slogans.
Constraints: clearly original illustration; all nine taverns visually distinct; Piazza delle Erbe unmistakable as START; free route readable from sofa distance; no photographs; no real logos; no realistic people; no drunken protagonist dominating the map.
Avoid: elegant museum-map aesthetic, neon cyberpunk, photorealism, tiny street names, linear goose-game circuit, cluttered miniature detail, illegible intersections, UI panels, watermark.
```

Expected: una singola immagine che comunica immediatamente Padova, nove destinazioni e libertà di percorso.

- [ ] **Step 3: Copiare l'output senza sovrascrivere versioni esistenti**

Read the absolute PNG path returned in `image_gen.output_hint`, then use `cp` with that exact source path and `assets/board/concepts/tabellone-tv-v1.png` as destination. Do not delete the generated source.

Expected: `assets/board/concepts/tabellone-tv-v1.png` exists and the source under `.codex/generated_images/` remains intact.

- [ ] **Step 4: Verificare formato e decodifica**

Run:

```bash
/opt/ImageMagick/bin/identify -format '%m %wx%h\n' assets/board/concepts/tabellone-tv-v1.png
```

Expected: `PNG`, orientamento orizzontale e rapporto vicino a `1.777`.

- [ ] **Step 5: Commit del concept**

```bash
git add assets/board/concepts/tabellone-tv-v1.png
git commit -m "art: add first TV board concept"
```

### Task 3: Revisione visiva e decisione di produzione

**Files:**
- Read: `assets/board/concepts/tabellone-tv-v1.png`
- Create only after feedback: `assets/board/concepts/tabellone-tv-v2.png`

**Interfaces:**
- Consumes: concept V1 e feedback diretto dell'utente.
- Produces: approvazione del linguaggio visivo oppure una V2 con una sola correzione mirata.

- [ ] **Step 1: Mostrare il concept completo**

Render `assets/board/concepts/tabellone-tv-v1.png` inline and provide its clickable absolute path.

- [ ] **Step 2: Verificare i criteri della specifica**

Check visibly:

```text
[ ] Padova riconoscibile
[ ] stile coerente con carte e avatar
[ ] Piazza delle Erbe leggibile come partenza
[ ] nove osterie distinguibili
[ ] percorso non lineare
[ ] caselle e bivi leggibili a distanza
[ ] assenza di HUD incorporato
[ ] spazio utile per sovrapposizioni future
```

- [ ] **Step 3: Raccogliere una sola correzione prioritaria**

Expected: l'utente approva V1 oppure indica la modifica con maggiore impatto; non si avvia ancora la scomposizione in livelli.

- [ ] **Step 4: Se richiesta, generare V2 non distruttiva**

Use `tabellone-tv-v1.png` as edit target, preserve all approved invariants, change only the requested issue, and save as `assets/board/concepts/tabellone-tv-v2.png`.

- [ ] **Step 5: Commit della revisione approvata**

```bash
git add assets/board/concepts/tabellone-tv-v2.png
git commit -m "art: refine TV board concept"
```
