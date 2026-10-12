// Static synthetic operator-test page only. Browser traffic is loopback-only.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const root=resolve(process.env.CHATBOT_PROOF_ROOT||'.'),report={syntheticOnly:true,externalRequests:0,emailSent:false,pushoverSent:false,bookingCreated:false,actualIPhoneVerified:false,checks:[]};
const messages={hu:'Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt részére, gyermek nélkül?',de:'Ist ein Deluxe Haus vom 2026-11-13 bis 2026-11-15 für 2 Erwachsene ohne Kinder frei?',en:'Is a Deluxe cabin available from 2026-11-13 to 2026-11-15 for 2 adults and no children?',si:'Ali je Deluxe hiška prosta od 2026-11-13 do 2026-11-15 za 2 odrasli osebi brez otrok?'};
const server=createServer((req,res)=>{
 try{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method!=='GET'||!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:mjs|html)$/.test(path))throw Error('PATH');
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep))throw Error('PATH');
  if(path.endsWith('.html')&&path!=='/sarberki-chatbot-project/index.html')throw Error('PATH');
  res.writeHead(200,{'Content-Type':path.endsWith('.mjs')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(file));
 }catch{res.writeHead(404);res.end();}
});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const [engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
  browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',route=>{
   if(new URL(route.request().url()).origin===origin)return route.continue();
   report.externalRequests++;return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const submit=async text=>{await page.locator('#question').fill(text);await page.locator('button[type=submit]').click();};
  for(const [language,message]of Object.entries(messages)){
   await page.goto(origin+'/sarberki-chatbot-project/index.html');
   await page.locator('#language').selectOption(language);await submit(message);
   const last=page.locator('#conversation .entry').last();
   if(language!=='hu'){
    await last.locator('.operator-review').waitFor();
    assert.match(await last.locator('.operator-review').innerText(),/kapacitás ellenőrzése még nem igazolt/);
    assert.equal(await last.locator('.operator-review').getAttribute('lang'),'hu');
   }else assert.equal(await last.locator('.operator-review').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   report.checks.push({engine,language,mobileWidth:390,result:'PASS'});
  }
  await page.locator('#language').selectOption('en');await page.locator('#resetChat').click();
  await submit('Is a Deluxe cabin available from 2026-11-13 to 2026-11-15?');
  assert.match(await page.locator('.operator-review').last().innerText(),/felnőtt/);
  await submit('2 adults and no children.');
  assert.match(await page.locator('.operator-review').last().innerText(),/kapacitás ellenőrzése még nem igazolt/);
  report.checks.push({engine,test:'multiturn-retains-known-facts',result:'PASS'});
  await page.locator('#resetChat').click();assert.equal(await page.locator('.operator-review').count(),0);
  await submit('Is there availability?');
  assert.match(await page.locator('.operator-review').last().innerText(),/érkez|távoz|időpont/i);
  report.checks.push({engine,test:'reset-clears-retained-facts',result:'PASS'});
  await submit('<img src=x onerror="window.__unsafe=true">');
  assert.equal(await page.evaluate(()=>window.__unsafe===true),false);
  assert.equal(await page.locator('#conversation img').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);report.checks.push({engine,test:'textContent-no-script-no-overflow-no-pageerrors',result:'PASS'});
  await browser.close();browser=null;
 }
 assert.equal(report.externalRequests,0);report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error.message);process.exitCode=1;}
finally{
 if(browser)await browser.close();await new Promise(r=>server.close(r));
 const directory=process.env.CHATBOT_PROOF_DIRECTORY||'/tmp/sarberki-chatbot-proof';mkdirSync(directory,{recursive:true});
 writeFileSync(resolve(directory,'MOBILE-PROOF.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
