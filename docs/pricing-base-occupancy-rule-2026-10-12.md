# Sárberki – kötelező alapárazási szabály (2026-10-12)

## Jóváhagyott üzleti szabály
- VIP, családi (2–6), Deluxe (11–14), osztott emeleti C (7C–10C): **négyfős alapár** akkor is, ha 1, 2 vagy 3 vendég érkezik. Négy főnél ugyanaz az alapár; négy fő felett kizárólag az adott egységhez érvényes, hiteles díjszabás szerinti többletdíj alkalmazható.
- Osztott A/B (7A–10B) és 15-ös különálló: **kétfős alapár**, tényleges maximális befogadóképességük két fő.
- Az elérhetőséget és kapacitást mindig **a tényleges felnőtt- és gyermeklétszámmal, gyermekéletkorokkal** kell ellenőrizni; a minimum alapárhoz tartozó létszámot nem szabad tényleges vendégként átadni a Previo-nak.
- Az alapár minimumlétszám-logikája belső számítás; vendégnek csak a helyes végösszeget és a szükséges árösszetevőket közöljük, nem azt, hogy négy vendéggel számoltunk.
- IFA, szezonfelár, egyéjszakás felár, kedvezmény és extra szolgáltatások külön, a hatályos szabályok szerint. Hiányzó/ellentmondó díjtételt nem szabad kitalálni.
- A szabály a chatbot és az e-mail-agent közös árazási logikájára egyaránt kötelező. Éles rendszer módosítása tilos.

## Kötelező regressziós példák (mindkét csatornán)
1. 2 felnőtt VIP: 2 fővel kapacitásellenőrzés; 4 fős VIP alapár; 0 gyermek, gyermekre nincs visszakérdezés.
2. 3 felnőtt családi: 3 fővel ellenőrzés; 4 fős alapár.
3. 2 felnőtt Deluxe: 2 fővel ellenőrzés; 4 fős alapár.
4. 3 felnőtt Deluxe: 3 fővel ellenőrzés; ugyanaz a 4 fős alapár.
5. 2 felnőtt 7C: 2 fővel ellenőrzés; 4 fős alapár.
6. 4 felnőtt 8C: 4 fővel ellenőrzés; 4 fős alapár.
7. 2 felnőtt 7A vagy 7B: 2 fővel ellenőrzés; 2 fős alapár.
8. 2 felnőtt 15-ös: 2 fővel ellenőrzés; 2 fős alapár.
9. 4 felnőtt 15-ös: kapacitás miatt kizárva; nem ajánlható.
10. 2 felnőtt + 1 gyermek (7 éves), családi: 3 tényleges fővel ellenőrzés; 4 fős alapár; gyermek életkora továbbadandó.
11. 2 felnőtt + 2 gyermek (7 és 11 éves), Deluxe: 4 tényleges fő; 4 fős alapár.
12. 5 felnőtt VIP: 5 tényleges fővel ellenőrzés; 4 fős alapár + kizárólag igazolt ötödik fő díja, ha van.
13. 6 felnőtt, nincs háztípus: minden megfelelő befogadóképességű típus ellenőrzése; 2 fős egységek és egyetlen C egység kizárva; minden igazoltan szabad típusból egy ajánlat.
14. Konkrétan kért szabad típus: csak a kért típus ajánlása. Igazoltan foglalt: összes kapacitásnak megfelelő, igazoltan szabad alternatíva típusonként egy-egy.
15. Previo ár/elérhetőség ismeretlen: tilos biztos árat, foglaltságot vagy szabad kapacitást állítani.

## Elfogadási feltétel
Kódimplementáció, célzott automatizált tesztek és mindkét csatorna regressziója szükséges; a dokumentáció önmagában nem bizonyítja a megvalósítást.