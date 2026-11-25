// Owner 2026-11-25 („vágj bele”): speech-to-text writes numbers as people SAY them. Before the shared engine, the
// voice channel rewrites spoken numbers into the written forms the engine already understands – Hungarian, German,
// English, Slovene. Only date-like forms (with a date suffix / ordinal near a month or a range word), a count before
// adults / children / persons / nights, spoken years and "a week" stays are rewritten; any other word stays as is.
// Voice only: chat and e-mail never pass through here.

// ---------- Hungarian ----------
const HU_UNITS={egy:1,kettő:2,ketto:2,két:2,ket:2,három:3,harom:3,négy:4,negy:4,öt:5,ot:5,hat:6,hét:7,het:7,nyolc:8,kilenc:9};
const HU_ORD={elsej:1,első:1,elso:1,második:2,masodik:2,harmadik:3,negyedik:4,ötödik:5,otodik:5,hatodik:6,hetedik:7,nyolcadik:8,kilencedik:9,tizedik:10,huszadik:20,harmincadik:30,egyedik:1,kettedik:2};
function huNumber(word){
 const w=word.toLocaleLowerCase('hu-HU');
 if(HU_ORD[w]!==undefined)return HU_ORD[w];
 if(w==='tíz'||w==='tiz')return 10;if(w==='húsz'||w==='husz')return 20;if(w==='harminc')return 30;
 for(const [t,v] of [['tizen',10],['huszon',20],['harminc',30]])if(w.startsWith(t)){const rest=w.slice(t.length);if(!rest)return null;const u=HU_UNITS[rest]??HU_ORD[rest];return u!==undefined&&u<10?v+u:null;}
 return HU_UNITS[w]??null;
}
const HU_STEM='(elsej|első|elso|második|masodik|harmadik|negyedik|ötödik|otodik|hatodik|hetedik|nyolcadik|kilencedik|tizedik|huszadik|harmincadik|(?:tizen|huszon|harminc)(?:egyedik|kettedik|harmadik|negyedik|ötödik|otodik|hatodik|hetedik|nyolcadik|kilencedik|egy|kettő|ketto|két|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc|kilenc)|tíz|tiz|húsz|husz|harminc|egy|kettő|ketto|két|három|harom|négy|negy|öt|ot|hat|hét|het|nyolc|kilenc)';
export function normalizeSpokenHu(text){
 let t=String(text||'');
 t=t.replace(/kétezer[\s-]*(\d{1,2})(?!\d)/giu,(m,n)=>String(2000+Number(n)));
 t=t.replace(new RegExp('kétezer[\\s-]*'+HU_STEM+'(?!\\p{L})','giu'),(m,w)=>{const n=huNumber(w);return n!==null?String(2000+n):m;});
 t=t.replace(new RegExp('(?<!\\p{L})'+HU_STEM+'(?:ik[aáeé]|ej[eé]|[aáeé])?(t[óo]l|t[őo]l|ig|[aáeé]n)(?!\\p{L})','giu'),(m,w,suf)=>{const n=huNumber(w.replace(/(?:ik[aáeé]|ej[eé])$/u,''));return n!==null&&n>=1&&n<=31?`${n}-${suf}`:m;});
 t=t.replace(/(?<![\d.])(\d{1,2})\s?(t[óo]l|t[őo]l|ig)(?!\p{L})/giu,'$1-$2');
 t=t.replace(new RegExp('(?<!\\p{L})'+HU_STEM+'(?=\\s+(?:felnőtt|felnott|gyerek|gyermek|fő|fo(?!\\p{L})|éjszak|ejszak|éjjel))','giu'),(m,w)=>{const n=huNumber(w);return n!==null?String(n):m;});
 // children's ages: „ötéves”, „öt és nyolc évesek”
 t=t.replace(new RegExp('(?<!\\p{L})'+HU_STEM+'(?=\\s*(?:éves|eves))','giu'),(m,w)=>{const n=huNumber(w);return n!==null&&n<=18?String(n)+' ':m;});
 t=t.replace(new RegExp('(?<!\\p{L})'+HU_STEM+'(?=\\s+(?:és|es|meg)\\s+\\d{1,2}\\s*(?:éves|eves))','giu'),(m,w)=>{const n=huNumber(w);return n!==null&&n<=18?String(n):m;});
 t=t.replace(/(\d{1,2})\s+(éves|eves)/giu,'$1 $2');
 // „egy hétre” = 7 nights (not „egy hét múlva”)
 t=t.replace(/(?<!\p{L})egy\s+hétre(?!\p{L})/giu,'7 éjszakára').replace(/(?<!\p{L})két\s+hétre(?!\p{L})/giu,'14 éjszakára');
 // fillers
 t=t.replace(/(?<!\p{L})(?:öö+|ööö*|hmm+|ömm+)(?!\p{L})[,.]?\s*/giu,'');
 return t;
}

