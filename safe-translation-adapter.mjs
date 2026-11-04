// Safe translation boundary for the Sárberki TEST interface.
// No network requests unless an explicitly supplied, same-origin test transport is enabled.
// All secrets stay server-side. This file never accepts guest data by default.
import {protectedTokens} from './bilingual-preview.mjs';

export const TRANSLATION_DISABLED='TRANSLATION_DISABLED';
const languages=new Set(['hu','de','en','si','sl']);
// Numbers and currencies must survive translation unchanged. The Hungarian count words "fő" and "éj"
// are language, not value ("5 adults" -> "5 fő"), so they are ignored; Ft/EUR/€/% are still compared.
function sameTranslatedNumbers(a,b){
 const norm=text=>protectedTokens(text).map(token=>token.replace(/\s*(?:fő|éj)$/iu,'')).sort();
 const x=norm(a),y=norm(b);
 return x.length===y.length&&x.every((v,i)=>v===y[i]);
}
export function checkTranslation({source,translated,sourceLanguage,targetLanguage}){
 if(!languages.has(sourceLanguage)||!languages.has(targetLanguage))throw Error('UNSUPPORTED_LANGUAGE');
 if(typeof source!=='string'||typeof translated!=='string'||!source.trim()||!translated.trim())throw Error('EMPTY_TRANSLATION');
 if(source.length>10000||translated.length>15000)throw Error('TRANSLATION_LIMIT');
 // Numerical/financial details must be checked by the operator; stop when protected values are lost.
 if(!sameTranslatedNumbers(source,translated))throw Error('PROTECTED_VALUES_DIFFER');
 return translated;
}
export function createSafeTranslator({enabled=false,transport=null}={}){
 return async function translate({text,sourceLanguage,targetLanguage,purpose}={}){
  if(!enabled||typeof transport!=='function')throw Error(TRANSLATION_DISABLED);
  if(!languages.has(sourceLanguage)||!languages.has(targetLanguage)||!['incoming','reply','edited_reply'].includes(purpose))throw Error('INVALID_INPUT');
  if(typeof text!=='string'||!text.trim()||text.length>10000)throw Error('INVALID_INPUT');
  // Transport is injected and authenticated by a future server integration.
  const response=await transport({text,sourceLanguage,targetLanguage,purpose});
  if(response?.verified!==true||typeof response?.text!=='string')throw Error('UNVERIFIED_TRANSLATION');
  return checkTranslation({source:text,translated:response.text,sourceLanguage,targetLanguage});
 };
}
