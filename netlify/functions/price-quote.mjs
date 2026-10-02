import {validateQuote} from '../../price-quote.mjs';
import {fetchPublicBookingQuote} from '../../price-source/sarberki-public-booking.mjs';
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

export function isLivePrevioEnabled(request) {
  try {
    return LIVE_TEST_HOSTS.has(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

export async function handlePriceQuote(request,source=fetchPublicBookingQuote,enabled=false,fxSource=fetchMnbEurRate) {
  if (request.method !== 'POST') return Response.json({error:'POST szükséges.'},{status:405});
  if (!enabled) return Response.json({status:'unverified',error:'HITELES ÁRLEKÉRÉS SZÜKSÉGES · Élő Previo-lekérés csak a külön Sárberki tesztoldalon engedélyezett; a Previo dátumkeresésének foglalásmentessége más környezetben nincs igazolva.'},{status:503,headers:{'cache-control':'no-store'}});
  try {
    if (Number(request.headers.get('content-length')||0)>8192) throw Error('Túl nagy kérés.');
    const raw=await request.text();
    if (raw.length>8192) throw Error('Túl nagy kérés.');
    const input=validateQuote(JSON.parse(raw));
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

export default (request) => handlePriceQuote(
  request,
  fetchPublicBookingQuote,
  isLivePrevioEnabled(request)
);
