# Gmail V1 – ellenőrzött lezárási kiegészítés
Dátum: 2026-10-28 (Europe/Vienna). Kizárólag gmail-test-subject-allowlist.

## Friss, szűk bizonyíték
- CI-hiba reprodukálva f78969398fc772bc732575c7a57c8da97ec0fc19 commiton: az eldobható PGlite környezetből hiányzott anon/authenticated; az elvárt migráció-elutasítás után a teszt nem hajtott végre rollbacket.
- Javítás: 185f056892e507112608fa4b88f84a6b1d00e78e. Csak tests/gmail-send-ledger-pglite.test.mjs; nincs SQL- vagy alkalmazásjogosultság-módosítás.
- Közvetlen táblajog-ellenőrzés: c7be513bf063e2f3c4917d85ddeeecbdd76d6a55. Anon/authenticated SELECT/INSERT/UPDATE/DELETE tiltva mindkét küldési táblán; kezdeti küldési tagság és RLS-policy száma nulla. Eldobható PGlite, nem hosted telepítés.
- Teljes helyi csomag: 2297 PASS / 0 FAIL / 0 SKIP. A két célzott PGlite-próba a teljes csomag része, nem hozzáadandó.
- Teljes CI SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40630616874
- Kapacitásregresszió SUCCESS: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40630616747
- A deploy-verification opcionális, kihagyott feladata nem telepített E2E PASS.

## Tényleges böngészős szerver-visszaolvasás
A meglévő cloud-approval.html tesztfelületen normál, hitelesített cookie-munkamenet állt helyre. Teljes reload után kézzel megadott exact tesztügy és a „Tárolt állapot, tervezet és audit visszaolvasása” művelet:
- v6, approval=pending, serverApproval=null, readOnly=true.
- A tárolt telefonszám-bekérő angol tervezet és magyar ellenőrző szöveg látható.
- clarificationApproval: scope clarification-only-v1, template missing-phone-en-v1, reviewedRevision=5, approvedRevision=6, factsRevision=0.
- A külön pontosító-jóváhagyás hash-kötése és v4/v6 auditeseménye visszaolvasható.
- A külön pontosító betöltés korábbi jóváhagyást jelzett; új jóváhagyás nem történt.
Ez a tartós visszaolvashatóság friss bizonyítéka. Nem új Writer-mentés, nem új Approver-aktus, nem friss négynyelvű hosted E2E, nem küldési engedély. A régi v5-adatbázisleltár történeti marad.

## FORBIDDEN / 404 értelmezés
Az október 26-i exact Gmail hosted dedup/reload bizonyíték: docs/EXACT-GMAIL-HOSTED-ACCEPTANCE-2026-10-26.md. A történeti mentési FORBIDDEN pontos oka nincs bizonyítva; sikeres későbbi mentés nem gyökérok-javítás.
A tulajdonos iPhone-képei igazolták az exact szintetikus Gmail-üzenet megnyitását. Egy későbbi 404 oka nem állapítható meg a képekből. A kijelölt levél külön Gmail-plugin olvasással elérhető volt a tesztfiók INBOX-ában; ez nem ugyanazon böngésző OAuth-munkamenetének bizonyítéka.

## Hátralévő feladatok elkülönítése
Most elvégezhető: a már meglévő, küldés nélküli jelölt kód célzott biztonsági felülvizsgálata, hiányzó negatív/rollback teszt csak konkrét rés esetén, bizonyítékok egyeztetése. A fenti sikeres tesztek nem ismétlendők változtatás nélkül.
BLOCKED – tényleges Gmail-visszaküldés: nincs bekötött szerveres küldőút, független felhős send-jog és tranzakciós audit/ledger-integráció; a SQL csak jelölt, nem telepített. A gmail.send külön OAuth-hozzájárulás és biztonságos szolgáltatói hitelesítés hiányzik. Új titkot/OAuth-beállítást igénylő lépések a tulajdonosi utasítás szerint függőben.
A hosted küldési séma előtt a dokumentált restore/rollback/review kapuk érvényesek. Sem Writer, sem Approver nem örökölhet send-jogot. A v6 pontosító-jóváhagyás nem hagyja jóvá a szállásajánlatot.
Previo API: külön integrációs kör; nem része az API nélküli V1 készültségének. Élő ár/kapacitás, szolgáltatói mapping és írás mellékhatásai nem találhatók ki.

## Készültség és következő három feladat
A feladatindításkor közölt 91% mérnöki becsléshez most nem rendelünk önkényes százalékpontot. Nincs bizonyíték 100%-ra. A régi 85%/84,4% dokumentumok más időpont/scope szerinti történeti számok.
1. A küldési jelölt tranzakciós állapotkezelésének és rollbackjének hiányelemzése, automatikus küldés nélkül.
2. A hosted send-jog/ledger bevezetés konkrét, auditálható csomagja a meglévő biztonsági kapuk betartásával; aktiválás nélkül.
3. A hiányzó OAuth/titok-hozzáférés rendezése után külön engedélyezett, kizárólag tesztcímzettű teljes küldési/kézbesítési próba.

Ebben a kiegészítésben nincs új tesztfutás, deploy, export, restore, adatbázisírás, e-mail/Pushover vagy Previo-művelet. Main, production és PR #7 érintetlen. V2/V3 érték: külön olvasás/írás/jóváhagyás/küldés határ és audit megőrzése.
