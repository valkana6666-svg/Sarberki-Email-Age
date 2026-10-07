import {BUSINESS} from './business-config.mjs?v=20261007-e2e1';

const PHYSICAL_UNITS=BUSINESS.splitPhysicalUnits||[];
const HOUSES=[7,8,9,10];
const COUNT_WORDS=Object.freeze({
  egy:1,'1':1,két:2,ket:2,kettő:2,ketto:2,'2':2,három:3,harom:3,'3':3,négy:4,negy:4,'4':4,
  one:1,two:2,three:3,four:4,ein:1,eine:1,zwei:2,drei:3,vier:4,en:1,ena:1,dva:2,dve:2,tri:3,'štiri':4,stiri:4
});

export const SPLIT_UNIT_IDS=Object.freeze(PHYSICAL_UNITS.map(x=>x.id));

function unique(values){return [...new Set(values)];}
function countValue(raw=''){return COUNT_WORDS[String(raw).toLocaleLowerCase('hu-HU')]||0;}
function exactIds(text=''){
  return unique([...String(text).matchAll(/\b(7|8|9|10)\s*[-/]?\s*([ABC])\b/giu)].map(m=>m[1]+m[2].toUpperCase()));
}
function hasTwoPersonPhrase(text=''){
  return /(?:\b(?:2|két|ket|kettő|ketto)\s*[- ]?fős\b|\b(?:2|two)[ -]?person\b|\b2[ -]?personen\b|\b2[ -]?oseb\w*\b)/iu.test(text);
}
function hasFourPersonPhrase(text=''){
  return /(?:\b(?:4|négy|negy)\s*[- ]?fős\b|\b(?:4|four)[ -]?person\b|\b4[ -]?personen\b|\b4[ -]?oseb\w*\b)/iu.test(text);
}
function countBeforeSizedUnit(text='',size=2){
  const sizeToken=size===2?'(?:2|két|ket|kettő|ketto)':'(?:4|négy|negy)';
  const pattern=new RegExp('\\b(egy|1|két|ket|kettő|ketto|2|három|harom|3|négy|negy|4)\\s*(?:db|darab)\\s*'+sizeToken+'\\s*[- ]?fős\\s+(?:osztott\\s+)?apartman\\w*','iu');
  const match=String(text).match(pattern);
  return match?countValue(match[1]):0;
}

export function splitRequestFromText(text=''){
  const source=String(text||'');
  const ids=exactIds(source);
  const explicitSplit=ids.length>0||/\b(?:osztott|split|geteilte[rs]?|deljen[ai]?)\b/iu.test(source);
  if(!explicitSplit)return {
    isSplit:false,kind:'not_split',requestedAB:0,requestedC:0,unitCount:0,exactUnitIds:[],
    sameHousePreferred:false,crossHouseFallbackRequiresApproval:false
  };

  if(ids.length){
    const rows=ids.map(id=>PHYSICAL_UNITS.find(x=>x.id===id)).filter(Boolean);
    const requestedAB=rows.filter(x=>x.segment==='A'||x.segment==='B').length;
    const requestedC=rows.filter(x=>x.segment==='C').length;
    return {
      isSplit:true,kind:'exact',requestedAB,requestedC,unitCount:rows.length,exactUnitIds:ids,
      sameHousePreferred:rows.length>1,crossHouseFallbackRequiresApproval:false
    };
  }

  const two=hasTwoPersonPhrase(source);
  const four=hasFourPersonPhrase(source);
  const requestedAB=two?(countBeforeSizedUnit(source,2)||1):0;
  const requestedC=four?(countBeforeSizedUnit(source,4)||1):0;
  const kind=two&&four?'mixed':two?'two_person':four?'four_person':'unspecified';
  const unitCount=requestedAB+requestedC;
  return {
    isSplit:true,kind,requestedAB,requestedC,unitCount,exactUnitIds:[],
    sameHousePreferred:unitCount>1,crossHouseFallbackRequiresApproval:unitCount>1
  };
}

