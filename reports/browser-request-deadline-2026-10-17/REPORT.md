# Sárberki V1 – beragadt böngészős JSON-kérések időkorlátja

2026-10-17. Kiindulás `d6694f7e65c47b16d9607528f20f90d7e934dd2c`; kizárólag `gmail-test-subject-allowlist`. Codex közvetlenül fejlesztett és ellenőrzött, párhuzamos agent nélkül.

## Probléma és javítás

A korábbi szimulált kapcsolatvesztés azonnal hibát adott. A lassú/beragadt fetch vagy JSON-body viszont nem rendelkezett saját kliensoldali időkorláttal, ezért a soros cookie-transport következő műveletei is várakozhattak.

A közös `shared-core/cookie-json-request.mjs` helper a böngészős cookie JSON-végpontok teljes válaszát, beleértve a JSON-body beolvasását, alapértelmezetten 15 másodperces időzítővel határolja. Időtúllépéskor AbortController megszakítást kér, `SERVICE_UNAVAILABLE` eredménnyel lezárja a helyi várakozást, törli az időzítőt, és nem indít új kérést. A kész válasz HTTP státuszát és bodyját megőrzi; a 403 nem változik sikeressé.

A fő Reader/Writer-kezelő, a meglévő chatbot/approval Auth-session és a cloud-case adapter ugyanazt a kis transporthelpert használja. Nem készült új session-/jogosultsági rendszer, provider vagy üzleti döntési mag. A soros kérések továbbra is session-/epoch-kapukkal működnek.

**Az időtúllépés nem visszagörgetés.** Egy szerveroldali írás már befejeződhetett, miközben a válasz elveszett. Ezért nincs automatikus write/approval retry vagy hamis siker. Friss ügy- és auditolvasás szükséges; egy régi megerősítésből nem szabad ismételt jóváhagyást indítani. A helper csak a helyi várakozást határolja; más lapok/szerverfolyamatok állapotára nem ad globális lockot.

## Tesztek

Új alkalmazáskód commit: `ccaff25245dc561d192ed1fe8bb58a507215f0de`.
A végleges tesztkorrekció commitja: `7d914d62807f218940225c431f23584a1effe451`; ez csak a GET-szerződést ellenőrző tesztet módosítja, az alkalmazáskód byte szerint változatlan.

- 50 célzott lifecycle/session/deadline/static-build ellenőrzés: **50 PASS / 0 FAIL / 0 SKIP**. A meglévő működést és a közvetlen függőségeket ellenőrzi, átfed a teljes CI-vel.
- Új deadline suite 4 eset: soha meg nem érkező headerek; soha véget nem érő JSON; érvényes 403 és timer cleanup; timeout után későn befejeződő írás nem vált sikerré és nem ismétlődik, a következő explicit olvasás működhet.
- A régi `cloud-case-request` teszt a teljes options-objektum változatlanságát várta, ezért az új AbortSignal miatt az első teljes CI **1799 PASS / 1 FAIL / 0 SKIP** lett. Javítva: a URL/fejlécek/credentials/cache/redirect/body továbbra szigorúan egyezik a meglévő klienssel, az élő, még nem megszakított AbortSignal külön ellenőrzést kap. Alkalmazáskódot emiatt nem változtattunk.
- A korrigált közvetlen szerződés/deadline suite **6 PASS / 0 FAIL / 0 SKIP**. Ezek nem összegezendők az előző 50-nel.
- [Végleges CI 39046433863](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39046433863), job `117435974964`: **1800 PASS / 0 FAIL / 0 SKIP**. Exact deployed SHA = `7d914d62807f218940225c431f23584a1effe451`. PWA static smoke, hitelesítés nélküli session/ügytár kapuk, MNB/árreferencia és Windows offline másolás SUCCESS; élő Previo nem futott. A teljes regressziót helyben nem ismételtük, CI futtatta.
- [Mobilrun 39046272492](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39046272492), job `117435507327`, az alkalmazáskód-commiton SUCCESS: Reader 12/12, Writer/approver/deadline 24/24; összesen **36 PASS / 0 FAIL**. A végleges, csak szerződéstesztet módosító commit miatt nem indítottuk újra ezt a sikeres mobilpróbát.

A Chromium/WebKit komponenspróba 25ms tesztparaméterrel, szándékosan beragadt **mock JSON-bodyval** futtatja a tényleges helpermodult, és egyetlen hívást, abortált jelet, biztonságos hibát követel. Ez nem valódi 15 másodperces hálózati késleltetés vagy fizikai iPhone-mérés. Az alap 15000ms értéket a célzott teszt ellenőrzi. Az iOS által teljesen felfüggesztett JavaScript időzítőinek valós idejét nem igazoltuk.

## Határok és következő lépés

A fizikai iPhone/Safari/PWA kapu továbbra nyitott; [rövid készülékpróba](../../docs/IPHONE-PWA-ACCEPTANCE-2026-10-17.md). A tényleges hálózatváltás és több Safari/PWA kontextus sütiforgatása külön készülékes hatókör. Hiba esetén a régi frissítési ág elutasítása új normál belépést igényelhet; token-reuse védelem nem kapcsolható ki.

V1-becslés **93%**, változatlan: e javítás nem helyettesíti a fizikai eszköz, a külső konfigurációk és a Previo/hiteles szolgáltatásforrás elfogadását. A korábbi, külön megőrzött és visszaolvasott mentési/bizonyítékcsomag érvényes, új export/restore nem indult. A hátralévő aktív becslés továbbra körülbelül 9–18 óra, külső várakozás nélkül.

Production/main, vendégadat, éles e-mail/Pushover, Previo-hívás/írás, valódi foglalás és jogosultságmegkerülés nem történt. V2/V3-érték: újrahasznosítható, műveleti jogosultságot nem adó korlát a meglévő kommunikációs adapteren.
