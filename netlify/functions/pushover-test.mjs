import {deployedCommit} from '../../build-info.mjs';

const ORIGIN = 'https://leafy-chimera-2403e5.netlify.app';
export const TEST_MESSAGE = 'Sárberki teszt – Pushover kapcsolat működik.';
const json = (body, status = 200) => Response.json(body, {
  status, headers: {'cache-control': 'no-store'}
});

// The provider credentials stay in the Functions environment. This endpoint
// only sends the fixed test message to the configured owner, never arbitrary text.
export function createHandler({env = process.env, send = fetch} = {}) {
  return async (request, context) => {
    if (new URL(request.url).origin !== ORIGIN || context?.site?.name !== 'leafy-chimera-2403e5') {
      return json({ok: false, code: 'TEST_SITE_ONLY'}, 403);
    }
    if (request.method !== 'POST') return json({ok: false, code: 'POST_REQUIRED'}, 405);
    if (request.headers.get('origin') !== ORIGIN) return json({ok: false, code: 'ORIGIN_REJECTED'}, 403);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
      return json({ok: false, code: 'JSON_REQUIRED'}, 415);
    }
    const raw = await request.text();
    if (raw.length > 128) return json({ok: false, code: 'INVALID_TEST_EVENT'}, 400);
    let event;
    try { event = JSON.parse(raw); } catch { return json({ok: false, code: 'INVALID_TEST_EVENT'}, 400); }
    if (event?.event !== 'connection-test' || Object.keys(event).length !== 1) {
      return json({ok: false, code: 'INVALID_TEST_EVENT'}, 400);
    }
    const token = env.PUSHOVER_API_TOKEN?.trim();
    const user = env.PUSHOVER_USER_KEY?.trim();
    const missing = [!token && 'PUSHOVER_API_TOKEN', !user && 'PUSHOVER_USER_KEY'].filter(Boolean);
    if (missing.length) return json({ok: false, code: 'MISSING_CONFIGURATION', missing}, 503);
    if (![token, user].every(value => /^[a-z0-9]{30}$/i.test(value))) {
      return json({ok: false, code: 'INVALID_CONFIGURATION'}, 503);
    }
    try {
      const result = await send('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({token, user, title: 'Sárberki teszt', message: TEST_MESSAGE}),
        signal: AbortSignal.timeout(10000)
      });
      const data = await result.json();
      if (!result.ok || data.status !== 1) {
        // Do not forward provider error text: it can contain submitted secrets.
        return json({ok: false, code: 'PUSHOVER_REJECTED', providerStatus: data.status ?? null}, 502);
      }
      return json({ok: true, providerStatus: 1, requestId: data.request, message: TEST_MESSAGE, deployedCommit});
    } catch {
      // An ambiguous timeout must not automatically send the notification again.
      return json({ok: false, code: 'PUSHOVER_UNAVAILABLE', deliveryUnknown: true}, 502);
    }
  };
}

export default createHandler();
export const config = {
  path: '/api/pushover-test',
  rateLimit: {windowLimit: 1, windowSize: 180, aggregateBy: 'domain', action: 'rate_limit'}
};
