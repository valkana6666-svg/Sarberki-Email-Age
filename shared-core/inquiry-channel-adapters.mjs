import {evaluateCentralInquiry} from './central-inquiry-decision.mjs';
import {buildCentralReply} from '../central-reply.mjs';
import {capacityOptionText,replyQuestions,stayCancellationFromText,replySummary,hotTubSentence,requestFlagsFromText,pierPreferenceFromText} from '../sarberki-core.mjs';
import {fishingQuestion} from '../fishing-rules.mjs';
import {SARBERKI_TENANT} from '../tenant-config.mjs';
const words={
 hu:{pending:'A kapacitás ellenőrzése még nem igazolt.',available:'A kért időszakra jelenleg van szabad helyünk ebben a háztípusban. A foglalás a visszaigazolásunkkal válik érvényessé.',unavailable:'A kért időszakra sajnos nincs elegendő szabad helyünk ebben a háztípusban.',review:'A megadott adatok pontosítása vagy emberi ellenőrzése szükséges.',date:'Kérjük, erősítse meg az érkezés és távozás évét.',units:'Hány szállásegységet szeretnének?',price:'Az ellenőrzött ár belső jóváhagyásra vár; ez még nem végleges ajánlat.'},
 de:{pending:'Die Verfügbarkeit ist noch nicht verifiziert.',available:'Für den gewünschten Zeitraum haben wir derzeit freie Plätze in diesem Haustyp. Die Buchung wird mit unserer Bestätigung verbindlich.',unavailable:'Für den gewünschten Zeitraum haben wir in diesem Haustyp leider nicht genügend freie Plätze.',review:'Die Angaben müssen präzisiert oder manuell geprüft werden.',date:'Bitte bestätigen Sie das Jahr der An- und Abreise.',units:'Wie viele Unterkunftseinheiten wünschen Sie?',price:'Der geprüfte Preis benötigt eine interne Freigabe und ist noch kein endgültiges Angebot.'},
 en:{pending:'Availability has not yet been verified.',available:'We currently have availability in this cabin type for the requested dates. The booking becomes valid with our confirmation.',unavailable:'Unfortunately, we do not have enough availability in this cabin type for the requested dates.',review:'The details need clarification or human review.',date:'Please confirm the year of arrival and departure.',units:'How many accommodation units would you like?',price:'The verified price is awaiting internal approval and is not a final offer.'},
 si:{pending:'Razpoložljivost še ni preverjena.',available:'Za želeni termin imamo trenutno proste kapacitete v tem tipu hiške. Rezervacija postane veljavna z našo potrditvijo.',unavailable:'Za želeni termin žal nimamo dovolj prostih kapacitet v tem tipu hiške.',review:'Podatke je treba pojasniti ali ročno preveriti.',date:'Prosimo, potrdite leto prihoda in odhoda.',units:'Koliko nastanitvenih enot želite?',price:'Preverjena cena čaka na interno odobritev in še ni končna ponudba.'}
};
// The status line written when every fact is known; the server price step puts the price in its place.
export const CAPACITY_PENDING_LINE=Object.freeze(Object.fromEntries(Object.entries(words).map(([k,v])=>[k,v.pending])));
// Previo-verified "free" status line (level 1): the price sentence goes right after it.
export const CAPACITY_AVAILABLE_LINE=Object.freeze(Object.fromEntries(Object.entries(words).map(([k,v])=>[k,v.available])));
const TOO_MANY={
 hu:(g,o)=>`A kért háztípusba ${g} fő nem fér el. `+(o?`Ennyi főnek ezek a házak felelnek meg: ${o.replace(/, ([^,]+)$/,' vagy $1')}. Kérjük, jelezze, melyik érdekelné.`:`${g} fő több ház együttes foglalásával helyezhető el; kérjük, jelezze, ha ez megfelel.`),
 de:(g,o)=>`Im gewünschten Haustyp finden ${g} Personen keinen Platz. `+(o?`Für diese Personenzahl eignen sich: ${o.replace(/, ([^,]+)$/,' oder $1')}. Bitte teilen Sie uns mit, was Sie interessiert.`:`${g} Personen können wir in mehreren Häusern zusammen unterbringen; bitte teilen Sie uns mit, ob das passt.`),
 en:(g,o)=>`The requested cabin type cannot accommodate ${g} guests. `+(o?`For this party size these cabins are suitable: ${o.replace(/, ([^,]+)$/,' or $1')}. Please let us know which one you prefer.`:`We can accommodate ${g} guests in several cabins booked together; please let us know if this suits you.`),
 si:(g,o)=>`V želeni tip hiške ${g} oseb ne more bivati. `+(o?`Za to število gostov so primerne: ${o.replace(/, ([^,]+)$/,' ali $1')}. Prosimo, sporočite, kaj vas zanima.`:`${g} oseb lahko namestimo v več hiškah skupaj; prosimo, sporočite, ali vam to ustreza.`)
};
const EXTRA_BED={hu:'Öt fő esetén az ötödik fő pótágyon alszik.',de:'Bei fünf Personen schläft die fünfte Person auf einem Zusatzbett.',
 en:'With five guests, the fifth guest sleeps on an extra bed.',si:'Pri petih osebah peta oseba spi na dodatnem ležišču.'};
