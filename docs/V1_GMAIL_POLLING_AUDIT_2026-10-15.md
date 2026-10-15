# Sárberki V1 – Gmail/Pushover mellékhatás-ellenőrzés (2026-10-15)

## Kódellenőrzés
Forrás: `gmail-readonly.js`, `gmail-policy.mjs`, `gmail-policy.test.mjs` a `gmail-test-subject-allowlist` ágon.

- A Gmail-olvasás `gmail.readonly` OAuth scope-pal működik; a tesztfiók azonosítását az Inbox-listázás előtt végzi.
- A fájl tartalmaz `sendPushoverForMessage`, `pollPushoverWatch` és `startPushoverWatch` függvényeket, amelyek *aktiválás esetén* `/api/pushover-gmail` POST értesítést küldhetnek, és percenként ellenőriznének.
- A fájlban `startPushoverWatch` hívási helye nem található; a jelenlegi `readWithToken` / OAuth callback útvonal sem indítja el. A kódban külön megjegyzés tiltja, hogy a V1 Gmail-olvasás automatikus Pushover-küldést indítson.
- Ez **nem** bizonyítja a Netlify-on futó verzió azonosságát a repositoryval, sem azt, hogy más kódban vagy külső ütemezésben nincs értesítés. A repositorybeli funkciók önmagukban nem igazolják aktív figyelés működését.

## V1 döntés és kockázat
A felhasználó korábban kérte a költséges, automatikus figyelés leállítását. Emiatt ne kapcsoljunk be pollingot vagy Pushover-küldést a V1 lezárása során. Ne távolítsuk el automatikusan a nem használt kódot: előbb azonosítani kell a hivatkozásokat és a Netlify telepített verzióját. Az olvasási és emberi jóváhagyási E2E elsőbbséget élvez.

## Következő ellenőrzési feladatok
1. Teszt-Netlify deployment commitjának és környezeti beállításainak összevetése a tesztággal, titkok kiolvasása nélkül.
2. Pushover-funkció esetleges külső hívóinak és ütemezéseinek ellenőrzése.
3. Az OAuth tesztfiók hitelesítése után szintetikus üzenet olvasása, Writer/Reader lánc és audit bizonyítása; értesítések kikapcsolva.
4. A teszteredmények és a végső V1 készültségi státusz frissítése.

Nincs éles kódmódosítás, Gmail-olvasás, értesítésküldés vagy Previo-művelet. Ez statikus audit, nem futásidejű igazolás.
