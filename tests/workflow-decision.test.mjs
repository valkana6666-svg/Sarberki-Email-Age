import test from 'node:test';
import assert from 'node:assert/strict';
import {decideInquiryNextAction,INQUIRY_NEXT_ACTIONS} from '../shared-core/workflow-decision.mjs';

test('missing facts route to data collection before any pricing adapter',()=>{
  const r=decideInquiryNextAction({missing:['dates','adults'],contradictions:[],human_review_required:false});
  assert.equal(r.action,INQUIRY_NEXT_ACTIONS.COLLECT_MISSING_DATA);
  assert.deepEqual(r.reasons,['dates','adults']);
});

test('contradiction routes to human review',()=>{
  const r=decideInquiryNextAction({
    missing:[],
    contradictions:[{code:'guest_total_mismatch'}],
    human_review_required:true
  });
  assert.equal(r.action,INQUIRY_NEXT_ACTIONS.HUMAN_REVIEW);
  assert.deepEqual(r.reasons,['guest_total_mismatch']);
});

test('clean assessment routes to pricing boundary',()=>{
  const r=decideInquiryNextAction({missing:[],contradictions:[],human_review_required:false,ready:true});
  assert.equal(r.action,INQUIRY_NEXT_ACTIONS.READY_FOR_PRICING);
  assert.deepEqual(r.reasons,[]);
});