// ---------- English ----------
const EN_CARD={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30};
const EN_ORD={first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,eleventh:11,twelfth:12,thirteenth:13,fourteenth:14,fifteenth:15,sixteenth:16,seventeenth:17,eighteenth:18,nineteenth:19,twentieth:20,thirtieth:30};
const EN_MONTH='(?:january|february|march|april|may|june|july|august|september|october|november|december)';
function enNumber(phrase,ordinal){
 const w=phrase.toLowerCase().replace(/-/g,' ').trim().split(/\s+/);
 if(w.length===1)return (ordinal?EN_ORD:EN_CARD)[w[0]]??null;
 if(w.length===2&&(w[0]==='twenty'||w[0]==='thirty')){const u=(ordinal?EN_ORD:EN_CARD)[w[1]];return u&&u<10?EN_CARD[w[0]]+u:null;}
 return null;
}
const EN_ORD_RE='((?:twenty|thirty)[\\s-](?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth)';
const EN_CARD_RE='((?:twenty|thirty)[\\s-](?:one|two|three|four|five|six|seven|eight|nine)|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)';
export function normalizeSpokenEn(text){
 let t=String(text||'');
 t=t.replace(/\b(?:twenty|two\s+thousand(?:\s+and)?)\s+twenty[\s-](six|seven|eight)\b/giu,(m,u)=>String(2020+EN_CARD[u.toLowerCase()]));
 // "June tenth", "the tenth of June", "to the thirteenth", "June 10th to 13th"
 t=t.replace(new RegExp(`\\b(${EN_MONTH})\\s+(?:the\\s+)?${EN_ORD_RE}\\b`,'giu'),(m,mon,o)=>{const n=enNumber(o,true);return n?`${mon} ${n}`:m;});
 t=t.replace(new RegExp(`\\b(?:the\\s+)?${EN_ORD_RE}\\s+of\\s+(${EN_MONTH})\\b`,'giu'),(m,o,mon)=>{const n=enNumber(o,true);return n?`${n} ${mon}`:m;});
 t=t.replace(new RegExp(`\\b(to|until|till|through|-)\\s+(?:the\\s+)?${EN_ORD_RE}\\b`,'giu'),(m,w,o)=>{const n=enNumber(o,true);return n?`${w} ${n}`:m;});
 t=t.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/giu,'$1');
 t=t.replace(new RegExp(`\\b${EN_CARD_RE}(?=\\s+(?:adults?|kids?|children|child|people|persons|guests|nights?))`,'giu'),(m,c)=>{const n=enNumber(c,false);return n?String(n):m;});
 // ages: "a five year old and an eight year old", "five and eight years old", "aged five and eight"
 t=t.replace(new RegExp(`\\b${EN_CARD_RE}(?=[\\s-]+(?:and\\s+(?:an?\\s+)?\\d{1,2}[\\s-]+)?years?[\\s-]+olds?\\b|[\\s-]+and\\s+(?:an?\\s+)?(?:\\d{1,2}|${EN_CARD_RE})[\\s-]+years?[\\s-]+olds?\\b)`,'giu'),(m,c)=>{const n=enNumber(c,false);return n&&n<=18?String(n):m;});
 t=t.replace(new RegExp(`(\\b(?:aged|ages)\\s+)${EN_CARD_RE}(?:\\s+and\\s+${EN_CARD_RE})?`,'giu'),(m,pre,a1,a2)=>{const x=enNumber(a1,false),y=a2?enNumber(a2,false):null;return x?pre+x+(y?' and '+y:''):m;});
 t=t.replace(/\bfor\s+a\s+week\b/giu,'for 7 nights').replace(/\bfor\s+two\s+weeks\b/giu,'for 14 nights');
 t=t.replace(/\b(?:uh+|um+|erm+)\b[,.]?\s*/giu,'');
 return t;
}

