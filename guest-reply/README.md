# Publikus válaszmag – előkészítés

Ez a könyvtár a vendégnek szánt válaszlogika leválasztott, **még nem bekapcsolt** új magja.

## Cél

A vendégválasz csak két forrást láthat majd:

1. a vendég saját, megtisztított foglalási adatait;
2. a `public-answer-data.mjs` fájlban kifejezetten vendégnek engedélyezett információkat, illetve külön jóváhagyott ár- és elérhetőségi eredményt.

A modul szándékosan nem importálja a teljes üzleti konfigurációt, a belső ügyállapotot, a PMS/árforrás technikai adatait vagy kezelői megjegyzéseket.

## Biztonsági határ

A `public-answer-contract.mjs` mező- és témalistával szűri a bemenetet. Ismeretlen mezőket eldob. Jóvá nem hagyott ár nem kerülhet a modellbe. Elérhetőség csak `verified: true` esetén kerülhet be. Fizikai osztott egységazonosító és belső technikai kifejezés nem kerülhet a vendégszövegbe.

A `public-answer-renderer.mjs` kizárólag a szűrt modellből és a publikus adattáblából épít szöveget.

## Jelenlegi állapot

NINCS bekötve az `index.html`, a Gmail-feldolgozó, az árlekérő vagy a jelenlegi választervezet helyére. Emiatt ennek az előkészítő commitnak nem szabad megváltoztatnia a mostani tesztoldal működését.

Visszaállítási kiindulópont az előkészítés előtt:
`9ae3159286309ed7c303226c27c22b26b27e3901`

A következő lépés csak külön döntés után lehet: a jelenlegi vendégválasz útvonal mögé kapcsolható funkciókapu, majd célzott videós teszt. A régi útvonalat addig nem töröljük.