// Owner 2026-11-12: C is upstairs, reached by a spiral staircase, with its own terrace. Said when C is in play
// (named C, a C count, or a split request of 3+ guests without A/B) AND a small child (0-5), a baby or an older guest
// comes, so nobody is surprised on arrival.
const UPPER_FLOOR={hu:'A C apartman az emeleten van, csigalépcsőn közelíthető meg, saját terasszal.',de:'Das Apartment C liegt im Obergeschoss, ist über eine Wendeltreppe erreichbar und hat eine eigene Terrasse.',
 en:'Apartment C is upstairs, reached by a spiral staircase, and has its own terrace.',si:'Apartma C je v nadstropju, dostopen po zavitih stopnicah, in ima svojo teraso.'};
const OLDER_GUEST=/(?<!\p{L})(?:idős\p{L}*|idos\p{L}*|nagymam\p{L}*|nagypap\p{L}*|nagyszül\p{L}*|nyugdíjas\p{L}*|mozgáskorlátozott\p{L}*|kerekesszék\p{L}*|elderly|senior\p{L}*|grandparents?|grandma|grandpa|wheelchair|großeltern|grosseltern|oma|opa|rollstuhl|starejš\p{L}*|babic\p{L}*|dedek|invalidsk\p{L}*)(?!\p{L})/iu;
function upperFloorNote(decision,language){
 const input=decision.capacity.input,f=decision.facts,p=input?.placement;
 if(!input?.cabin?.startsWith?.('split'))return '';
 const cInPlay=input.cabin==='splitC'||p?.c>0||(input.cabin==='split'&&!(p?.ab>0)&&Number(f.guests)>=3);
 const small=(f.child_ages||[]).some(a=>Number.isInteger(a)&&a<=5);
 return cInPlay&&(small||OLDER_GUEST.test(String(f.originalText||'')))?' '+(UPPER_FLOOR[language]||UPPER_FLOOR.hu):'';
}
// Either the open questions of the shared decision, or (when nothing is missing) one status line.
function centralConversationParts(decision,language){
 const f=decision.facts,m=new Set(decision.missing),t=words[language]||words.hu;
 const questions=replyQuestions(language,{needDates:m.has('dates'),needAdults:m.has('adults'),needChildStatus:m.has('children_status'),needChildAge:m.has('child_ages'),needCabin:m.has('accommodation'),guests:f.guests});
 if(m.has('dates_confirmation'))questions.push(t.date);
 if(m.has('units_requested'))questions.push(t.units);
 if(questions.length)return {questions,status:null};
 if(decision.requiresHumanReview&&decision.contradictions.length)return {questions:[],status:t.review};
 // The requested type cannot hold the party (sweep 2026-11-12): say so and name the types that fit; never the
 // internal "not verified" line. Several houses only as a question (no multi-unit assumption).
 if(decision.capacity.incompatible){const g=Number(f.guests),o=capacityOptionText(g,language);
  return {questions:[],status:(TOO_MANY[language]||TOO_MANY.hu)(g,o)};}
 const status=decision.capacity.status==='AVAILABLE'?t.available:decision.capacity.status==='UNAVAILABLE'?t.unavailable:t.pending;
 // Five guests in a split house: the fifth sleeps on an extra bed (AGENTS); no surcharge is stated.
 const split=decision.capacity.input?.cabin?.startsWith?.('split')&&Number(f.guests)===5?' '+(EXTRA_BED[language]||EXTRA_BED.hu):'';
 return {questions:[],status:status+split+upperFloorNote(decision,language)+(decision.pricing.verified?' '+t.price:'')};
}
export function renderCentralConversation(decision,{language=decision.facts.language}={}){
 const {questions,status}=centralConversationParts(decision,language);
 return questions.length?questions.join('\n'):status;
}
export function buildChatInquiryReply(options={}){
 const decision=evaluateCentralInquiry(options);
 const original=options.message||decision.facts.originalText||'';
 return {decision,text:renderEmailDecision(decision,original,decision.facts.language),operatorReviewText:renderEmailDecision(decision,original,'hu'),operatorReviewLanguage:'hu',channel:'chat',requiresApproval:true};
}
function renderEmailDecision(decision,original,language){
 const f=decision.facts;
 // An explicit stay cancellation gets the existing approved acknowledgement, not booking questions.
 // The decision, facts and safety flags are unchanged; a human still reviews before anything is sent.
 if(stayCancellationFromText(original))return buildCentralReply({language,original,intent:'cancellation_request'});
 // Verified Sárberki fishing knowledge (tickets, rules) is part of the same letter in every channel.
 const fishing=fishingQuestion(original,language);
 const knowledge=fishing&&fishing.kind!=='review'?[{tenantId:SARBERKI_TENANT.id,caseId:'inquiry-draft',kind:'knowledge',lines:[fishing.answer],approved:true,source:fishing.source}]:[];
 const draft=buildCentralReply({caseId:'inquiry-draft',language,original,arrival:f.dates?.arrival,departure:f.dates?.departure,guests:f.guests,adults:f.adults,children:f.children,childAges:f.child_ages,phone:f.phone,cabin:f.cabin},{records:knowledge});
 // Existing email renderer remains the presentation layer. The shared decision
 // and its current safety status are returned alongside the pending draft.
 const parts=centralConversationParts(decision,language);
 let additions=parts.questions.filter(line=>line&&!draft.includes(line));
 // When the draft already asks the guest to choose among the capacity-suitable offered types, the
 // generic "VIP, Családi, Deluxe or Osztott?" question would re-offer unsuitable types.
 if(OFFERED_CHOICE.some(text=>draft.includes(text))){
  const generic=new Set([...replyQuestions(language,{needCabin:true}),...replyQuestions(language,{needCabin:true,guests:2})]);
  additions=additions.filter(line=>!generic.has(line));
 }
 const withQuestions=placeAdditions(draft,additions,language);
 // A verified Previo answer (Level 1) takes the place of "we will confirm availability separately" in the
 // accommodation section, so the letter never says both; otherwise the status goes before the closing as before.
 // Without a chosen cabin type the "in this cabin type" sentence would make no sense: the letter keeps asking
 // for the type (short reply), exactly as before Level 1.
 const verified=['AVAILABLE','UNAVAILABLE'].includes(decision.capacity?.status)||decision.capacity?.incompatible===true; // "nem fér el" goes in the stay section too
 const status=verified&&!decision.capacity?.input?.cabin?null:parts.status;
 const full=!status||draft.includes(status)?withQuestions
  :verified&&replacePlaceholder(withQuestions,status,language)||placeStatus(withQuestions,status,language);
 return shortMissingDetailsReply(full,language,decision)||shortDatedReply(full,language,decision,original)||full;
}
// Owner decision 2026-11-04: when the dates are still missing and the letter holds nothing but the
// standard placeholders and questions, send a short, direct request for the missing details instead
// of the full sectioned letter. Any other content (pets, fishing, terms, extras, capacity notes,
// unknown questions) keeps the full letter, so no answer is ever dropped.
const SHORT={
 hu:{intro:'Köszönjük érdeklődését. Hogy pontos ajánlatot és árat tudjunk küldeni, kérjük, írja meg:',outro:'Ezek alapján ellenőrizzük a szabad helyet, és küldjük az ajánlatot.',
  dates:'a pontos érkezési és távozási dátumot',people:'hány felnőtt és hány gyermek érkezik (gyermeknél az életkort is)',ages:'a gyermek(ek) életkorát',
  cabin:'melyik háztípust választaná: VIP, Családi, Deluxe vagy Osztott',cabinTwo:'melyik háztípust választaná: VIP, Családi, Deluxe, Osztott vagy Különálló 2 fős',phone:'egy telefonszámot, amelyen elérhetjük'},
 de:{intro:'Vielen Dank für Ihre Anfrage. Damit wir Ihnen ein genaues Angebot mit Preis senden können, teilen Sie uns bitte mit:',outro:'Auf dieser Grundlage prüfen wir die freien Plätze und senden Ihnen das Angebot.',
  dates:'das genaue An- und Abreisedatum',people:'wie viele Erwachsene und Kinder anreisen (bei Kindern bitte das Alter)',ages:'das Alter der Kinder',
  cabin:'welchen Haustyp Sie wählen: VIP, Familienhaus, Deluxe oder geteiltes Haus',cabinTwo:'welchen Haustyp Sie wählen: VIP, Familienhaus, Deluxe, geteiltes Haus oder freistehende Hütte für 2 Personen',phone:'eine Telefonnummer, unter der wir Sie erreichen können'},
 en:{intro:'Thank you for your enquiry. So that we can send you an exact offer and price, please let us know:',outro:'We will then check availability and send you our offer.',
  dates:'your exact arrival and departure dates',people:'how many adults and children will be staying (with the children’s ages)',ages:'the children’s ages',
  cabin:'which cabin type you would like: VIP, Family cabin, Deluxe or Split cabin',cabinTwo:'which cabin type you would like: VIP, Family cabin, Deluxe, Split cabin or the standalone 2-person cabin',phone:'a phone number where we can reach you'},
 si:{intro:'Hvala za vaše povpraševanje. Da vam lahko pošljemo natančno ponudbo in ceno, nam prosimo sporočite:',outro:'Nato preverimo razpoložljivost in vam pošljemo ponudbo.',
  dates:'točen datum prihoda in odhoda',people:'koliko odraslih in otrok bo prišlo (pri otrocih tudi starost)',ages:'starost otrok',
  cabin:'kateri tip hiške želite: VIP, Družinska hiška, Deluxe ali Deljena hiška',cabinTwo:'kateri tip hiške želite: VIP, Družinska hiška, Deluxe, Deljena hiška ali samostojna hiška za 2 osebi',phone:'telefonsko številko, na kateri vas lahko dosežemo'}
};
const SECTION={hu:['Szállás','Ár és díjak','Az ajánlathoz még szükségünk van','Foglalás állapota'],de:['Unterkunft','Preis und Gebühren','Noch benötigte Angaben','Reservierungsstatus'],
 en:['Accommodation','Price and charges','Details still needed','Booking status'],si:['Nastanitev','Cena in doplačila','Podatki za dopolnitev','Status rezervacije']};
