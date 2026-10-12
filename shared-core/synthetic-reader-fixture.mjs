import {isIsolatedReviewCaseId} from './isolated-review-case-id.mjs';

// One deterministic, fully fictional mailbox item for the existing authenticated
// Writer -> server ingest-and-draft API. Importing this file NEVER writes data.
// This is not an authorization adapter and does not handle credentials.
const tenantId='sarberki-test';
const template=Object.freeze({
 sender:'guest@reader-fixture.invalid',
 text:'Please book one Deluxe cabin from 2026-10-23 to 2026-10-25 for 2 adults and no children.',
 mailbox_id:'sarberki_reader_fixture',
 message_id:'reader-preview-20261012-v1',
 thread_id:'reader-preview-synthetic-thread-v1',
 received_at:'2026-10-12T10:00:00Z'
});

export function syntheticReaderFixtureRequest(){
 return {
  tenantId,
  action:'ingest-and-draft',
  envelope:{...template},
  expectedRevision:0
 };
}

// Requires actual Supabase Writer authority in the case client or protected server route.
// It must never be called with the Reader's read-only cookie session.
// The response deliberately contains metadata only: no guest text or credentials.
export async function ensureSyntheticReaderFixture(writerClient){
 if(typeof writerClient?.ingestAndDraft!=='function')throw Error('WRITER_SESSION_REQUIRED');
 const response=await writerClient.ingestAndDraft(syntheticReaderFixtureRequest());
 const record=response?.record,caseId=record?.caseId,data=record?.data;
 const latestDraft=Array.isArray(data?.drafts)?data.drafts.at(-1):null;
 if(!['new','duplicate'].includes(response?.resolution?.status)||
    record?.tenantId!==tenantId||!isIsolatedReviewCaseId(caseId)||
    !Number.isSafeInteger(record.revision)||record.revision<1||
    data?.id!==caseId||data?.tenantId!==tenantId||
    data?.sender?.toLowerCase()!==template.sender||
    data?.state?.approval!=='pending'||data?.serverApproval!=null||
    data?.state?.quote!=null||
    data?.state?.availability!=null||!Array.isArray(data.messages)||
    !data.messages.some(m=>m.mailbox_id===template.mailbox_id&&m.message_id===template.message_id&&
      m.text===template.text)||
    !latestDraft||latestDraft.synthetic!==true||
    typeof latestDraft.text!=='string'||!latestDraft.text.trim()||
    latestDraft.revision!==data.state.revision||
    latestDraft.basedOnMessageCount!==data.messages.length)
  throw Error('SYNTHETIC_FIXTURE_UNVERIFIED');
 return Object.freeze({tenantId,caseId,revision:record.revision,
  duplicate:response.resolution?.status==='duplicate',readyForReaderPreview:true});
}
