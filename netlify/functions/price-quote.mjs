import {validateQuote} from '../../price-quote.mjs';
import {fetchPublicBookingQuote} from '../../price-source/sarberki-public-booking.mjs';

export async function handlePriceQuote(request,source=fetchPublicBookingQuote,enabled=false) {
  if (request.method !== 'POST') return Response.json({error:'POST szükséges.'},{status:405});
  if (!enabled) return Response.json({status:'unverified',error:'HITELES ÁRLEKÉRÉS SZÜKSÉGES · A Previo dátumkeresésének foglalásmentessége még nincs PMS vagy szolgáltatói oldalon igazolva.'},{status:503,headers:{'cache-control':'no-store'}});
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
// Netlify passes its context as the second argument. Keep dependency injection
// on the named testable handler, and pass only the Request from the runtime.
export default (request) => handlePriceQuote(request,fetchPublicBookingQuote,process.env.SARBERKI_PREVIO_NO_HOLD_CONFIRMED==='true');
