# Sárberki V1 – Gmail tesztküldés biztonsági kapu (2026-10-27)

Állapot: TERV / NEM TELEPÍTETT. Kizárólag a gmail-test-subject-allowlist ágon, éles Gmail-küldés nélkül.

## Igazolt alap
- A Gmail böngészős beolvasó `gmail-readonly.js` csak `https://www.googleapis.com/auth/gmail.readonly` scope-ot kér.
- Az exact Gmail-ügy `13c8ecb7-f836-4e2c-9833-d58ee96f2dda` zárt telefonszám-pontosító jóváhagyása v6; reviewedRevision v5; scope `clarification-only-v1`. Ez NEM foglalás- vagy szállásajánlat-jóváhagyás.
- Az iPhone tesztfelület az adatbázis-visszaolvasást és auditot megmutatta; ez nem bizonyít Gmail-küldést.
- A korábbi exact Gmail → Writer → Reader hosted próba 2026-10-26 sikeres volt; nem kell megismételni.

## Kötelező kapuk – mielőtt egyetlen tesztüzenet kimehet
1. A readonly és send OAuth-hatáskörét ne vonjuk össze automatikusan. Küldésre csak a külön `https://www.googleapis.com/auth/gmail.send` engedély kérhető; az alkalmazás nem kérhet teljes `mail.google.com` scope-ot.
2. A küldés külön, alapból kikapcsolt tesztfunkció; CSAK `sarberkiprojecttest@gmail.com` célcím engedélyezett és a forrásfiók azonossága külön ellenőrzendő. Production, a Sárberki valódi ügyfelei, CC/BCC, átirányítás: tiltott.
3. Szerveroldalon és küldéskor frissen ellenőrizendő: tenant, pontos ügyazonosító, jóváhagyási scope, jóváhagyó eltér a szerkesztőtől, reviewedRevision, aktuális caseRevision, megőrzött tervezet-hash, jogosult munkamenet és CSRF. A `clarification-only-v1` kizárólag az előre rögzített telefonszám-bekérő szöveget engedélyezheti, foglalási/ár/kapacitás-ígéretet soha.
4. Pontosan egyszeri végrehajtási kulcs: tenant + case + approval revision + draft hash + destination. Bizonytalan hálózati eredménynél ne küldje újra automatikusan; külön, felügyelt egyeztetés szükséges.
5. Küldés előtt az összes MIME fejlécet és a címzettet validálni kell. Ne engedjen tetszőleges szöveget, címzettet vagy hamis From/Reply-To értéket a böngészőből.
6. Sikeres Gmail API válasz esetén csak a szükséges, nem érzékeny bizonyíték naplózható (message ID, thread ID, timestamp, jóváhagyási revízió, idempotency); hozzáférési token, jelszó, magánlevél-törzs és Google titok soha.
7. A tesztküldés csak a felhasználó külön jóváhagyása után indulhat. A v6 belső jóváhagyás nem jelent küldési engedélyt.
8. A `gmail.send` aktiválása előtt ellenőrizni kell a Google OAuth consent/testing és engedélyezett tesztfelhasználók helyzetét. GitHub Secrets-t és Netlify kulcsokat megkerülő megoldás tilos.
9. Előbb izolált automatizált negatív tesztek: nincs token/scope, Reader jogosulatlan, régi revision/hash, más tenant, más címzett, módosított tervezet, párhuzamos/ismételt kattintás, hálózati timeout, Gmail 401/403/429/5xx. Minden negatív próba nulla küldést és megfelelő auditot bizonyítson.
10. Zöld CI és review után legfeljebb egy összevont Netlify TESZT-kiadás; konkrét build SHA ellenőrzése. Main/production érintetlen.

## Források
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
- https://developers.google.com/workspace/gmail/api/auth/scopes

## Következő munka
A létező küldési implementáció és jogosultsági infrastruktúra felmérése után készülhet külön, alapból tiltott dry-run/szimulációs végpont és annak negatív tesztje. Semmilyen éles küldést ne indítsunk addig, amíg ez a kapulista nincs igazolva.
