import {fetchMnbEurRate} from './price-quote.mjs';

// Isolated currency helper: never reads or calls Previo, never accepts guest data.
// Even the manual-review helper is reachable only on the Sárberki test hostname.
const TEST_HOST='leafy-chimera-2403e5.netlify.app';

export async function handleManualFx(request,rateSource=fetchMnbEurRate){
  if(request.method!=='GET')return Response.json({status:'disabled',error:'GET szükséges.'},{status:405,headers:{'cache-control':'no-store'}});
  try{
    if(new URL(request.url).hostname!==TEST_HOST)return Response.json({status:'disabled',error:'Csak a tesztoldalon érhető el.'},{status:403,headers:{'cache-control':'no-store'}});
    const fx=await rateSource();
    if(!Number.isFinite(fx?.rate)||fx.rate<=0||!/^20\d{2}-\d{2}-\d{2}$/.test(fx.date)||fx.source!=='Magyar Nemzeti Bank')throw Error('Nem hitelesített MNB árfolyam.');
    return Response.json({status:'available',rateHufPerEur:fx.rate,rateDate:fx.date,source:fx.source},{headers:{'cache-control':'no-store'}});
  }catch{
    return Response.json({status:'unavailable',error:'Az MNB euróárfolyam most nem érhető el. Csak az ellenőrzött forintár használható.'},{status:503,headers:{'cache-control':'no-store'}});
  }
}
export default request=>handleManualFx(request);
