// Owner 2026-11-25 (#9 7159099524): separate finance view over the SAME case store – deposits of recorded bookings.
// Pure helpers (no DOM, no network): grouping, search, totals, row text. A probable Previo payment is shown only as a
// suggestion; nothing here marks a deposit as received (that stays the human "Foglaló beérkezett" step).
const HOUR=3600000;
export const GROUPS=Object.freeze({
 overdue:{label:'Lejárt',info:'A határidő lejárt, a foglaló nincs megjelölve.'},
 soon:{label:'Hamarosan esedékes',info:'48 órán belül lejár a határidő.'},
 waiting:{label:'Várakozó',info:'Foglaló még nem érkezett, a határidő később jár le.'},
 received:{label:'Beérkezett / lezárt',info:'A foglaló beérkezett (ember jelölte meg).'},
 cancelled:{label:'Lemondva',info:'Lemondott foglalás – nincs foglaló-teendő.'}
});
export const GROUP_ORDER=Object.freeze(['overdue','soon','waiting','received','cancelled']);

export function financeGroup(row,now=Date.now()){
 const s=row?.summary,f=s?.finance;if(!f)return null;
 if(s.booking==='deposit_received')return 'received';
 if(s.booking==='cancelled')return 'cancelled';
 if(s.booking!=='finalized')return null;
 const t=Date.parse(f.deadlineUtc||'');
 if(Number.isNaN(t))return 'waiting';
 if(t<now)return 'overdue';
 return t-now<=48*HOUR?'soon':'waiting';
}

const norm=v=>String(v||'').toLocaleLowerCase('hu-HU').normalize('NFD').replace(/[̀-ͯ]/g,'');
export function matchesQuery(row,query){
 const q=norm(query).trim();if(!q)return true;
 const s=row.summary||{};
 return [s.name,s.email,s.unit,s.finance?.reference,row.caseId].some(v=>norm(v).includes(q));
}

// Rows of the finance view: grouped, filtered, ordered (deadline first; received newest first).
export function financeRows(rows,{now=Date.now(),group='all',query=''}={}){
 const list=(Array.isArray(rows)?rows:[]).map(row=>({row,group:financeGroup(row,now)})).filter(x=>x.group&&(group==='all'||x.group===group)&&matchesQuery(x.row,query));
 const key=x=>x.group==='received'?String(x.row.summary.finance.receivedOn||''):String(x.row.summary.finance.deadlineUtc||'9');
 return list.sort((a,b)=>GROUP_ORDER.indexOf(a.group)-GROUP_ORDER.indexOf(b.group)||(a.group==='received'?key(b).localeCompare(key(a)):key(a).localeCompare(key(b))));
}

export function financeTotals(rows,now=Date.now()){
 const out=Object.fromEntries(GROUP_ORDER.map(g=>[g,{count:0,amount:0,unknownAmount:0}]));
 for(const row of Array.isArray(rows)?rows:[]){
  const g=financeGroup(row,now);if(!g)continue;const a=row.summary.finance.amount;
  out[g].count++;if(Number.isSafeInteger(a))out[g].amount+=a;else out[g].unknownAmount++;
 }
 return out;
}

export const huf=n=>Number.isSafeInteger(n)?String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' Ft':'összeg ismeretlen';
const when=iso=>new Date(iso).toLocaleString('hu-HU',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const day=d=>d.replaceAll('-','. ')+'.';
export function financeRowText(row,now=Date.now()){
 const s=row.summary||{},f=s.finance||{},g=financeGroup(row,now);
 const title=[s.name||'Név nélkül',s.unit,s.arrival&&s.departure?day(s.arrival)+' – '+day(s.departure):null].filter(Boolean).join(' · ');
 const lines=['Foglaló: '+huf(f.amount)+(f.reference?' · Previo: '+f.reference:'')];
 if(g==='received')lines.push('✅ Beérkezett'+(f.receivedOn?': '+day(f.receivedOn):''));
 else if(g==='cancelled')lines.push('Lemondva');
 else if(f.deadlineUtc){
  const left=Date.parse(f.deadlineUtc)-now,h=Math.round(Math.abs(left)/HOUR);
  lines.push((g==='overdue'?'⚠️ Határidő lejárt: ':g==='soon'?'⏳ Határidő: ':'Határidő: ')+when(f.deadlineUtc)+(g==='overdue'?` (${h} órája)`:g==='soon'?` (${h} óra múlva)`:''));
 }else lines.push('Határidő nincs rögzítve');
 if(g!=='received'&&g!=='cancelled'){
  const r=f.reminders||{};
  lines.push('Emlékeztető: '+(r.final?'mindkettő elküldve':r.first?'első elküldve':'még nem ment'));
 }
 return {title,lines,group:g};
}
