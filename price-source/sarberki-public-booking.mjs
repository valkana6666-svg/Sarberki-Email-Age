import {validateQuote} from '../price-quote.mjs';
import {SARBERKI_PROFILE} from '../business/sarberki/profile.mjs';

const ROOT=SARBERKI_PROFILE.bookingProvider.root;
const HOTEL_ID=SARBERKI_PROFILE.bookingProvider.hotelId;
const NAMES=Object.fromEntries(Object.entries(SARBERKI_PROFILE.accommodationTypes).map(([key,value])=>[key,value.bookingName]));
const GET_PATHS=new Set(['/','/index/step-1/','/index/step-2/']);
const POST_PATHS=new Set(['/','/index/get-object-kind-occupancy/','/index/get-occupancy-price/']);
const QUERY_KEYS=new Set(['hotId','currency','lang','theme','redirectType','showTabs','PHPSESSID']);

function validatePrevioRequest(url,options={}) {
  const target=new URL(url), method=options.method||'GET';
  if(target.origin!==ROOT||target.username||target.password||target.hash||!(method==='GET'?GET_PATHS:method==='POST'?POST_PATHS:new Set()).has(target.pathname)||target.searchParams.get('hotId')!==HOTEL_ID||[...target.searchParams.keys()].some(key=>!QUERY_KEYS.has(key))||target.searchParams.has('currency')&&target.searchParams.get('currency')!=='HUF') throw Error('Nem engedélyezett Previo kérés vagy átirányítás.');
  if(method==='POST'&&target.pathname==='/') {
    const body=new URLSearchParams(options.body);
    if([...body.keys()].sort().join(',')!=='arrival,departure,step'||body.get('step')!=='1') throw Error('A dátumkeresés űrlapja megváltozott.');
  }
  if(method==='POST'&&target.pathname!=='/') {
    const keys=[...new URLSearchParams(options.body).keys()].sort().join(',');
    const expected=target.pathname==='/index/get-object-kind-occupancy/'?'PHPSESSID,currency,hotId,lang,newDesign,obkId':'PHPSESSID,currency,formData,hotId,lang,obkId';
    if(keys!==expected) throw Error('A Previo ár- vagy kapacitáskérésének mezői megváltoztak.');
    const body=new URLSearchParams(options.body);
    if(body.get('hotId')!==HOTEL_ID||body.get('currency')!=='HUF'||!/^\d+$/.test(body.get('obkId')||'')) throw Error('Eltérő Previo szálláshely, pénznem vagy háztípus.');
    if(target.pathname==='/index/get-occupancy-price/') {
      const form=JSON.parse(body.get('formData'));
      const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join(',')===keys;
      if(!exact(form,'obkId,rooms')||String(form.obkId)!==body.get('obkId')||!Array.isArray(form.rooms)||form.rooms.length<1||form.rooms.length>10
        ||form.rooms.some(room=>!exact(room,'guestCategories,hash,isNonRef,numOfGuestsWithBed')||room.hash!==null||room.isNonRef!==false
          ||!Number.isInteger(room.numOfGuestsWithBed)||room.numOfGuestsWithBed<1||room.numOfGuestsWithBed>40
          ||!Array.isArray(room.guestCategories)||room.guestCategories.length<1
          ||room.guestCategories.some(cat=>!exact(cat,'count,guaId')||!Number.isInteger(cat.guaId)||cat.guaId<1||!Number.isInteger(cat.count)||cat.count<0||cat.count>40)))
        throw Error('Csak névtelen vendégkategóriák küldhetők a Previo árlekéréshez.');
    }

  }
  return target;
}

