import {buildReplyDraft} from './sarberki-core.mjs';
import {SARBERKI_TENANT} from './tenant-config.mjs';
import {createReplyContext,renderReplyContext} from './shared-core/reply-context.mjs';
export function buildCentralReply(input,{tenant=SARBERKI_TENANT,records=[]}={}){
 return renderReplyContext(createReplyContext(tenant,input,records),buildReplyDraft);
}
