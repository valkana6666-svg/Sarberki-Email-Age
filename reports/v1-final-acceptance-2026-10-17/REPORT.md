# Sárberki V1 – végső elfogadási felülvizsgálat, 2026-10-17

**Döntés: feltételes tesztkörnyezeti elfogadás. Teljes V1-lezárás még nem igazolt.** A fizikai iPhone/PWA és a külső szolgáltatói kapuk nyitva maradnak. Ez nem élesítési engedély.

## Verzió és bizonyíték

A most ellenőrzött tesztági HEAD: `a420207482d678572421293988bfa7643d44248e`. A megadott `7d914d62807f218940225c431f23584a1effe451` óta csak két dokumentum változott, az alkalmazás és a tesztek változatlanok. Újabb kódot nem írtunk felül. Ez a jelentés is kizárólag dokumentációs változás.

- [CI 39046433863](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39046433863), job `117435974964`: **1800 PASS / 0 FAIL / 0 SKIP**, tesztelt és telepített SHA `7d914d62807f218940225c431f23584a1effe451`.
- [Mobil 39046272492](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39046272492): **36 PASS / 0 FAIL**, azonos alkalmazáskód a `ccaff25245dc561d192ed1fe8bb58a507215f0de` commiton. A későbbi 7d914 csak tesztassertiont javított.
- A GitHub legfrissebb tesztági workflow-listáját ismét elolvastuk: a végleges teszt- és kapacitásrun sikeres. A ccaff korábbi sikertelen runját a végleges 7d914 eredmény felülírja; azt nem számítjuk új hibának.
- **Ebben a munkamenetben új tesztfuttatás: 0.** A fenti számok korábbi, változatlan kódhoz tartozó bizonyítékok, nem új mérések; a különböző bizonyítékok assertionjeit nem adjuk össze.

## Elfogadási döntések

| Állapot | Terület és bizonyíték | Még szükséges |
| --- | --- | --- |
| KÉSZ ÉS IGAZOLT | Közös 15 000 ms transport, fejléc és JSON-body határideje; abort és timer cleanup; 403 elutasítás; nincs automatikus írásismétlés; epoch/session védelem. Forrás és meglévő célzott tesztek áttekintve. | Új hiba nem azonosítható az átvizsgált útvonalakon. |
| KÉSZ ÉS IGAZOLT | Chromium/WebKit Reader/Writer/approver, lifecycle, késői válaszok, hálózati hibák, manifest és telepített statikus PWA-smoke. | A bizonyíték emulált böngészőre vonatkozik. |
| KÉSZ ÉS IGAZOLT | Korábbi friss, pontosan engedélyezett szintetikus Gmail OAuth/read → normál Writer deduplikáció → ugyanazon ügy/preview és audit visszaolvasása. | Nem új beszúrás, banki ellenőrzés, kapacitásigazolás vagy új jóváhagyás. |
| KÉSZ ÉS IGAZOLT | Külön szintetikus szerep-/tenant-/CAS-/auditpróbák; 49 táblás restore; tényleges izolált Auth/REST és Reader írástiltás; szolgáltatási SQL rollback. | Nem az eredeti adminfiókok és külső providerkonfigurációk visszaállításának bizonyítéka. |
| KÉSZ ÉS IGAZOLT | HU/DE/EN/SI determinisztikus üzleti/parsertesztek; külön tényleges OpenAI EN/DE/SI → HU fordítás három zárt mintán. | Nem egyetlen, mindent összekapcsoló élő négy nyelvű próba; HU bemenetre külön OpenAI-próba nem igazolt. |
| KÉSZ, DE KÉSZÜLÉKES ELLENŐRZÉSRE VÁR | Fizikai iPhone Safari, telepített PWA, belépés, szerepek, billentyűzet és operációsrendszer-szintű háttér/hálózatváltás. | Tulajdonosi készülékpróba; az automatizált sikert nem számítjuk ennek. |
| KÜLSŐ HOZZÁFÉRÉSRE VÁR | Hiteles, friss Previo kapacitás és fizikai ház-/dézsanaptár összekötése. | Mellékhatásmentes olvasás igazolása, elkülönített teszthozzáférés. Most nincs élő hívás vagy szabad kapacitásra tett állítás. |
| KÜLSŐ HOZZÁFÉRÉSRE VÁR | Google/Netlify/Supabase admin/MFA/config helyreállítási leltár és védett kulcsmegőrzés. | Tulajdonosi, védett ellenőrzés. A korábban jelzett API-kulcsrotáció lezárására nincs új bizonyíték; éles használat előtt ellenőrizendő, kulcsot nem olvastunk. |
| HIBÁS / JAVÍTANDÓ | Új, reprodukált alkalmazáshibát ez a forrás- és bizonyíték-felülvizsgálat nem talált. | Ez nem jelenti az összes környezet hibamentességét. A nyitott elfogadási kapuk nem PASS eredmények. |
| V2-BE ÁTHELYEZHETŐ | Teljes történeti törzsvendég-jogosultság automatizálása és az elhalasztott hatékonyság-/metrikarendszer. | Hiteles előzmény nélkül kedvezmény nem adható. A jelen V1 biztonsági kapuit nem helyezzük át. |

