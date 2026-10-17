// Match the established cookie case client on GET as well as POST. Explicit JSON
// Content-Type avoids an empty GET being represented as a binary/base64 event.
import {createCookieJsonRequest} from './cookie-json-request.mjs';
export function createCloudCaseRequest({request=fetch}={}){
 request=createCookieJsonRequest({request});
 return async(metadata,input,method='POST')=>{
  const response=await request('/.netlify/functions/booking-cases'+(method==='GET'?'?'+new URLSearchParams(input):''),{
   method,credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'X-Sarberki-Operator':'1','X-CSRF-Token':metadata.csrfToken,'Content-Type':'application/json'},
   ...(method==='POST'?{body:JSON.stringify(input)}:{})
  });
  const body=await response.json();if(!response.ok)throw Error(body.error||'SERVICE_UNAVAILABLE');return body.result;
 };
}
