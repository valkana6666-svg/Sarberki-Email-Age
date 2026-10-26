// Public, closed diagnostic vocabulary. Never include raw server text or headers.
const categories=new Set(['AUTH_REQUIRED','FORBIDDEN','SESSION_COOKIE_MISSING','SESSION_COOKIE_INVALID',
 'SESSION_EXPIRED','CSRF_REJECTED','AUTH_LOGIN_REJECTED','AUTH_REFRESH_REJECTED',
 'AUTHORITY_REJECTED','MEMBERSHIP_DENIED','SESSION_SETUP_REQUIRED','SESSION_SERVICE_UNAVAILABLE']);
export function attachOperatorRequestFailure(error,response,body){
 if(Number.isInteger(response?.status))error.status=response.status;
 if(categories.has(body?.diagnostic?.category))error.diagnosticCategory=body.diagnostic.category;
 return error;
}
export function operatorFailureSummary(error){
 const status=[400,401,403,405,409,422,503].includes(error?.status)?'HTTP '+error.status:'';
 const category=categories.has(error?.diagnosticCategory)?error.diagnosticCategory:'';
 return status||category?' ['+[status,category].filter(Boolean).join(' · ')+']':'';
}
