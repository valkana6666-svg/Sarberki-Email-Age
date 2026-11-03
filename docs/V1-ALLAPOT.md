# Sárberki V1 – aktuális állapot (legfeljebb 40 sor; minden feladat a saját commitjában frissíti)

Utolsó frissítés: 2026-11-03 CET. Szerepek: AGENTS.md „FÓKUSZ ÉS HATÉKONYSÁG”. Részletes előzmény (archív): `docs/V1-FOLYTATASI-PONT.md`, `docs/V1-AUTOMATION-STATUS-2026-11-01.md`.

## Kész, igazolt – ne ismételd
| Terület | Bizonyíték |
|---|---|
| Gmail → közös AI → mentés → független jóváhagyás (iPhone, élő) | `a4eb189` |
| Létszámkijelzés, duplikált mentés tiltása, Re: tiltás, alkalmazásváltás (iPhone) | `312b9ad`, `c0f8f4d`, `71c84c9`, `3b63e50` |
| Elutasítás → új tervezet → újranyitás (L11–L12), élő | `0f7cb51`; audit-SQL `d1bb91a` |
| Jogosultság, függetlenség, CSRF, tenant, kijelentkezés, 30 perces tétlenség (élő) | `47aed48`, `b081d45` |
| Írásmentes élő próbaszkript (`scripts/live-test-readonly-smoke.mjs`) | `a44f1c8`, 20/20 PASS |
| #8 napi kezelő, türkiz feliratos ikon, iPhone-on is | `e531a04`, kiadás `32052fc`, `31ce41c` |
| Napi mentés + elkülönített visszaállítás (GitHub-úton) | napi `[backup-v2-cloud-bridge-run]`, utolsó 41410412064 |
| Független Drive-másolat: export → izolált restore → Drive-feltöltés → pontos ID-s visszaolvasás → restore a Drive-letöltésből (52 tábla) | run 41531603671 (`b6e22f1`); app-mappa `19WOxZQK…` (owner-only, run 41531436566) |
| Previo TEST csak olvasó felmérés (V2-előkészítés) | `9553d9d`, `3d2cae9`, engedély `b6bcb39` |

TEST-oldal: `leafy-chimera-2403e5`, telepített `17c1ad2` (2026-11-02 16:18Z; élő próba 20/20, chatbot 26/26 + 3 kiadás utáni PASS). Teljes `npm test`: 2562/2562.