## A 15 másodperces ellenőrzés részletei

A `shared-core/cookie-json-request.mjs` egyetlen `Promise.race` alatt végzi a fetch-et és a `response.json()` beolvasását; alapértéke 15000 ms. Határidőkor AbortController abort és SERVICE_UNAVAILABLE elutasítás történik; a timer a finally ágban törlődik. A teljes válasz HTTP-statusát és ok mezőjét megőrzi. A 403 ezért nem válik sikerré; a session adapter szükség esetén AUTH_REQUIRED állapotba zár.

A fő Reader/Writer belépési UI, a külön operator-session, az approval session és a cloud-case adapter a közös helperhez kapcsolódik. A soros kéréskezelés és az epoch/session-ellenőrzések megmaradtak. A sor helyi böngészőpéldányra vonatkozik, nem globális, több lap közötti zárolás.

A meglévő négy helperteszt lefedi a beragadt fejlécet, a beragadt JSON-bodyt, a 403-at és a késői írássikert automatikus replay nélkül. Az időtúllépés nem szerveroldali rollback: bizonytalan mentés/jóváhagyás után friss állapot- és auditolvasás kell. A JavaScript timer nem bizonyítja, hogy felfüggesztett iOS-alkalmazásban pontosan 15 falióra-másodperc múlva megjelenik a hiba.

Részletes bizonyíték: [timeout-jelentés](../browser-request-deadline-2026-10-17/REPORT.md).

## Üzleti szabályok

| Szabály | Ellenőrzött működés és határ |
| --- | --- |
| Legfeljebb 15 fő: 50%; 15 felett: 80% | `depositPolicyForBooking`: `guestCount > 15`; meglévő 14/15/16 fős és négy nyelvű tervezettesztek. |
| Több mint 14 nap: 7 nap; legfeljebb 14 nap: 24 óra | A jelen implementáció a foglalási nap és érkezési nap naptári különbségével választ szabályt; 1/3/14/15/30 napos tesztek. Az offsettel megadott foglalási időpontból 24/168 eltelt óra adja a határidőt. |
| Tényleges pénzbeérkezés | `paymentMustBeReceived: true`, `receiptConfirmed: false`; a határidő kiszámítása nem banki igazolás. A számlára érkezést embernek kell ellenőriznie. |
| Rövid határidős lemondás | Advisory assessment, 14 napos határérték és időrendi tiltások; emberi felülvizsgálat. Nincs automatikus törlés vagy pénzügyi végrehajtás. |
| Tulajdonosi kivétel | Nincs automatikus kivételdöntés. Az `ownerApproved` adatmezőre épülő tiszta segédfüggvény nem önmagában Auth-jogosultságigazolás; a tulajdonosi döntés hiteles rögzítésének teljes felhős útvonalát nem minősítjük lezártnak. |
| Bizonytalan ár/kapacitás/ügy | Jóváhagyási kapu zárva; emberi tisztázás. Szintetikus jóváhagyás nem végleges foglalás. |
| Házhoz kötött, külön bérelhető dézsa | Fix resource/house/időszak és teljes naptárkövetelmény; hiányos adat UNKNOWN. Dézsa- és szállásjóváhagyás külön; restaurált SQL-ben is ellenőrizve. A valós naptárkapcsolat továbbra hiányzik. |
| 7–10 A/B/C osztott egységek | Közös kapacitásmag és meglévő regressziók változatlanok. Típusszintű elérhetőség nem bizonyít azonos fizikai házon belüli A+B párost. |

