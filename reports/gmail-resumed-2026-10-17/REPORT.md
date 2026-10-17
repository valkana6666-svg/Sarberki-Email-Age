# Gmail-olvasás folytatása – 2026-10-17

## Aktuális eredmény
A felhasználó kézi böngészős hitelesítése után a tesztoldal friss pozitív
Gmail-eredményt mutatott, build: 7b18ea6. A november 13–15-i, önmagát
szintetikusnak jelölő magyar levélből helyesen megjelent: két éjszaka,
két felnőtt, két gyermek, négy fő, dézsa/horgászat, helyi választervezet.
Újranyitáskor ugyanaz a helyi ügyazonosító és duplicate jelent meg.
Ez helyi olvasási/duplikációs bizonyíték, nem felhős Writer-mentés.

A korábbi retained_data_restricted akadály ezen olvasásra feloldódott.
Nincs szükség ugyanennek az OAuth-próbának ismétlésére.

## Határ és azonosítási hiba
Ez nem a privát felhős receipt (október 30–november 1., nyolc felnőtt).
Egy korábbi listaelemet a koordinátor elégtelen metadata alapján tévesen
jelölt mintaként és megnyitott; a tartalom eltért. Nem exportálta, nem mentette
felhőbe, nem tette repositoryba, és visszatért az igazolt szintetikus levélhez.
A levél eredete nem igazolt; további levelek találgatásos megnyitása leállt.
Ezért nem állítunk teljes, kizárólag igazolt mintákból álló végponttól végpontig
próbát. Következő receipt-olvasás előtt pontos, nem titkos kiválasztási
azonosság szükséges; a dátum/tárgy önmagában nem elegendő.

Új felhős írás, Reader/audit-visszaolvasás, jóváhagyás, e-mail/Pushover,
Previo-kérés vagy foglalás nem történt. A privát allowlist változatlan.
A teljes azonos receipt-lánc továbbra NEM IGAZOLT.

## UI-eltérés
A szintetikus levélnél a Gmail panel hiánylistája „Nincs megadva” állapotot
mutatott, miközben az alsó adatlapon hiányzó gyermekkor/telefon/háztípus,
a tervezetben megfelelő pontosító kérdések szerepeltek.
Ez külön reprodukálandó megjelenítési eltérés; most nincs javítási állítás.
A belső jóváhagyási gomb engedélyezettnek látszott, de nem nyomtuk meg;
ebből nem következik szerveroldali jóváhagyási jogosultság.

## Ellenőrzött meglévő CI
Kód/CI HEAD: 7b18ea6624d6d7bf100f2902425ec20d98d09f07.
[CI 39008979691](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/39008979691),
test job 117327197725: 1677 PASS / 0 FAIL / 0 SKIP.
Exact deploy PASS ugyanarra a teljes SHA-ra. Élő Previo-smoke külön SKIPPED.
A külön multilingual workflow 39008979703 is SUCCESS.
Nem indítottunk új npm/CI/provider tesztet; ez dokumentációs folytatási pont.

V1 becslés továbbra kb. 90%. Hátra: azonos pontos receipt teljes lánca,
tényleges iPhone/PWA, végső snapshot/restore, későbbi Previo-tesztkapcsolat.
V2/V3: forrásazonosság és olvasás/írás/jóváhagyás elkülönítése megmarad.
