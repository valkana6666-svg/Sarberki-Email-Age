import {requestPrevioReadOnly} from '../price-source/sarberki-public-booking.mjs';

const ROOT='https://booking.previo.cz';
const HOTEL_ID='753011';
const arrival='2026-10-16';
const departure='2026-10-18';
const safe=(url,options)=>requestPrevioReadOnly(url,options,fetch);
const initial=await safe(`${ROOT}/?hotId=${HOTEL_ID}&currency=HUF&lang=hu&redirectType=iframe`,{signal:AbortSignal.timeout(45000)});
if(!initial.ok) throw Error('Initial Previo GET failed: '+initial.status);
const first=await initial.text();
const form=first.match(/<form[^>]*id="firstStep"[^>]*>/)?.[0];
const action=form?.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g,'&');
if(!action) throw Error('firstStep action not found');
const step=await safe(action,{
  method:'POST',
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({step:'1',arrival,departure}),
  signal:AbortSignal.timeout(45000)
});
if(!step.ok) throw Error('Date search failed: '+step.status);
const html=await step.text();
const match=html.match(/var PageParams = (\{.*?\})\s*\/\/-->/s);
if(!match) throw Error('PageParams not found');
const params=JSON.parse(match[1]);
const primitives=obj=>Object.fromEntries(Object.entries(obj||{}).filter(([,v])=>v===null||['string','number','boolean'].includes(typeof v)));
const kinds=(params.OBJECT_KINDS||[]).map(k=>({keys:Object.keys(k).sort(),values:primitives(k)}));
console.log('PREVIO MAPPING OBJECT_KINDS',JSON.stringify(kinds));

const stepUrl=new URL(step.url);
const session=stepUrl.searchParams.get('PHPSESSID')||new URL(action).searchParams.get('PHPSESSID')||'';
for(const kind of params.OBJECT_KINDS||[]){
  const obkId=String(kind.obkId);
  const u=new URL('/index/get-object-kind-occupancy/',ROOT);
  for(const key of ['hotId','currency','lang','theme','redirectType','PHPSESSID']){
    const val=stepUrl.searchParams.get(key);
    if(val) u.searchParams.set(key,val);
  }
  if(!u.searchParams.has('hotId')) u.searchParams.set('hotId',HOTEL_ID);
  const body=new URLSearchParams({hotId:HOTEL_ID,currency:'HUF',lang:'hu',obkId,PHPSESSID:session,newDesign:'1'});
  const res=await safe(u.href,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-requested-with':'XMLHttpRequest'},body,signal:AbortSignal.timeout(45000)});
  if(!res.ok){console.log('PREVIO MAPPING OCCUPANCY ERROR',JSON.stringify({obkId,status:res.status}));continue;}
  const data=await res.json();
  const occ=String(data.html||'');
  const free=occ.match(/data-numOfFreeRooms="(\d+)"/)?.[1]??null;
  const attrs=[];
  for(const m of occ.matchAll(/\b(id|name|value|data-[\w-]+)="([^"]*)"/g)){
    const key=m[1], value=m[2];
    if(/session|phpsessid/i.test(key)||/PHPSESSID/i.test(value)) continue;
    const pair=key+'='+value;
    if(!attrs.includes(pair)) attrs.push(pair);
  }
  const text=occ.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
  console.log('PREVIO MAPPING OCCUPANCY',JSON.stringify({
    obkId,
    hotelLangName:kind.hotelLangName,
    free,
    attrs:attrs.slice(0,120),
    text:text.slice(0,1200)
  }));
}
console.log('PREVIO MAPPING DISCOVERY PASS');