// ---------- German ----------
const DE_UNIT={ein:1,eins:1,zwei:2,drei:3,vier:4,fünf:5,fuenf:5,sechs:6,sieben:7,acht:8,neun:9};
const DE_BASE={zehn:10,elf:11,zwölf:12,zwoelf:12,dreizehn:13,vierzehn:14,fünfzehn:15,fuenfzehn:15,sechzehn:16,siebzehn:17,achtzehn:18,neunzehn:19,zwanzig:20,dreißig:30,dreissig:30};
function deCardinal(w){
 w=w.toLowerCase();
 if(DE_UNIT[w]!==undefined)return DE_UNIT[w];if(DE_BASE[w]!==undefined)return DE_BASE[w];
 const m=/^(ein|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun)und(zwanzig|dreißig|dreissig)$/.exec(w);return m?DE_UNIT[m[1]]+DE_BASE[m[2]]:null;
}
// ordinal stem: erst→1, zweit→2, dritt→3, viert, fünft, sechst, siebt, acht, neunt, zehnt … zwanzigst, einundzwanzigst …
function deOrdinal(w){
 w=w.toLowerCase().replace(/(?:en|er|e|em|es)$/,'');
 const special={erst:1,dritt:3,siebt:7,acht:8};if(special[w])return special[w];
 return deCardinal(w.replace(/st$/,''))??deCardinal(w.replace(/t$/,''));
}
const DE_MONTH='(?:januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)';
const DE_ORD_RE='((?:(?:ein|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun)und)?(?:zwanzigst|dreißigst|dreissigst)(?:en|er|e)|(?:erst|zweit|dritt|viert|fünft|fuenft|sechst|siebt|acht|neunt|zehnt|elft|zwölft|zwoelft|dreizehnt|vierzehnt|fünfzehnt|fuenfzehnt|sechzehnt|siebzehnt|achtzehnt|neunzehnt)(?:en|er|e))';
export function normalizeSpokenDe(text){
 let t=String(text||'');
 t=t.replace(/zweitausend(?:und)?\s*(sechs|sieben|acht)undzwanzig/giu,(m,u)=>String(2020+DE_UNIT[u.toLowerCase()]));
 t=t.replace(/zweitausend\s+(\d{2})\b/giu,(m,n)=>String(2000+Number(n)));
 // ordinal day words near a month or a range word: "vom zehnten bis dreizehnten Juni", "am ersten Juli"
 t=t.replace(new RegExp(`\\b${DE_ORD_RE}(?=\\s+(?:bis\\b|${DE_MONTH}\\b|\\d{1,2}\\.?\\s*${DE_MONTH}))`,'giu'),(m,o)=>{const n=deOrdinal(o);return n&&n<=31?`${n}.`:m;});
 t=t.replace(new RegExp(`\\b(vom|am|ab|bis(?:\\s+zum)?)\\s+${DE_ORD_RE}\\b`,'giu'),(m,w,o)=>{const n=deOrdinal(o);return n&&n<=31?`${w} ${n}.`:m;});
 t=t.replace(/\b(\d{1,2})\.\.(?=\s)/g,'$1.');
 t=t.replace(/\b((?:ein|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun)?(?:und)?(?:zwanzig|dreißig|dreissig)|ein|eine|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)(?=\s+(?:Erwachsene|Kinder|Kind|Personen|Gäste|Naechte|Nächte))/giu,(m,c)=>{const n=deCardinal(c.replace(/^eine$/i,'ein'));return n?String(n):m;});
 // ages: "fünf und acht Jahre alt", "ein fünfjähriges"
 t=t.replace(/\b(ein|eins|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)(?=\s+(?:und\s+\d{1,2}\s+)?Jahre\b|\s+und\s+(?:\d{1,2}|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+Jahre\b)/giu,(m,c)=>{const n=deCardinal(c);return n?String(n):m;});
 t=t.replace(/\bfür\s+eine\s+Woche\b/giu,'für 7 Nächte').replace(/\bfür\s+zwei\s+Wochen\b/giu,'für 14 Nächte');
 t=t.replace(/\b(?:äh+m*|ähm+|öhm+)\b[,.]?\s*/giu,'');
 return t;
}

// ---------- Slovene ----------
const SI_ORD={prvega:1,drugega:2,tretjega:3,četrtega:4,cetrtega:4,petega:5,šestega:6,sestega:6,sedmega:7,osmega:8,devetega:9,desetega:10,enajstega:11,dvanajstega:12,trinajstega:13,štirinajstega:14,stirinajstega:14,petnajstega:15,šestnajstega:16,sestnajstega:16,sedemnajstega:17,osemnajstega:18,devetnajstega:19,dvajsetega:20,tridesetega:30};
function siOrdinal(w){
 w=w.toLowerCase();if(SI_ORD[w])return SI_ORD[w];
 const m=/^(ena|dva|tri|štiri|stiri|pet|šest|sest|sedem|osem|devet)in(dvajsetega|tridesetega)$/.exec(w);
 const u={ena:1,dva:2,tri:3,štiri:4,stiri:4,pet:5,šest:6,sest:6,sedem:7,osem:8,devet:9};return m?u[m[1]]+SI_ORD[m[2]]:null;
}
const SI_MONTH='(?:januarja|februarja|marca|aprila|maja|junija|julija|avgusta|septembra|oktobra|novembra|decembra)';
export function normalizeSpokenSi(text){
 let t=String(text||'');
 t=t.replace(/dva\s*tisoč\s*(šest|sest|sedem|osem)in\s*dvajset/giu,(m,u)=>String(2020+{šest:6,sest:6,sedem:7,osem:8}[u.toLowerCase()]));
 t=t.replace(new RegExp(`(?<!\\p{L})((?:ena|dva|tri|štiri|stiri|pet|šest|sest|sedem|osem|devet)in(?:dvajsetega|tridesetega)|${Object.keys(SI_ORD).join('|')})(?!\\p{L})`,'giu'),(m,o,off,all)=>{
  const after=all.slice(off+m.length,off+m.length+40);const before=all.slice(Math.max(0,off-6),off);
  if(!new RegExp(`^\\s*(?:do\\b|${SI_MONTH})`,'iu').test(after)&&!/(?:od|do)\s*$/iu.test(before))return m;
  const n=siOrdinal(o);return n?`${n}.`:m;});
 // ages: "stara pet in osem let"
 const SIC={ena:1,eno:1,en:1,dva:2,dve:2,tri:3,štiri:4,stiri:4,pet:5,šest:6,sest:6,sedem:7,osem:8,devet:9,deset:10,enajst:11,dvanajst:12};
 t=t.replace(/(?<!\p{L})(ena|eno|en|dva|dve|tri|štiri|stiri|pet|šest|sest|sedem|osem|devet|deset|enajst|dvanajst)(?=\s+(?:in\s+\S+\s+)?let(?!\p{L}))/giu,(m,c)=>String(SIC[c.toLowerCase()]));
 t=t.replace(/(?<!\p{L})(\d{1,2}\s+in\s+)(ena|eno|dva|dve|tri|štiri|stiri|pet|šest|sest|sedem|osem|devet|deset|enajst|dvanajst)(?=\s+let(?!\p{L}))/giu,(m,pre,c)=>pre+SIC[c.toLowerCase()]);
 t=t.replace(/(?<!\p{L})za\s+en\s+teden(?!\p{L})/giu,'za 7 noči').replace(/(?<!\p{L})za\s+dva\s+tedna(?!\p{L})/giu,'za 14 noči');
 t=t.replace(/(?<!\p{L})(?:eee+|mmm+|hmm+)(?!\p{L})[,.]?\s*/giu,'');
 return t;
}

// All four: the rules use language-specific words, so they do not disturb one another.
// Misheard cabin names (speech-to-text): „de lux”, „de luks”, „dilux” → Deluxe; „víp”, „v i p” → VIP.
export function normalizeCabinNames(text){
 return String(text||'').replace(/(?<!\p{L})(?:de|di)[\s-]?lu(?:x|ks|kse|xe)(?!\p{L})/giu,'Deluxe').replace(/(?<!\p{L})(?:v[\s.]?i[\s.]?p|víp|vájp)(?!\p{L})/giu,'VIP');
}
export function normalizeSpoken(text){
 text=normalizeCabinNames(text);
 return normalizeSpokenSi(normalizeSpokenDe(normalizeSpokenEn(normalizeSpokenHu(text))));
}