function poolStatus(needAB,needC,poolChecks={}){
  const ab=poolChecks.splitAB||null, upper=poolChecks.splitC||null;
  const abOk=needAB===0||Boolean(ab?.verified&&ab.availableUnits>=needAB);
  const cOk=needC===0||Boolean(upper?.verified&&upper.availableUnits>=needC);
  return {
    pooledAvailabilityVerified:Boolean(abOk&&cOk&&(needAB===0||ab?.verified)&&(needC===0||upper?.verified)),
    splitAB:needAB?ab:null,
    splitC:needC?upper:null
  };
}
function flatten(combos){return unique(combos.flat());}
function physicalForSegment(segment){
  return PHYSICAL_UNITS.filter(x=>x.segment===segment).map(x=>x.id);
}
function sameHouseCombos(segments){
  return HOUSES.map(house=>segments.map(segment=>`${house}${segment}`));
}
function optionReason(pooled,totalUnits){
  if(pooled){
    return totalUnits>1
      ?'A szükséges 2 fős és 4 fős Previo poolban van elég szabad egység, de az egyedi 7A–10C egység-ID és az azonos fizikai házhoz tartozó párosítás ezen a read-only útvonalon nem látszik.'
      :'A szükséges Previo poolban van elég szabad egység, de az egyedi 7A–10C egység-ID ezen a read-only útvonalon nem látszik.';
  }
  return totalUnits>1
    ?'A Previo-típusmapping hitelesített (A/B = 2 fős apartman pool, C = 4 fős apartman pool), de a szükséges pooled elérhetőség, az egyedi 7A–10C egység-ID vagy a fizikai párosítás még kézi ellenőrzést igényel.'
    :'A Previo-típusmapping hitelesített (A/B = 2 fős apartman pool, C = 4 fős apartman pool), de a szükséges pooled elérhetőség vagy az egyedi 7A–10C egység-ID még kézi ellenőrzést igényel.';
}
function decorate({label,units,capacity,candidateCombinations,needAB,needC,requestMode,poolChecks}){
  const pool=poolStatus(needAB,needC,poolChecks);
  const totalUnits=needAB+needC;
  return {
    kind:'split_manual_review',
    label,
    units,
    capacity,
    availability_verified:false,
    pooled_availability_verified:pool.pooledAvailabilityVerified,
    individual_unit_mapping_verified:false,
    same_house_pairing_verified:false,
    business_placement_requires_human_approval:totalUnits>1,
    individual_mapping_requires_review:true,
    current_read_only_mapping_requires_human_approval:true,
    same_house_preferred:totalUnits>1,
    cross_house_fallback_allowed:totalUnits>1,
    cross_house_fallback_requires_human_approval:totalUnits>1,
    candidate_combinations:candidateCombinations,
    candidate_unit_ids:flatten(candidateCombinations),
    request_mode:requestMode,
    pool_checks:{splitAB:pool.splitAB,splitC:pool.splitC},
    reason:optionReason(pool.pooledAvailabilityVerified,totalUnits)
  };
}

function specifiedOptions(request,poolChecks={}){
  const ab=Number(request?.requestedAB||0), c=Number(request?.requestedC||0);
  if(request?.kind==='exact'&&request.exactUnitIds?.length){
    const rows=request.exactUnitIds.map(id=>PHYSICAL_UNITS.find(x=>x.id===id)).filter(Boolean);
    return [decorate({
      label:request.exactUnitIds.join(' + '),
      units:rows.map(x=>x.segment==='C'?'splitC':x.segment==='B'?'splitB':'splitA'),
      capacity:rows.reduce((n,x)=>n+Number(x.nominalGuests||0),0),
      candidateCombinations:[request.exactUnitIds],
      needAB:rows.filter(x=>x.segment!=='C').length,
      needC:rows.filter(x=>x.segment==='C').length,
      requestMode:'exact',poolChecks
    })];
  }
  if(!ab&&!c)return null;

  let label='',units=[],combos=[],mode='mixed';
  if(ab===1&&c===0){
    label='Osztott A/B';
    units=['splitA_or_B'];
    combos=HOUSES.flatMap(house=>[[`${house}A`],[`${house}B`]]);
    mode='single_two_person';
  }else if(ab===2&&c===0){
    label='Osztott A + Osztott B';
    units=['splitA','splitB'];
    combos=sameHouseCombos(['A','B']);
    mode='double_two_person';
  }else if(ab===0&&c===1){
    label='Osztott C';
    units=['splitC'];
    combos=physicalForSegment('C').map(id=>[id]);
    mode='single_four_person';
  }else if(ab===1&&c===1){
    label='Osztott A/B + Osztott C';
    units=['splitA_or_B','splitC'];
    combos=HOUSES.flatMap(h=>[[`${h}A`,`${h}C`],[`${h}B`,`${h}C`]]);
    mode='two_plus_four';
  }else if(ab===2&&c===1){
    label='Osztott A + Osztott B + Osztott C';
    units=['splitA','splitB','splitC'];
    combos=sameHouseCombos(['A','B','C']);
    mode='full_split_house';
  }else{
    label=`${ab} × Osztott 2 fős${c?` + ${c} × Osztott C`:''}`;
    units=[...Array(ab).fill('splitA_or_B'),...Array(c).fill('splitC')];
    combos=[];
    mode='multi_split_units';
  }
  return [decorate({label,units,capacity:ab*2+c*4,candidateCombinations:combos,needAB:ab,needC:c,requestMode:mode,poolChecks})];
}

