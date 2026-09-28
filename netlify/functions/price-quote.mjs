import {fetchQuote,validateQuote} from '../../price-quote.mjs';

export default async (request) => {
  if (request.method !== 'POST') return Response.json({error:'POST szükséges.'},{status:405});
  try {
    if (Number(request.headers.get('content-length')||0)>8192) throw Error('Túl nagy kérés.');
    const raw=await request.text();
    if (raw.length>8192) throw Error('Túl nagy kérés.');
    const input=validateQuote(JSON.parse(raw));
    const result=await fetchQuote(input);
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  } catch(error) {
    return Response.json({status:'unverified',error:error.message},{status:422,headers:{'cache-control':'no-store'}});
  }
};
