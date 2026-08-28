import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'docs/game-design/imprevisti-v1.md')
const outputPath = resolve(root, 'docs/design/cards/preview/index.html')

const source = readFileSync(sourcePath, 'utf8')
const lines = source.split('\n')
const cards = []
let family = ''
let card = null

for (const line of lines) {
  const familyMatch = line.match(/^## (Disastri personali|Incontri sociali|Caos urbano|Eventi da osteria|Colpi di fortuna e caos positivo)$/)
  if (familyMatch) family = familyMatch[1]

  const cardMatch = line.match(/^### (\d{2})\. (.+)$/)
  if (cardMatch) {
    if (card) cards.push(card)
    card = { number: cardMatch[1], title: cardMatch[2], family, description: '', escape: '', choices: [] }
    continue
  }

  if (!card || !line.trim()) continue
  if (!card.description && !line.startsWith('- ')) {
    card.description = line.trim()
    continue
  }
  if (line.startsWith('- **Salva il culo:**')) {
    card.escape = line.replace('- **Salva il culo:**', '').trim()
    continue
  }
  if (line.startsWith('- **')) card.choices.push(line.slice(2).trim())
}
if (card) cards.push(card)

if (cards.length !== 50) throw new Error(`Attese 50 carte, trovate ${cards.length}`)

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const inline = (value) => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>')

const familyMeta = {
  'Disastri personali': ['DISASTRO PERSONALE', 'KA-BOOM!'],
  'Incontri sociali': ['INCONTRO SOCIALE', 'OH NO!'],
  'Caos urbano': ['CAOS URBANO', 'SBAM!'],
  'Eventi da osteria': ['CAOS DA OSTERIA', 'CIN CIN!'],
  'Colpi di fortuna e caos positivo': ['COLPO DI FORTUNA', 'CHE CULO!']
}

const cardsHtml = cards.map((item) => {
  const [label, burst] = familyMeta[item.family]
  const choiceHtml = item.choices.map((choice) => `<li>${inline(choice)}</li>`).join('')
  const escapeParts = item.escape.split(';').map((part) => part.replace(/^ oppure /, '').trim())
  const escapeLabels = ['SCOMODA', 'FAI', 'BEVI']
  const escapeHtmlBlocks = escapeParts.map((part, index) => `<div class="escape-option"><b>${escapeLabels[index] ?? 'OPZIONE'}</b><span>${inline(part)}</span></div>`).join('')
  return `<article class="event-card" data-family="${escapeHtml(item.family)}" data-card="${item.number}">
    <header><span>${label}</span><b>#${item.number}</b></header>
    <h2>${escapeHtml(item.title).toUpperCase()}</h2>
    <div class="art" aria-label="Spazio illustrazione ${escapeHtml(item.title)}"><span>${burst}</span><strong>${item.number}</strong></div>
    <p class="description">${escapeHtml(item.description)}</p>
    <ul class="consequences">${choiceHtml}</ul>
    <section class="escape"><h3>SALVA IL CULO</h3><div>${escapeHtmlBlocks}</div></section>
    <output class="fit-badge" aria-live="polite">OK</output>
  </article>`
}).join('\n')

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Osterie Extreme Survival — Carte Imprevisto V1</title>
<style>
:root{--ink:#21130d;--paper:#f2d58e;--red:#d32d22;--yellow:#f7bf19;--green:#183f2b;--cream:#fff1bd;--black:#15110d}
*{box-sizing:border-box}body{margin:0;background:#17120e;color:#f8e6b7;font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif}.toolbar{position:sticky;top:0;z-index:9;display:flex;align-items:center;gap:12px;padding:14px 20px;background:#17120eef;border-bottom:3px solid #f7bf19;backdrop-filter:blur(12px)}.toolbar h1{font-size:20px;margin:0 auto 0 0;letter-spacing:.04em}.toolbar select,.toolbar button{border:2px solid var(--yellow);background:#281b13;color:#fff3c4;padding:9px 12px;font:700 14px Arial;cursor:pointer}.summary{font:700 14px Arial;color:#f7bf19}.deck{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:34px;padding:34px;align-items:start}.event-card{position:relative;width:100%;max-width:390px;aspect-ratio:5/8;margin:auto;overflow:hidden;padding:16px;display:grid;grid-template-rows:auto auto 28% auto auto 1fr;gap:8px;color:var(--ink);background:radial-gradient(circle at 18% 12%,#fff2be 0 2%,transparent 3%),repeating-linear-gradient(3deg,#efd18a 0 5px,#e9c67b 6px 9px);border:6px solid var(--black);border-radius:18px;box-shadow:0 0 0 3px var(--red),8px 10px 0 #0008;transform:rotate(var(--tilt,0deg))}.event-card:nth-child(3n+1){--tilt:-.25deg}.event-card:nth-child(3n+2){--tilt:.2deg}.event-card::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,transparent 70%,#6e17161c),radial-gradient(circle at 88% 4%,#7b151522 0 8%,transparent 9%)}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid var(--ink);font-size:12px;letter-spacing:.08em}header span{background:var(--green);color:#fff0bd;padding:5px 8px;transform:skew(-5deg)}header b{font-size:17px}h2{margin:0;text-align:center;font-size:clamp(25px,2.25vw,37px);line-height:.9;letter-spacing:.015em;text-wrap:balance;text-shadow:2px 2px 0 #fff0bd}.art{position:relative;overflow:hidden;display:grid;place-items:center;background:var(--red);border:4px solid var(--ink);clip-path:polygon(2% 5%,98% 0,96% 95%,4% 100%)}.art::before{content:'';position:absolute;width:170%;height:170%;background:repeating-conic-gradient(var(--yellow) 0 8deg,var(--red) 8deg 16deg);animation:pulse 8s linear infinite}.art span{position:relative;z-index:1;padding:8px 14px;background:var(--cream);border:4px solid var(--ink);font-size:clamp(25px,2.5vw,42px);transform:rotate(-5deg);text-shadow:2px 2px 0 var(--yellow)}.art strong{position:absolute;right:12px;bottom:-9px;z-index:1;color:#fff;font-size:58px;-webkit-text-stroke:3px #1d110c}.description{margin:0;padding:8px 9px;background:#fff1c5;border:2px solid var(--ink);font:800 clamp(12px,1.05vw,15px)/1.2 Arial,sans-serif;text-align:center}.consequences{list-style:none;margin:0;padding:0;background:#f7c629;border:3px solid var(--ink);font:800 clamp(11px,.9vw,14px)/1.15 Arial,sans-serif}.consequences li{padding:6px 8px;border-bottom:2px solid var(--ink)}.consequences li:last-child{border:0}.escape{min-height:0;display:flex;flex-direction:column;border:3px solid var(--ink);background:#f9e6a9}.escape h3{margin:-1px -1px 3px;padding:4px;background:var(--ink);color:var(--yellow);font-size:clamp(17px,1.5vw,23px);text-align:center;letter-spacing:.05em}.escape>div{min-height:0;display:grid;grid-template-columns:repeat(3,1fr);flex:1}.escape-option{min-width:0;padding:5px;border-right:2px solid var(--ink);display:flex;flex-direction:column;gap:3px;text-align:center}.escape-option:last-child{border:0}.escape-option b{color:var(--red);font-size:clamp(11px,.95vw,14px)}.escape-option span{font:700 clamp(9px,.72vw,11px)/1.08 Arial,sans-serif;overflow-wrap:anywhere}.fit-badge{position:absolute;right:8px;top:44px;padding:3px 6px;background:#196b35;color:white;border:2px solid #111;font:900 11px Arial}.event-card.is-overflowing{box-shadow:0 0 0 5px #ff304f,8px 10px 0 #0008}.event-card.is-overflowing .fit-badge{background:#d4112d}.event-card.is-overflowing .fit-badge::after{content:' — TESTO LUNGO'}body.compact .deck{grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px}body.compact .event-card{max-width:320px}body.show-overflow .event-card:not(.is-overflowing){display:none}body[data-view="tv"] .event-card{grid-template-rows:auto auto 42% auto 1fr}body[data-view="tv"] .escape{display:none}body[data-view="controller"] .event-card{grid-template-rows:auto auto auto 1fr}body[data-view="controller"] .art,body[data-view="controller"] .consequences{display:none}body[data-view="controller"] .description{font-size:16px}body[data-view="controller"] .escape-option{justify-content:center}body[data-view="controller"] .escape-option span{font-size:14px;line-height:1.25}@keyframes pulse{50%{transform:rotate(4deg) scale(1.04)}}@media(prefers-reduced-motion:reduce){.art::before{animation:none}}@media(max-width:600px){.toolbar{flex-wrap:wrap}.toolbar h1{width:100%}.deck{padding:18px;grid-template-columns:1fr}.event-card{max-width:370px}}
@media print{.toolbar{display:none}.deck{grid-template-columns:repeat(3,1fr);gap:8mm;padding:0}.event-card{break-inside:avoid;box-shadow:none;max-width:none}}
</style>
</head>
<body data-view="tv">
<nav class="toolbar"><h1>CARTE IMPREVISTO V1 · STILE B</h1><span class="summary" id="summary">Analisi…</span><select id="family"><option value="">Tutte le famiglie</option>${Object.keys(familyMeta).map((name)=>`<option>${name}</option>`).join('')}</select><button id="surface">Vista controller</button><button id="size">Vista compatta</button><button id="overflow">Solo testi lunghi</button></nav>
<main class="deck">${cardsHtml}</main>
<script>
const cards=[...document.querySelectorAll('.event-card')];
const summary=document.querySelector('#summary');
function audit(){let long=0;for(const card of cards){card.classList.remove('is-overflowing');const overflowing=card.scrollHeight>card.clientHeight;if(overflowing){card.classList.add('is-overflowing');long++}card.querySelector('.fit-badge').textContent=overflowing?'ATTENZIONE':'OK'}summary.textContent=cards.filter(c=>c.style.display!=='none').length+' carte · '+long+' testi lunghi'}
document.querySelector('#family').addEventListener('change',event=>{for(const card of cards)card.style.display=!event.target.value||card.dataset.family===event.target.value?'':'none';audit()});
document.querySelector('#size').addEventListener('click',()=>{document.body.classList.toggle('compact');requestAnimationFrame(audit)});
document.querySelector('#surface').addEventListener('click',event=>{const controller=document.body.dataset.view==='tv';document.body.dataset.view=controller?'controller':'tv';event.target.textContent=controller?'Vista TV':'Vista controller';requestAnimationFrame(audit)});
document.querySelector('#overflow').addEventListener('click',()=>{document.body.classList.toggle('show-overflow')});
new ResizeObserver(audit).observe(document.querySelector('.deck'));audit();
</script>
</body></html>`

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, html)
console.log(`Generate ${cards.length} carte in ${outputPath}`)
