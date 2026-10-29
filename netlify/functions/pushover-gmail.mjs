import {createPushoverDeliveryCoordinator} from '../../shared-core/pushover-delivery-coordinator.mjs';
import {createPushoverLedger} from './_shared/pushover-ledger.mjs';
import {createPushoverRpc} from './_shared/pushover-rpc.mjs';
import {TEST_GMAIL_ACCOUNT, isTestInquiry} from '../../gmail-policy.mjs';

const ORIGIN = 'https://leafy-chimera-2403e5.netlify.app';
const json = (body, status = 200) => Response.json(body, {
  status, headers: {'cache-control': 'no-store'}
});

function headerMap(message) {
  return Object.fromEntries((message.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
}
function clean(value='', limit=120) {
  return String(value).replace(/[\r\n]+/gu,' ').replace(/\s+/gu,' ').trim().slice(0,limit);
}

export function createHandler({env = process.env, send = fetch, ledger = null, ledgerFactory = null, gmailTimeoutMs = 10000} = {}) {
  if(!Number.isInteger(gmailTimeoutMs)||gmailTimeoutMs<1||gmailTimeoutMs>15000)throw Error('INVALID_GMAIL_TIMEOUT');
  async function gmailJson(url,headers) {
    const controller=new AbortController();let timer;
    try {
      return await Promise.race([(async()=>{
        const response=await send(url,{headers,cache:'no-store',redirect:'error',signal:controller.signal});
        return {response,data:response.ok?await response.json():null};
      })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('GMAIL_TIMEOUT'));},gmailTimeoutMs);})]);
    } finally {clearTimeout(timer);}
  }
  return async (request, context) => {
    if (new URL(request.url).origin !== ORIGIN || context?.site?.name !== 'leafy-chimera-2403e5') {
      return json({ok:false,code:'TEST_SITE_ONLY'},403);
    }
    if (request.method !== 'POST') return json({ok:false,code:'POST_REQUIRED'},405);
    if (request.headers.get('origin') !== ORIGIN) return json({ok:false,code:'ORIGIN_REJECTED'},403);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
      return json({ok:false,code:'JSON_REQUIRED'},415);
    }
    let event;
    try { event = await request.json(); } catch { return json({ok:false,code:'INVALID_EVENT'},400); }
    if (event?.event !== 'gmail-new-message'
        || typeof event?.messageId !== 'string'
        || !/^[A-Za-z0-9_-]{5,128}$/u.test(event.messageId)
        || Object.keys(event).some(key => !['event','messageId'].includes(key))) {
      return json({ok:false,code:'INVALID_EVENT'},400);
    }

    if(env.PUSHOVER_ENABLED !== 'true')return json({ok:false,code:'NOT_ENABLED'},503);
    let activeLedger=ledger;
    try { if(!activeLedger && ledgerFactory)activeLedger=ledgerFactory(); }
    catch { return json({ok:false,code:'INVALID_LEDGER_CONFIGURATION'},503); }
    if(!activeLedger)return json({ok:false,code:'LEDGER_REQUIRED'},503);
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/iu.test(auth)) return json({ok:false,code:'GMAIL_AUTH_REQUIRED'},401);
    const gmailHeaders = {authorization:auth};
    try {
      let profileResult;
      try {profileResult=await gmailJson('https://gmail.googleapis.com/gmail/v1/users/me/profile',gmailHeaders);}
      catch {return json({ok:false,code:'GMAIL_UNAVAILABLE',deliveryUnknown:false},503);}
      if (!profileResult.response.ok) return json({ok:false,code:'GMAIL_AUTH_REQUIRED'},401);
      const profile = profileResult.data;
      if (profile?.emailAddress?.trim().toLowerCase() !== TEST_GMAIL_ACCOUNT) {
        return json({ok:false,code:'WRONG_GMAIL_ACCOUNT'},403);
      }
      let messageResult;
      try {messageResult=await gmailJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(event.messageId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,gmailHeaders);}
      catch {return json({ok:false,code:'GMAIL_UNAVAILABLE',deliveryUnknown:false},503);}
      if (!messageResult.response.ok) return json({ok:false,code:'GMAIL_MESSAGE_UNAVAILABLE'},404);
      const message = messageResult.data;
      if (!isTestInquiry(message)) return json({ok:false,code:'MESSAGE_NOT_IN_INBOX'},409);

      const token = env.PUSHOVER_API_TOKEN?.trim();
      const user = env.PUSHOVER_USER_KEY?.trim();
      const missing = [!token && 'PUSHOVER_API_TOKEN', !user && 'PUSHOVER_USER_KEY'].filter(Boolean);
      if (missing.length) return json({ok:false,code:'MISSING_CONFIGURATION',missing},503);
      if (![token,user].every(value => /^[a-z0-9]{30}$/i.test(value))) {
        return json({ok:false,code:'INVALID_CONFIGURATION'},503);
      }

      const headers = headerMap(message);
      const subject = clean(headers.subject || '(nincs tárgy)');
      const from = clean(headers.from || '(ismeretlen feladó)');
      if(message.id !== event.messageId)return json({ok:false,code:'MESSAGE_ID_MISMATCH'},409);
      const coordinator=createPushoverDeliveryCoordinator({enabled:true,ledger:activeLedger,sender:async()=>{
      const result = await send('https://api.pushover.net/1/messages.json', {
        method:'POST',
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({
          token,user,
          title:'Sárberki · új levél',
          url:ORIGIN + '/',
          url_title:'Sarberki tesztoldal megnyitasa',
          message:`Új levél érkezett a Sárberki tesztfiókba.\nFeladó: ${from}\nTárgy: ${subject}`
        }),
        signal:AbortSignal.timeout(10000)
      });
      const data = await result.json();
      if (!result.ok || data.status !== 1)throw Error('PROVIDER_REJECTED');
      return {accepted:true,requestId:data.request};
      }});
      const outcome=await coordinator.process({tenantId:'sarberki-test',mailbox:TEST_GMAIL_ACCOUNT,messageId:event.messageId,notificationType:'gmail-new-message'});
      return json({ok:outcome.status==='accepted'||outcome.status==='suppressed',...outcome},outcome.status==='accepted'||outcome.status==='suppressed'?200:502);
    } catch {
      return json({ok:false,code:'PUSHOVER_UNAVAILABLE',deliveryUnknown:true},502);
    }
  };
}

// Only the protected server entry point resolves credentials. Both switches default off.
// Dedicated notification configuration must never be shared with browser/case-store clients.
export function createRuntimeHandler({env=process.env,send=fetch}={}) {
  return createHandler({env,send,ledgerFactory:()=>{
    if(env.PUSHOVER_LEDGER_ENABLED !== 'true')return null;
    return createPushoverLedger({rpc:createPushoverRpc({
      url:env.PUSHOVER_SUPABASE_URL,
      key:env.PUSHOVER_SUPABASE_SERVICE_ROLE_KEY,
      send
    })});
  }});
}
export default createRuntimeHandler();
export const config = {
  path:'/api/pushover-gmail',
  rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}
};

