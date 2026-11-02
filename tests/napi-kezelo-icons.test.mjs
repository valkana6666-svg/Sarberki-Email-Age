import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manifest=JSON.parse(readFileSync(new URL('../napi-kezelo/manifest.webmanifest',import.meta.url),'utf8'));
const png=(rel)=>readFileSync(new URL('../napi-kezelo/'+rel,import.meta.url));

test('napi-kezelo manifest icons are real PNGs of the advertised dimensions',()=>{
 assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
 for(const icon of manifest.icons){
  assert.equal(icon.type,'image/png');
  const b=png(icon.src);
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const [w,h]=icon.sizes.split('x').map(Number);
  assert.equal(b.readUInt32BE(16),w);
  assert.equal(b.readUInt32BE(20),h);
 }
});

test('napi-kezelo apple-touch-icon exists, is a square PNG and is linked from the page',()=>{
 const b=png('icons/apple-touch-icon.png');
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(b.readUInt32BE(16),b.readUInt32BE(20));
 assert.match(readFileSync(new URL('../napi-kezelo/index.html',import.meta.url),'utf8'),/apple-touch-icon[^>]*icons\/apple-touch-icon\.png|icons\/apple-touch-icon\.png[^>]*apple-touch-icon/);
});

test('negative: a missing icon file is detected',()=>{
 assert.throws(()=>png('icons/does-not-exist.png'),{code:'ENOENT'});
});
