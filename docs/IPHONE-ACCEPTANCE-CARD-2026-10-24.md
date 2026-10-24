# iPhone Safari/PWA elfogadási lap – 2026-10-24

Kizárólag a leafy tesztoldal, meglévő tesztfiókok és szintetikus ügyek. A Gmail-javítás helyi commitja `cd57dcc8f3bbb202e2f7e5bb2921dca84cb703fb`; jelenleg NINCS telepítve. Az új Gmail-próba csak az integrált commit és a tesztoldal egyezése után minősíthető annak elfogadásává.

## Már igazolt rész nem ismétlendő

A Reader főképernyős előnézet → háttér → törlés → új olvasás részpróba korábban elfogadott. A meglévő `982fc2fa-1e79-478b-8241-2a59f73027b8` ügy v3 jóváhagyása nem ismételhető. Részletes előzmény és szerepkörkorlát: `IPHONE-PWA-ACCEPTANCE-2026-10-17.md`. A régi Reader-nevű fiók bővített jogosultságú; ne használjuk readonly negatív próba igazolására.

## Előkészítés

- Oldal: https://leafy-chimera-2403e5.netlify.app/cloud-approval.html . Külön Safariban és a már telepített főképernyős kezelőben is ellenőrizendő a még nyitott pont.
- Rögzítendő: dátum, iOS-verzió, Safari vagy PWA, látható build, használt szerep, alábbi PASS/FAIL/NEM FUTOTT eredmények. Jelszó/token nem küldendő a chatbe.
- A tesztelő a készüléket kezeli; az asszisztens ebből a munkatérből nem tudja az iPhone hardveres próbáját elvégezni.

| Próba | Lépés | Elvárt eredmény | Állapot |
| --- | --- | --- | --- |
| Tárolt audit olvasása | A fenti ügyön kizárólag „Tárolt állapot és audit visszaolvasása” | v3 / internally_approved, egy v3-as jóváhagyási esemény | NEM FUTOTT MOST |
| Hálózatvesztés | Wi-Fi és mobiladat ki, egyetlen auditolvasás | Hiba/nem igazolt eredmény; nincs hamis friss siker vagy új jóváhagyás | NEM FUTOTT |
| Kapcsolat helyreállás | Hálózat vissza, kézi új olvasás; szükség esetén új login | Azonos v3 és egyetlen jóváhagyás; nincs automatikus írás | NEM FUTOTT |
| Jóváhagyó háttérbe küldése | Bejelölt megerősítés mellett másik app, majd visszatérés; mentés/jóváhagyás nélkül | Régi tervezet/megerősítés törlődik; visszatérés nem küld jóváhagyást | NEM FUTOTT |
| Kilépés és visszagomb | Kijelentkezés, majd böngészős vissza | Nincs használható régi védett előnézet új hitelesítés nélkül | NEM FUTOTT |
| Safari/PWA belépés | Mindkettő külön megnyitása | Szükség esetén külön login; közös sessiont nem feltételezünk | NEM FUTOTT |
| Mobil használhatóság | Belépés és olvasófelület álló nézetben, billentyűzettel | Gombok elérhetők, nincs vízszintes túllógás | NEM FUTOTT |
| Gmail új patch | Csak pontos új deploy után kijelölt szintetikus levél readonly megnyitása | Megfelelő levél; nincs küldés/Pushover; hibánál nincs téves siker | BLOKKOLT: NINCS ÚJ DEPLOY |

Gmail-időkorlát: tartósan elakadó kérés/JSON esetén 15 másodperc után kézi újraindítást kér, nem próbálkozik automatikusan. Ezt a hibát szolgáltatói forgalom vagy rate limit szándékos előidézésével nem teszteljük; az elakadást helyi VM-tesztek igazolták. A fizikai hálózatvesztés eltérő hibaágat is adhat.

Új Writer-mentés és új jóváhagyás pozitív fizikai próbájához külön, még nem jóváhagyott zárt szintetikus ügy és két tényleges jogosultságú actor kell. Érvényes ár-/kapacitás-/verzióbizonyíték nélkül az elvárt eredmény tiltás. A már lezárt ügyet emiatt nem írjuk át. Ennek a pozitív eszközpróbának az állapota továbbra NEM IGAZOLT.

## Rövid eredménylap

Dátum: ___; iOS: ___; Safari/PWA: ___; build: ___; szerep: ___; próbapont: ___; PASS/FAIL/NEM FUTOTT: ___; látható hiba vagy elvárt eredmény: ___.

Elég a rövid szöveges eredmény; érzékeny képernyőkép nem szükséges. Egy sikeres pont nem zárja le automatikusan a többit vagy a Previo-integrációt.
