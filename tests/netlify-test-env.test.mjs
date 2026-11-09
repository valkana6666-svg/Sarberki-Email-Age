import test from 'node:test';
import assert from 'node:assert/strict';
import {getSwitches,setSwitch} from '../scripts/netlify-test-env.mjs';

const fake=(siteName='leafy-chimera-2403e5')=>{const calls=[];const f=async(url,init={})=>{calls.push({url,init});
 if(url.includes('/sites/'))return new Response(JSON.stringify({name:siteName,id:'site-1',account_id:'acc-1'}));
 if(url.includes('/env?'))return new Response(JSON.stringify([{key:'PREVIO_READ_API_ENABLED',is_secret:false,values:[{context:'all',value:'sandbox-73521-only'}]},{key:'PREVIO_API_KEY',is_secret:true,values:[]}]));
 return new Response('{}',{status:200});};f.calls=calls;return f;};

test('only the TEST site, only allow-listed non-secret switches, owner approval required',async()=>{
 const f=fake();
 const sw=await getSwitches({fetchImpl:f});
 assert.equal(sw.PREVIO_READ_API_ENABLED,'all=sandbox-73521-only');assert.equal('PREVIO_API_KEY' in sw,false);
 await assert.rejects(setSwitch({key:'PREVIO_READ_API_ENABLED',value:'sandbox-73521-only',fetchImpl:f}),/OWNER_APPROVAL_REQUIRED/);
 await assert.rejects(setSwitch({key:'PREVIO_API_KEY',value:'x',ownerApproved:true,fetchImpl:f}),/KEY_NOT_ALLOWED/);
 await assert.rejects(setSwitch({key:'PREVIO_HOTEL_ID',value:'753011',ownerApproved:true,fetchImpl:f}),/VALUE_NOT_ALLOWED/);
 const r=await setSwitch({key:'PREVIO_READ_API_ENABLED',value:'sandbox-73521-only',ownerApproved:true,fetchImpl:f});
 assert.equal(r.set,true);const put=f.calls.at(-1);assert.equal(put.init.method,'PUT');assert.match(put.url,/env\/PREVIO_READ_API_ENABLED\?site_id=site-1$/);
 assert.equal(JSON.parse(put.init.body).is_secret,false);
 await assert.rejects(getSwitches({fetchImpl:fake('moonlit-live-site')}),/NOT_THE_TEST_SITE/);
});
