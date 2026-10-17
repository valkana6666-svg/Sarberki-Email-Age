# V1 elfogadási mátrix – bizonyíték és tényleges hatókör

2026-10-17. Nem új élő tesztfuttatás: a meglévő regressziók és dátumozott bizonyítékok összevonása. Az aktuális commit/CI a [központi checkpointban](V1-ACCEPTANCE-CHECKPOINT-2026-10-17.md) szerepel. A release-állapot nem azonos a sikeres assertionök számával.

| Elfogadási terület | Automatizált bizonyíték | Tényleges határ / nyitott kapu |
| --- | --- | --- |
| HU/DE/EN/SI dátum/létszám/háztípus és tervezetnyelv | `tests/multilingual-booking-parity-v1.test.mjs`; közös parser/renderer regressziók | A fixture-ök mintáit igazolja, nem tetszőleges vendéglevél nyelvi garanciáját |
| Gmail → ügy → tervezet → Reader → külön approver → audit | `tests/gmail-read-cookie-postgres-e2e-20261014.test.mjs` | Fake GIS/Gmail/Auth transport + tényleges controller/handler/PostgreSQL; nem új élő Gmail-olvasás |
| Friss tényleges Gmail → azonos felhős Writer dedup → preview/audit | [lezárt próba](../reports/gmail-exact-cloud-chain-2026-10-17/REPORT.md) | Egyetlen pontos szintetikus receipt; nem ár-/kapacitásigazolás és nem jóváhagyás |
| Reader/Writer/approver, tenant, CAS, audit | `tests/cloud-synthetic-approval.test.mjs`, `tests/server-case-service.test.mjs`, meglévő policytesztek; [valódi izolált Auth](../reports/restored-v1-runtime-2026-10-17/REPORT.md) | A tesztfiók és a felhős adminfiók külön fogalom; service_role nem alkalmazási belépés |
| Nem igazolt/stale/hibás ár vagy kapacitás | `tests/synthetic-booking-review.test.mjs`, `tests/synthetic-guest-journey.test.mjs` | Nincs végleges ajánlat/jóváhagyás; élő Previo továbbra nincs bekötve |
| Osztott C 4/5/6, egy-/többegységes kérés, közelség | Meglévő kapacitás-/elhelyezési regressziók, közös döntési mag | A típusszintű pool nem igazol fizikai A+B párost; egyedi forrás továbbra kell |
| Bizonytalan szolgáltatásügy összerendelése | `tests/service-link-resolution.test.mjs`; [felhős részpróba](../reports/service-preview-scope-2026-10-16/REPORT.md) | Emberi bizonyíték és mindkét ügy verziója kell; levélhivatkozás nem jogosultság |
| Dézsa ház/időszak és külön jóváhagyás | `tests/tub-service-approval.test.mjs`, `tests/tub-availability.test.mjs`, `tests/restored-service-rollback.test.mjs`; tényleges restaurált SQL | A szolgáltatási döntés nem módosít szállásjóváhagyást/verziót. Valós ház-/dézsanaptár kötés még kell |
| Hiányzó adat, ellentmondás, tagadás/visszavonás | Közös intake/service-intent és többnyelvű regressziók | Emberi tisztázás; nincs kitalált dátum, létszám, kapacitás vagy automatikus lemondás |
| Előleg és lemondás | Többnyelvű paritássuite 15/16 fős és dátumhatárai, audit-adatvédelmi tesztek | Határidő tájékoztatás nem pénzbeérkezés és nem automatikus foglalástörlés |
| Törzsvendég | Konfiguráció és kommunikáció tesztelt; 730 nap/20%, előzményigazolás szükséges | A teljes 729/730/731 napos jogosultsági automatizálás lezárását nem állítjuk; hiteles vendégelőzmény nélkül nincs kedvezmény |
| Gyermekárak pontos 3/8 éves határa, 2027-es ár | Bizonytalansági emberi kapu | Tulajdonosi, egyértelmű határérték/árjóváhagyás kell; az egymásba érő korcsoportokat nem találjuk ki |
| Mobil Reader, Writer és külön jóváhagyó | 390px Chromium/WebKit szintetikus UI-próbák; lifecycle regressziók | Nem tényleges iPhone/Safari. A háttéresemények emuláltak, nem iOS operációsrendszer-szintű mérések |
| PWA manifest, start URL, ikonok, no-store | `tests/operator-pwa.test.mjs`, statikus build/privacy és telepített PWA-smoke | Valódi főképernyős telepítés, külön Safari/PWA süti és hálózatváltás még eszközön igazolandó |
| Mentés / restore / Auth újraindítás | [49 táblás aktuális restore](../reports/restored-v1-runtime-2026-10-17/REPORT.md) | Az eredeti fiókok és a külső admin/redirect/provider/MFA beállítások külön kapu |

A V1 nem automatikus küldő/foglaló rendszer. A belső szintetikus jóváhagyás nem vendégajánlat vagy Previo-foglalás. Ténylegesen nyitott emberi kapu: fizikai iPhone-elfogadás és egyértelmű üzleti döntések; szolgáltatói kapu: Previo teszthozzáférés és mellékhatásmentes olvasás igazolása.
