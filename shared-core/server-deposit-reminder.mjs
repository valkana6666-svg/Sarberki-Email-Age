// Server-only. Owner 2026-11-23: "jelezne a vendégnek az e-mail címen 2 nappal előtte, hogy lejár a határideje az
// előrefizetésnek". For a finalized booking whose deposit deadline is within the next 2 days, the server writes a
// fixed reminder text (4 languages, from the stored booking – no AI), attests it, saves it as the case's newest
// machine draft (sc_tm_deposit_reminder, once per booking) and approves it (sc_tm_decide). Nothing is SENT here: the
// operator's click sends it through the existing send path (test pair only, send ledger). See
// deployment/test-mailbox/deposit-reminder.sql.
import {createHash,createHmac} from 'node:crypto';
import {localDeadline} from './booking-confirmation-draft.mjs';
import {CABIN_NAMES} from './price-insert-sentence.mjs';
import {voucherFor} from './server-previo-reservation-write.mjs';
import {BUSINESS} from '../business-config.mjs';

export const REMINDER_SCOPE='test-mailbox-deposit-reminder-v2';
export const REMINDER_WINDOW_MS=2*86400000;
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const sha=t=>createHash('sha256').update(String(t),'utf8').digest('hex');
const huf=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const dot=d=>String(d).replaceAll('-','.')+'.';

// Owner 2026-11-24: two reminders. 'final' on the deadline's Budapest day (or up to 12 h after the deadline),
// 'first' otherwise within the 48 h before it; each once. The database computes the same by its own clock.
const budapestDay=ms=>new Date(ms).toLocaleDateString('en-CA',{timeZone:'Europe/Budapest'});
export function reminderKind(booking,nowMs=Date.now()){
 if(booking?.status!=='finalized')return null;
 const t=Date.parse(booking?.deposit?.deadlineUtc||'');if(Number.isNaN(t))return null;
 let kind=null;
 if(nowMs<t+12*3600000&&(nowMs>=t||budapestDay(nowMs)===budapestDay(t)))kind='final';
 else if(nowMs<t&&t-nowMs<REMINDER_WINDOW_MS)kind='first';
 if(kind==='final'&&booking.depositReminderFinal)return null;
 if(kind==='first'&&booking.depositReminder)return null;
 return kind;
}
export function reminderDue(booking,nowMs=Date.now()){return reminderKind(booking,nowMs)!==null;}

