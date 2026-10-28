import {createOperatorCookieSession,OperatorSessionError} from '../../shared-core/operator-cookie-session.mjs';
import {buildAvailabilityOptions} from './availability-options.mjs';
import {fetchPublicBookingAvailability} from '../../price-source/sarberki-public-booking.mjs';
import {canPriceOption} from '../../booking-filter.mjs';
import {validateQuote} from '../../price-quote.mjs';
import {previoReadOnlyAdapter} from '../../price-source/previo-adapter.mjs';
import {fetchPublicPriceReference} from '../../price-source/public-price-fallback.mjs';

const LIVE_TEST_HOSTS=new Set([
  'leafy-chimera-2403e5.netlify.app'
]);

const MNB_URL='https://www.mnb.hu/arfolyamok.asmx';
const MNB_PAGE_URL='https://www.mnb.hu/en/arfolyamok';
const MNB_SOAP='<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetCurrentExchangeRates xmlns="http://www.mnb.hu/webservices/" /></soap:Body></soap:Envelope>';

function parseMnbSoap(xml) {
  const date=xml.match(/<Day\s+date="(\d{4}-\d{2}-\d{2})"/u)?.[1];
  const raw=xml.match(/<Rate\s+unit="1"\s+curr="EUR">([\d,.]+)<\/Rate>/u)?.[1];
  const rate=Number(String(raw||'').replace(',','.'));
  if(!date||!Number.isFinite(rate)||rate<=0) throw Error('Az MNB aktuális EUR-középárfolyama nem olvasható.');
  return {rate,date,source:'Magyar Nemzeti Bank',currency:'EUR',base:'HUF'};
}

