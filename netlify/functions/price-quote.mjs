import {validateQuote} from '../../price-quote.mjs';
import {fetchPublicBookingQuote} from '../../price-source/sarberki-public-booking.mjs';

const LIVE_TEST_HOSTS=new Set([
  'leafy-chimera-2403e5.netlify.app',
  'localhost',
  '127.0.0.1'
]);

export function isLivePrevioEnabled(request,env=process.env) {
  try {
    return LIVE_TEST_HOSTS.has(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

export async function handlePriceQuote(request,source=fetchPublicBookingQuote,enabled=false) {
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
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  } catch(error) {
    return Response.json({status:'unverified',error:'HITELES ÁRLEKÉRÉS SZÜKSÉGES · '+error.message},{status:503,headers:{'cache-control':'no-store'}});
  }
}

export default (request) => handlePriceQuote(
  request,
  fetchPublicBookingQuote,
  isLivePrevioEnabled(request,process.env)
);
