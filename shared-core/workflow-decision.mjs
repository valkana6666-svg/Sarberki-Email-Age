// Generic workflow routing for normalized accommodation inquiries.
// It converts validation results into a stable next-action signal without
// knowing the business, PMS, pricing engine or communication channel.

export const INQUIRY_NEXT_ACTIONS=Object.freeze({
  COLLECT_MISSING_DATA:'collect_missing_data',
  HUMAN_REVIEW:'human_review',
  READY_FOR_PRICING:'ready_for_pricing'
});

export function decideInquiryNextAction(assessment={}){
  const missing=Array.isArray(assessment.missing)?assessment.missing:[];
  const contradictions=Array.isArray(assessment.contradictions)?assessment.contradictions:[];

  if(missing.length){
    return Object.freeze({
      action:INQUIRY_NEXT_ACTIONS.COLLECT_MISSING_DATA,
      reasons:Object.freeze([...missing])
    });
  }

  if(Boolean(assessment.human_review_required)||contradictions.length){
    return Object.freeze({
      action:INQUIRY_NEXT_ACTIONS.HUMAN_REVIEW,
      reasons:Object.freeze(contradictions.map(x=>x?.code||'review_required'))
    });
  }

  return Object.freeze({
    action:INQUIRY_NEXT_ACTIONS.READY_FOR_PRICING,
    reasons:Object.freeze([])
  });
}
