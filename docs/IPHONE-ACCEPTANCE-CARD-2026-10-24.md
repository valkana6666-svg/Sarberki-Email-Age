# iPhone Safari/PWA elfogadási lap – 2026-10-24

## Legfrissebb lezárás – 2026-10-25 13:43 Europe/Vienna

A korábbi, alább történeti állapotot tartalmazó checklistet felülírja a [mai lezárási jelentés](V1-CLOUD-SAFARI-CLOSURE-2026-10-25.md).
A kiadott build 75c2469f88589375310334f78b9b85708f38542b. A tulajdonosi iPhone-próbán kijelentkezés, vissza/előre, frissítés és közvetlen megnyitás belépést kért; a kézi újrabelépés és a v3 internally_approved audit visszaolvasása PASS. Ezeket ne kérjük újra. A Gmail-eredetjelzés külön készülékes bizonyítéka, Safari/PWA elkülönítés és hálózatvesztés ettől nem válik PASS-szá. Új deploy most nem szükséges.

## Történeti előkészítés


Kizárólag a leafy tesztoldal, meglévő tesztfiókok és szintetikus ügyek.

Frissítés, 2026-10-25: a /api/health HTTP 200 válasza szerint a telepített alkalmazás `20c0c9dfd8e17f75bd54381db5268101c92ad91b`. A gmail-readonly.js, gmail-policy.mjs és operator-login-ui.mjs tényleges HTTPS-bájtjai megegyeznek a tesztelt forrással. A korábbi „NINCS telepítve” jelzés ezért elavult. A `55d9ea22bcace76c2af9efa534d6557fe02d6025` kreditvédelmi commit csak konfigurációt/CI-t/tesztet/dokumentációt változtatott, alkalmazásdeployt nem igényel. Az új Gmail readonly célzott GitHub-futás 40167974826: 21 PASS / 0 FAIL / 0 SKIP; a deploy-ellenőrzés szándékosan kihagyva. Ez szintetikus kódbizonyíték, nem új Google API-olvasás.

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
| Gmail eredetjelzés | A már ellenőrzött 20c0c9df builden a kijelölt, meglévő szintetikus levél egyszeri readonly megnyitása | Gmail readonly API-olvasás jelzés és olvasási idő; nincs küldés/Pushover vagy automatikus írás | PASS – tulajdonosi képek, 2026-10-25 08:53:47 Europe/Vienna; csak böngészős eredet, részletek: GMAIL-IPHONE-EVIDENCE-2026-10-25.md |

Gmail-időkorlát: tartósan elakadó kérés/JSON esetén 15 másodperc után kézi újraindítást kér, nem próbálkozik automatikusan. Ezt a hibát szolgáltatói forgalom vagy rate limit szándékos előidézésével nem teszteljük; az elakadást helyi VM-tesztek igazolták. A fizikai hálózatvesztés eltérő hibaágat is adhat.

Új Writer-mentés és új jóváhagyás pozitív fizikai próbájához külön, még nem jóváhagyott zárt szintetikus ügy és két tényleges jogosultságú actor kell. Érvényes ár-/kapacitás-/verzióbizonyíték nélkül az elvárt eredmény tiltás. A már lezárt ügyet emiatt nem írjuk át. Ennek a pozitív eszközpróbának az állapota továbbra NEM IGAZOLT.

## Rövid eredménylap

Dátum: ___; iOS: ___; Safari/PWA: ___; build: ___; szerep: ___; próbapont: ___; PASS/FAIL/NEM FUTOTT: ___; látható hiba vagy elvárt eredmény: ___.

Elég a rövid szöveges eredmény; érzékeny képernyőkép nem szükséges. Egy sikeres pont nem zárja le automatikusan a többit vagy a Previo-integrációt.