// Pure: the reminder text from the stored booking (no guest data beyond the name the guest gave).
export function buildDepositReminder({values,booking,bookingNumber=null,language='hu',kind='first',nowMs=Date.now(),brand=BUSINESS.brandName}){
 const lang=['hu','de','en','si'].includes(language)?language:'hu';
 const amount=booking?.deposit?.amount;
 if(!Number.isSafeInteger(amount)||amount<=0||!values?.arrival||!values?.departure)fail('REMINDER_FACTS_MISSING');
 const due=localDeadline(booking.deposit.deadlineUtc);
 const key=Object.entries(CABIN_NAMES).find(([,n])=>n.hu.toLowerCase()===String(values.unit||'').trim().toLowerCase())?.[0];
 const cabin=(key&&CABIN_NAMES[key]?.[lang])||String(values.unit||'');
 const name=String(values.name||'').trim();
 const num=bookingNumber&&/^SC-[0-9A-F]{16}$/.test(bookingNumber)?bookingNumber:null;
 const stay=`${dot(values.arrival)} – ${dot(values.departure)}${cabin?', '+cabin:''}`;
 const fin=kind==='final',past=fin&&nowMs>=Date.parse(booking.deposit.deadlineUtc);
 const ref={hu:`(${stay}${num?`, foglalási szám: ${num}`:''})`,de:`(${stay}${num?`, Buchungsnummer: ${num}`:''})`,en:`(${stay}${num?`, booking number: ${num}`:''})`,si:`(${stay}${num?`, številka rezervacije: ${num}`:''})`};
 const lead={
  hu:fin?(past?`Szeretnénk tájékoztatni, hogy foglalásához ${ref.hu} a foglaló befizetési határideje ma lejárt, és a foglaló még nem érkezett meg hozzánk.`
    :`Szeretnénk tájékoztatni, hogy foglalásához ${ref.hu} a foglaló befizetési határideje ma lejár.`)
   :`Szeretnénk emlékeztetni, hogy foglalásához ${ref.hu} közeleg a foglaló befizetési határideje.`,
  de:fin?(past?`wir möchten Sie informieren, dass die Frist für die Anzahlung Ihrer Buchung ${ref.de} heute abgelaufen ist und die Anzahlung noch nicht bei uns eingegangen ist.`
    :`wir möchten Sie informieren, dass die Frist für die Anzahlung Ihrer Buchung ${ref.de} heute abläuft.`)
   :`wir möchten Sie daran erinnern, dass die Frist für die Anzahlung Ihrer Buchung ${ref.de} bald abläuft.`,
  en:fin?(past?`We would like to let you know that the deposit deadline for your booking ${ref.en} passed today and we have not yet received the deposit.`
    :`We would like to let you know that the deposit for your booking ${ref.en} is due today.`)
   :`This is a friendly reminder that the deposit for your booking ${ref.en} is due soon.`,
  si:fin?(past?`obveščamo vas, da je rok za plačilo predplačila za vašo rezervacijo ${ref.si} danes potekel in predplačila še nismo prejeli.`
    :`obveščamo vas, da rok za plačilo predplačila za vašo rezervacijo ${ref.si} poteče danes.`)
   :`radi bi vas spomnili, da se rok za plačilo predplačila za vašo rezervacijo ${ref.si} izteka.`};
 const ask={hu:fin?'Kérjük, ha még nem tette meg, utalja el a foglalót, vagy jelezze nekünk, ha kérdése van. ':'',de:fin?'Bitte überweisen Sie die Anzahlung, falls noch nicht geschehen, oder melden Sie sich bei Fragen. ':'',
  en:fin?'If you have not done so yet, please transfer the deposit or let us know if you have any questions. ':'',si:fin?'Če tega še niste storili, prosimo, nakažite predplačilo ali nam sporočite, če imate vprašanja. ':''};
 const T={
  hu:[name?`Kedves ${name}!`:'Kedves Vendégünk!','',
   lead.hu,'',
   `Foglaló: ${huf(amount)} Ft`,`Határidő: ${due.date} ${due.time} (magyarországi idő)`,'',
   ask.hu+'A foglalás a foglaló beérkezése után válik véglegessé. Ha már elutalta, köszönjük, ezt a levelet tekintse tárgytalannak.','',
   'Üdvözlettel:',brand],
  de:[name?`Liebe(r) ${name},`:'Liebe Gäste,','',
   lead.de,'',
   `Anzahlung: ${huf(amount)} HUF`,`Frist: ${due.date} ${due.time} (ungarische Zeit)`,'',
   ask.de+'Die Buchung wird nach Eingang der Anzahlung verbindlich. Falls Sie bereits überwiesen haben, vielen Dank – betrachten Sie diese Nachricht als gegenstandslos.','',
   'Mit freundlichen Grüßen',brand],
  en:[name?`Dear ${name},`:'Dear Guest,','',
   lead.en,'',
   `Deposit: ${huf(amount)} HUF`,`Due by: ${due.date} ${due.time} (Hungarian time)`,'',
   ask.en+'Your booking becomes final once the deposit has been received. If you have already paid, thank you – please disregard this message.','',
   'Kind regards,',brand],
  si:[name?`Spoštovani ${name},`:'Spoštovani gost,','',
   lead.si,'',
   `Predplačilo: ${huf(amount)} HUF`,`Rok: ${due.date} ${due.time} (madžarski čas)`,'',
   ask.si+'Rezervacija postane dokončna po prejemu predplačila. Če ste že plačali, se vam zahvaljujemo – to sporočilo prezrite.','',
   'Lep pozdrav,',brand]}[lang];
 return T.join('\n');
}

export function attestReminder({key,tenantId,caseId,expectedRevision,text,deadlineUtc,kind,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const fields=[REMINDER_SCOPE,tenantId,caseId,String(expectedRevision),sha(text),deadlineUtc,kind,checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:REMINDER_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

// Prepare (save + approve) the reminder. Returns {saved, approved}. The DB re-checks window, once-only and attestation.
export async function prepareDepositReminder({record,attestationKey,transport,clock=()=>new Date().toISOString(),now=()=>Date.now()}={}){
 const data=record?.data,b=data?.booking;
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 if(b?.status!=='finalized')fail('NOT_FINALIZED');
 const kind=reminderKind(b,now());
 if(!kind){const t=Date.parse(b?.deposit?.deadlineUtc||''),n=now();
  const sameDay=!Number.isNaN(t)&&(n>=t||budapestDay(n)===budapestDay(t));
  fail((sameDay&&b.depositReminderFinal)||(!sameDay&&b.depositReminder)?'REMINDER_ALREADY_SENT':'REMINDER_NOT_DUE');}
 const v=data?.state?.values||{};
 if(!String(v.email||'').trim()&&['chat','phone'].includes(data?.sourceReceipt?.provider))fail('NO_EMAIL');
 const ref=String(b.previo?.reference||'');
 const text=buildDepositReminder({values:v,booking:b,language:v.language,kind,nowMs:now(),bookingNumber:/^V2-\d+$/.test(ref)?voucherFor({tenantId:record.tenantId,caseId:record.caseId}):null});
 const proof=attestReminder({key:attestationKey,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:record.revision,text,deadlineUtc:b.deposit.deadlineUtc,kind,checkedAt:clock()});
 const saved=await transport('/rest/v1/rpc/sc_tm_deposit_reminder',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_draft:{text},p_proof:proof}});
 if(!saved)return {saved:null,approved:false};
 let approved=null;
 try{approved=await transport('/rest/v1/rpc/sc_tm_decide',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:Number(saved.revision),
  p_draft_hash:sha(text),p_decision:'approve',p_reason:null}});}catch{approved=null;}
 return {saved:approved||saved,approved:!!approved,text,kind};
}
