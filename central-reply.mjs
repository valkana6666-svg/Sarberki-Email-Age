import {buildReplyDraft} from './sarberki-core.mjs';
import {SARBERKI_TENANT} from './tenant-config.mjs';
import {createReplyContext,renderReplyContext} from './shared-core/reply-context.mjs';
export function buildCentralReply(input,{tenant=SARBERKI_TENANT,records=[]}={}){
 return renderReplyContext(createReplyContext(tenant,input,records),buildReplyDraft);
}

// Optional service-aware preview; existing buildCentralReply callers remain unchanged.
import {classifyTubRequest,assessTubEligibility} from './shared-core/tub-request.mjs';
export function buildCentralServicePreview(input,options={}) {
 const draft=buildCentralReply(input,options);
 const request=classifyTubRequest(input?.original||'');
 if(request.kind!=='tub_request')return {draft,service:null};
 const eligibility=assessTubEligibility({unitNumber:input?.unitNumber,availability:input?.hotTubAvailability});
 return {draft,service:{...request,eligibility,requiresHumanReview:true,confirmationAllowed:false}};
}
