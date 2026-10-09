# Sárberki – kézi árlekérési áthidalás és biztonságos visszaállítás (2026-10-09)

## Állapot és cél
Ez **nem automatikus Previo-aktiválás**. A hivatalos Previo Reservation+ dokumentálatlan POST-kéréseinek átmeneti kapacitászárolási mellékhatása továbbra sincs igazolva, így a `PREVIO_READ_SAFETY_VERIFIED` nem állítható át. A korábbi élő, tesztoldalra korlátozott `/api/price-quote` és `/api/availability-options` végpontok továbbra is alapból 503 választ adnak és nem hívják a Previót.

## Operatív, jelenleg használható menet
1. Nyisd meg a tesztoldalon a feldolgozott levelet. A már szerkesztett dátum, ház és gyermekéletkor maradjon meg.
2. Az Ár jóváhagyása panelen kattints a **Hivatalos Sárberki / Previo foglaló megnyitása** hivatkozásra. A hivatalos foglalóban válaszd ki ugyanazt az érkezést, távozást, háztípust, felnőtteket és gyermekéletkorokat, majd ellenőrizd a teljes árat és a szükséges szabad egységek számát. A foglalást *ne fejezd be*.
3. Írd be a foglalóban ellenőrzött **teljes forintárat** a Sárberki tesztoldalon. Csak akkor pipáld be a megerősítést, ha **az egész időszakra** elegendő szabad egység van, és a vendégösszetétel/ár egyezik.
4. A megerősítés külön, test-only GET `/api/manual-fx` hívást végez, amely csak a Magyar Nemzeti Bank árfolyamát kéri le. Previo-kérést nem végez. Hibás MNB-adatnál csak a forintár szerepel, EUR becslés nincs.
5. Ezután a kezelő még **külön** rákattint az **Ár jóváhagyása és beépítése a levélbe** gombra. Nincs automatikus levélküldés, foglalás vagy PMS-módosítás. A kézi jóváhagyás nem helyettesíti a végső kapacitásellenőrzést.

Az automatikus árlekérés feloldásához szükséges Previo technikai írásos nyilatkozat (beleértve minden átmeneti hold/lock kizárását), **vagy** hivatalos csak olvasásra szolgáló Previo API-kapcsolat. A Previo a hivatalos API-t külön szolgáltatásként tartja nyilván, és korlátozott díjmentes teszt-hozzáférést is kínál: https://help.previo.app/en/doc/api-access/ . Díjköteles szolgáltatásra nincs megrendelés, és az aktiváló kapcsolók nem változtak.

## Elkülönítés és visszaállítás
- Kiinduló tesztági HEAD: `9bc9d046c6ac209054e31abf7d54b3a9420abd6d`; a mostani fejlesztés kizárólag `gmail-test-subject-allowlist` ágon van.
- A kezelői módosítás a `price-check.js` fájlban marad; az MNB-segéd `netlify/functions/manual-fx.mjs` és a `netlify.toml` külön útvonalán található.
- Teljes visszaállítás: a tesztágat az előző SHA-ra visszaállítani **csak** egy tudatos, védett visszaállítási folyamatban; ne erőltessünk force push-t. Biztonságosabb: a fejlesztés commitjainak `git revert`-je, új tesztekkel. Production/main érintetlen.
- `PREVIO_READ_SAFETY_VERIFIED` nem módosul; `CASE_STORE_ENABLED=disabled` változatlan marad.
- A `tests/manual-price-assist.test.mjs` lefedi a host-korlátozást, MNB-hibát, a kézi megerősítést és az inputváltozás miatti tiltást.
- A közvetlen Netlify konfig és a böngészős végpont ellenőrzése külön szükséges. Zöld CI csak a forráskód és mockok ellenőrzése, nem bizonyít éles Previo- vagy Netlify működést.
