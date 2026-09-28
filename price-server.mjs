import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {validateQuote} from './price-quote.mjs';
import {fetchPublicBookingQuote} from './price-source/sarberki-public-booking.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PRICE_PORT || 8765);
const files = {'/':'index.html','/index.html':'index.html','/gmail-readonly.js':'gmail-readonly.js','/gmail-normalize.mjs':'gmail-normalize.mjs','/price-check.js':'price-check.js','/fishing-rules.mjs':'fishing-rules.mjs'};
http.createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  if (req.method === 'GET' && files[path]) {
    const data = await readFile(join(root,files[path]));
    res.writeHead(200,{'content-type':/\.m?js$/u.test(path)?'text/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store'});res.end(data);return;
  }
  if (req.method !== 'POST' || path !== '/api/price-quote') {res.writeHead(404);res.end();return;}
  try {
    const chunks=[];let size=0;
    for await (const chunk of req) {size+=chunk.length;if(size>8192)throw Error('Túl nagy kérés.');chunks.push(chunk);}
    const input=validateQuote(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if(process.env.SARBERKI_PREVIO_NO_HOLD_CONFIRMED!=='true') throw Error('HITELES ÁRLEKÉRÉS SZÜKSÉGES · A Previo dátumkeresésének foglalásmentessége nincs igazolva.');
    const result=await fetchPublicBookingQuote(input);
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(result));
  } catch(error) {
    res.writeHead(422,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({status:'unverified',error:error.message}));
  }
}).listen(port,'127.0.0.1',()=>console.log(`Árlekérő tesztszerver: http://127.0.0.1:${port}`));
