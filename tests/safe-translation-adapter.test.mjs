import test from 'node:test';import assert from 'node:assert/strict';
import {createSafeTranslator,checkTranslation,TRANSLATION_DISABLED} from '../safe-translation-adapter.mjs';
test('translation is disabled by default and cannot contact an injected transport',async()=>{
 let calls=0;const translate=createSafeTranslator({transport:async()=>{calls++;return {verified:true,text:'Hello'};}});
 await assert.rejects(translate({text:'Hello',sourceLanguage:'en',targetLanguage:'hu',purpose:'incoming'}),e=>e.message===TRANSLATION_DISABLED);
 assert.equal(calls,0);
});
test('synthetic transport may return validated text with unchanged numbers',async()=>{
 const translate=createSafeTranslator({enabled:true,transport:async()=>({verified:true,text:'120 000 Ft, 4 fő'})});
 assert.equal(await translate({text:'120 000 Ft, 4 fő',sourceLanguage:'hu',targetLanguage:'de',purpose:'edited_reply'}),'120 000 Ft, 4 fő');
});
test('rejects changed amounts, unsupported language, unverified response and too long requests',async()=>{
 assert.throws(()=>checkTranslation({source:'120 000 Ft',translated:'130 000 Ft',sourceLanguage:'hu',targetLanguage:'en'}),/PROTECTED_VALUES_DIFFER/);
 const fake=createSafeTranslator({enabled:true,transport:async()=>({verified:false,text:'hello'})});
 await assert.rejects(fake({text:'Hello',sourceLanguage:'en',targetLanguage:'hu',purpose:'incoming'}),/UNVERIFIED_TRANSLATION/);
 await assert.rejects(fake({text:'Hello',sourceLanguage:'ru',targetLanguage:'hu',purpose:'incoming'}),/INVALID_INPUT/);
 await assert.rejects(fake({text:'x'.repeat(10001),sourceLanguage:'de',targetLanguage:'hu',purpose:'reply'}),/INVALID_INPUT/);
});
