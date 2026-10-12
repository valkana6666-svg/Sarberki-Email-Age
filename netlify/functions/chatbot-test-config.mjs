// Public metadata only; no service_role, DB credentials or tokens are returned.
const project='https://mojnqizbcaczstguikpv.supabase.co';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export function isPublishableKey(key){
 if(typeof key!=='string'||key.length>4096)return false;
 if(/^sb_publishable_[A-Za-z0-9_-]{20,200}$/.test(key))return true;
 try{
  const parts=key.split('.');if(parts.length!==3||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))return false;
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());
  return claims.role==='anon'&&claims.ref==='mojnqizbcaczstguikpv';
 }catch{return false;}
}
export function createChatbotConfigHandler({env=process.env}={}){
 return async event=>{
  const reply=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
  if(event.httpMethod!=='GET')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(env.URL!=='https://leafy-chimera-2403e5.netlify.app'||env.CASE_STORE_ENABLED!=='synthetic-only'||env.CASE_STORE_TEST_TENANTS!=='sarberki-test,demo-test'||env.SUPABASE_URL!==project||!isPublishableKey(env.SUPABASE_PUBLISHABLE_KEY))return reply(503,{error:'TEST_DATA_UNAVAILABLE',syntheticOnly:true});
  return reply(200,{enabled:true,syntheticOnly:true,tenantId:'sarberki-test',supabaseUrl:project,publishableKey:env.SUPABASE_PUBLISHABLE_KEY});
 };
}
export const handler=createChatbotConfigHandler();
