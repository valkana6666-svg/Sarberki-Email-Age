import {validateQuote} from '../../price-quote.mjs';

export default async (request) => {
  if (request.method !== 'POST') return Response.json({error:'POST szükséges.'},{status:405});
  try {
    if (Number(request.headers.get('content-length')||0)>8192) throw Error('Túl nagy kérés.');
    const raw=await request.text();
    if (raw.length>8192) throw Error('Túl nagy kérés.');
    validateQuote(JSON.parse(raw));
    // The public booking page currently serves an interactive challenge to serverless Chromium.
    // Keep automated quotes closed until an authorized read-only source can be verified.
    return Response.json({status:'unverified',error:'A foglalási oldal szerveroldali ellenőrzést kér. Élő ár jelenleg nem igazolható; kézi ellenőrzés szükséges.'},{status:503,headers:{'cache-control':'no-store'}});
  } catch(error) {
    return Response.json({status:'unverified',error:error.message},{status:422,headers:{'cache-control':'no-store'}});
  }
};