## Nyitott feladatok
| ID | Felelős | Állapot | Teendő |
|---|---|---|---|
| DRIVE-TOKEN | Tulajdonos + Claude | PASS (run 41699553348, 11-03 19:04Z): OAuth-app **In production**, új `drive.file` refresh token a secretben; preflight → export → izolált restore → Drive-feltöltés → pontos ID-s visszaolvasás → restore a Drive-bájtokból mind SUCCESS | Napi kérés átállítva (ChatGPT-feladat „Sárberki napi Drive-mentés”, 08:00 Europe/Vienna, #9 11-03 19:12Z); vezérlőfájl `docs/BACKUP-V2-CLOUD-CONTROL.md`: `provider=drive`, `request_marker=[backup-v2-run]`, `drive_folder_id` = a workflow-ban rögzített mappa. Hátra: (1) 11-04-i ütemezett Drive-futás PASS; (2) tartósság igazolása: egy sikeres Drive-futás 2026-11-10 után. Klienstitok: nem cseréljük (tulajdonosi döntés 11-03) |
| SCHEDULE-ENV | Tulajdonos | SZÜNETELTETVE (2026-11-02 16:16Z) | Óránkénti futás kikapcsolva; újraindításkor környezet: Sarberki TEST E2E, utasításban `docs/V1-ALLAPOT.md` |
| V1-RC-CHECK | Claude | PASS – V1 kiadásra jelölhető (TEST) | [`V1-RC-CHECK-2026-11-02.md`](V1-RC-CHECK-2026-11-02.md); production csak külön engedéllyel |
| LIVE-MAILBOX-PLAN | Claude | TERV KÉSZ – tulajdonosi döntésre vár | **info@sarberkito.hu = Google Workspace** (MX `smtp.google.com`, Work 11-02 23:24) → meglévő Gmail-lánc, Internal OAuth `gmail.readonly`. Előfeltétel: a vállalkozás tulajdonosa (édesapa) hozzájárulása + adatkezelési tájékoztató. TEST-előkészítés 1/2 kész: közös automatikuslevél-szűrő (Previo, auto-reply, bulk, noreply, saját feladó) a szerveren és a napi kezelőben; postafiók-profil szerveroldalon, éles profil KIKAPCSOLVA. Tulajdonosi döntés (11-03): éles ügytár = **külön Supabase-projekt**; éles értesítés vendégadat nélkül (`notificationText`, kész). Éles ügytár: 1. szelet kész – változtathatatlan projektprofil + tenant-őr (`deployment/deployment-profile/install.sql`, PGlite 4/4; NEM alkalmazva). Hátra: 2. szelet – a minimális éles útvonal paraméterezése (SQL + JS, projekt-kötés is), korrigált becslés 3–4 munkamenet (plan doc); DB-alkalmazás csak engedéllyel [`V1-LIVE-MAILBOX-PLAN.md`](V1-LIVE-MAILBOX-PLAN.md): 3 kérdés |
| GUEST-TEXT-FIXES | Claude | KÉSZ; TEST-kiadás PASS (`17c1ad2`) | Minőségi átvizsgálás (264 megkeresés): (1) magyar dátum `2026.11.13.` (`3228b13`); (2) „nem hozunk kutyát” után nincs kisállatdíj-mondat; (3) szlovén „s psom” felismerve; (4) kérdések/státusz az aláírás elé, felkínált típusok mellett nincs „VIP/Családi/Deluxe/Osztott?” ismétlés; (5) létszám: „6 főre”, „15 fős társaság”, „za 4 osebe” felismerve (azonos kapacitásdöntés); (6) dátum: „2027.06.12-én egy éjszakára”, „1 night on …”, „from 5th to 8th May” (bizonytalan hossz → visszakérdez); (7) kifejezett lemondás → meglévő „Megkaptuk a lemondási kérelmét” sablon, foglalási kérdések nélkül (feltételekre vonatkozó kérdés nem lemondás); (8) szlovén „3 osebe / 2 osebi / 1 oseba”, „starost otroka”; (9) EN „kids”, DE „1 Kind 7 Jahre” gyerekként, életkorral; (10) „jul 10-14”, „2027. július 3-án érkezve 4 éjszakára” (év nélkül → visszakérdez). `npm test` 2550/2550 |
| TEST-SENDER | Tulajdonos + Claude | DÖNTÉS (11-03) | Tesztpár: `sarberkito@gmail.com` (kitalált „vendég”) ↔ `sarberkiprojecttest@gmail.com`; mindig új levél, „Sárberki élő teszt” tárgy. **Küldési engedély csak e párra** (AGENTS.md TESZT-LEVÉLKÜLDÉSI ENGEDÉLY). Szerepek (11-03): Claude kezeli a `sarberkiprojecttest@gmail.com`-ot (Gmail-csatlakozó bekötve, igazolva); a „vendég” levelei a `sarberkito@gmail.com`-ról jönnek (tulajdonos/ChatGPT; a beépített csatlakozó egy fiókot köt). Emberi jóváhagyás, kézi válasz a „Jóváhagyott szöveg másolása” gombbal; utána a V1 automatikus küldése (rögzített címzett, napló, kapcsoló). info@ csak teljes V1 + Previo API után |
| TEST-MAIL-QUALITY | Claude | JAVÍTVA, TEST-kiadás | 7 tulajdonosi tesztlevél (11-03) a szerveres úton: (1) magyar lemondás német válaszát javítva (ő/ű + gyakori magyar szavak a nyelvfelismerésben); (2) 5–8 főnél a vendégszöveg csak egész házat ajánl, osztott (A+C/B+C, A+B+C) csak kezelői megjegyzésként, igazolt foglalhatatlanság után (tulajdonosi döntés 11-03, AGENTS); (3) 9+ fő: „egy házban nem fér el; több ház – jelezze, ha megfelel”, nincs „felajánlott típus” kérdés; (4) családi aláírás teljes névvel („Familie Müller”). **E2E 1/7 PASS (5. levél, iPhone, 11-03):** sarberkito → tesztpostafiók → Writer AI-javaslat + mentés (tm-1a1a32e75c490832) → független Approver jóváhagyás → „Másolva ✓” → kézi Gmail-válasz ugyanabban a szálban a sarberkito-nak (21:43Z; a szöveg egyezik a jóváhagyottal, Claude Gmail-csatlakozóval ellenőrizte). Hátra: 6 levél; UX-teendő: a jóváhagyott, kiküldésre váró ügy legyen könnyen elérhető; kezelői megjegyzés láthatósága jóváhagyás után ellenőrizendő; „Kedves Smith!” és az elavult „info@sarberki.hu Outlook” felirat |
| PLATFORM-RESTORE-TEST | Claude + tulajdonos | TERVEZETT – éles bevezetés előtt | A valódi postafiók TEST-beállítása után, valódi vendégadat előtt: teljes újraépítés külön ingyenes Supabase-projektbe + külön Netlify-oldalra a Drive-mentésből; cél: ≤ 4 óra helyreállítás (RTO), ≤ 24 óra adatvesztés (RPO). Becslés: Claude 1–2 munkamenet, tulajdonos kb. 1–1,5 óra |
| PREVIO-READ-PLAN | Work | V1 után | Csak olvasó kapacitás/ár bekötésének feltételei (API-kulcs, mellékhatás-kapu) |

## Akadályok
- Gmail OAuth élő újrapróbája és a fizikai iPhone-lépések emberi lépést igényelnek.
- Previo: saját API-hozzáférés és éles honlap → Previo kapcsolat nem igazolt; Previo-írás műveletenkénti tulajdonosi engedéllyel.

## Engedélyek (Previo-írás, TEST is – AGENTS.md; végrehajtás ELŐTT rögzítendő)
| Típus (ELŐZETES / UTÓLAGOS TUDOMÁSULVÉTEL) | Engedélyező | Időpont | Pontos művelet | Tesztadat | Lezárás módja |
|---|---|---|---|---|---|
| UTÓLAGOS TUDOMÁSULVÉTEL (nem előzetes engedély) | Tulajdonos | Végrehajtás: 2026-11-02 09:39–11:56 CET (Work); tudomásulvétel: 2026-11-02 ~13:00 CET | Previo 73521 API TESZT: foglalás létrehozása (voucher 20260001), voucher-PDF előállítása küldés nélkül, majd lemondás | „TESZT WORK VOUCHER 20261102”, 1 felnőtt, várólista, e-mail/telefon nélkül | Lemondott; auditcélból megmarad; pénzügyi rendezés nincs (`c09ecc5`, `3d2cae9`) |