const PLACEHOLDER={
 hu:['A kért faház elérhetőségét külön visszaigazoljuk.','Az elérhetőséget külön ellenőrizzük és visszaigazoljuk.','A teljes árat a ténylegesen szabad lehetőség alapján adjuk meg.','Ez az érdeklődés még nem visszaigazolt foglalás. A szükséges adatok és a választott faház egyeztetése, valamint az aktuális elérhetőség ellenőrzése után tudjuk a foglalást visszaigazolni.'],
 de:['Wir bestätigen die Verfügbarkeit des gewünschten Hauses gesondert.','Die Verfügbarkeit prüfen und bestätigen wir gesondert.','Den Gesamtpreis nennen wir anhand der tatsächlich verfügbaren Möglichkeit.','Diese Anfrage ist noch keine bestätigte Buchung. Erst nach Klärung der erforderlichen Angaben und des gewählten Hauses sowie erneuter Verfügbarkeitsprüfung können wir die Buchung bestätigen.'],
 en:['We will confirm availability of your requested cabin separately.','We will check and confirm availability separately.','We will quote the total price for the option that is actually available.','This enquiry is not a confirmed booking. We can confirm a booking only after clarifying the required details and selected cabin and rechecking availability.'],
 si:['Razpoložljivost želene hiške bomo potrdili posebej.','Razpoložljivost bomo preverili in potrdili posebej.','Skupno ceno navedemo za možnost, ki je dejansko na voljo.','To povpraševanje še ni potrjena rezervacija. Rezervacijo lahko potrdimo šele po uskladitvi potrebnih podatkov in izbrane hiške ter ponovnem preverjanju razpoložljivosti.']
};

