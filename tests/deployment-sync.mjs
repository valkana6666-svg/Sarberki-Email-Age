import assert from 'node:assert/strict';

const base=(process.env.TEST_NETLIFY_URL || 'https://leafy-chimera-2403e5.netlify.app').replace(/\/$/,'');
const expected=(process.env.EXPECTED_COMMIT || '').trim();

assert.match(expected,/^[a-f0-9]{40}$/,'EXPECTED_COMMIT must be the exact 40-character GitHub commit SHA.');

const maxAttempts=24;
const delayMs=5000;
let last='';

for(let attempt=1; attempt<=maxAttempts; attempt++){
  try{
    const response=await fetch(base+'/api/health?sync='+Date.now(),{
      headers:{'cache-control':'no-cache'},
      cache:'no-store'
    });
    const raw=await response.text();
    if(!response.ok){
      last='HTTP '+response.status+': '+raw.slice(0,200);
    }else{
      let body;
      try{ body=JSON.parse(raw); }
      catch{ body=null; }
      const deployed=body?.deployedCommit;
      if(deployed===expected){
        console.log('DEPLOY SYNC PASS',JSON.stringify({expected,deployed,url:base}));
        process.exit(0);
      }
      last='expected '+expected+' but Netlify reports '+String(deployed);
    }
  }catch(error){
    last=String(error?.message||error);
  }

  if(attempt<maxAttempts){
    console.log('Waiting for exact test deploy',JSON.stringify({attempt,maxAttempts,last}));
    await new Promise(resolve=>setTimeout(resolve,delayMs));
  }
}

throw new Error('Test Netlify is not running the exact commit under test: '+last);
