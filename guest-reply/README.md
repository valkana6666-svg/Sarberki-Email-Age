# Publikus válaszmag – elkülönített próba

Ez a könyvtár a vendégnek szánt válaszlogika leválasztott, a régi tervezettől **függetlenül, kézzel indítható** új magja.

## Cél

A vendégválasz csak két forrást láthat majd:

1. a vendég saját, megtisztított foglalási adatait;
2. a `public-answer-data.mjs` fájlban kifejezetten vendégnek engedélyezett információkat, illetve külön jóváhagyott ár- és elérhetőségi eredményt.

A modul szándékosan nem importálja a teljes üzleti konfigurációt, a belső ügyállapotot, a PMS/árforrás technikai adatait vagy kezelői megjegyzéseket.

## Biztonsági határ

A `public-answer-contract.mjs` mező- és témalistával szűri a bemenetet. Ismeretlen mezőket eldob. Jóvá nem hagyott ár nem kerülhet a modellbe. Elérhetőség csak `verified: true` esetén kerülhet be. Fizikai osztott egységazonosító és belső technikai kifejezés nem kerülhet a vendégszövegbe.

A `public-answer-renderer.mjs` kizárólag a szűrt modellből és a publikus adattáblából épít szöveget.

## Jelenlegi állapot

Az `index.html`-ben külön, összecsukott próbanézetként elérhető, amely nem írja felül a régi tervezetet. A Gmail- és árlekérő modulba nincs bekötve; nem küld levelet. A próbanézet még nem vesz át jóváhagyott árat vagy kapacitásadatot: ezekre csak ellenőrzés utáni, nem megtévesztő tájékoztatást ad.

Visszaállítási kiindulópont az előkészítés előtt:
`9ae3159286309ed7c303226c27c22b26b27e3901`

A következő lépés: szigorúan ellenőrzött ár-/elérhetőség-adapter és célzott végponttól végpontig teszt. A régi útvonalat addig nem töröljük.
