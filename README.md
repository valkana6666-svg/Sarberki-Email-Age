# Sárberki érdeklődéskezelő – tesztág

A `gmail-test-subject-allowlist` ág külön Netlify tesztprojektje:
https://leafy-chimera-2403e5.netlify.app/ — felületi verzió: v0.3.8 TEST.
A `main` és a külön éles Netlify projekt nem része ennek a tesztnek.

## Gmail, csak olvasás

A böngészős OAuth kizárólag `gmail.readonly` scope-ot kér. A fiók a
Google-ablakban választott `users/me` fiók; a tesztkapuhoz kijelölt fiók
`sarberkiprojecttest@gmail.com`. A query:
`in:inbox newer_than:30d -category:promotions -category:social`.
A queryben nincs tárgyfeltétel. A beolvasott teljes levelek közül a helyi
`gmail-subject.mjs` csak az alábbi pontos tárgyakat engedi át
(kis-/nagybetű és szélső szóköz eltérés megengedett):

- Érdeklődés a szállásról
- Érdeklődés a szallasrol
- Érdeklődés szállásról

A találatok közül a legújabb `internalDate` alapján készül a kezelői rekord.
A rekordban eredeti szöveg, forrás, normalizált mezők, bizonytalanságok,
hiányok és szerkeszthető választervezet jelenik meg. A kézi JSON-betöltés
opcionális tartalék út. A válasz emberi ellenőrzést igényel; automatikus
e-mail-küldés és foglalásmódosítás nincs. Az aktuális kiadás valós Gmail
OAuth → rekord → felület végigfutása még nincs újra élőben igazolva.

## Ár és kapacitás

A nyilvános foglalási oldal Previo-keretet használ. A szerveroldali
Chromium-próbán a `sarberkito.hu/foglalas/` Cloudflare-ellenőrző keretet
szolgáltatott, a Previo iframe nem jelent meg. Emiatt a Netlify
`/api/price-quote` validált input után 503-as JSON
`status: unverified` választ ad. A felület kézi ellenőrzést kér,
nem jelenít meg becsült összeget, és a vendégtervezetbe nem kerül ár.
Ez az útvonal nem igazol szabad kapacitást, dátum-, létszám-, háztípus-
vagy egységszintű élő árat. A `price-quote.mjs` kísérleti böngészős
adaptere megmaradt helyi fejlesztésre, de a Netlify-funkció nem futtatja.
Gyermekár és több egység automatikus árazása nincs kész.

## Ellenőrzés

`npm install && npm test` fut a GitHub Actions tesztági workflow-ban.
A tesztek a tárgyszűrő tényleges elfogadó/elutasító eseteit, a dátum
és háztípus normalizálását, a fő árinput-korlátokat és a 503-as,
nem igazolt ár JSON-választ is ellenőrzik. A CI sikere nem bizonyít
valós Gmail-beolvasást vagy Previo-árat.

Élő kiadási kapu: kijelölt fiók OAuth-ja; jóváhagyott tárgyú tesztlevél
automatikus beolvasása; egységes rekord és választervezet megjelenése;
emberi jóváhagyási határ ellenőrzése. Élő árhoz külön, engedélyezett,
csak olvasási adatforrás és valós ár-összehasonlító teszt szükséges.
