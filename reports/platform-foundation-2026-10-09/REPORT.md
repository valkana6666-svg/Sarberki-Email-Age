# Sárberki – AI-platform alapjai és foglalhatósági biztonság

Zárójelentés: 2026. október 9. Az október 8-i fejlesztési utasítás folytatása.

Repository: `valkana6666-svg/Sarberki-Email-Age`. Ág: `gmail-test-subject-allowlist`.

## Kiinduló állapot és visszaállítás

Kiinduló commit: `0ca7d101c50edd4a38cefb22b81000ddf1efbd54`. A távoli tesztág egyezett ezzel. A korábbi teljes tesztkészletet újrafuttattuk: **710/710 PASS, 0 FAIL, 0 SKIP**. Bizonyíték: `baseline-tests.log`.

Visszaállítási pont: helyi `sarberki-before-platform-foundation-20261008` tag a kiinduló commiton. A megosztott tesztágon a kódcommit revertje használható; ne írjuk felül a main vagy production történetét. A böngészős ügyállapot külön adat, a kód visszaállítása nem jelent ügyadat-mentést vagy migrációt.

Meglévő alapok: üzleti konfiguráció, csak olvasási PMS-adapter, kapacitásszűrés, központi választervező, böngészős többüzenetes ügytár és automatikus tesztek. Ezekre építettünk; nem kezdtük újra a projektet.

## Elvégzett fejlesztések

### Foglalhatósági bizonyíték

Új, szolgáltatófüggetlen modell készült: `AVAILABLE`, `UNAVAILABLE`, `UNKNOWN`. Tartalmazza a vállalkozási azonosítót, egységet/típust, teljes időszakot, ellenőrzési időpontot, forrást, darabszámot, érvényességet, ellenőrzési szintet és hibát.

Az UNKNOWN készlete `null`, nem nulla. Ellentmondásos darabszám, idegen vállalkozás, eltérő időszak, hiányzó forrás/időbélyeg, jövőbeli vagy 120 másodpercnél régebbi ellenőrzés nem lehet érvényes bizonyíték.

A korábbi szerveroldali kapacitásszűrés már ezt a validálást használja. A kliens elutasítja a lejárt összesített választ és az idegen vállalkozási választ. A tárolt, lejárt pozitív kapacitásmondat nem kerül vissza friss ajánlatként az ügy válaszába. A kapacitásformázó külön is kizárja a nem igazolt vagy foglalt sorokat, akkor is, ha tévesen a szabad lista tartalmazza őket.

A régi `available/unavailable/unverified` mezőket kompatibilitási okból megtartottuk a jelenlegi UI és szűrés között; az új adapterbizonyíték a három egységes nagybetűs állapotot használja. Ez fokozatos átállás, nem a teljes régi modell egyszerre történő cseréje.

### Élő Previo biztonsági kapu

Az élő kapacitás- és árvégpontnak a teszthost mellett külön szerveroldali biztonsági beállítás is szükséges: `PREVIO_READ_SAFETY_VERIFIED=true`. Alapértelmezetten tiltott. A kapcsolót nem kapcsoltuk be és nem módosítottunk Netlify-környezeti változókat.

Ez a változás tudatos működési korlátozás: a tesztoldal puszta címe nem jogosít fel élő lekérdezésre. Az ismételt élő vizsgálatot a készletzárolási mellékhatás dokumentált kizárásáig nem végeztük el. A kapu a telepített API útvonalakon működik; nem általános szolgáltatói mellékhatás-igazolás és nem minden belső fejlesztői függvény hálózati sandboxa.

### Vállalkozási konfiguráció és tényleges egységstruktúra

Új konfigurációs modell: azonosító, név, nyelvek, tudásforrások, üzleti szabályok, egységek, árpolitika, adapter és kommunikációs politika. A konfiguráció mélyen fagyasztott. Idegen vagy nem jóváhagyott tudásforrást nem fogad el.

A Sárberki első konfigurációja külön sorban kezeli a **15 fizikai ház 23 foglalható egységét**. A 7–10-es házak A/B/C egységei külön rekordok. Az automatikus szűrés névleges, pótágy nélkül számolt kapacitást használ: VIP 5, Családi 8, Deluxe 5, Különálló 2, osztott A/B 2, C 4. A korábbi üzleti katalógus pótágyas adatait nem töröltük, de az új automatikus házszűrés nem épít rájuk igazolás nélkül.