// Short answers kept in the short letter (owner 2026-11-04/05): the fishing block, the pet fee and the
// hot-tub sentence. They are lifted out of their sections and shown as one paragraph.
const ANSWER_SECTION={hu:{fishing:'Horgászat',extras:'Kiegészítő információk',booking:'Foglalási feltételek'},de:{fishing:'Angeln',extras:'Weitere Informationen',booking:'Buchungsbedingungen'},
 en:{fishing:'Fishing',extras:'Additional information',booking:'Booking terms'},si:{fishing:'Ribolov',extras:'Dodatne informacije',booking:'Pogoji rezervacije'}};
// Owner-approved one-line answers (2026-11-05) that the short letter keeps.
const KEPT_EXTRA=/^(?:Minden faházhoz saját stég|Zu jedem Haus gehört ein eigener Steg|Every cabin has its own pier|Vsaka hiška ima svoj pomol|A szomszédos elhelyezést külön ellenőrizzük\.|Eine Unterbringung nebeneinander prüfen wir gesondert\.|We will check separately whether adjacent cabins are possible\.|Sosednjo namestitev preverimo posebej\.)/u;
const PET_LINE=/^(?:Háziállat hozható, díja |Haustiere sind erlaubt; die Gebühr beträgt |Pets are allowed; the fee is |Hišni ljubljenčki so dovoljeni; pristojbina znaša )/u;
function liftAnswers(bodyLines,language){
 const sec=ANSWER_SECTION[language],answers=[],rest=[];let current=null;
 for(const raw of bodyLines){
  const line=raw.trim();
  if(line===sec.fishing||line===sec.extras||line===sec.booking){current=line;continue;}
  if(!line){current=null;rest.push(raw);continue;}
  // Owner 2026-11-05: each answer is its own paragraph; the fishing ticket block stays together.
  if(current===sec.fishing){if(answers.at(-1)?.fishing)answers.at(-1).lines.push(line);else answers.push({fishing:true,lines:[line]});continue;}
  if(current===sec.booking){answers.push({lines:[line]});continue;}
  if(current===sec.extras&&(PET_LINE.test(line)||KEPT_EXTRA.test(line)||line===hotTubSentence(language))){answers.push({lines:[line]});continue;}
  rest.push(raw);
 }
 return {answers:answers.map(a=>a.lines.join('\n')),rest};
}
function shortMissingDetailsReply(full,language,decision){
 const lang=SHORT[language]?language:null;
 if(!lang||!decision.missing.includes('dates'))return null;
 const t=SHORT[lang],w=words[lang];
 const q=flag=>replyQuestions(lang,flag)[0];
 const keyOf=new Map([[q({needDates:true}),'dates'],[q({needAdults:true}),'people'],[q({needChildStatus:true}),'people'],[q({needChildAge:true}),'ages'],
  [q({needPhone:true}),'phone'],[q({needCabin:true}),'cabin'],[q({needCabin:true,guests:2}),'cabinTwo']]);
 const lines=full.split('\n'),closingAt=lines.indexOf(CLOSING[lang]);
 if(closingAt<2)return null;
 const greeting=lines[0],closing=lines.slice(closingAt);
 const allowed=new Set([...SECTION[lang],...PLACEHOLDER[lang],w.pending,w.review]);
 const wanted=new Set();
 const lifted=liftAnswers(lines.slice(1,closingAt),lang);
 for(const line of lifted.rest.map(l=>l.trim()).filter(Boolean)){
  if(line===replyIntro(lang)||allowed.has(line))continue;
  const key=keyOf.get(line);
  if(!key)return null;
  wanted.add(key);
 }
 if(!wanted.has('dates'))return null;
 if(wanted.has('people'))wanted.delete('ages');
 if(wanted.has('cabinTwo'))wanted.delete('cabin');
 const items=['dates','people','ages','cabin','cabinTwo','phone'].filter(k=>wanted.has(k)).map(k=>t[k]);
 const list=items.map((item,i)=>'– '+item+(i===items.length-1?'.':','));
 return [greeting,'',...(lifted.answers.length?[lifted.answers.join('\n\n'),'']:[]),t.intro,...list,'',t.outro,'',...closing].join('\n');
}
const replyIntro=lang=>({hu:'Köszönjük érdeklődését.',de:'Vielen Dank für Ihre Anfrage.',en:'Thank you for your enquiry.',si:'Hvala za vaše povpraševanje.'})[lang];
const OFFERED_CHOICE=['melyik felajánlott faháztípust választja','welchen der angebotenen Haustypen','which of the offered cabin types','katero od ponujenih vrst hišk'];
const MISSING_TITLE={hu:'Az ajánlathoz még szükségünk van',de:'Noch benötigte Angaben',en:'Details still needed',si:'Podatki za dopolnitev'};
const STATUS_TITLE={hu:'Foglalás állapota',de:'Reservierungsstatus',en:'Booking status',si:'Status rezervacije'};
const CLOSING={hu:'Üdvözlettel:',de:'Mit freundlichen Grüßen',en:'Kind regards,',si:'Lep pozdrav'};
// A status sentence is its own paragraph directly before the closing, never after the signature.
const CABIN_LINE=/^(?:A kért háztípus: |Gewünschter Haustyp: |Requested cabin type: |Želeni tip hiške: )/;
function replacePlaceholder(draft,status,language){
 const lines=draft.split('\n'),ph=PLACEHOLDER[PLACEHOLDER[language]?language:'hu'];
 const at=lines.findIndex(line=>line.trim()===ph[0]||line.trim()===ph[1]);
 if(at>=0){lines[at]=status;return lines.join('\n');}
 // No placeholder: directly after the requested cabin type line, still inside the accommodation section.
 const cabinAt=lines.findIndex(line=>CABIN_LINE.test(line.trim()));
 if(cabinAt<0)return null;
 lines.splice(cabinAt+1,0,status);return lines.join('\n');
}
function placeStatus(draft,status,language){
 const lines=draft.split('\n'),at=lines.indexOf(CLOSING[MISSING_TITLE[language]?language:'hu']);
 if(at<0)return draft+'\n\n'+status;
 lines.splice(at,0,status,'');return lines.join('\n');
}
// Extra questions belong inside the letter: in the "still needed" section, otherwise as their own
// section before the booking status or the closing. Never after the signature.
function placeAdditions(draft,additions,language){
 if(!additions.length)return draft;
 const lang=MISSING_TITLE[language]?language:'hu',lines=draft.split('\n');
 const missingAt=lines.indexOf(MISSING_TITLE[lang]);
 if(missingAt>=0){
  let end=missingAt+1;while(end<lines.length&&lines[end]!=='')end++;
  lines.splice(end,0,...additions);return lines.join('\n');
 }
 let at=lines.indexOf(STATUS_TITLE[lang]);
 if(at<0)at=lines.indexOf(CLOSING[lang]);
 if(at<0)return draft+'\n\n'+additions.join('\n');
 lines.splice(at,0,MISSING_TITLE[lang],...additions,'');return lines.join('\n');
}
// Operator-only (never in the guest text): a split is an alternative only after the whole houses are
// verified unavailable for the dates (owner, 2026-11-03; AGENTS.md).
function splitAlternativeNote(decision){
 const facts=decision.facts,guests=Number(facts?.guests),requested=decision.capacity?.input?.cabin;
 // facts.split_request_text falls back to the whole message, so the capacity input is the split signal.
 if(!Number.isInteger(guests)||guests<5||guests>8||facts.cabin||String(requested||'').startsWith('split'))return '';
 return '\n\nKezelői megjegyzés (a vendég nem látja): ha a kért időszakra nincs szabad egész ház, osztott elhelyezés ajánlható ('+(guests<=6?'A+C vagy B+C':'A+B+C')+') – a vendégnek csak igazolt foglalhatatlanság után.';
}
export function buildEmailInquiryDraft(options={}){
 const decision=evaluateCentralInquiry(options),original=options.message||decision.facts.originalText||'';
 return {decision,text:renderEmailDecision(decision,original,decision.facts.language),operatorReviewText:renderEmailDecision(decision,original,'hu')+splitAlternativeNote(decision),operatorReviewLanguage:'hu',channel:'email',requiresApproval:true};
}

