# Sárberki V1 – szintetikus e-mail-folyamat ellenőrzése, 2026-10-14

## Eredmény

**A komponensek összekötött, izolált próbája sikeres; a tényleges Gmail kezelőfelület teljes felhős E2E útja még nincs kész.** Az ellenőrzés alapja a `gmail-test-subject-allowlist` ág `3d0c82bc61a838f85d666d573d4403165d1c47f3` állapota. Production/main, valódi vendégadat, e-mail-küldés és Previo-írás nem érintett. Célzott teszt és jelentés került hozzáadásra, valamint a nem védett szerveres adatprojekció egyetlen sorral átveszi a már normalizált telefonszámot; védett választervező, üzleti szabály és jogosultsági modul nem változott.

Az új célzott parancs:

```sh
node --test tests/synthetic-mail-postgres-e2e-20261014.test.mjs tests/server-message-extraction.test.mjs
```

**13 PASS, 0 FAIL, 0 SKIP.** A teljes regressziós tesztkészletet nem indítottuk újra. A teszt kifejezetten reprodukálja a teljes e-mail/chatbot vendégszöveg eltérését: ez ismert hiány karakterizálása, nem a szövegegyezési elfogadási feltétel teljesülése. A megadott telefonszám tárolása és a felesleges visszakérdezés hiánya a kezdeti és a reviewed draftban is sikeres.

## Bizonyítékok és korlátok

| Lépés | Igazolt eredmény | Bizonyíték szintje / korlát |
|---|---|---|
| 1. E-mail-adat fogadása | Négy kitalált Gmail `text/plain` MIME payload és base64url-törzs | Offline fixture, nem tényleges Gmail API vagy mailbox |
| 2. MIME és normalizálás | A meglévő `gmail-readonly.js` transform olvassa a törzset, feladót és üzenetazonosítót | VM-ben futó tényleges adapter, HTTP és böngésző bejelentkezés nélkül |
| 3. Nyelv és igény kinyerése | HU/DE/SI/EN nyelv, dátum, Deluxe, 2 felnőtt, 0 gyermek és megadott telefonszám a szerver saját kinyerésével | A kliens által állított foglalási tényeket nem használja az atomikus ingest-and-draft |
| 4. Közös döntés / szabály | E-mail és chatbot azonos döntést és tényeket ad | A teljes vendégszöveg egyenlősége nem teljesül; lásd nyitott hibák |
| 5. Kapacitás és egységszám | Teljes időszakhoz illeszkedő 1 szabad egység; kapacitásellenőrzés a számítás előtt | Kitalált `synthetic-fixture`, nem élő Previo-eredmény |
| 6. Ár | 1 egység × 2 éj × 100 kitalált egységár = 200 belső összeg | Belső szintetikus számítás, nem teljes számszerű vendégajánlat, nem jóváhagyott valós ár |
| 7. Tervezet mentése | Atomikus ügy + függő tervezet v1, majd külön ellenőrzött tervezet v2 | Valódi PGlite PostgreSQL, meglévő SQL/RPC és repository |
| 8. Reader | Lista és tárolt előnézet olvasható; szerkesztés és jóváhagyás tiltott | Valódi SQL szerep/RLS, szimulált Auth HTTP |
| 9. Jóváhagyó | Külön read+approve, write nélküli szerep hagy jóvá; Writer nem hagyhat jóvá | Meglévő RPC, aktuális DB-tagság és session, szerveri attesztáció |
| 10. Negatív ágak | Ismeretlen kapacitás és ár jóváhagyási kattintáskor tilt; hibás feladó, hiányos igény, rossz verzió, ismételt/tamperelt üzenet és jogosulatlan művelet tiltott | Ugyanazon összekötött adatfolyam; nincs approval audit a tiltott ágakon |
| 11. CAS / idempotencia / audit | Duplikált levél nem hoz létre új verziót; telefon nélküli követő levél megőrzi a korábbi telefonszámot; jóváhagyás v2→v3; egy audit azonos actorral és SQL adathash-sel | Tranzakciós PostgreSQL művelet, ismételt jóváhagyás tiltott |
| 12. Újraindítás / visszaolvasás | Dump után új PostgreSQL-példányból mind a négy jóváhagyás és Reader által olvasható audit megmarad | Izolált motor újraindítása, nem teljes managed Supabase/Netlify katasztrófa-helyreállítás |

Az Auth HTTP ebben a tesztben kifejezetten szimulált: nem állít bizonyítékot valódi JWT-aláírás-ellenőrzésről vagy Gmail/OAuth belépésről. A SQL RLS, szerepek, CAS, session-sor, issuer feltétel, attesztáció és tranzakciós audit tényleges PostgreSQL-kódon futnak. Nem történt admin/service-role alkalmazásjogosultság-megkerülés; a tesztharness csak az új, eldobható adatbázis sémáját és kitalált identitásait provisionálja.

## Meglévő felhős bizonyíték – nem ismételtük meg

A koordinátor által ellenőrzött hivatalos teszt-host próba:

