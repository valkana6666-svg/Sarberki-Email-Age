import test from 'node:test';
import assert from 'node:assert/strict';
import {INBOX_QUERY, assertTestGmailAccount, isTestInquiry} from './gmail-policy.mjs';

const message=(from='Teszt <valkana6666@gmail.com>', subject='Érdeklődés a szállásról', date='2026-10-02T10:00:00Z', labels=['INBOX'])=>({
  internalDate:String(Date.parse(date)),
  labelIds:labels,
  payload:{headers:[{name:'From',value:from},{name:'Subject',value:subject}]}
});

test('Gmail search reads every inbox message after the test start date, regardless of sender or subject',()=>{
  assert.equal(INBOX_QUERY,'in:inbox after:2026/09/25');
});

test('wrong OAuth account stops before inbox reads',()=>{
  assert.doesNotThrow(()=>assertTestGmailAccount({emailAddress:'SarberkiProjectTest@gmail.com'}));
  for(const profile of [{emailAddress:'other@example.invalid'},{},null])
    assert.throws(()=>assertTestGmailAccount(profile),/tesztfiók/u);
});

test('inbox predicate accepts any sender and any subject',()=>{
  assert.equal(isTestInquiry(message()),true);
  assert.equal(isTestInquiry(message('istvan.kovacs.k.i@gmail.com','Foglalás')),true);
  assert.equal(isTestInquiry(message('guest@example.com','Bármi lehet a tárgy')),true);
  assert.equal(isTestInquiry(message('another@example.com','')),true);
});

test('local filter still rejects old dates, non-inbox mail and invalid timestamps',()=>{
  for(const m of [
    message(undefined,undefined,'2026-09-24T12:00:00Z'),
    message(undefined,undefined,undefined,['SENT']),
    {...message(),internalDate:'invalid'}
  ]) assert.equal(isTestInquiry(m),false);
});

test('OAuth callback verifies the designated account before requesting any messages',async()=>{
  const fs=await import('node:fs/promises'), vm=await import('node:vm');
  const core=await import('./sarberki-core.mjs'), business=await import('./business-config.mjs'), fishing=await import('./fishing-rules.mjs'), policy=await import('./gmail-policy.mjs');
  const source=(await fs.readFile(new URL('./gmail-readonly.js',import.meta.url),'utf8')).replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>`modules[${JSON.stringify(name.split('?')[0])}]`);
  for(const emailAddress of ['wrong@example.invalid','sarberkiprojecttest@gmail.com']) {
    let callback; const calls=[],status={textContent:''},button={disabled:false,addEventListener(_type,fn){this.click=fn}};
    const oauth={initTokenClient(options){callback=options.callback;assert.equal(options.scope,'https://www.googleapis.com/auth/gmail.readonly');assert.equal(options.hint,'sarberkiprojecttest@gmail.com');return {requestAccessToken(){}}}};
    const context=vm.createContext({
      modules:{'sarberki-core.mjs':core,'business-config.mjs':business,'fishing-rules.mjs':fishing,'gmail-policy.mjs':policy},
      document:{getElementById:id=>id==='read_gmail'?button:status,querySelector:()=>({content:'test-client'})},
      window:{google:{accounts:{oauth2:oauth}}},
      google:{accounts:{oauth2:oauth}},
      fetch:async url=>{calls.push(String(url));return {ok:true,json:async()=>String(url).endsWith('/profile')?{emailAddress}:{messages:[]}}},
      console,URL,Date,Number,TextDecoder,Uint8Array
    });
    await vm.runInContext(source,context);
    button.click();
    await callback({access_token:'fake-unit-test-token'});
    assert.equal(calls.length,emailAddress.startsWith('wrong')?1:2);
    assert.match(calls[0],/\/profile$/u);
    if(calls.length===2)assert.equal(new URL(calls[1]).searchParams.get('q'),INBOX_QUERY);
    else assert.match(status.textContent,/tesztfiók/u);
    assert.equal(button.disabled,false);
  }
});
