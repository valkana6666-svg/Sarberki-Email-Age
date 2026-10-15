# WORK ÁTADÁS — SÁRBERKI V1, 2026-10-15
Határidő: 2026-10-18 vasárnap este (Europe/Budapest). A felhasználó hétfőtől dolgozik, ezért csütörtök–vasárnap elsőbbségi fejlesztési időszak.

## Fő utasítás
Folytasd a meglévő V1 projektet a legutóbbi igazolt commitból; ne kezdd újra. Kizárólag a valkana6666-svg/Sarberki-Email-Age repository gmail-test-subject-allowlist ágán dolgozz. Main/production, valódi vendégadatok, automatikus e-mail-küldés, Previo-írás tilos. A V2 tudásbázis a docs/v2/V2_OTLETTAR_ES_BACKLOG.md fájlban van; V2 funkciót most ne implementálj.

## Azonnali sorrend
1. Ellenőrizd a branch aktuális commitját, CI-t, teszteket, telepítést és a mentések visszaállíthatóságát. A korábbi 92%-os készültséget és 1501 PASS értéket csak történeti becslésként kezeld, ne friss tényként.
2. Első blokkoló: friss Gmail OAuth olvasási kapcsolat a kizárólagos sarberkiprojecttest@gmail.com tesztfiókban. Csak gmail.readonly, Inbox, fiókazonosság ellenőrzés. Az emberi bejelentkezéshez/engedélyhez kérj célzott közreműködést; ne kérj jelszót vagy tokent chatben.
3. HU/DE/EN/SL válaszok, gyermekkorok, hiányzó adatok, háztípusok regressziója; javíts csak bizonyított hibát.
4. Previo nyilvános, csak olvasási foglaltság- és árpróba; kizárólag igazoltan szabad egység ajánlható; osztott A/B/C mapping hiányában kötelező emberi ellenőrzés. Ne használj nem engedélyezett végpontot.
5. Jogosultság-, audit-, emberi jóváhagyás-, mentés-, deployment-sync- és végponttól végpontig tesztek. Tesztoldal iPhone-ellenőrzés, ha emberi lépés kell.
6. Október 18-án ellenőrizhető V1 átadási jegyzőkönyv: pontos commit, teszteredmények, bizonyított és nyitott funkciók, biztonsági korlátok, visszaállítási lépések.

## Munkamód
Önállóan haladj, amíg nem kell hitelesítés vagy valódi emberi jóváhagyás. Codexnek add át a jól körülhatárolt kódmunkát, majd ellenőrizd a változásokat. Ne ismételj sikeresen lezárt feladatokat. Minden nagyobb lépésnél rövid bizonyíték és következő feladat. Ha külső kapcsolat nem igazolható, ne állítsd késznek; folytasd a független teszteket. Az október 18-i cél nem indokolja a biztonsági kapuk megkerülését.

## Használati keret
A felhasználó 11:41 körüli automatikus megújulást vár, de ezt ellenőrizni kell. Egy külön keret-visszaállítás felhasználása csak akkor javasolt, ha tényleges korlát akadályozza a határidős munkát; a döntést a felhasználó hozza meg. Ne kezdeményezz visszaállítást automatikusan.
