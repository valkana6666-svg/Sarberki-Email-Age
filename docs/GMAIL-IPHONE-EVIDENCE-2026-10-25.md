# Gmail V1 – iPhone eredetpróba és többnyelvű bizonyíték, 2026-10-25

## Fizikai készülékpróba: PASS, korlátozott bizonyítékkal

A tulajdonos hét iPhone-képernyőképet adott át (IMG_9166–IMG_9172). A felületen a „Gmail readonly API-olvasás · böngészőben megfigyelt, szerveroldalon nem igazolt” eredet és 2026-10-25T07:53:47.204Z olvasási idő látható (08:53:47 Europe/Vienna). A napló későbbi újranyitást is jelez; az újranyitás nem új API-olvasás.

A kijelölt szintetikus levél feldolgozása: november 13–15., két éjszaka, két felnőtt és két gyermek, dézsakérés, magyar nyelv. Hiányzó telefonszám és gyermekéletkorok jelzése látható. A duplicate jelzés meglévő ügyre utal; új Writer-mentés/DB-idempotencia kizárólag a képek alapján nem igazolt.

A képek nem bizonyítanak új felhős mentést, szerveroldali Gmail-eredetigazolást, jóváhagyást, ár- vagy kapacitáslekérdezést. A kapacitás tiltva maradt; ezt a próbát nem ismételtük. iOS-verzió és Safari/PWA mód nem állapítható meg biztosan. A korábban ellenőrzött telepített build 20c0c9dfd8e17f75bd54381db5268101c92ad91b; a képekből új buildazonosító nem olvasható ki.

## Meglévő többnyelvű tesztek: PASS, szintetikus

Frissen visszaolvasott GitHub-futás: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40167974792
Commit: 55d9ea22bcace76c2af9efa534d6557fe02d6025.
Job: 121092810862, 1907 PASS / 0 FAIL / 0 SKIP.

A tényleges jobnaplóban HU/DE/EN/SI sikeres esetek szerepelnek a tervezet dátumainak és háztípusának megőrzésére, ismeretlen kapacitás kezelésére, előleg/fizetési határidőkre és tulajdonosi jóváhagyás nélküli lemondási közlés tiltására. Forrás: tests/multilingual-booking-parity-v1.test.mjs. A SI a projekt szlovén belső nyelvkódja.

Ezek nem új idegen nyelvű Gmail API- vagy fizikai iPhone-próbák, és nem teljes felhős jóváhagyási bizonyítékok. A már sikeres teszteket nem indítottuk újra.

## Következő elfogadási pont

A még nem igazolt többnyelvű felhős mentés/jóváhagyás meglévő bizonyítékainak tételes összevetése; csak tényleges hiány esetén új, elkülönített szintetikus ügy használata. Korábbi jóváhagyást nem ismétlünk. Élő Previo, vendégküldés és Pushover nem indult. Új Netlify-telepítés nem szükséges; ez dokumentációs frissítés.

V2/V3 érték: a böngészős forrásmegfigyelés, szerveres bizonyíték és műveleti jogosultság továbbra is külön határ.
