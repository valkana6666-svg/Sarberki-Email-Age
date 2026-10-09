// Explicit opt-in async client. Existing localStorage runtime remains the default.
export function createCaseStoreClient({getAccessToken,request=fetch}={}){
 if(typeof getAccessToken!=='function')throw Error('Hitelesített munkamenet szükséges.');
 const call=async(method,input)=>{
  const token=await getAccessToken();if(!token)throw Error('AUTH_REQUIRED');
  const response=await request('/.netlify/functions/booking-cases'+(method==='GET'?'?'+new URLSearchParams(input):''),{method,cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(input)}:{})});
  const body=await response.json();if(!response.ok)throw Error(body.error||'SERVICE_UNAVAILABLE');return body.result;
 };
 return {get:(tenantId,caseId)=>call('GET',{tenantId,caseId}),list:tenantId=>call('GET',{tenantId}),ingest:input=>call('POST',input),draft:(tenantId,caseId,expectedRevision)=>call('POST',{action:'draft',tenantId,caseId,expectedRevision})};
}
