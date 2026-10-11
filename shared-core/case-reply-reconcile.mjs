import {sameBookingConversation} from './case-thread-identity.mjs';
import {combineCaseFacts} from './case-facts-merge.mjs';
// The caller supplies extracted facts from the current message only.
// Never treat quoted historical text as a new guest correction.
export function reconcileIncomingReply({conversation={},incoming={},previousFacts={},incomingFacts={}}={}){
 const identity=sameBookingConversation(conversation,incoming);
 const merged=combineCaseFacts(previousFacts,incomingFacts,identity.matched);
 return {...merged,identity,requiresHumanReview:!identity.matched||merged.conflicts.length>0};
}