- Ügy: `37ebec20-a08a-4a62-8555-90657dae0acd`, Writer által előkészített v3 → külön kezelő által jóváhagyott v4.
- Jóváhagyó actor: `14a9374c-9891-41ce-9ead-7c15c443197c`; időpont: `2026-10-14T04:39:56.59972Z`.
- Tárolt állapot: `internally_approved`; draft SHA-256: `d4ba253c4ea9c03c82ed89c7887ed8160410f5e51540d0842906067e8295c4e6`.
- Újratöltés utáni RLS-védett audit: egy `approve_isolated_synthetic`, v4, ugyanaz az actor; adathash: `70e8db5ff9ad4dee0c508738e8875f661b293d53167106569a3c88a2f4019396`.
- A jóváhagyó írási próbája: `FORBIDDEN`.
- Meglévő alapcommit CI: Actions run `38461782334`, job `115518510633`, 1448 PASS, 0 FAIL, 0 SKIP. Az új tesztfájl saját CI-je a közzététel előtt **NEM IGAZOLT**.

Ez a felhős próba a rögzített szintetikus Writer mintán zajlott. A jóváhagyott szöveg pontosító választ tartalmazott, többek között hiányzó telefonszám miatt; nem jelentett teljes számszerű ajánlatot, visszaigazolt vendégfoglalást vagy elküldött levelet. A fenti ügyet az új ellenőrzés nem módosította és nem hagyta jóvá ismét.

## Nyitott, igazolt elfogadási hiányok

1. **A tényleges Gmail UI nincs bekötve a felhős ügytárba.** Az `index.html` `displayGmailRecord()` függvénye helyi `analyze` / `SarberkiBookingRuntime.cases.get` útvonalat használ, és a forrás kifejezetten helyi tesztmentést jelez. Nem hívja a meglévő hitelesített `ingestAndDraft` felhős műveletet. A `writer-reader-fixture` kizárólag a rögzített szintetikus mintát tölti fel. Az új teszt kézzel kapcsolja össze a meglévő adapterek és ügytár komponenseit; ettől a telepített Gmail-folyamat nem válik E2E kész állapotúvá.
2. **A teljes vendégoldali e-mail/chatbot szöveg nem azonos.** A `shared-core/inquiry-channel-adapters.mjs` e-mail-adaptere levelet és státuszszöveget renderel, a chatbot-adapter státuszszöveget. A teszt ugyanazon tényeken igazolta az azonos döntést és a közös státuszrészt, továbbá kifejezetten reprodukálta a különböző teljes szöveget. A mentett atomikus e-mail-tervezet az e-mail-adapter eredménye; az ellenőrzött tárolt tervezet a meglévő központi levélrenderert használja. Nincs igazolt, mindkét telepített csatornán azonos teljes vendégszöveg. Ez a korábbi betűre egyezési követelmény szerint **nyitott hiány**, nem puszta elnevezési különbség.
## Célzott javítás – megadott telefonszám megőrzése

Az `intake-normalize.mjs` már normalizálta a telefonszámot; a szerveres kinyerés korábban eldobta. Az engedélyezett egyetlen soros `normalized.phone → values.phone` adapterjavítás ezt a tárolási hibát megszüntette. Négy nyelven igazolt a tartós mentés, a kezdeti és az ellenőrzött tárolt tervezet telefonkérdés nélküli szövege, valamint a korábbi adat megőrzése hiányos követő levélnél. A meglévő `buildEmailInquiryDraft` már továbbadja a `facts.phone` értékét, ezért ott nem volt szükség változtatásra. A normalizáló nem ad megbízható `normalized.name` mezőt, ezért nem vezettünk be új névfelismerést vagy találgatást.

## Következő V1-lépés

A szerveres telefonprojekció célzott javítása elkészült. Következőként a teljes vendégszöveg-egyezésnek konkrét, engedélyezendő javítását, valamint a Gmail kezelőfelület meglévő hitelesített Writer útvonalhoz csatlakozásának szintetikus-only tervét kell elbírálni. Lásd `PLAN.md`: konkrét, még nem alkalmazott diffek és integrációs határok. A már létező runtime/repository használható; új ügykezelő, második parser vagy jóváhagyási rendszer nem szükséges. A rögzített felhős jóváhagyási fixture guardját nem szabad önkényesen általánosítani tetszőleges levélre.

A tényleges vendégszöveg-egyezés javításához az érintett védett választervező/szövegek pontos módosítása külön jóváhagyást igényel. Az élő Previo-forrás olvasási mellékhatás-mentességének és éles kapacitás/ár bizonyítékának ellenőrzése külön kiadási előfeltétel; a szintetikus eredmény ezt nem helyettesíti. A tényleges Gmail/OAuth transzport, felhős UI bekötés és eszközön végzett végső használati próba még nem zárható le ebből a jelentésből.

## V1 készültség és bevezetés

A koordinátor becslése: **kb. 90–92% fejlesztési készültség**. Ez nem a sikeres tesztek százaléka, és nem élesítési engedély. A közös feldolgozás, tartós ügytár, jogosultságok és felhős emberi jóváhagyás jelentős része igazolt; a tényleges Gmail felület → felhős ügytár kapcsolat és a teljes vendégszöveg-egyezés még hiányzik. Az éles bevezetéshez ezek lezárása, az olvasási Previo-integráció mellékhatásainak igazolása, tényleges iPhone/Safari használati próba és külön kiadási jóváhagyás szükséges. A korábbi ellenőrzött mentések megmaradtak; ebben a feladatban nincs adatbázis-migráció vagy felhős tesztügy-módosítás.
