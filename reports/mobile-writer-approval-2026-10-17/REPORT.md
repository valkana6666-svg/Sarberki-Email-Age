# Mobilos Writer és külön jóváhagyó – 2026-10-17

Kiindulás: `48e01e8854bef372714e275a5bff4f4c158baf46`, tesztelt alkalmazáskód `19dae9d50ccb0b9fb6ea9eca25830ff637f1c922`, 1788 PASS / 0 FAIL / 0 SKIP. Kizárólag `gmail-test-subject-allowlist`. Codex közvetlenül végezte a tesztfejlesztést.

## Új ellenőrzés

A korábbi 12 mobilteszt a Reader olvasási útvonalát fedte. Az új `scripts/operator-write-approval-mobile-proof.mjs` az eredeti index és cloud-approval HTML/CSS/modulokat futtatja 390×844 Chromium/WebKit nézetben. A teszthost originjét a böngésző helyi route-fulfillmentje szimulálja, mert a változatlan jóváhagyó felület erre az originre korlátozott. Nem csatlakozik a Netlify-hoz, Gmailhez, Supabase-hez vagy Previo-hoz; minden kérés helyi szintetikus válasz vagy tiltás. Szervizmunkás blokkolva. Nincs valódi Auth, cookie, token vagy vendégadat.

Útvonalak: Writer-belépés → zárt német MIME betöltése → explicit mentés → duplicate → jóváhagyási link → Writer-tervezet előkészítése → Reader tiltása → külön approver → nem igazolt feltételeknél szerverelutasítás felületi kezelése → ügyválasztás változásának invalidálása → pontos tervezethash szintetikus jóváhagyása → auditválasz megjelenítése → mobil elrendezés és kijelentkezés.

A tényleges DOM/controller/hash-kód fut; az Auth, jogosultság, adatmegőrzés, ár/kapacitás és audit backend válasza mock. Ez a böngészős felület működésének bizonyítéka; az adatbázis tranzakciós auditját vagy üzleti tiltását önmagában nem bizonyítja. Azokat a meglévő izolált PostgreSQL/E2E tesztek fedik. Valódi iPhone/Safari/PWA-telepítési próba továbbra is NEM IGAZOLT.

## Eredmény

Első tesztcommit: `ed10d59917d9acf77583917a03ee01610c706581`.
[Első mobilrun](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39028521988): a Chromium hat új útvonalellenőrzése sikeres, majd a kijelentkezési mezőcsoport tesztassertionje hibás eredményt adott; a WebKit még nem futott le. Ez a futás nem tekinthető sikeres mobil-elfogadásnak.

A Playwright helyi forrásának `isNativelyDisabled` helperje BUTTON/INPUT/SELECT/TEXTAREA/OPTION/OPTGROUP elemeket kezel, magát a FIELDSET-et nem. A javítás explicit `fieldset.disabled` DOM-tulajdonságot és a benne lévő valódi gomb örökölt letiltását ellenőrzi. Nem változtattunk alkalmazáskódot vagy kijelentkezési logikát, és nem gyengítettük a követelményt.

Javító tesztcommit: `9c5ea14dda5d5989998d250b5f1c8bd46eed94f2`. 

- [Végleges teljes CI 39028646129](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39028646129), job `117384523276`: **1788 PASS / 0 FAIL / 0 SKIP**; exact test deploy ugyanaz a `9c5ea14dda5d5989998d250b5f1c8bd46eed94f2`. PWA static smoke, hitelesítés nélküli session/ügytár tiltási kapuk, MNB/árreferencia és offline Windows másolás SUCCESS. Élő Previo-lépés szándékosan nem futott, nem npm SKIP.
- [Mobilrun 39028646128](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39028646128), job `117384523130`: SUCCESS. Új Writer/approver ellenőrzések **14 PASS / 0 FAIL** (7 Chromium + 7 WebKit); meglévő Reader-suite **12 PASS / 0 FAIL**. E két browser-suite összesen **26/26**, a 1788 npm-teszttől külön.
- Az első mobilrun hibás FIELDSET-assertionje után a javított próba mindkét motoron igazolta a tényleges DOM-disabled állapotot és a vezérlő örökölt tiltását. Nyitott teszthiba nem maradt. A korábbi sikertelen futás történeti eredménye megmarad.
- Módosított fájlok: az új script és `.github/workflows/sarberki-gmail-mobile.yml`. A workflow a kapcsolódó jóváhagyási UI-fájlok változására is fut, és külön eredmény-artifactot tárol hét napig. Syntax/diff-check PASS.

| Új böngészős ellenőrzés | Chromium | WebKit |
| --- | --- | --- |
| Német MIME betöltése, nincs automatikus mentés, explicit Writer new/duplicate | PASS | PASS |
| Writer-tervezet előkészítése nem jóváhagyás | PASS | PASS |
| Reader nem töltheti be a jóváhagyási rekordot | PASS | PASS |
| Nem igazolt ár/kapacitás szimulált szerverelutasítása törli a jóváhagyást | PASS | PASS |
| Másik ügy választása érvényteleníti a megerősítést, új POST nélkül | PASS | PASS |
| Külön approver pontos tervezethash és szintetikus auditválasz | PASS | PASS |
| 390px szélesség, 44px gombok, kijelentkezés és tiltás | PASS | PASS |

A helyi első indítás előtt hiányzott a Playwright Chromium bináris; emiatt a script a böngészőnyitásnál megállt, alkalmazáspróba nem futott. A meglévő CI telepíti Chromiumot/WebKitet; nem telepítettünk új csomagot és nem változott lockfile. A korábbi sikeres mentés és élő Gmail-próba nem ismétlődött.

## Biztonság és következő lépés

Alkalmazáskód, adatbázis, jogosultság, ár-/kapacitásszabály, production és main nem változik. A CI a tesztágra fut. Nincs e-mail, Pushover, Previo-hívás vagy valódi foglalás. A friss titkosított mentés továbbra is a [korábbi ellenőrzött állapotban](../v1-backup-pwa-2026-10-17/REPORT.md) érhető el.

V1-becslés: 92%; új böngészős teszt önmagában nem indokol nagyobb százalékot. Következő konkrét elfogadási kapu tényleges iPhone/Safari és főképernyős mód. A teljes platform/Auth-recovery és a Previo tesztkapcsolat utáni hiteles forrásos jóváhagyási próba külön hátralévő feladat. V2/V3 érték: a meglévő közös kód és külön Writer/Reader/approve határ ellenőrzése, új jogosultsági rendszer nélkül.
