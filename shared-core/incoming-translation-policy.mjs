import {syntheticMailEnvelope} from './synthetic-mail-fixtures.mjs';
// Shared preflight only; the server repeats this check before any egress.
export function assertClosedTranslation(input){
 if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='purpose,sourceLanguage,targetLanguage,text'||
  input.purpose!=='incoming'||input.targetLanguage!=='hu'||!['de','en','si'].includes(input.sourceLanguage)||
  input.text!==syntheticMailEnvelope(input.sourceLanguage).text)throw Error('INVALID_INPUT');
 return input;
}
