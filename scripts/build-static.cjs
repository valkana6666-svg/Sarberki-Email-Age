// Publish app assets only. Environment variables are never interpolated.
const fs = require('node:fs');
const path = require('node:path');
require('./write-build-info.cjs');
const output = path.resolve('dist');
fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output);
const allowedDirectories = new Set(['business','guest-reply','shared-core','price-source','sarberki-chatbot-project','napi-kezelo']);
const chatbotAssets = new Set(['index.html','chat-session.mjs','chat-view.mjs','remote-chat-client.mjs','inquiry-preview.mjs','operator-session.mjs','version-status.mjs','manifest.webmanifest','icons']);
const dailyAssets = new Set(['index.html','napi.mjs','napi.css','manifest.webmanifest']);
function copyDirectory(source, relative='') {
 for (const entry of fs.readdirSync(source,{withFileTypes:true})) {
  const rel=path.join(relative,entry.name);
  if(relative==='sarberki-chatbot-project'&&!chatbotAssets.has(entry.name))continue;
  if(relative==='napi-kezelo'&&!dailyAssets.has(entry.name))continue;
  if(relative==='sarberki-chatbot-project/icons'&&!['icon-192.png','icon-512.png','apple-touch-icon.png'].includes(entry.name))continue;
  if(/\.(?:png|webmanifest)$/.test(entry.name)&&!relative.startsWith('sarberki-chatbot-project')&&!(relative==='napi-kezelo'&&entry.name==='manifest.webmanifest')&&!(relative===''&&entry.name==='operator.webmanifest'))continue;
  if(entry.isSymbolicLink()) continue;
  if(entry.isDirectory()) {
   if(relative==='' && !allowedDirectories.has(entry.name))continue;
   if(entry.name==='fixtures')continue;
   copyDirectory(path.join(source,entry.name),rel);
  } else if(entry.isFile() && /\.(?:html|m?js|css|svg|txt|webmanifest|png)$/.test(entry.name) && !/\.test\./.test(entry.name) && !/(?:^server-|^supabase-case-repository|^price-server|^recorded-previo-test)/.test(entry.name)) {
   if(/^isolated-persistent-(?:runtime|http)\.mjs$/.test(entry.name)||entry.name==='operator-cookie-session.mjs'||entry.name==='cloud-synthetic-approval.mjs')continue;
   fs.mkdirSync(path.dirname(path.join(output,rel)),{recursive:true});
   fs.copyFileSync(path.join(source,entry.name),path.join(output,rel));
  }
 }
}
copyDirectory('.');
