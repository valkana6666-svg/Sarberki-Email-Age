# Napi kezelő – ellenőrzött tesztbővítés, 2026-10-29

Kizárólag `gmail-test-subject-allowlist`, ugyanaz a Netlify TESZT és központi ügytár. Útvonal: https://leafy-chimera-2403e5.netlify.app/napi-kezelo/ . Nincs új motor, adatbázis vagy jogosultsági rendszer; üzleti szabály és adatbázisséma nem változott.

## Elkészült

- A meglévő védett ügy-API `daily-list` olvasata a már engedélyezett review-record ügykört listázza, szerveroldali kategóriával. A régi lista válaszformája változatlan. A kategória kizárólag tárolt állapotból származik; az új/tervezet nélküli ügy beérkezett, az aktuális review-tervezet jóváhagyásra vár, a belsőleg jóváhagyott vagy további ellenőrzést igénylő ügy folyamatban van. Nincs kitalált lezárt státusz. A régi tesztchat a napi nézetben rejtett; a részletes teszt/chatbot megmarad.
- Az ügyadatlap ugyanazt a review-record olvasatot használja, mint a részletes jóváhagyófelület: üzenetek és előzmények, érkezés, távozás, létszám, háztípus, tárolt tervezet és magyar ellenőrző szöveg. Hiányzó adat egyértelműen jelölve; nincs belső JSON/auditdump.
- A meglévő `edit-draft` és `approve` művelet bekötve. Korábbi ügyállapothoz tartozó tervezetnél a napi nézet nem enged szerkesztést vagy jóváhagyást. A szerver adja a Writer/független Approver megjelenítési jelzőket; minden műveletnél változatlanul újra ellenőriz jogosultságot, CSRF-et, hash-t és ügyverziót. Mentés után külön visszaolvasás, új betöltés és jóváhagyói hozzájárulás szükséges. Nincs automatikus újrapróbálás. Háttérbe kerülés/sessionváltás/lejáró nézet törli a szerkesztést és hozzájárulást.
- Külön manifest-id/scope/start_url és 180/192/512 px türkiz ikon. A tulajdonos a beszélgetésben a projekt narancssárga chatbotikonját választotta referenciának a korábban nem azonosítható citromsárga kép helyett. A reprodukálható asset-konverzió az eredeti ikon képpontjainak helyét, fényerejét és alfáját őrzi; fekete háttér, türkiz előtér. A meglévő ikonfájlok változatlanok. A referencia szalagján nincs külön olvasható felirat; azt az alak megőrzése érdekében nem rajzoltuk át. A kezdőképernyős alkalmazás neve Sárberki Napi.

## Igazolt tesztek és bizonyítékhatár

- Teljes Node-regresszió: **2403 PASS, 0 FAIL, 0 SKIP**. A helyi sandbox első futása folyamat-/hálózati korlát miatt nem volt elfogadható; az engedélyezett környezetben a teljes ismétlés sikeres.
- Célzott ügy-/napi tesztek: **20 PASS, 0 FAIL**. Valódi PostgreSQL-szemantikájú PGlite: cookie Auth/CSRF, Reader/Writer/független Approver, tenant, régi ügyverzió és hibás hash elutasítása, szerkesztés, visszaolvasás, tartós audit; napi és részletes olvasat ugyanazt a rekordot látja. PGlite nem hosted Supabase E2E.
- Chromium 390×844 érintős mobil-emuláció: **8 PASS**. Kategória, üzenetek/adatok, lejárat, újratöltés, Reader-tiltás, Writer-szerkesztés/mentés/visszaolvasás és külön Approver, közös folyamatban státusz; régi TESZT továbbra elérhető. Szintetikus HTTP-transport, nem valódi vendégadat. Tényleges külső kérés 0, a régi GSI-loader szándékosan blokkolva.
- Build, Node-szintaxis és whitespace ellenőrzés sikeres. Ikonkonverzió minden méretnél ellenőrzi a fekete/előtérrész és alfa változatlanságát.
- WebKit ebben a helyi futásban nem futott; a mobil CI két engine-t kér. Fizikai iPhone/Safari/kezdőképernyő-próba **NEM TÖRTÉNT**.

## Nem kész / nem igazolt

- Elutasítás és ügy lezárása: nincs meglévő központi backend-életciklus; a gomb tiltott, hiány egyértelmű. Nem módosítottunk hallgatólagosan üzleti állapotokat vagy DB-jogosultságokat.
- Új tervezet generálása a napi nézetben nincs bekötve; a részletes tesztfelület meglévő eljárása marad. A napi nézet a tárolt tervezetet szerkeszti és hagyja jóvá.
- Valós vendégadat, vendégküldés, végleges foglalás és élő Previo nem aktivált. A tesztadat jóváhagyása nem valós foglalhatósági/árellenőrzés. Egyes pontos Gmail-tesztügyek meglévő bizonyítékhiány miatti jóváhagyási tiltása megmarad.
- Hosted hitelesített Writer/Reader/Approver mentési próba, teljes felhős audit/restore és valódi iPhone telepítés nincs frissen igazolva: operátori belépés és eszköz kell. A feature flagek változatlanok; a kikapcsolt backend látható elérhetetlenséget eredményez.
- A commit CI-je és a teszthost pontos kiadott SHA-ja csak a push és telepítés utáni ellenőrzéssel jelenthető késznek.

V2/V3 érték: ugyanaz a központi motor, API, session, tenant- és műveleti jogosultság, CAS és audit; a napi nézet csak megjelenítés és a meglévő ellenőrzött műveletek új belépési pontja.