A gyermekárak pontos 3/8 éves határának és a 2027-es áraknak a tulajdonosi jóváhagyása külön nyitott kérdés. Ezekhez nem találtunk ki szabályt, nem nyitottunk jóváhagyási kaput.

## Integrációs és mentési korlátok

A Gmail-kliens a `gmail.readonly` scope-ot kéri `include_granted_scopes:false` mellett. A korábbi tényleges OAuth-próba és a zárt pontos receipt lánca rendelkezésre áll; ebben a körben nem jelentkeztünk be újra és nem olvastunk postaládát. A Supabase-jogosultságokat a dátumozott valós/izolált és szintetikus bizonyítékok hatókörében fogadjuk el; teljes új szolgáltatói adminaudit nem történt.

A Netlify utolsó igazolt deploy SHA-ja a tesztelt `7d914d...`; a későbbi, csak dokumentációs HEAD nem új alkalmazásdeploy. Most nem végeztünk új közvetlen deploymérést.

A mentés és a teljes restore-bizonyíték október 24-én lejáró GitHub-példányairól korábban külön, hash-visszaolvasott másolat készült. Nincs szükség pusztán e jelentés miatt új export/restore-ra. Külső admin/MFA, eredeti felhasználók belépése és tulajdonosi offline kulcsmegőrzés továbbra külön ellenőrizendő. Részletek: [külső helyreállítási leltár](../../docs/EXTERNAL-RECOVERY-READINESS-2026-10-17.md).

További források: [elfogadási mátrix](../../docs/V1-ACCEPTANCE-MATRIX-2026-10-17.md), [friss Gmail-lánc](../gmail-exact-cloud-chain-2026-10-17/REPORT.md), [három tényleges OpenAI-minta](../translation-terminology-2026-10-16/REPORT.md), [restore/Auth](../restored-v1-runtime-2026-10-17/REPORT.md).

## Következő lépés és ráfordítás

**V1: továbbra is körülbelül 93%.** Ez mérnöki becslés, nem tesztarány; a mostani dokumentációs felülvizsgálat nem zárt le új készülékes vagy külső integrációs kaput. Hátralévő aktív munka becslése **9–18 óra**, külső várakozás nélkül: készülékes teljes mátrix és esetleges javítás 2–4 óra; Previo és hiteles ház-/dézsaadatok csatlakoztatása 4–8 óra; tulajdonosi/admin/üzleti bizonyítékok és végső integrált regresszió 3–6 óra. Új API-szerződés vagy feltárt hiba ezt módosíthatja.

A következő konkrét lépés a [körülbelül 3 perces iPhone-útmutató](../../docs/IPHONE-PWA-ACCEPTANCE-2026-10-17.md) végrehajtása. Ezt csak a fizikai készülék birtokosa tudja megtenni. A sikeres első próba nem zárja le automatikusan a Writer/approver/hálózat/session teljes készülékes mátrixát. Addig nincs indokolt új kódmódosítás, teljes CI vagy mentésismétlés az itt átvizsgált változatlan komponenseken.

Production, main, vendégadatok, email/Pushover, élő Previo és valódi foglalások érintetlenek. Változtatás kizárólag a kijelölt tesztág dokumentációján történt.