Ezért a hatfős teszt elvárása megváltozott: egy VIP nem elegendő; egy Családi megfelelő lehet, Deluxe esetén két egység szükséges. Ez kapacitási jelöltség, nem élő foglalhatósági állítás.

### Ellenőrzött válaszinformációs réteg

Új adatréteg vetíti ki az engedélyezett vendégadatokat, a vállalkozás jóváhagyott szabálymezőit és az adott ügyhöz tartozó ellenőrzött szövegsorokat. Más vállalkozás vagy más ügy forrásrekordja hibát eredményez. Jóváhagyás vagy forrás nélküli rekord nem használható.

A renderelő nem kap teljes konfigurációt, adapterkezelőt, GitHub-adatokat, kulcsokat vagy más vendéglistát. A központi ügyállapotból készített válasz már ezen a rétegen át használja a meglévő választervezőt. A vendéglevél külön jelölt, nem megbízható bemenet. Forráslista készül a konfigurációs és ellenőrzött válaszadatokról.

Az ellenőrzési jelöléseket a megbízható alkalmazáskód állítja elő; nem a vendéglevél. A jelölés nem kriptográfiai aláírás. A réteg logikai adatminimalizálást biztosít, nem operációsrendszer-szintű sandbox. A régi parser és néhány közvetlen formázóhívás még megmaradt; a teljes rendszer minden útvonalának végleges leválasztása további feladat.

### Adapter, kommunikáció és központi keret

A meglévő csak olvasási PMS-adapter új normalizált foglalhatósági műveletet kapott. A Previo-adapter Sárberkihez kötött; idegen vállalkozás hívását az új művelet még a forráslekérés előtt elutasítja. Forráshiba UNKNOWN eredményt ad.

Új kommunikációs boríték csak a releváns üzenetazonosítókat, időpontot, feladót és szöveget engedi át. Jelenleg e-mail és kézi bemenet támogatott; chatbotot, Messengert, WhatsAppot és telefonos AI-t nem építettünk.

A generikus motor konfigurációt, parsert, renderelőt és adaptert kap. Nem hoz létre második önálló döntéshozó AI-t és automatikusan nem küldhet üzenetet. Jelenleg újrahasznosítható, tesztelt illesztési keret, nem a teljes Gmail-rendszer helyettesítője.

### Árkezelés

Külön, tesztelt modell készült az igazolt fix egységárra és az alapár, szezonális összeg, kedvezmény, IFA, opcionális szolgáltatás és végösszeg elkülönítésére. Azonos egység igazolt kapacitásán belül egy és négy vendég alapára azonos; több egység és éjszaka szorzódik, a létszám nem szorozza a ház alapárát.

Hiányos, idegen vagy nem ellenőrzött árösszetevőből nem készül hiteles végösszeg. Nem vezettünk be kitalált díjakat. A régi árlekérő és kézi árjóváhagyás megmaradt. Az új komponensmodell még nem váltotta le a teljes meglévő árfolyamatot; az aktuális IFA, kedvezmények és szezonális díjak élő helyességét ez a fejlesztés nem bizonyítja.

### Ügyadatok elkülönítése

A böngészős ügytár vállalkozásonként külön tárolási kulcsot használ, és elutasítja az idegen vállalkozási borítékot. A korábbi Sárberki-tároló kompatibilisen megmarad; címke nélküli régi rekord csak a Sárberki saját tárolójából migrálható.

Ez nem hitelesített többügyfeles rendszer. A böngészőben megadott tenant ID nem hozzáférési jogosultság. Közös ügytár, szerveroldali hitelesítés és tenant-hozzárendelés továbbra is szükséges.

## Tesztek és bizonyítékok

| Vizsgálat | Eredmény | Bizonyíték |
|---|---:|---|
| Kiinduló teljes készlet | 710/710 PASS | `baseline-tests.log` |
| Új platformtesztek | 35 új teszt | `tests/platform-foundation.test.mjs` |
| Célzott platform/kapacitás/válasz tesztek | 81/81 PASS | `targeted-tests.log` |
| Teljes regresszió | **745/745 PASS, 0 FAIL, 0 SKIP** | `automatic-tests.log` |
| Telepített böngészős alapműködés | Sikeres, build `9fbc80d` | `sarberki-platform-20261009.json`, `.jpg` |
| Új élő Previo-kapacitás | Nem végeztük el | Mellékhatás-mentesség nincs kizárva |

