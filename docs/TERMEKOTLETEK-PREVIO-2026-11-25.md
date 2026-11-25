# Termékötletek Previót használó szálláshelyeknek – 2026-11-25

**Tulajdonosi cél (2026-11-25):** a Sárberki-rendszerből szolgáltatás legyen más, Previót használó, hasonló szálláshelyek számára. Minél több hétköznapi feladatot – vendégkommunikáció, foglaló, számlázás, kimutatás – oldjon meg, a Previóhoz kapcsolódva. A tulajdonos kérése: „ezeket most szépen meg kell valósítani”.

Ez ötlet- és ütemterv, nem engedély. Minden éles lépéshez, Previo-íráshoz és ügyféladathoz továbbra is az `AGENTS.md` szerinti külön engedély kell. Az ügyfélszerzés menete külön tervben szerepel (#9 7101032904, V3 után).

## Amit a Previo API-n már bizonyítottan elérünk (csak olvasás, éles 753011, 2026-11-23–25)

| Adat | Állapot | Megjegyzés |
|---|---|---|
| Szabad helyek naptára, árszámítás | működik | Az ár egyezik a Sárberki-árlistával, IFA-val. |
| Árlisták, háztípusok, egységek (23), vendégkategóriák | működik | Az egységnevek és típusok azonosak a TEST-tel. |
| Foglalások | 2020 végétől máig | Teljes vendégadattal – csak szerveren kezelhető. |
| Befizetések (`Hotel.getPayments`) | 2020-11-17-től, 11 709 tétel | A dátumszűrő nem hat; nincs foglalásazonosító, csak számla (`invId`). |
| Írás az élesbe | nincs jog, nem is kértük | A TEST 73521-ben írunk, engedéllyel. |

## Szolgáltatáscsomagok

### 1. Alapcsomag – vendégkommunikáció (a Sárberkinél jórészt kész)
- **AI-chat a honlapon:** valós szabad hely és ár, alternatívák, foglalás véglegesítése, opció a Previóban, Pushover. *Kész (TEST).*
- **E-mail-asszisztens:** válaszjavaslat valós foglaltság és ár alapján, kezelői jóváhagyással. *Kész (TEST); élesítés: éles postafiók, csak olvasva.*
- **Napi kezelő:** egy helyen a teendők (igények, foglalók, lejárt opciók, levelek). *Kész (TEST).*
- **Emlékeztetők:** foglaló-határidő (Pushover + két vendéglevél). *Kész (TEST), DB-jóváhagyás és kapcsoló hátra.* Később: érkezés előtti tájékoztató, értékeléskérés.
- **Telefonos asszisztens (V3):** terv jóváhagyva, nincs kész.

### 2. Pénzügyi csomag – foglaló és számlázás
- **Foglaló automatikus felismerése:** befizetés → számla → foglalás, majd az ügy lezárása. *Előfeltétel: a számla→foglalás olvasás felmérése és a befizetés-lekérdezés szűrése (most minden kérés mind a 11 709 tételt hozza).*
- **Kintlévőség-lista:** mely foglalásoknál hiányzik foglaló vagy végösszeg.
- **Napi/heti pénzügyi összesítő:** befizetések fizetési mód szerint, pénztárkönyv-állapot.
- **Banki egyeztetés:** bankszámlatételek ↔ Previo-befizetések. *Banki hozzáférés kell; külön döntés.*

### 3. Kimutatások a tulajdonosnak (név nélkül)
- Foglaltság házanként és szezononként, átlagár, csatornák (honlap, Booking, Szállás.hu), lemondási arány, törzsvendég-arány, előrejelzés.

### 4. Működési segítség
- Takarítási lista érkezés/távozás szerint; vendégregisztráció- és IFA-ellenőrzés a foglalások alapján.

## Előfeltételek, mielőtt más szálláshelynek nyújtjuk

| Teendő | Miért | Felelős |
|---|---|---|
| **Previo partneri feltételek** (partnerprogram, API-használat harmadik félnek) | Más szálláshely adataihoz szolgáltatóként fértünk hozzá – NEM IGAZOLT, hogy ehhez mi kell. | Work (levél a Previónak), tulajdonos dönt |
| **Adatvédelem:** adatfeldolgozói szerződés-sablon, adatkezelési tájékoztató | Vendégek személyes adatai | tulajdonos (jogi), Claude előkészíti a vázlatot |
| **Ügyfélenkénti elkülönítés** (tenant): saját kulcs, saját adat, saját beállítás | Egy ügyfél se lássa a másikét | Claude (a mag erre épül: `PLATFORM-STRATEGY.md`) |
| **Beállítófelület:** házak, árak, szabályok ügyfelenként | Minden szállás más | Claude |
| **Költség és ár:** havidíj, futási költségek (Netlify, AI, telefon) | Üzleti modell | tulajdonos + ChatGPT |

## Javasolt sorrend
1. **A Sárberki éles bevezetése** (V1 élesben, majd V2): ez a referencia és a bizonyíték az új ügyfeleknek.
2. **A pénzügyi csomag első lépése:** foglaló-felismerés a Sárberkinél (számla→foglalás felmérés, szűrés).
3. **Kimutatások** a Sárberkinek (név nélkül) – bemutatható érték.
4. **Partneri és adatvédelmi tisztázás** a Previóval – párhuzamosan.
5. **Többügyfeles előkészítés** (elkülönítés, beállítófelület) – amikor az 1–4. kész.
6. **Ügyfélszerzés** a #9 7101032904 terve szerint (V3 után, 2–3 kísérleti ügyfél).
