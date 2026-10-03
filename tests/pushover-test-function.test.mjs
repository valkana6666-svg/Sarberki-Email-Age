import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler, TEST_MESSAGE, config} from '../netlify/functions/pushover-test.mjs';

const origin = 'https://leafy-chimera-2403e5.netlify.app';
const site = {site: {name: 'leafy-chimera-2403e5'}};
const env = {PUSHOVER_USER_KEY: 'u'.repeat(30), PUSHOVER_API_TOKEN: 'a'.repeat(30)};
const request = (url = origin, body = {event: 'connection-test'}) => new Request(url + '/api/pushover-test', {
  method: 'POST', headers: {origin, 'content-type': 'application/json'}, body: JSON.stringify(body)
});

test('fixed notification sent only server-side; success exposes no credentials', async () => {
  let calls = 0;
  const handler = createHandler({env, send: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.pushover.net/1/messages.json');
    assert.equal(options.body.get('message'), TEST_MESSAGE);
    assert.equal(options.body.get('token'), env.PUSHOVER_API_TOKEN);
    assert.equal(options.body.get('user'), env.PUSHOVER_USER_KEY);
    return Response.json({status: 1, request: 'test-request-id'});
  }});
  const response = await handler(request(), site);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.equal(JSON.parse(body).providerStatus, 1);
  assert.ok(!body.includes(env.PUSHOVER_API_TOKEN));
  assert.ok(!body.includes(env.PUSHOVER_USER_KEY));
  assert.equal(calls, 1);
});

test('production, wrong site, foreign origin and custom messages never send', async () => {
  const handler = createHandler({env, send: () => {throw Error('Must not send');}});
  assert.equal((await handler(request('https://moonlit-torrone-88b39d.netlify.app'), site)).status, 403);
  assert.equal((await handler(request(), {site:{name:'moonlit-torrone-88b39d'}})).status, 403);
  const foreign = request();
  foreign.headers.set('origin', 'https://example.com');
  assert.equal((await handler(foreign, site)).status, 403);
  assert.equal((await handler(request(origin, {event:'connection-test', message:'custom'}), site)).status, 400);
});

test('missing configuration does not invoke Pushover', async () => {
  const response = await createHandler({env:{}, send:()=>{throw Error('Must not send');}})(request(), site);
  assert.equal(response.status, 503);
  assert.deepEqual((await response.json()).missing, ['PUSHOVER_API_TOKEN', 'PUSHOVER_USER_KEY']);
});

test('provider failure and timeout do not leak secrets or retry', async () => {
  for (const mode of ['rejected','timeout']) {
    let calls = 0;
    const handler = createHandler({env, send:async()=>{
      calls++;
      if(mode === 'timeout') throw Error(env.PUSHOVER_API_TOKEN);
      return Response.json({status:0,errors:[env.PUSHOVER_USER_KEY]}, {status:400});
    }});
    const response = await handler(request(), site);
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.ok(!body.includes(env.PUSHOVER_API_TOKEN));
    assert.ok(!body.includes(env.PUSHOVER_USER_KEY));
    assert.equal(calls, 1);
  }
  assert.deepEqual(config.rateLimit, {windowLimit:1, windowSize:180, aggregateBy:'domain', action:'rate_limit'});
});
