import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler as baseHandler,config} from '../netlify/functions/pushover-gmail.mjs';

function createHandler(options){let claimed=false;return baseHandler({...options,ledger:{async claimOnce(){if(claimed)return{status:'duplicate'};claimed=true;return{status:'claimed',claimId:'synthetic-claim'};},async markSent(){return true;},async markUnknown(){return true;}}});}
const origin='https://leafy-chimera-2403e5.netlify.app';
const site={site:{name:'leafy-chimera-2403e5'}};
const env={PUSHOVER_ENABLED:'true',PUSHOVER_USER_KEY:'u'.repeat(30),PUSHOVER_API_TOKEN:'a'.repeat(30)};
const messageId='19abcdef12345';
const request=(overrides={})=>new Request(origin+'/api/pushover-gmail',{
  method:'POST',
  headers:{
    origin,
    'content-type':'application/json',
    authorization:'Bearer test-google-token',
    ...(overrides.headers||{})
  },
  body:JSON.stringify(overrides.body||{event:'gmail-new-message',messageId})
});

function mockFetch({account='sarberkiprojecttest@gmail.com',inbox=true,pushoverStatus=1}={}) {
  return async (url,options={})=>{
    if (url.endsWith('/profile')) return Response.json({emailAddress:account});
    if (url.includes('/messages/')) return Response.json({
      id:messageId,
      internalDate:String(Date.parse('2026-10-05T16:30:00Z')),
      labelIds:inbox?['INBOX']:['SENT'],
      payload:{headers:[
        {name:'From',value:'Any Sender <anyone@example.com>'},
        {name:'Subject',value:'Bármilyen tárgy'}
      ]}
    });
    if (url==='https://api.pushover.net/1/messages.json') {
      assert.equal(options.body.get('title'),'Sárberki · új levél');
      assert.equal(options.body.get('url'),origin+'/');
      assert.equal(options.body.get('url_title'),'Sarberki tesztoldal megnyitasa');
      assert.match(options.body.get('message'),/Any Sender/u);
      assert.match(options.body.get('message'),/Bármilyen tárgy/u);
      return Response.json({status:pushoverStatus,request:'push-request'},{status:pushoverStatus===1?200:400});
    }
    throw Error('unexpected URL '+url);
  };
}

test('any verified inbox message from the test Gmail account can trigger Pushover',async()=>{
  const response=await createHandler({env,send:mockFetch()})(request(),site);
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
});

test('sender and subject are not allowlisted; Gmail itself is the source of notification text',async()=>{
  const response=await createHandler({env,send:mockFetch()})(request({
    body:{event:'gmail-new-message',messageId}
  }),site);
  assert.equal(response.status,200);
});

test('wrong Gmail account, non-inbox mail and unauthenticated calls cannot notify',async()=>{
  assert.equal((await createHandler({env,send:mockFetch({account:'other@example.com'})})(request(),site)).status,403);
  assert.equal((await createHandler({env,send:mockFetch({inbox:false})})(request(),site)).status,409);
  assert.equal((await createHandler({env,send:mockFetch()})(request({headers:{authorization:''}}),site)).status,401);
});

test('arbitrary notification text cannot be injected and production origin is blocked',async()=>{
  const invalid=request({body:{event:'gmail-new-message',messageId,message:'fake text'}});
  assert.equal((await createHandler({env,send:mockFetch()})(invalid,site)).status,400);
  const prod=new Request('https://moonlit-torrone-88b39d.netlify.app/api/pushover-gmail',{
    method:'POST',headers:{origin:'https://moonlit-torrone-88b39d.netlify.app','content-type':'application/json',authorization:'Bearer x'},
    body:JSON.stringify({event:'gmail-new-message',messageId})
  });
  assert.equal((await createHandler({env,send:mockFetch()})(prod,site)).status,403);
});

test('Pushover credentials stay server-side and provider rejection is reported',async()=>{
  const response=await createHandler({env,send:mockFetch({pushoverStatus:0})})(request(),site);
  assert.equal(response.status,502);
  const body=await response.text();
  assert.ok(!body.includes(env.PUSHOVER_API_TOKEN));
  assert.ok(!body.includes(env.PUSHOVER_USER_KEY));
  assert.deepEqual(config.rateLimit,{windowLimit:60,windowSize:60,aggregateBy:'domain',action:'rate_limit'});
});

test('endpoint shares atomic ledger across parallel requests and restart',async()=>{
 let claimed=false,sends=0;
 const ledger={async claimOnce(){if(claimed)return{status:'duplicate'};claimed=true;return{status:'claimed',claimId:'synthetic-claim'};},async markSent(){return true;},async markUnknown(){return true;}};
 const send=async(...args)=>{if(args[0].includes('api.pushover.net'))sends++;return mockFetch()(...args);};
 const a=baseHandler({env,ledger,send}),b=baseHandler({env,ledger,send});
 const responses=await Promise.all([a(request(),site),b(request(),site)]);
 assert.ok(responses.every(r=>r.status===200));assert.equal(sends,1);
 await baseHandler({env,ledger,send})(request(),site);assert.equal(sends,1);
});
test('disabled or missing ledger never makes external requests',async()=>{
 const send=()=>assert.fail('external request forbidden');
 assert.equal((await baseHandler({env:{},send})(request(),site)).status,503);
 assert.equal((await baseHandler({env,send})(request(),site)).status,503);
});
