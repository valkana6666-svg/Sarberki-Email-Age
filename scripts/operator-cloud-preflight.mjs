// Read-only, credential-free cloud readiness probe for the isolated Sárberki test site.
// Never logs cookies, keys, response content, tokens or personal information.
const origin='https://leafy-chimera-2403e5.netlify.app';
const allowedErrors=new Set(['AUTH_REQUIRED','SESSION_SETUP_REQUIRED','SESSION_SERVICE_UNAVAILABLE',
 'CASE_STORE_DISABLED','FORBIDDEN','SERVICE_UNAVAILABLE','METHOD_NOT_ALLOWED']);
export function classifyCloudReadiness({operator,cases}){
 if(operator?.httpStatus===200||cases?.httpStatus===200)return {status:'UNSAFE_UNEXPECTED_PUBLIC_200',session:'UNKNOWN',caseStore:'UNKNOWN'};
 const session=operator?.httpStatus===401&&operator.error==='AUTH_REQUIRED'?'CONFIGURED_BUT_LOGIN_UNVERIFIED':
  operator?.httpStatus===503&&operator.error==='SESSION_SETUP_REQUIRED'?'BLOCKED_BY_SESSION_CONFIGURATION':'UNVERIFIED';
 const caseStore=cases?.httpStatus===401&&cases.error==='AUTH_REQUIRED'?'SYNTHETIC_GATE_CONFIGURED_BUT_AUTH_UNVERIFIED':
  cases?.httpStatus===503&&cases.error==='CASE_STORE_DISABLED'?'BLOCKED_BY_CASE_STORE_CONFIGURATION':'UNVERIFIED';
 return {status:'READ_ONLY_PROBE_COMPLETE',session,caseStore};
}
export async function inspectCloudReadiness({request=fetch,timeoutMs=8000}={}){
 const probe=async(path,headers)=>{
  try{
   const response=await request(origin+path,{
    method:'GET',redirect:'error',cache:'no-store',
    signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'application/json','Cache-Control':'no-store',...headers}
   });
   // Read only a small, whitelisted error code. NEVER output raw response text.
   let payload=null;
   if(response.status===401||response.status===403||response.status===503)
    try{payload=await response.json();}catch{}
   const error=allowedErrors.has(payload?.error)?payload.error:'UNVERIFIED';
   return {httpStatus:response.status,error};
  }catch{
   return {httpStatus:null,error:'UNVERIFIED'};
  }
 };
 const operator=await probe('/.netlify/functions/operator-session',{
  'X-Sarberki-Operator':'1','Sec-Fetch-Site':'same-origin',Origin:origin
 });
 const cases=await probe('/.netlify/functions/booking-cases?tenantId=sarberki-test',{});
 return {syntheticOnly:true,readOnly:true,cloudOnly:true,
  loginAttempted:false,passwordUsed:false,personalDataRead:false,
  actualIPhoneVerified:false,operator,cases,...classifyCloudReadiness({operator,cases})};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const report=await inspectCloudReadiness();
 console.log('SARBERKI OPERATOR CLOUD PREFLIGHT',JSON.stringify(report));
 if(report.status==='UNSAFE_UNEXPECTED_PUBLIC_200')process.exitCode=1;
}
