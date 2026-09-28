import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {fetchQuote,validateQuote} from './price-quote.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PRICE_PORT || 8765);
const files = {'/':'index.html','/index.html':'index.html','/gmail-readonly.js':'gmail-readonly.js','/price-check.js':'price-check.js'};
http.createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  if (req.method === 'GET' && files[path]) {
    const data = await readFile(join(root,files[path]));
    res.writeHead(200,{'content-type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store'});res.end(data);return;
  }
  if (req.method !== 'POST' || path !== '/api/price-quote') {res.writeHead(404);res.end();return;}
  try {
    const chunks=[];let size=0;
    for await (const chunk of req) {size+=chunk.length;if(size>8192)throw Error('Túl nagy kérés.');chunks.push(chunk);}
    const input=validateQuote(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    const result=await fetchQuote(input);
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(result));
  } catch(error) {
    res.writeHead(422,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({status:'unverified',error:error.message}));
  }
}).listen(port,'127.0.0.1',()=>console.log(`Árlekérő tesztszerver: http://127.0.0.1:${port}`));