export function splitCapacityOptions(guests,poolChecks={},request=null){
  const specified=specifiedOptions(request,poolChecks);
  if(specified)return specified;

  const units=[
    {key:'splitA',label:'Osztott A',capacity:BUSINESS.accommodationTypes.splitA.maxGuests,segment:'A'},
    {key:'splitB',label:'Osztott B',capacity:BUSINESS.accommodationTypes.splitB.maxGuests,segment:'B'},
    {key:'splitC',label:'Osztott C',capacity:BUSINESS.accommodationTypes.splitC.maxGuests,segment:'C'}
  ];
  const combos=[];
  for(let mask=1;mask<(1<<units.length);mask++){
    const selected=units.filter((_,i)=>mask&(1<<i));
    const capacity=selected.reduce((n,x)=>n+x.capacity,0);
    if(capacity>=guests)combos.push({selected,capacity,excess:capacity-guests,count:selected.length});
  }
  combos.sort((a,b)=>a.excess-b.excess||a.count-b.count||a.selected.map(x=>x.label).join().localeCompare(b.selected.map(x=>x.label).join()));
  const best=combos[0];
  if(!best)return [];
  return combos.filter(x=>x.excess===best.excess&&x.count===best.count).map(x=>{
    const segments=x.selected.map(y=>y.segment);
    const needAB=segments.filter(s=>s==='A'||s==='B').length, needC=segments.filter(s=>s==='C').length;
    return decorate({
      label:x.selected.map(y=>y.label).join(' + '),
      units:x.selected.map(y=>y.key),
      capacity:x.capacity,
      candidateCombinations:sameHouseCombos(segments),
      needAB,needC,requestMode:'generic_capacity',poolChecks
    });
  });
}

export function splitInternalSummary(options=[],request=null){
  const first=options?.[0];
  if(!first)return '';
  const technical='A Previo jelenleg csak pool-szinten igazolja az osztott egységeket; a konkrét 7A–10C egységazonosító még nem olvasható ki automatikusan.';
  if(first.request_mode==='single_two_person'){
    return 'Egyetlen 2 fős osztott apartman: bármely szabad A/B egység választható (7A, 7B, 8A, 8B, 9A, 9B, 10A, 10B). '+technical;
  }
  if(first.request_mode==='double_two_person'){
    return 'Két 2 fős osztott apartman: elsődleges az azonos házas A+B pár (7A+7B, 8A+8B, 9A+9B, 10A+10B). Eltérő házakból összeállított A/B kombináció csak emberi jóváhagyással használható. '+technical;
  }
  if(first.request_mode==='single_four_person'){
    return 'Egy 4 fős osztott apartman: a C, vagyis a felső/emeleti egység választható (7C, 8C, 9C, 10C). '+technical;
  }
  if(first.request_mode==='two_plus_four'){
    return '2 fős + 4 fős osztott kombinációnál elsőként ugyanazon fizikai ház A+C vagy B+C párosát kell keresni. Más házak keverése csak emberi jóváhagyással lehetséges. '+technical;
  }
  if(first.request_mode==='full_split_house'){
    return 'Teljes osztott faház igénynél elsőként ugyanazon fizikai ház A+B+C egységeit kell együtt keresni (7A+7B+7C … 10A+10B+10C). '+technical;
  }
  const combos=unique(options.flatMap(x=>x.candidate_combinations||[]).map(x=>x.join('+'))).slice(0,12);
  return (combos.length?'Elsődleges azonos házas belső kombinációk: '+combos.join(', ')+'. ':'')+technical;
}
