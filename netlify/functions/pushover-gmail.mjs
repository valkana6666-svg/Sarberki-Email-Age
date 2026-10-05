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

export function createHandler({env = process.env, send = fetch} = {}) {
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

    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/iu.test(auth)) return json({ok:false,code:'GMAIL_AUTH_REQUIRED'},401);
    const gmailHeaders = {authorization:auth};
    try {
      const profileResponse = await send('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers:gmailHeaders, cache:'no-store'
      });
      if (!profileResponse.ok) return json({ok:false,code:'GMAIL_AUTH_REQUIRED'},401);
      const profile = await profileResponse.json();
      if (profile?.emailAddress?.trim().toLowerCase() !== TEST_GMAIL_ACCOUNT) {
        return json({ok:false,code:'WRONG_GMAIL_ACCOUNT'},403);
      }

      const messageResponse = await send(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(event.messageId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        {headers:gmailHeaders, cache:'no-store'}
      );
      if (!messageResponse.ok) return json({ok:false,code:'GMAIL_MESSAGE_UNAVAILABLE'},404);
      const message = await messageResponse.json();
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
      const result = await send('https://api.pushover.net/1/messages.json', {
        method:'POST',
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({
          token,user,
          title:'Sárberki · új levél',
          message:`Új levél érkezett a Sárberki tesztfiókba.\nFeladó: ${from}\nTárgy: ${subject}`
        }),
        signal:AbortSignal.timeout(10000)
      });
      const data = await result.json();
      if (!result.ok || data.status !== 1) {
        return json({ok:false,code:'PUSHOVER_REJECTED',providerStatus:data.status ?? null},502);
      }
      return json({ok:true,providerStatus:1,requestId:data.request,messageId:message.id});
    } catch {
      return json({ok:false,code:'PUSHOVER_UNAVAILABLE',deliveryUnknown:true},502);
    }
  };
}

export default createHandler();
export const config = {
  path:'/api/pushover-gmail',
  rateLimit:{windowLimit:60,windowSize:60,aggregateBy:'domain',action:'rate_limit'}
};
