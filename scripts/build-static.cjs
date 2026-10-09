// Publish app assets only. Environment variables are never interpolated.
const fs = require('node:fs');
const path = require('node:path');
require('./write-build-info.cjs');
const output = path.resolve('dist');
fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output);
const allowedDirectories = new Set(['business','guest-reply','shared-core','price-source']);
function copyDirectory(source, relative='') {
 for (const entry of fs.readdirSync(source,{withFileTypes:true})) {
  const rel=path.join(relative,entry.name);
  if(entry.isSymbolicLink()) continue;
  if(entry.isDirectory()) {
   if(relative==='' && !allowedDirectories.has(entry.name))continue;
   if(entry.name==='fixtures')continue;
   copyDirectory(path.join(source,entry.name),rel);
  } else if(entry.isFile() && /\.(?:html|m?js|css|svg|txt)$/.test(entry.name) && !/\.test\./.test(entry.name) && !/(?:^server-|^supabase-case-repository|^price-server|^recorded-previo-test)/.test(entry.name)) {
   fs.mkdirSync(path.dirname(path.join(output,rel)),{recursive:true});
   fs.copyFileSync(path.join(source,entry.name),path.join(output,rel));
  }
 }
}
copyDirectory('.');
