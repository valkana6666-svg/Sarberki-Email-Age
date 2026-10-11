// Existing server-generated UUIDs and named synthetic fixtures share this UI.
// Syntax is not authorization: tenant, stored draft and membership are rechecked.
export const isIsolatedReviewCaseId=value=>typeof value==='string'&&(
 /^case-[A-Za-z0-9_-]{1,120}$/.test(value)||
 /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
);
