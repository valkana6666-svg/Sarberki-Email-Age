// V3-SMALLTALK client: asks the server for a fact-bound answer to a question the rule-based chatbot did not understand.
// Returns the answer text or null (switch off, error, or no approved fact) – then the existing answer stays.
export function createChatAssistProvider({request=fetch}={}){
 return async ({message,language})=>{
  try{
   const r=await request('/.netlify/functions/chat-assist',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language})});
   if(!r.ok)return null;const body=await r.json();
   return typeof body?.answer==='string'&&body.answer.trim()?body.answer.trim():null;
  }catch{return null;}
 };
}
