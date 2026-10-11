# Szerveres központi tervező integráció – 2026-10-11

Kiinduló commit: `96e2270d8347ab73adf784b685822b677abbed20`, igazolt CI: [38171099947](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38171099947). Kizárólag `gmail-test-subject-allowlist`.

## Elkészült

- A meglévő `prepareSyntheticBookingReview` a közös döntési rétegből ellenőrzi a kérés adatait, a kiválasztott kapacitást és az árösszesítést. Nem készült új ügytár vagy jogosultsági rendszer.
- A meglévő szerveres előnézet a közös e-mail-adaptert hívja, a tárolt adatok egységes projekciójával.
- A Gmail/server adatkinyerés ugyanazt az `intake-normalize` modult használja, mint a chatbot; a meglévő thread-, mailbox- és RFC-azonosítás megmaradt. Ismert dátumok és gyermekkorok megmaradnak a következő üzenetben.
- Magyar kezelői ellenőrző szöveg készül a közös döntésből; megjelenik a szerveres előnézetben, az izolált jóváhagyási nézetben és a külön chatbot tesztfelületen.
- Az új tervezet az aktuális ügyállapot-revízióhoz és üzenetszámhoz kötött. A régi változatok append-only maradnak. Régi pending tervezet, amelyből ez a kötés hiányzik, új review-draft műveletet és új kezelői átnézést igényel.
- A tervezet numerikus létszámadatai javítva; ismert gyermekéletkorra és telefonszámra nem kérdez újra. Ez új tervezetszöveget készít, a régi tárolt változatot nem írja át.

## Biztonság

Auth/RLS/tagság, tenant-elkülönítés, CAS, jóváhagyási jogosultság, aktuális tervezet-hash és atomi audit a meglévő útvonalon marad. Nem változott az eredeti Supabase-séma. A megbízható tenant/idő kontextus a kapacitásellenőrzőben nem ad jogosultságot, és nem új HTTP bemeneti mező.

A jóváhagyás előtt a provider újból ellenőriz kapacitást és árat. Árhívás nem indul hiányos, ismeretlen vagy elégtelen kapacitásra; várakozás közben lejáró bizonyíték tilt. A provider kizárólag beadott szintetikus forrás. A generic osztott fixture nem igazol külön A/B/C poolokat vagy fizikai párost, ezért szerveres jóváhagyása továbbra is kézi felülvizsgálatot igényel.

Nincs automatikus küldés, Previo-írás, foglalás vagy szolgáltatásaktiválás. A települt API alapértelmezett tiltása megmaradt. Nem változott az eredeti adatbázis vagy a laptop ügytára.

## Helyi tesztek

- **1074 PASS, 0 FAIL** teljes regresszió.
- **28 PASS, 0 FAIL** célzott integrációs/fordítási/runtime/SQL-API csomag; a teljes csomag részhalmaza.
- Új tesztek: 7 szerveres központi review, 5 runtime/projekció, 6 kezelői fordítás; összesen 18, a 1056-os kiinduláshoz képest.
- Valódi PostgreSQL-motort használó helyi RLS/CAS/audit és izolált jóváhagyás-regresszió sikeres; az Auth HTTP ezekben szimulált.
- A felhős, tényleges GoTrue Auth/PostgREST/PostgreSQL/Chromium/újraindítás lánc és a Chromium/WebKit mobilpróba külön Actions-bizonyítékot készít. E jelentés helyi teszteredménye önmagában nem igazolja ezek sikerét.

## Két projekt állapota

AI-agent V1: a szintetikus szerveres beérkeztetés, központi review, előnézet és tartós tervezet az új döntési rétegre épül. A meglévő Gmail-belépés és olvasás, valamint a régi helyi kezelői útvonal teljes átállítása nincs ebből élő levelekkel igazolva. Az átállítás fokozatos, új automatikus küldés nélkül.

Chatbot: külön helyi kezelői tesztfelület, közös döntés, többüzenetes memória, négy nyelv, magyar kezelői szöveg. A mobilautomatizálás 390 pixeles Chromium/WebKit emuláció; nem valódi iPhone-eszközpróba és nem tartós HTTPS vendégchat.

## Mentés és fennmaradó feladat

A fejlesztési ZIP a végleges commit pontos git-archívumából, a tesztekből és dokumentációból, valamint ellenőrzőösszegekből készítendő. A meglévő titkosított adatbázisfájlok változatlanul megőrizhetők, a korábbi [38129512850](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38129512850) izolált restore bizonyítékával: 43 tábla és leltár egyezett. Ez korábbi mentés, nem friss Supabase-adatbázisfelvétel. A teljes platform-visszaállítás és a laptop exportja továbbra sem teljesen igazolt.

Következő feladat: tartósan elérhető, igazoltan elkülönített HTTPS tesztcélhoz kötés, majd a meglévő Gmail-kezelőfelület további fokozatos átállítása. Élő Previo-forrás csak dokumentált készletzárolás-mentesség és jogosultság után kapcsolható be; valódi iPhone-próba és külső konfigurációk ellenőrzése külön szükséges.
