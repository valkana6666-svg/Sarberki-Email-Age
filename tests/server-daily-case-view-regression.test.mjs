import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCaseCategory,dailyCaseSummary} from '../shared-core/server-daily-case-view.mjs';

const record=({approval='pending',revision=3,stored=true,draftRevision=3,messageCount=1,basedOnMessageCount=1,synthetic=true,reviewStatus='internal_review_required'}={})=>({
 tenantId:'sarberki-test',caseId:'case-daily-category-synthetic',revision:7,
 data:{state:{approval,revision},messages:Array.from({length:messageCount},(_,i)=>({text:'Szintetikus '+i})),
  drafts:stored?[{revision:draftRevision,basedOnMessageCount,synthetic,reviewStatus,text:'Kitalált tervezet'}]:[]}
});

test('only a current explicitly reviewable synthetic draft enters approval queue',()=>{
 assert.equal(dailyCaseCategory(record()),'approval');
 assert.equal(dailyCaseCategory(record({stored:false})),'incoming');
 for(const options of [
  {draftRevision:2},{basedOnMessageCount:0},{synthetic:false},
  {reviewStatus:'manual_edit_requires_review'}, {approval:'internally_approved'}
 ])assert.notEqual(dailyCaseCategory(record(options)),'approval');
});

test('internal approval stays in progress; it is not closure or delivery',()=>{
 const approved=record({approval:'internally_approved'});
 assert.equal(dailyCaseCategory(approved),'progress');
 assert.notEqual(dailyCaseCategory(approved),'closed');
 assert.equal(dailyCaseCategory(record({approval:'rejected'})),'progress');
});

test('daily summary exposes only case identity, revision, and derived category',()=>{
 const r=record();
 const summary=dailyCaseSummary(r);
 assert.deepEqual(summary,{tenantId:r.tenantId,caseId:r.caseId,revision:r.revision,category:'approval'});
 assert.equal('data' in summary,false);
 assert.equal('text' in summary,false);
});
