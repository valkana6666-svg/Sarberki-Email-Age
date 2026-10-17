import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manifest=JSON.parse(readFileSync(new URL('../operator.webmanifest',import.meta.url),'utf8'));
const chatbot=JSON.parse(readFileSync(new URL('../sarberki-chatbot-project/manifest.webmanifest',import.meta.url),'utf8'));

test('operator home-screen launch starts without an email selector, session or auth fragment',()=>{
 const origin='https://synthetic-test.invalid';
 const start=new URL(manifest.start_url,origin);
 assert.equal(start.origin,origin);
 assert.equal(start.pathname,'/index.html');
 assert.equal(start.search,'');
 assert.equal(start.hash,'');
 assert.equal(manifest.scope,'/');
 assert.equal(manifest.display,'standalone');
 assert.match(manifest.name,/TESZT/);
 assert.notEqual(manifest.id,chatbot.id);
});

test('operator install icons are real PNGs of the advertised dimensions',()=>{
 assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
 for(const icon of manifest.icons){
  assert.equal(icon.type,'image/png');
  const png=readFileSync(new URL('../'+icon.src,import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
  assert.equal(png.readUInt32BE(20),Number(icon.sizes.split('x')[1]));
 }
});