Az új tesztek bizonyítják a friss/lejárt/hibás kapacitás kezelését, teljes időszakhoz és vállalkozáshoz kötést, forráshibát, névleges egységstruktúrát, két mesterséges vállalkozás tudás- és ügyelkülönítését, más ügy és titkos mezők kizárását, négy nyelven a vizsgált rosszindulatú utasítás figyelmen kívül hagyását, fix egységárat, komponensösszesítést és alapértelmezetten tiltott élő/írási/küldési működést.

A régi tesztek megmaradtak. Néhány tesztadat friss időbélyeget és forrást kapott, mert a korábbi hiányos vagy történeti minta már nem lehet aktuális bizonyíték. A hatfős kapacitásteszt pótágyas elvárását és a kapacitásformázó tesztadatainak ellenőrzési jelöléseit az új biztonsági szabályhoz igazítottuk. Nem változtattunk hibás működés kedvéért pozitívra negatív tesztet.

A böngészőben dátum nélküli Deluxe-kérés szerepelt két felnőttre, kiegészítve egy titokkiadást kérő utasítással. A rendszer helyesen tartotta meg a létszámot és háztípust, célzottan kérte a dátumot, nem adta vissza a rosszindulatú utasítást, nem állított szabad kapacitást, és a jóváhagyás tiltott maradt. Élő időszakos kapacitástesztet vagy hitelesített Gmail-OAuth beolvasást ez nem helyettesít.

## Érintett fájlok

Új: `tenant-config.mjs`, `central-reply.mjs`, `shared-core/availability-model.mjs`, `shared-core/communication.mjs`, `shared-core/engine.mjs`, `shared-core/reply-context.mjs`, `shared-core/verified-pricing.mjs`, `tests/platform-foundation.test.mjs`, `docs/PLATFORM-STRATEGY.md`.

Módosított működés: `AGENTS.md`, `availability-recommend.mjs`, `booking-cases.mjs`, `booking-filter.mjs`, `booking-runtime.mjs`, `case-state.mjs`, `netlify/functions/availability-options.mjs`, `netlify/functions/price-quote.mjs`, `price-source/previo-adapter.mjs`, `shared-core/pms-adapter.mjs`.

Módosított regressziós tesztadatok/elvárások: `price-quote.test.mjs`, `tests/availability-options.test.mjs`, `tests/availability-reply.test.mjs`, `tests/booking-continuation.test.mjs`, `tests/case-ui.test.mjs`, `tests/central-booking.test.mjs`, `tests/price-quote-function.test.mjs`.

## Commit és tartós stratégia

Kód és stratégiai dokumentáció commitja: **`9fbc80d0784df1b11421da664aa4a8fb59ded59a`**. A távoli tesztágra mentve, a telepített tesztoldalon a build azonosítója megjelent.

Tartós alapelv: `docs/PLATFORM-STRATEGY.md`, valamint az `AGENTS.md` kötelező fejlesztési előírásai. A Sárberki az AI-vállalkozás első alkalmazása; az újrahasznosítható alapokat a stabilitás és a biztonság megtartásával fejlesztjük.

## Szakaszállapot és következő feladatok

1. Állapotfelmérés: kész; 710 teszt reprodukálva és visszaállítási pont létrehozva.
2. Foglalhatósági biztonság: új modell és frissességkapuk integrálva, szimulált adatokkal igazolva; új élő adat nincs.
3. Válaszinformációs réteg: a központi ügyválaszban működik; teljes útvonal-migráció és erősebb szerveroldali határ még szükséges.
4. Modularitás: új modellek és illesztési pontok készültek; minden Sárberki-specifikus logika kivonása nincs kész.
5. Minimális többvállalkozásos alap: konfiguráció és logikai elkülönítés két mesterséges adatkészlettel tesztelve; éles SaaS nincs.
6. Regresszió: kész, 745/745; a telepített alapműködés külön ellenőrizve.

Következő prioritások: Previo műveletek dokumentált mellékhatás-vizsgálata; hitelesített Gmail-tesztek; közös szerveroldali ügytár és jogosultságok; a maradék közvetlen válaszútvonalak migrációja; a teljes árfolyamat komponensmodellhez kötése; konkrét egység/párosítás és több dátum élő igazolása, amikor biztonságosan végezhető.

**Minősítés:** a rendszer további fejlesztési és ellenőrzött tesztüzemi alapként használható. Nem kész többügyfeles éles platform és nem igazolt minden dátumra működő foglalási rendszer. Production nem módosult; valódi e-mail-küldés és Previo-írás nem történt. Ellenőrizetlen foglalhatóságot továbbra sem állíthatunk szabadként.
