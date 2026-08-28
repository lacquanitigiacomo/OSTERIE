import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const previewPath = new URL('../docs/design/cards/preview/index.html', import.meta.url)

test('card preview contains the complete 50-card catalog', () => {
  assert.equal(existsSync(previewPath), true, 'the preview must be generated')
  const html = readFileSync(previewPath, 'utf8')
  assert.equal((html.match(/class="event-card/g) ?? []).length, 50)
  assert.match(html, /FOTO COMPROMETTENTE/)
  assert.match(html, /mostra la foto più compromettente che trovi nella galleria del telefono/)
  assert.match(html, /data-view="tv"/)
  assert.match(html, /Vista controller/)
})
