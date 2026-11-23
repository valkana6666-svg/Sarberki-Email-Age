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

export const REMINDER_SCOPE='test-mailbox-deposit-reminder-v1';
export const REMINDER_WINDOW_MS=2*86400000;
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const sha=t=>createHash('sha256').update(String(t),'utf8').digest('hex');
const huf=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const dot=d=>String(d).replaceAll('-','.')+'.';

// Is a reminder due for this booking now? (the database checks the same window again)
export function reminderDue(booking,nowMs=Date.now()){
 if(booking?.status!=='finalized'||booking?.depositReminder)return false;
 const t=Date.parse(booking?.deposit?.deadlineUtc||'');
 return !Number.isNaN(t)&&t>nowMs&&t-nowMs<=REMINDER_WINDOW_MS;
}

// Pure: the reminder text from the stored booking (no guest data beyond the name the guest gave).
export function buildDepositReminder({values,booking,bookingNumber=null,language='hu',brand=BUSINESS.brandName}){
 const lang=['hu','de','en','si'].includes(language)?language:'hu';
 const amount=booking?.deposit?.amount;
 if(!Number.isSafeInteger(amount)||amount<=0||!values?.arrival||!values?.departure)fail('REMINDER_FACTS_MISSING');
 const due=localDeadline(booking.deposit.deadlineUtc);
 const key=Object.entries(CABIN_NAMES).find(([,n])=>n.hu.toLowerCase()===String(values.unit||'').trim().toLowerCase())?.[0];
 const cabin=(key&&CABIN_NAMES[key]?.[lang])||String(values.unit||'');
 const name=String(values.name||'').trim();
 const num=bookingNumber&&/^SC-[0-9A-F]{16}$/.test(bookingNumber)?bookingNumber:null;
 const stay=`${dot(values.arrival)} – ${dot(values.departure)}${cabin?', '+cabin:''}`;
 const T={
  hu:[name?`Kedves ${name}!`:'Kedves Vendégünk!','',
   `Szeretnénk emlékeztetni, hogy foglalásához (${stay}${num?`, foglalási szám: ${num}`:''}) közeleg a foglaló befizetési határideje.`,'',
   `Foglaló: ${huf(amount)} Ft`,`Határidő: ${due.date} ${due.time} (magyarországi idő)`,'',
   'A foglalás a foglaló beérkezése után válik véglegessé. Ha már elutalta, köszönjük, ezt a levelet tekintse tárgytalannak.','',
   'Üdvözlettel:',brand],
  de:[name?`Liebe(r) ${name},`:'Liebe Gäste,','',
   `wir möchten Sie daran erinnern, dass die Frist für die Anzahlung Ihrer Buchung (${stay}${num?`, Buchungsnummer: ${num}`:''}) bald abläuft.`,'',
   `Anzahlung: ${huf(amount)} HUF`,`Frist: ${due.date} ${due.time} (ungarische Zeit)`,'',
   'Die Buchung wird nach Eingang der Anzahlung verbindlich. Falls Sie bereits überwiesen haben, vielen Dank – betrachten Sie diese Nachricht als gegenstandslos.','',
   'Mit freundlichen Grüßen',brand],
  en:[name?`Dear ${name},`:'Dear Guest,','',
   `This is a friendly reminder that the deposit for your booking (${stay}${num?`, booking number: ${num}`:''}) is due soon.`,'',
   `Deposit: ${huf(amount)} HUF`,`Due by: ${due.date} ${due.time} (Hungarian time)`,'',
   'Your booking becomes final once the deposit has been received. If you have already paid, thank you – please disregard this message.','',
   'Kind regards,',brand],
  si:[name?`Spoštovani ${name},`:'Spoštovani gost,','',
   `radi bi vas spomnili, da se rok za plačilo predplačila za vašo rezervacijo (${stay}${num?`, številka rezervacije: ${num}`:''}) izteka.`,'',
   `Predplačilo: ${huf(amount)} HUF`,`Rok: ${due.date} ${due.time} (madžarski čas)`,'',
   'Rezervacija postane dokončna po prejemu predplačila. Če ste že plačali, se vam zahvaljujemo – to sporočilo prezrite.','',
   'Lep pozdrav,',brand]}[lang];
 return T.join('\n');
}

export function attestReminder({key,tenantId,caseId,expectedRevision,text,deadlineUtc,checkedAt}){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))fail('SETUP_REQUIRED');
 const fields=[REMINDER_SCOPE,tenantId,caseId,String(expectedRevision),sha(text),deadlineUtc,checkedAt];
 if(fields.some(v=>typeof v!=='string'||!v||/[\r\n]/.test(v)))fail('INVALID_EVIDENCE');
 return {scope:REMINDER_SCOPE,checkedAt,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(fields.join('\n')).digest('hex')};
}

// Prepare (save + approve) the reminder. Returns {saved, approved}. The DB re-checks window, once-only and attestation.
export async function prepareDepositReminder({record,attestationKey,transport,clock=()=>new Date().toISOString(),now=()=>Date.now()}={}){
 const data=record?.data,b=data?.booking;
 if(typeof transport!=='function')fail('SETUP_REQUIRED');
 if(b?.status!=='finalized')fail('NOT_FINALIZED');
 if(b?.depositReminder)fail('REMINDER_ALREADY_SENT');
 if(!reminderDue(b,now()))fail('REMINDER_NOT_DUE');
 const v=data?.state?.values||{};
 if(!String(v.email||'').trim()&&['chat','phone'].includes(data?.sourceReceipt?.provider))fail('NO_EMAIL');
 const ref=String(b.previo?.reference||'');
 const text=buildDepositReminder({values:v,booking:b,language:v.language,bookingNumber:/^V2-\d+$/.test(ref)?voucherFor({tenantId:record.tenantId,caseId:record.caseId}):null});
 const proof=attestReminder({key:attestationKey,tenantId:record.tenantId,caseId:record.caseId,expectedRevision:record.revision,text,deadlineUtc:b.deposit.deadlineUtc,checkedAt:clock()});
 const saved=await transport('/rest/v1/rpc/sc_tm_deposit_reminder',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:record.revision,p_draft:{text},p_proof:proof}});
 if(!saved)return {saved:null,approved:false};
 let approved=null;
 try{approved=await transport('/rest/v1/rpc/sc_tm_decide',{method:'POST',body:{p_tenant:record.tenantId,p_case:record.caseId,p_expected:Number(saved.revision),
  p_draft_hash:sha(text),p_decision:'approve',p_reason:null}});}catch{approved=null;}
 return {saved:approved||saved,approved:!!approved,text};
}