// Owner decision 2026-11-04 ("röviden, tömören"): with known dates, a standard enquiry becomes one
// short paragraph (dates and party, suitable types or the several-cabin note) and a bulleted list of
// what is still needed. Only recognised standard lines are rewritten; anything else keeps the full letter.
const DATED={
 hu:{options:o=>`Önöknek ezek a házak jöhetnek szóba: ${o}.`,or:' vagy ',large:n=>`${n} fő egy házban nem fér el, de több ház együttes foglalásával el tudjuk helyezni Önöket.`,
  ask:'Kérjük, írja meg:',choice:'melyik háztípust választja',multi:'megfelel-e a több házas elhelyezés',outroPrice:'Ezután ellenőrizzük a szabad helyet, és küldjük az ajánlatot árral.',
  optionsRe:/^A megadott létszám alapján ezek az elhelyezések jöhetnek szóba: (.+)\. A ténylegesen szabad lehetőségeket a kért időszakra ellenőrizzük\.$/u,largeRe:/^(\d+) fő egy házban nem fér el; /u},
 de:{options:o=>`Für Sie kommen diese Häuser infrage: ${o}.`,or:' oder ',large:n=>`${n} Personen passen nicht in ein Haus, wir können Sie aber in mehreren Häusern zusammen unterbringen.`,
  ask:'Bitte teilen Sie uns mit:',choice:'welchen Haustyp Sie wählen',multi:'ob Ihnen die Unterbringung in mehreren Häusern passt',outroPrice:'Danach prüfen wir die Verfügbarkeit und senden Ihnen das Angebot mit Preis.',
  optionsRe:/^Für die angegebene Personenzahl kommen folgende Unterkünfte infrage: (.+)\. Die tatsächlich freien Möglichkeiten prüfen wir für den gewünschten Zeitraum\.$/u,largeRe:/^(\d+) Personen passen nicht in ein Haus; /u},
 en:{options:o=>`These cabins can suit you: ${o}.`,or:' or ',large:n=>`${n} guests cannot stay in one cabin, but we can accommodate you in several cabins booked together.`,
  ask:'Please let us know:',choice:'which cabin type you choose',multi:'whether accommodation in several cabins suits you',outroPrice:'We will then check availability and send you our offer with the price.',
  optionsRe:/^For the stated party size, these accommodation options can work: (.+)\. We will check which of them are actually available for the requested dates\.$/u,largeRe:/^(\d+) guests cannot stay in a single cabin; /u},
 si:{options:o=>`Za vas pridejo v poštev te hiške: ${o}.`,or:' ali ',large:n=>`${n} oseb ne more bivati v eni hiški, lahko pa vas namestimo v več hiškah skupaj.`,
  ask:'Prosimo, sporočite nam:',choice:'katero vrsto hiške izberete',multi:'ali vam ustreza namestitev v več hiškah',outroPrice:'Nato preverimo razpoložljivost in vam pošljemo ponudbo s ceno.',
  optionsRe:/^Za navedeno število gostov pridejo v poštev naslednje možnosti: (.+)\. Za izbrani termin preverimo, katere so dejansko proste\.$/u,largeRe:/^(\d+) oseb ne more bivati v eni hiški; /u}
};
function shortDatedReply(full,language,decision,original=''){
 const d=DATED[language],t=SHORT[language];
 const f=decision.facts;
 if(!d||!f.dates?.arrival||!f.dates?.departure||decision.missing.includes('dates')||decision.missing.includes('dates_confirmation'))return null;
 const flags=requestFlagsFromText(original);
 const summary=replySummary(language,{arrival:f.dates.arrival,departure:f.dates.departure,guests:f.guests,adults:f.adults,children:f.children,childAges:f.child_ages||[],dog:flags.petRequested,hotTub:flags.hotTubRequested,pier:pierPreferenceFromText(original)});
 if(!summary)return null;
 const q=flag=>replyQuestions(language,flag)[0];
 const keyOf=new Map([[q({needAdults:true}),'people'],[q({needChildStatus:true}),'people'],[q({needChildAge:true}),'ages'],
  [q({needPhone:true}),'phone'],[q({needCabin:true}),'cabin'],[q({needCabin:true,guests:2}),'cabinTwo']]);
 const lines=full.split('\n'),closingAt=lines.indexOf(CLOSING[language]);
 if(closingAt<2)return null;
 const allowed=new Set([...SECTION[language],...PLACEHOLDER[language],words[language].pending,replyIntro(language)]);
 let options=null,large=null,sawSummary=false;const wanted=new Set();
 const lifted=liftAnswers(lines.slice(1,closingAt),language);
 for(const line of lifted.rest.map(l=>l.trim()).filter(Boolean)){
  if(allowed.has(line))continue;
  if(line===summary){sawSummary=true;continue;}
  const o=d.optionsRe.exec(line);if(o){options=o[1];continue;}
  const g=d.largeRe.exec(line);if(g){large=Number(g[1]);continue;}
  if(OFFERED_CHOICE.some(text=>line.includes(text))){wanted.add('choice');continue;}
  const key=keyOf.get(line);if(!key)return null;
  wanted.add(key);
 }
 if(!sawSummary||options&&large)return null;
 if(large)wanted.add('multi');
 if(wanted.has('people'))wanted.delete('ages');
 if(wanted.has('cabinTwo'))wanted.delete('cabin');
 if(wanted.has('choice')){wanted.delete('cabin');wanted.delete('cabinTwo');}
 const label=k=>({choice:d.choice,multi:d.multi})[k]||t[k];
 const items=['multi','choice','cabin','cabinTwo','people','ages','phone'].filter(k=>wanted.has(k)).map(label);
 if(!items.length)return null;
 const optionText=options?options.replace(/, (?=[^,]*$)/u,d.or):null;
 const head=[replyIntro(language),summary,optionText?d.options(optionText):'',large?d.large(large):''].filter(Boolean).join(' ');
 const list=items.map((item,i)=>'– '+item+(i===items.length-1?'.':','));
 return [lines[0],'',head,'',...(lifted.answers.length?[lifted.answers.join('\n\n'),'']:[]),d.ask,...list,'',options?d.outroPrice:t.outro,'',...lines.slice(closingAt)].join('\n');
}