export async function requestPrevioReadOnly(url,options={},request=fetch) {
  for(let redirects=0;redirects<3;redirects++) {
    const target=validatePrevioRequest(url,options), method=options.method||'GET';
    const response=await request(target.href,{...options,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status)) return response;
    const initialGet=method==='GET'&&target.pathname==='/'&&[301,302,303].includes(response.status);
    const searchPost=method==='POST'&&target.pathname==='/'&&[302,303].includes(response.status);
    if(!initialGet&&!searchPost) throw Error('Nem engedélyezett Previo átirányítás.');
    const location=response.headers?.get('location');
    if(!location) throw Error('A Previo átirányítás célja hiányzik.');
    url=new URL(location,target).href;
    if(new URL(url).pathname!==(initialGet?'/index/step-1/':'/index/step-2/')) throw Error('A Previo nem az engedélyezett keresési oldalra irányított át.');
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

// Read-only availability check. It sends dates and a mapped accommodation type only;
 // no customer identity and no adult/child composition is required.
export async function fetchPublicBookingAvailability(raw,request=fetch){
  const {arrival,departure,cabin}=raw||{};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(arrival||'')||!/^\d{4}-\d{2}-\d{2}$/.test(departure||'')) throw Error('Pontos érkezési és távozási dátum szükséges.');
  const start=new Date(arrival+'T00:00:00Z'), end=new Date(departure+'T00:00:00Z');
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start) throw Error('Érvényes tartózkodási időszak szükséges.');
  if(!NAMES[cabin]) throw Error('Ehhez a háztípushoz nincs ellenőrzött Previo megfeleltetés.');
  const safe=(url,options)=>requestPrevioReadOnly(url,options,request);
  const initial=await checkedResponse(await safe(`${ROOT}/?hotId=${HOTEL_ID}&currency=HUF&lang=hu&redirectType=iframe`,{signal:AbortSignal.timeout(45000)}));
  const first=await initial.text();
  const form=first.match(/<form[^>]*id="firstStep"[^>]*>/)?.[0];
  const action=form?.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g,'&');
  if(!action||new URL(action).origin!==ROOT||new URL(action).pathname!=='/'||new URL(action).searchParams.get('hotId')!==HOTEL_ID) throw Error('A Previo dátuműrlapja megváltozott.');
  const step=await post(safe,action,{step:'1',arrival,departure},false);
  const stepHtml=await step.text(), params=pageParams(stepHtml);
  if(params.RESERVATION_DETAILS?.from!==arrival||params.RESERVATION_DETAILS?.to!==departure) throw Error('A Previo dátumai eltérnek a kért időszaktól.');
  const kind=params.OBJECT_KINDS?.filter(x=>x.hotelLangName===NAMES[cabin]);
  if(kind?.length!==1) throw Error('A kért háztípus nem azonosítható egyértelműen.');
  const obkId=kind[0].obkId;
  const common={hotId:HOTEL_ID,currency:'HUF',lang:'hu',obkId:String(obkId),PHPSESSID:new URL(step.url).searchParams.get('PHPSESSID')||new URL(action).searchParams.get('PHPSESSID')||''};
  const occupancy=await (await post(safe,sessionUrl('/index/get-object-kind-occupancy/',step.url),{...common,newDesign:'1'})).json();
  if(!occupancy.success||typeof occupancy.html!=='string') throw Error('A Previo nem igazolta a rendelkezésre állást.');
  const free=Number(occupancy.html.match(/data-numOfFreeRooms="(\d+)"/)?.[1]);
  if(!Number.isInteger(free)) throw Error('Nem ellenőrizhető a szabad kapacitás.');
  return {status:'review_required',source:'Sárberki hivatalos foglalási felület',sourceUrl:SARBERKI_PROFILE.bookingUrl,checkedAt:new Date().toISOString(),arrival,departure,cabin,availability:free>0?'available':'unavailable',availableUnits:free,bookingCompleted:false};
}

