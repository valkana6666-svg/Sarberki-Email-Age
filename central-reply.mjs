import {buildReplyDraft} from './sarberki-core.mjs';
import {SARBERKI_TENANT} from './tenant-config.mjs';
import {createReplyContext,renderReplyContext} from './shared-core/reply-context.mjs';
export function buildCentralReply(input,{tenant=SARBERKI_TENANT,records=[]}={}){
 return renderReplyContext(createReplyContext(tenant,input,records),buildReplyDraft);
}

// Optional service-aware preview; existing buildCentralReply callers remain unchanged.
import {classifyTubRequest,assessTubEligibility} from './shared-core/tub-request.mjs';
export function buildCentralServicePreview(input,options={}) {
 const draft=buildCentralReply(input,options);
 const request=classifyTubRequest(input?.original||'');
 if(request.kind!=='tub_request')return {draft,service:null};
 const eligibility=assessTubEligibility({unitNumber:input?.unitNumber,availability:input?.hotTubAvailability});
 return {draft,service:{...request,eligibility,requiresHumanReview:true,confirmationAllowed:false}};
}

// Service presentation only; no availability or approval decision.
export function tubServiceDraft(language='hu',linked=false,notAvailable=false,cancelled=false,actionConflict=false){
 if(actionConflict)return {hu:'A dézsaigényre vonatkozó szándék nem egyértelmű. Kérjük, pontosítsa: megtartaná vagy visszavonná az igényt? Emberi ellenőrzés szükséges; ez nem visszaigazolás.',de:'Ihre Absicht bezüglich der Badefass-Anfrage ist nicht eindeutig. Bitte klären Sie, ob Sie die Anfrage beibehalten oder zurücknehmen möchten. Eine manuelle Prüfung ist erforderlich; dies ist keine Bestätigung.',en:'Your intention regarding the hot-tub request needs clarification. Please confirm whether you want to keep or withdraw the request. Human review is required; this is not a confirmation.',si:'Vaš namen glede zahteve za masažno kad ni jasen. Prosimo, pojasnite, ali želite zahtevo ohraniti ali preklicati. Potreben je pregled osebja; to ni potrditev.'}[language]||'A dézsaigény szándéka nem egyértelmű; emberi ellenőrzés szükséges.';
 const words={
  hu:['Megkaptuk a külön bérelhető dézsára vonatkozó igénylést.','A kapcsolódó foglalási ügy azonosítása emberi ellenőrzést igényel; kérjük, pontosítsa a foglalás azonosítóját.','A kért szállásegységhez nincs dézsa. Más lehetőséget emberi egyeztetéssel ellenőrzünk.','A kért dátumot, kezdési időpontot és időtartamot, valamint az elérhetőséget külön ellenőrizzük. Ez még nem visszaigazolás.'],
  de:['Wir haben Ihre Anfrage für das separat mietbare Badefass erhalten.','Die zugehörige Buchung muss manuell geprüft werden. Bitte präzisieren Sie die Buchungsreferenz.','Zur angefragten Unterkunft gehört kein Badefass. Andere Möglichkeiten müssen manuell geprüft werden.','Datum, Beginn, Mietdauer und Verfügbarkeit werden separat geprüft. Dies ist noch keine Bestätigung.'],
  en:['We have received your request for the separately rented hot tub.','The related booking needs manual identification. Please clarify the booking reference.','The requested accommodation has no hot tub. Other options need manual review.','The requested date, start time, duration and availability will be checked separately. This is not a confirmation.'],
  si:['Prejeli smo vašo zahtevo za masažno kad, ki se najame posebej.','Povezano rezervacijo je treba ročno preveriti. Prosimo, pojasnite številko rezervacije.','Zahtevana nastanitev nima masažne kadi. Druge možnosti je treba ročno preveriti.','Zahtevani datum, začetek, trajanje in razpoložljivost bomo preverili posebej. To še ni potrditev.']
 };
 if(cancelled)return {hu:'A dézsaigény visszavonását rögzítettük ellenőrzésre. Emberi jóváhagyás szükséges.',de:'Die Rücknahme Ihrer Badefass-Anfrage wird manuell geprüft.',en:'Your hot-tub cancellation request needs human review.',si:'Preklic zahteve za masažno kad mora preveriti osebje.'}[language]||'Emberi ellenőrzés szükséges.';
 const w=words[language]||words.hu;return [w[0],!linked?w[1]:notAvailable?w[2]:w[3]].join('\n\n');
}
