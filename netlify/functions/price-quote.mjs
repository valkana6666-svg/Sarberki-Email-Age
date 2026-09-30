import {validateQuote} from '../../price-quote.mjs';
import {fetchPublicBookingQuote} from '../../price-source/sarberki-public-booking.mjs';

const LIVE_TEST_HOSTS=new Set([
  'leafy-chimera-2403e5.netlify.app'
]);

const MNB_URL='https://www.mnb.hu/arfolyamok.asmx';
const MNB_SOAP='<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetCurrentExchangeRates xmlns="http://www.mnb.hu/webservices/" /></soap:Body></soap:Envelope>';

export async function fetchMnbEurRate(request=fetch) {
  const response=await request(MNB_URL,{
    method:'POST',
    headers:{'content-type':'text/xml; charset=utf-8','soapaction':'"http://www.mnb.hu/webservices/GetCurrentExchangeRates"'},
    body:MNB_SOAP,
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok) throw Error('Az MNB árfolyam-szolgáltatása nem elérhető.');
  const xml=await response.text();
  const date=xml.match(/<Day\s+date="(\d{4}-\d{2}-\d{2})"/u)?.[1];
  const raw=xml.match(/<Rate\s+unit="1"\s+curr="EUR">([\d,.]+)<\/Rate>/u)?.[1];
  const rate=Number(String(raw||'').replace(',','.'));
  if(!date||!Number.isFinite(rate)||rate<=0) throw Error('Az MNB aktuális EUR-középárfolyama nem olvasható.');
  return {rate,date,source:'Magyar Nemzeti Bank',currency:'EUR',base:'HUF'};
}

export function isLivePrevioEnabled(request,env=process.env) {
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
    const result=await source(input);
    if(result.status==='unavailable') return Response.json(result,{status:200,headers:{'cache-control':'no-store'}});
    if(result.status!=='review_required'||!Number.isSafeInteger(result.total)||result.total<=0) throw Error('A Previo nem adott hiteles teljes árat.');
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
  isLivePrevioEnabled(request,process.env)
);