// Only read-only quote endpoints. No reservation submission or customer data.
export async function fetchPublicBookingQuote(raw,request=fetch){
  const input=validateQuote(raw);
  const safe=(url,options)=>requestPrevioReadOnly(url,options,request);
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
  if(free<1) return {status:'unavailable',source:`${SARBERKI_PROFILE.brandName} hivatalos foglalási felület`,checkedAt:new Date().toISOString(),...input,availability:'unavailable',availableUnits:free,bookingCompleted:false};
  const categories=params.GUEST_CATEGORIES||[];
  const adult=categories.filter(x=>x.isDefault&&!x.isChild);
  if(adult.length!==1) throw Error('A Previo felnőtt kategóriája nem egyértelmű.');
  const units=input.units||1;
  if(free<units) return {status:'unavailable',source:`${SARBERKI_PROFILE.brandName} hivatalos foglalási felület`,checkedAt:new Date().toISOString(),...input,availability:'unavailable',availableUnits:free,bookingCompleted:false};
  const parties=Array.from({length:units},()=>({adults:0,children:[]}));
  for(let i=0;i<units;i++) parties[i].adults=1;
  for(let i=units;i<input.adults;i++) parties[(i-units)%units].adults++;
  for(let i=0;i<input.children.length;i++) parties[i%units].children.push(input.children[i]);
  const maxPerUnit=SARBERKI_PROFILE.accommodationTypes[input.cabin]?.maxGuests;
  if(parties.some(p=>p.adults+p.children.length>maxPerUnit)) throw Error('A vendégek nem oszthatók el biztonságosan a kért egységek között.');
  const rooms=parties.map(p=>{
    const counts=new Map([[adult[0].guaId,p.adults]]);
    for(const age of p.children){const id=categoryFor(age,categories).guaId;counts.set(id,(counts.get(id)||0)+1);}
    const withBed=p.adults+p.children.filter(age=>!categoryFor(age,categories).isWithoutBed).length;
    return {hash:null,isNonRef:false,numOfGuestsWithBed:withBed,guestCategories:categories.map(x=>({guaId:x.guaId,count:counts.get(x.guaId)||0}))};
  });
  const priceRooms=async selectedRooms=>{
    const formData={obkId,rooms:selectedRooms};
    const priced=await (await post(safe,sessionUrl('/index/get-occupancy-price/',step.url),{...common,formData:JSON.stringify(formData)})).json();
    if(priced.success!==true||priced.unknownPrice!==false||!Number.isSafeInteger(priced.totalPrice)||priced.totalPrice<=0||!Number.isSafeInteger(priced.totalTaxes)||priced.totalTaxes<0||priced.totalTaxes>priced.totalPrice) throw Error('A Previo nem adott ellenőrzött teljes árat.');
    return {accommodation:priced.totalPrice-priced.totalTaxes,tourismTax:priced.totalTaxes,total:priced.totalPrice};
  };
  const priced=await priceRooms(rooms);
  let unitBreakdown=[];
  if(units>1){
    unitBreakdown=await Promise.all(rooms.map(async(room,index)=>{
      const one=await priceRooms([room]);
      return {unit:index+1,adults:parties[index].adults,children:[...parties[index].children],...one};
    }));
    const summed=unitBreakdown.reduce((acc,x)=>({
      accommodation:acc.accommodation+x.accommodation,
      tourismTax:acc.tourismTax+x.tourismTax,
      total:acc.total+x.total
    }),{accommodation:0,tourismTax:0,total:0});
    if(summed.accommodation!==priced.accommodation||summed.tourismTax!==priced.tourismTax||summed.total!==priced.total) throw Error('A több házas összár és a házankénti Previo-árak eltérnek; kézi ellenőrzés szükséges.');
  }
  return {status:'review_required',source:'Sárberki hivatalos foglalási felület',sourceUrl:SARBERKI_PROFILE.bookingUrl,checkedAt:new Date().toISOString(),...input,units,availability:'available',availableUnits:free,accommodation:priced.accommodation,tourismTax:priced.tourismTax,total:priced.total,unitBreakdown,currency:'HUF',bookingCompleted:false};
}
