# Friss Gmail → pontos receipt → felhős visszaolvasás, 2026-10-17

## Igazolt élő lánc
Tesztoldal, látható build és kód: `7849d5694b9b800cbe48cdd8cbc55c8c6d0b0015`.
Kizárólag gmail-test-subject-allowlist. A Google figyelmeztetését a koordinátor
automatikus felülvizsgálata elutasította; a felhasználó kézi böngészőátadást
kapott. Folytatási jelzése után friss pozitív Gmail-eredmény jelent meg.
Nem a popup bezáródásából következtettünk sikerre.

A korábbi előzményben megadott pontos üzenetazonosítóval a meglévő
syntheticGmailMessageId mód futott. A felület egyetlen kiválasztott levelet
mutatott: október 30–november 1., nyolc felnőtt, Test Guest.
A forrásazonosító és a korábban megadott tárgy/idő egyezett. A Gmail-azonosítót,
személyes feladót, nyers fejléceket és tartalmat nem másoljuk a repositoryba.
A kód fiókellenőrzés után csak az egy kiválasztott levél GET-jét használja;
ennek meglévő offline bizonyítéka gmail-scoped-read.test.mjs.
Nem állítunk új hálózati forgalomrögzítést vagy szerveroldali Google-hitelesítést.

## Normál Writer-kísérlet és olvasási audit
A „Betöltött Gmail-tesztlevél mentése · Writer” explicit gomb sikeres választ
adott a normál cookie-alapú munkamenettel:
`13c8ecb7-f836-4e2c-9833-d58ee96f2dda`, változatlan v1,
„Meglévő privátan engedélyezett szintetikus tesztügy”.
Ez meglévő ügyhöz deduplikált visszajátszás, NEM új v1 beszúrás.
Nem módosítottunk privát engedélylistát, feladót, szerepet vagy sémát.

Ugyanazon caseId/v1 normál szerveres olvasási előnézete sikeres.
Látható: ügyverzió 1, tényverzió 0, tárolt tervezetverzió egyező,
pending, nem igazolt kapacitás és ár, tiltott jóváhagyás.
Az auditjelzés „visszaolvasva · létrehozás · v1”, a szerver ellenőrizte
a last-writer és a PostgreSQL snapshot/audit hash egyezését:
`b04dc79ee54c1de22db89e3936b8ee631ef4f3347ba160a14a8eac6878e92b3c`.
Ez a korábban tárolt beszúrás auditja, nem mostani új írás vagy jóváhagyás.

A Reader-felület olvasási végpontját a meglévő Writer-munkamenettel használtuk.
Külön Reader-szerepű új belépés/írástiltási próba most NEM történt; annak korábbi
igazolt eredményét nem nevezzük ennek a munkamenetnek.
A friss OAuth → pontosan engedélyezett receipt → normál dedup → ugyanazon
felhős ügy és audit visszaolvasása kombinált bizonyíték így megvan.

## Tesztek és még nyitott kapuk
[Az alkalmazott kód CI-je](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39011573593):
SUCCESS, 1688 PASS / 0 FAIL / 0 SKIP, exact deploy PASS. A kapacitásworkflow
39011573589 is SUCCESS. Ezek korábbi ellenőrzések, most nem indítottuk újra.
Ez a szakasz böngészős elfogadási próba és dokumentáció, nem új kódfejlesztés.

Új DB-beszúrást, külön második Writer-kísérletet, új Reader-szerepű próbát,
AI-fordítást, teljes audit-history láncot és tényleges iPhone/PWA-t nem állítunk.
Nincs e-mail/Pushover, Previo-kérés/írás vagy foglalás. Production/main érintetlen.

Új megfigyelés: nyolc explicit felnőttnél a helyi Gmail-figyelmeztetés még
gyermekstátuszt kér, bár a közös választervezet már nem kérdez rá.
Ez külön UI/állapotparitás-regresszióként javítandó; a régi felhős v1-et
miatta nem írjuk át. Hátra továbbá a tényleges iPhone/PWA, végső snapshot/restore
és a későbbi Previo-tesztkapcsolat; utóbbira továbbra nem vár a többi munka.

V1 becslés kb. 91%: az azonos üzenetes kombinált bizonyíték hiánya lezárult,
a többi elfogadási kapu megmaradt. Ez mérnöki becslés, nem tesztarány.
V2/V3: a csatornaolvasás, tárolási jogosultság, kapacitás/ár, jóváhagyás és
külső végrehajtás külön határa változatlan.
