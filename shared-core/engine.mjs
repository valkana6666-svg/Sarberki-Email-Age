import {communicationEnvelope} from './communication.mjs';
import {assertReadOnlyPmsAdapter} from './pms-adapter.mjs';
import {createReplyContext,renderReplyContext} from './reply-context.mjs';
// Small reusable orchestration seam. Tenant rules, parser and renderer are injected.
export function createInquiryEngine({tenant,adapter,parse,render}){
 assertReadOnlyPmsAdapter(adapter);
 if(adapter.id!==tenant.adapterId||adapter.tenantId&&adapter.tenantId!==tenant.id||typeof parse!=='function'||typeof render!=='function')throw Error('Nem megfelelő vállalkozási motor.');
 return Object.freeze({
  interpret(raw){const envelope=communicationEnvelope(tenant.id,raw);return {envelope,facts:parse(envelope.text||'')};},
  availability(query,options={}){return adapter.getVerifiedAvailability(query,{...options,tenantId:tenant.id});},
  draft(input,records=[]){return renderReplyContext(createReplyContext(tenant,input,records),render);},
  send(){throw Error('Automatikus küldés tiltva; emberi jóváhagyás szükséges.');}
 });
}
