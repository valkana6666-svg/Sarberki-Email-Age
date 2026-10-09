import {validateQuote} from '../../price-quote.mjs';
import {fetchPublicPriceReference} from '../../price-source/public-price-fallback.mjs';
import {fetchMnbEurRate} from './price-quote.mjs';

const TEST_HOST='leafy-chimera-2403e5.netlify.app';
export function isPublicReferenceHost(request){
  try{return new URL(request.url).hostname===TEST_HOST;}catch{return false;}
}
export async function handlePriceReference(request,source=fetchPublicPriceReference,fxSource=fetchMnbEurRate,allowed=false){
  if(request.method!=='POST')return Response.json({error:'POST szükséges.'},{status:405});
  if(!allowed)return Response.json({status:'unverified',error:'Az árlista-alapú kalkuláció csak a Sárberki tesztoldalon engedélyezett.'},{status:403,headers:{'cache-control':'no-store'}});
  try{
    if(Number(request.headers.get('content-length')||0)>8192)throw Error('Túl nagy kérés.');
    const text=await request.text();
    if(text.length>8192)throw Error('Túl nagy kérés.');
    const input=validateQuote(JSON.parse(text));
    const quote=source(input);
    if(quote.status!=='public_reference'||quote.referenceOnly!==true||quote.availability!=='not_checked'
      ||quote.bookingCompleted!==false||quote.arrival!==input.arrival||quote.departure!==input.departure
      ||quote.cabin!==input.cabin||quote.adults!==input.adults||JSON.stringify(quote.children)!==JSON.stringify(input.children)
      ||!Number.isSafeInteger(quote.total)||quote.total<1||!Number.isSafeInteger(quote.accommodation)
      ||!Number.isSafeInteger(quote.tourismTax)||quote.accommodation+quote.tourismTax!==quote.total)
      throw Error('A publikus kalkulátor eltérő vagy hiányos referenciaárat adott.');
    let eurConversion={status:'unavailable'};
    try{
      const rate=await fxSource();
      if(!Number.isFinite(rate.rate)||rate.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(rate.date||''))throw Error('Érvénytelen EUR árfolyam.');
      eurConversion={status:'available',rateHufPerEur:rate.rate,rateDate:rate.date,source:rate.source,totalEur:Math.round(quote.total/rate.rate*100)/100};
    }catch{eurConversion={status:'unavailable'};}
    return Response.json({...quote,eurConversion},{headers:{'cache-control':'no-store'}});
  }catch(error){
    return Response.json({status:'unverified',error:'TÁJÉKOZTATÓ ÁR NEM SZÁMÍTHATÓ · '+error.message},{status:422,headers:{'cache-control':'no-store'}});
  }
}
export default request=>handlePriceReference(request,fetchPublicPriceReference,fetchMnbEurRate,isPublicReferenceHost(request));
