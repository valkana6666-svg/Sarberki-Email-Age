// Static assets only on the single authorized test host. No Auth or service APIs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const expected=JSON.parse(readFileSync(new URL('../operator.webmanifest',import.meta.url),'utf8'));
async function asset(path){
 const url=new URL(path,origin);
 assert.equal(url.origin,origin);
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,path);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
 return response;
}
const html=await (await asset('/index.html')).text();
assert.match(html,/<link rel="manifest" href="\.\/operator\.webmanifest">/);
const response=await asset('/operator.webmanifest');
assert.match(response.headers.get('content-type')||'',/^application\/manifest\+json\b/);
assert.deepEqual(await response.json(),expected);
for(const icon of expected.icons){
 const png=Buffer.from(await (await asset('/'+icon.src.replace(/^\.\//,''))).arrayBuffer());
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
 assert.equal(png.readUInt32BE(20),Number(icon.sizes.split('x')[1]));
}
console.log('OPERATOR PWA STATIC DEPLOY PASS: manifest, clean start, icons, no-store. Actual iPhone install NOT VERIFIED.');