function parseMnbHtml(html) {
  const text=String(html||'')
    .replace(/<script[\s\S]*?<\/script>/giu,' ')
    .replace(/<style[\s\S]*?<\/style>/giu,' ')
    .replace(/<[^>]+>/gu,' ')
    .replace(/&nbsp;|&#160;/giu,' ')
    .replace(/&amp;/giu,'&')
    .replace(/\s+/gu,' ')
    .trim();
  const monthNames={
    january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
    január:1,február:2,március:3,április:4,május:5,június:6,július:7,augusztus:8,szeptember:9,október:10,november:11,december:12
  };
  let date=text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/u)?.[0];
  if(!date) {
    const m=text.match(/Napi árfolyamok:\s*(\d{1,2})\s+([\p{L}]+)\s+(\d{4})/iu);
    if(m) {
      const month=monthNames[m[2].toLowerCase()];
      if(month) date=`${m[3]}-${String(month).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
    }
  }
  const raw=text.match(/\bEUR\s+(?:Euro|Euró)\s+1\s+([\d.,]+)/iu)?.[1];
  const rate=Number(String(raw||'').replace(',','.'));
  if(!date||!Number.isFinite(rate)||rate<=0) throw Error('Az MNB napi árfolyamoldaláról nem olvasható az EUR-középárfolyam.');
  return {rate,date,source:'Magyar Nemzeti Bank',currency:'EUR',base:'HUF'};
}

export async function fetchMnbEurRate(request=fetch) {
  try {
    const response=await request(MNB_URL,{
      method:'POST',
      headers:{'content-type':'text/xml; charset=utf-8','soapaction':'"http://www.mnb.hu/webservices/GetCurrentExchangeRates"'},
      body:MNB_SOAP,
      signal:AbortSignal.timeout(15000)
    });
    if(!response.ok) throw Error('MNB SOAP hiba.');
    return parseMnbSoap(await response.text());
  } catch {
    const response=await request(MNB_PAGE_URL,{
      method:'GET',
      headers:{'accept':'text/html,application/xhtml+xml'},
      signal:AbortSignal.timeout(15000)
    });
    if(!response.ok) throw Error('Az MNB árfolyam-szolgáltatása és napi árfolyamoldala sem elérhető.');
    return parseMnbHtml(await response.text());
  }
}

export function isLivePrevioEnabled(request,safetyVerified=process.env.PREVIO_READ_SAFETY_VERIFIED==='true') {
  try {
    const url=new URL(request.url);
    return safetyVerified===true&&url.protocol==='https:'&&url.port===''&&LIVE_TEST_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function handlePriceQuote(request,source=previoReadOnlyAdapter.getQuote,enabled=false,fxSource=fetchMnbEurRate,capacitySource=fetchPublicBookingAvailability) {
  if (request.method !== 'POST') return Response.json({error:'POST szükséges.'},{status:405});
  if (!enabled) return Response.json({status:'unverified',code:'PREVIO_SAFETY_GATE_CLOSED',error:'HITELES ÁRLEKÉRÉS SZÜKSÉGES · Élő Previo-lekérés csak a külön Sárberki tesztoldalon engedélyezett; a Previo dátumkeresésének foglalásmentessége más környezetben nincs igazolva.'},{status:503,headers:{'cache-control':'no-store'}});
  try {
    if (Number(request.headers.get('content-length')||0)>8192) throw Error('Túl nagy kérés.');
    const raw=await request.text();
    if (raw.length>8192) throw Error('Túl nagy kérés.');
    const input=validateQuote(JSON.parse(raw));
    const splitAB=['splitA','splitB'].includes(input.cabin),splitC=input.cabin==='splitC';
    const units=input.units||1;
    const query={arrival:input.arrival,departure:input.departure,guests:input.adults+input.children.length,adults:input.adults,cabin:input.cabin,units,fallback:false,...(splitAB||splitC?{placement:{ab:splitAB?units:0,c:splitC?units:0,adjacent:false,exactIds:[]}}:{})};
    const capacity=await buildAvailabilityOptions(query,capacitySource);
    const key=splitAB?'splitAB':input.cabin;
    if(!canPriceOption(capacity,key,units)){const unavailable=capacity.unavailable_options.find(x=>x.key===key);if(unavailable)return Response.json({...input,status:'unavailable',availability:'unavailable',availableUnits:unavailable.availableUnits,bookingCompleted:false},{headers:{'cache-control':'no-store'}});throw Error('A kért kapacitás nem igazolt; árszámítás nem történt.');}
    const result=['splitA','splitB','splitC'].includes(input.cabin) ? fetchPublicPriceReference(input) : await source(input);
    if(result.status==='unavailable') return Response.json(result,{status:200,headers:{'cache-control':'no-store'}});
    if(!['review_required','public_reference'].includes(result.status)||!Number.isSafeInteger(result.total)||result.total<=0) throw Error('Nem érkezett ellenőrzött ár.');
    if(result.status==='public_reference') return Response.json(result,{headers:{'cache-control':'no-store'}});
    let eurConversion={status:'unavailable'};
    try {
      const fx=await fxSource();
      eurConversion={
        status:'available',
        rateHufPerEur:fx.rate,
        rateDate:fx.date,
        source:fx.source,
        totalEur:Math.round((result.total/fx.rate)*100)/100
      };
    } catch(error) {
      eurConversion={status:'unavailable',error:error.message};
    }
    return Response.json({...result,eurConversion},{headers:{'cache-control':'no-store'}});
  } catch(error) {
    return Response.json({status:'unverified',error:'HITELES ÁRLEKÉRÉS SZÜKSÉGES · '+error.message},{status:503,headers:{'cache-control':'no-store'}});
  }
}

// HTTP entry point: the internal calculator above is not an authentication boundary.
// Reuse fresh Auth + DB read membership and the established encrypted-cookie/CSRF path.
export function createPriceQuoteHandler({env=process.env,fetchImpl=fetch,
  source=previoReadOnlyAdapter.getQuote,fxSource=fetchMnbEurRate,
  capacitySource=fetchPublicBookingAvailability}={}) {
  return async request=>{
    if(request.method!=='POST')return Response.json({error:'POST szükséges.'},{status:405,headers:{'cache-control':'no-store','allow':'POST'}});
    const enabled=isLivePrevioEnabled(request,env.PREVIO_READ_SAFETY_VERIFIED==='true');
    if(!enabled)return handlePriceQuote(request,source,false,fxSource,capacitySource);
    let session;
    try {
      // Read-only lookup: no Writer/Approver role and no client-supplied tenant grant.
      // Do not accept Bearer or a partner API token as an operator session.
      if(request.headers.has('authorization'))return Response.json({error:'AUTH_REQUIRED'},{status:401,headers:{'cache-control':'no-store'}});
      if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'FORBIDDEN'},{status:403,headers:{'cache-control':'no-store'}});
      session=await createOperatorCookieSession({env,fetchImpl}).protectedRead({
        httpMethod:'POST',headers:{...Object.fromEntries(request.headers),host:new URL(request.url).host}
      });
    } catch(error) {
      // Fixed local codes only; never return Auth responses, credentials or configuration.
      return Response.json({error:error instanceof OperatorSessionError?error.code:'SESSION_SERVICE_UNAVAILABLE'},
        {status:error instanceof OperatorSessionError?error.status:503,headers:{'cache-control':'no-store'}});
    }
    const response=await handlePriceQuote(request,source,true,fxSource,capacitySource);
    response.headers.set('set-cookie',session.setCookie);
    response.headers.set('cache-control','private, no-store');
    return response;
  };
}

export default createPriceQuoteHandler();
// Distributed edge protection, per IP and domain; not an account-wide billing cap.
// Applies to the function, including its direct /.netlify/functions/ URL.
export const config={rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'}};
