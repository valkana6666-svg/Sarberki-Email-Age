import {validateQuote} from '../price-quote.mjs';

const ROOT='https://booking.previo.cz';
const HOTEL_ID='753011';
const NAMES={deluxe:'DELUXE faház',family:'Családi faház',vip:'VIP apartman',small:'Különálló 2 fős faház'};
const GET_PATHS=new Set(['/','/index/step-1/','/index/step-2/']);
const POST_PATHS=new Set(['/','/index/get-object-kind-occupancy/','/index/get-occupancy-price/']);

async function readOnlyRequest(request,url,options={}) {
  for(let redirects=0;redirects<3;redirects++) {
    const target=new URL(url), method=options.method||'GET';
    if(target.origin!==ROOT||!(method==='GET'?GET_PATHS:method==='POST'?POST_PATHS:new Set()).has(target.pathname)||target.searchParams.get('hotId')!==HOTEL_ID) throw Error('Nem engedélyezett Previo kérés vagy átirányítás.');
    if(method==='POST'&&target.pathname==='/') {
      const body=new URLSearchParams(options.body);
      if([...body.keys()].sort().join(',')!=='arrival,departure,step'||body.get('step')!=='1') throw Error('A dátumkeresés űrlapja megváltozott.');
    }
    const response=await request(target.href,{...options,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status)) return response;
    if(method!=='POST'||target.pathname!=='/'||![302,303].includes(response.status)) throw Error('Nem engedélyezett Previo átirányítás.');
    const location=response.headers?.get('location');
    if(!location) throw Error('A Previo átirányítás célja hiányzik.');
    url=new URL(location,target).href;
    if(new URL(url).pathname!=='/index/step-2/') throw Error('A Previo nem a keresési eredményre irányított át.');
    options={method:'GET',signal:options.signal};
  }
  throw Error('Túl sok Previo átirányítás.');
}

function sessionUrl(path, pageUrl) {
  const u=new URL(path,ROOT), p=new URL(pageUrl);
  for(const name of ['hotId','currency','lang','theme','redirectType','PHPSESSID']) if(p.searchParams.has(name)) u.searchParams.set(name,p.searchParams.get(name));
  if(!u.searchParams.has('hotId')) u.searchParams.set('hotId',HOTEL_ID);
  return u.href;
}
function pageParams(html){
  const match=html.match(/var PageParams = (\{.*?\})\s*\/\/-->/s);
  if(!match) throw Error('A Previo oldal adatmodellje nem olvasható.');
  const params=JSON.parse(match[1]);
  if(String(params.HOT_ID)!==HOTEL_ID || params.CUR_CODE!=='HUF') throw Error('Eltérő szálláshely vagy pénznem.');
  return params;
}
function categoryFor(age,categories){
  const matches=categories.filter(x=>x.isChild && age>=x.ageFrom && age<=x.ageTo);
  if(matches.length!==1) throw Error('A gyermek életkora nem rendelhető egyértelmű Previo-kategóriához.');
  return matches[0];
}
async function checkedResponse(response){
  if(!response.ok) throw Error(`A Previo nem elérhető (${response.status}).`);
  return response;
}
async function post(request,url,data,ajax=true){
  const headers={'content-type':'application/x-www-form-urlencoded'};
  if(ajax) headers['x-requested-with']='XMLHttpRequest';
  const response=await checkedResponse(await request(url,{method:'POST',headers,body:new URLSearchParams(data),signal:AbortSignal.timeout(45000)}));
  return response;
}

// Only read-only quote endpoints. No reservation submission or customer data.
export async function fetchPublicBookingQuote(raw,request=fetch){
  const input=validateQuote(raw);
  const safe=(url,options)=>readOnlyRequest(request,url,options);
  if(!NAMES[input.cabin]) throw Error('Ehhez a háztípushoz nincs ellenőrzött Previo megfeleltetés.');
  const initial=await checkedResponse(await safe(`${ROOT}/?hotId=${HOTEL_ID}&currency=HUF&lang=hu&redirectType=iframe`,{signal:AbortSignal.timeout(45000)}));
  const first=await initial.text();
  const form=first.match(/<form[^>]*id="firstStep"[^>]*>/)?.[0];
  const action=form?.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g,'&');
  if(!action || new URL(action).origin!==ROOT||new URL(action).pathname!=='/'||new URL(action).searchParams.get('hotId')!==HOTEL_ID) throw Error('A Previo dátuműrlapja megváltozott.');
  const step=await post(safe,action,{step:'1',arrival:input.arrival,departure:input.departure},false);
  const stepHtml=await step.text(), params=pageParams(stepHtml);
  if(params.RESERVATION_DETAILS?.from!==input.arrival||params.RESERVATION_DETAILS?.to!==input.departure) throw Error('A Previo dátumai eltérnek a kért időszaktól.');
  const kind=params.OBJECT_KINDS?.filter(x=>x.hotelLangName===NAMES[input.cabin]);
  if(kind?.length!==1) throw Error('A kért háztípus nem azonosítható egyértelműen.');
  const obkId=kind[0].obkId;
  const common={hotId:HOTEL_ID,currency:'HUF',lang:'hu',obkId:String(obkId),PHPSESSID:new URL(step.url).searchParams.get('PHPSESSID')||new URL(action).searchParams.get('PHPSESSID')||''};
  const occupancy=await (await post(safe,sessionUrl('/index/get-object-kind-occupancy/',step.url),{...common,newDesign:'1'})).json();
  if(!occupancy.success||typeof occupancy.html!=='string') throw Error('A Previo nem igazolta a rendelkezésre állást.');
  const free=Number(occupancy.html.match(/data-numOfFreeRooms="(\d+)"/)?.[1]);
  if(!Number.isInteger(free)) throw Error('Nem ellenőrizhető a szabad kapacitás.');
  if(free<1) return {status:'unavailable',source:'Sárberki hivatalos foglalási felület',checkedAt:new Date().toISOString(),...input,availability:'unavailable',bookingCompleted:false};
  const categories=params.GUEST_CATEGORIES||[];
  const adult=categories.filter(x=>x.isDefault&&!x.isChild);
  if(adult.length!==1) throw Error('A Previo felnőtt kategóriája nem egyértelmű.');
  const counts=new Map([[adult[0].guaId,input.adults]]);
  for(const age of input.children){const id=categoryFor(age,categories).guaId;counts.set(id,(counts.get(id)||0)+1);}
  const withBed=input.adults+input.children.filter(age=>!categoryFor(age,categories).isWithoutBed).length;
  const formData={obkId,rooms:[{hash:null,isNonRef:false,numOfGuestsWithBed:withBed,guestCategories:categories.map(x=>({guaId:x.guaId,count:counts.get(x.guaId)||0}))}]};
  const priced=await (await post(safe,sessionUrl('/index/get-occupancy-price/',step.url),{...common,formData:JSON.stringify(formData)})).json();
  if(priced.success!==true||priced.unknownPrice!==false||!Number.isSafeInteger(priced.totalPrice)||priced.totalPrice<=0||!Number.isSafeInteger(priced.totalTaxes)||priced.totalTaxes<0||priced.totalTaxes>priced.totalPrice) throw Error('A Previo nem adott ellenőrzött teljes árat.');
  return {status:'review_required',source:'Sárberki hivatalos foglalási felület',sourceUrl:'https://sarberkito.hu/foglalas/',checkedAt:new Date().toISOString(),...input,availability:'available',availableUnits:free,accommodation:priced.totalPrice-priced.totalTaxes,tourismTax:priced.totalTaxes,total:priced.totalPrice,currency:'HUF',bookingCompleted:false};
}
