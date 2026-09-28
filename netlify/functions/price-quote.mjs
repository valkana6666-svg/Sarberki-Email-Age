import {fetchQuote,validateQuote} from '../../price-quote.mjs';
import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';

export default async (request) => {
  if (request.method !== 'POST') return Response.json({error:'POST szükséges.'},{status:405});
  try {
    if (Number(request.headers.get('content-length')||0)>8192) throw Error('Túl nagy kérés.');
    const raw=await request.text();
    if (raw.length>8192) throw Error('Túl nagy kérés.');
    const input=validateQuote(JSON.parse(raw));
    // The public booking page currently serves an interactive challenge to this serverless browser.
    // Do not retry or infer a price until an authorized read-only integration is available.
    if (input) return Response.json({status:'unverified',error:'A foglalási oldal szerveroldali ellenőrzést kér. Élő ár jelenleg nem igazolható; kézi ellenőrzés szükséges.'},{status:503,headers:{'cache-control':'no-store'}});
    const result=await fetchQuote(input, async () => playwright.launch({
      args:chromium.args,
      executablePath:await chromium.executablePath(),
      headless:true
    }));
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  } catch(error) {
    return Response.json({status:'unverified',error:error.message},{status:422,headers:{'cache-control':'no-store'}});
  }
};
