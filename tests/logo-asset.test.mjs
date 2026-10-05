import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('test header uses the orange fish-and-crown Sárberki crest SVG',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const svg=fs.readFileSync(new URL('../sarberki-logo-orange.svg',import.meta.url),'utf8');

  assert.match(html,/class="brand-logo"[^>]+src="\.\/sarberki-logo-orange\.svg\?v=/u);
  assert.doesNotMatch(html,/class="brand-logo"[^>]+src="\.\/sarberki-logo-orange\.png/u);
  assert.match(svg,/viewBox="0 0 800 556"/u);
  assert.match(svg,/aria-label="Sárberki Horgásztó Lenti logó"/u);
  assert.match(svg,/fill="#ff7a00"/u);
  assert.match(svg,/<rect[^>]+fill="#000"/u);
  assert.ok(svg.length>15000,'crest SVG unexpectedly small or replaced');
});
