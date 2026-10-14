import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
import * as fishing from '../fishing-rules.mjs';
import * as policy from '../gmail-policy.mjs';
import * as splitUnits from '../split-units.mjs';
import {syntheticMailLanguages,syntheticMailMime,syntheticMailEnvelope,closedMailRequestFromGmailRecord,matchesClosedSyntheticMailRecord} from '../shared-core/synthetic-mail-fixtures.mjs';
test('four exact fictional MIME payloads pass actual Gmail transform and match only their server registry envelope',async()=>{
 const source=(await readFile(new URL('../gmail-readonly.js',import.meta.url),'utf8')).replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>'modules['+JSON.stringify(name.split('?')[0])+']');
 const window={},element={disabled:false,textContent:'',addEventListener(){},insertAdjacentElement(){}};
 const context=vm.createContext({modules:{'sarberki-core.mjs':core,'business-config.mjs':{BUSINESS},'fishing-rules.mjs':fishing,'gmail-policy.mjs':policy,'split-units.mjs':splitUnits},window,document:{getElementById:()=>element,querySelector:()=>({content:'synthetic-client'})},console,URL,Date,Number,Intl,TextDecoder,Uint8Array,atob});
 await vm.runInContext(source,context);
 for(const language of syntheticMailLanguages){
  const parsed=window.sarberkiGmailTransform(syntheticMailMime(language)),input=closedMailRequestFromGmailRecord(parsed);
  assert.equal(parsed.normalized.language,language);assert.deepEqual(input.envelope,syntheticMailEnvelope(language));
  assert.equal(input.expectedRevision,0);assert.equal(input.values,undefined);
  const record={tenantId:'sarberki-test',data:{tenantId:'sarberki-test',sender:input.envelope.sender,messages:[input.envelope]}};
  assert.equal(matchesClosedSyntheticMailRecord(record),true);
  assert.throws(()=>closedMailRequestFromGmailRecord({...parsed,original_message:parsed.original_message+' changed'}),/FORBIDDEN/);
  assert.throws(()=>closedMailRequestFromGmailRecord({...parsed,source:{...parsed.source,from_email:'unlisted@synthetic.invalid'}}),/FORBIDDEN/);
  assert.equal(matchesClosedSyntheticMailRecord({...record,data:{...record.data,messages:[input.envelope,input.envelope]}}),false);
 }
 assert.throws(()=>syntheticMailMime('other'),/INVALID_INPUT/);
});
