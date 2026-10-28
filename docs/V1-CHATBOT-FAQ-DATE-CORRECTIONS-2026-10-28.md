# Chatbot V1: FAQ és dátummódosítás – 2026-10-28

Kiindulópont: `34430892bfff860d114872e724a70adbcac15147`, tesztág: `gmail-test-subject-allowlist`.

## Reprodukált hibák és javítások

1. Aktív érdeklődés közben a bejelentkezési FAQ nem mindig kapta meg a meglévő tájékoztató választ; szlovénul a konkrét kérdésre nem jelent meg az időpont. A FAQ a már jóváhagyott nyelvi szöveget adja vissza, a megőrzött ügyadat változatlan. Az ugyanazon üzenetben értelmezett időszakmódosítást továbbra is feldolgozzuk.
2. Magyar, német és angol önálló „szabad dézsa?” kérdés szálláskapacitási ágra kerülhetett. A csak dézsára vonatkozó kérdés a külön díjas, külön ellenőrzést előíró meglévő szöveget kapja. A szállást is kérő összetett foglalási érdeklődés továbbra foglalási ág.
3. A külön címkézett angol érkezési/távozási dátum nem volt felismerhető, az aktív ügyben pedig a korábbi dátum maradt meg. A közös parser a magyar, német, angol és szlovén címkézett ISO dátumpárt dolgozza fel. Hiányos vagy érvénytelen új ISO dátum esetén a chat eldobja a korábbi időszakot, és pontosítást kér; nem állít kapacitást. A gyermekek, létszám, szállástípus és a közös döntési architektúra megmarad.

## Ellenőrzés

- Célzott szintetikus próbák lefedik a négy nyelvet, az email/chat közös döntést, hibás/hiányos/ismételt/felcserélt dátumot, a régi dátum törlését, a külön dézsadíjat és a korábbi ügyadat megőrzését.
- Kapacitást érintő dátumváltozás miatt teljes `npm test` és meglévő kapacitásregresszió kötelező. A számokat és az adott commitra futott CI linkjét a munkamenet végén kell jelenteni.
- A Chromium/WebKit 390 px loopback mobilpróba a bejelentkezési/dézsa FAQ-t és az érvénytelen új dátumot is ellenőrzi. Ez emuláció, nem valódi iPhone.
- Külső Previo/Gmail-művelet, levélküldés, valós foglalás, új üzleti szabály vagy kulcs nem történt. A fizikai iPhone- és külső integrációs kapuk változatlanul nyitottak.

V2/V3 érték: a négy nyelv címkézett dátumait a meglévő közös parser kezeli, az állapot frissítése csatornaadapterben történik. A biztosíték nem garantál minden természetes nyelvű dátumfordulatot: ilyen esetben további pontosítás szükséges.
