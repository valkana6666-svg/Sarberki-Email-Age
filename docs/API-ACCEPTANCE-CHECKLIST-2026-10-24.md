# Previo API fogadási ellenőrzőlista – 2026-10-24

Állapot: offline előkészítés rendelkezésre áll; hivatalos szolgáltatói bekötés NEM IGAZOLT. A `server-previo-api-preflight.mjs` és `server-previo-contract-adapter.mjs` belső mezői nem Previo wire mezők. Nincs kitalált végpont vagy szolgáltatói payload. Ez a lista a 2026-10-21-i átadást egészíti ki; nem ad végrehajtási jogosultságot.

| Kapu | Bekérendő / ellenőrizendő | Elfogadás feltétele | Jelenlegi állapot |
| --- | --- | --- | --- |
| API-család | A Sárberkinek ténylegesen engedélyezett API és aktuális verzió/dokumentáció | Szolgáltatói forrás és hozzáférés egyezik | SZOLGÁLTATÓI FÜGGŐSÉG |
| Hitelesítés | Hivatalos módszer, külön sandbox, csak olvasó jogosultság, visszavonás/rotáció | Kulcs csak szerveroldali titoktárban; pozitív sandbox Auth és negatív jogosultságpróba | HOZZÁFÉRÉSRE VÁR |
| Property | Hivatalos API-szálláshelyazonosító | Válasz a megfelelő szálláshelyhez kötött; a publikus 753011 nem automatikus API-azonosító | MEGFELELTETÉSRE VÁR |
| Egységek | Az alábbi 23 helyi egység pontos szolgáltatói egység- és típusazonosítója | Teljes, egyedi fizikai egységlista; nincs hiány/dupla egység/típussal helyettesített fizikai szoba | SZOLGÁLTATÓI ADATRA VÁR |
| Kapacitás | Teljes érkezés–távozás intervallumra olvasási szerződés | Dokumentáltan nincs hold/készletzárolás; foglalt/szabad/UNKNOWN különbség igazolt | DOKUMENTÁCIÓRA ÉS SANDBOXRA VÁR |
| Ár | Rate plan, HUF, egységár, vendégösszetétel, gyermekkorok, pótágy, éjszakák, szezon/minimum, kedvezmények, szolgáltatások és kerekítés | Azonos dátum/létszám/egység mellett kezelői Previo-végösszeggel egyező, bontott ár | TELJES ÁRSZERZŐDÉS HIÁNYZIK |
| Adók | IFA alapja/mentessége, ÁFA és minden további kötelező díj; árba foglalás vagy külön fizetés | A teljes fizetendő és külön díjak egyértelműen egyeznek; nincs kétszer számított adó | HIVATALOS LEKÉPEZÉSRE VÁR |
| Időzóna | Europe/Budapest, dátum vagy időpont formátuma, távozási nap és nyári időszámítás | A szolgáltatói szerződés alapján dátumhatár- és DST-egyeztetés | BELSŐ ZÓNA RÖGZÍTETT; API SZEMANTIKA HIÁNYZIK |
| Dézsa | 11 rögzített erőforrás, naptár és teljes időszak-lefedettség, más ház vendégeinek foglalása | Konkrét erőforráshoz kötött teljes naptár; hiányos megjegyzés nem szabad dézsa | ÉLŐ NAPTÁRSZERZŐDÉS HIÁNYZIK |
| Frissesség | Forrásidő, érvényesség, property/tenant/ügyverzió/dátum kötés | Lejárt, másik ügyhöz vagy időszakhoz tartozó válasz nem válik ajánlattá | OFFLINE KAPUK TESZTELTEK; ÉLŐ ADATRA VÁR |
| Hibakezelés | Auth hiba, jogosultsághiány, 429, 5xx, timeout, hibás/hiányos válasz | Legfeljebb 15 s és egy olvasási próbálkozás; szűrt hiba, UNKNOWN/emberi ellenőrzés, nincs hamis siker | OFFLINE HARNES TESZTELT; SZOLGÁLTATÓI HIBAKÓDOKRA VÁR |
| Audit | Kérésazonosító, ügy/verzió és bizonyítékhivatkozás | A meglévő tranzakciós auditban tárolás és visszaolvasás; titok és vendéglevél nélkül | MEGLÉVŐ ÜGYTÁRHOZ KÖTENDŐ |
| Vészleállítás | Csak teszthost/tenant/property, alapból tiltott éles műveletek | Tiltott kapcsolóval 0 külső kérés; kapcsolók ellenőrzése aktiválás előtt | TILTÁS MEGMARAD |
| Élesítés | Pontos tesztcommit/CI/deploy, készülékelfogadás, külön helyreállítási eredmény | Tulajdonosi élesítési döntés az ellenőrzött bizonyítékok után | NINCS ENGEDÉLYEZVE |

## Átadáskor rögzítendő titokmentes bizonyíték

Minden kapuhoz: szolgáltatói dokumentáció URL/verzió és ellenőrzési dátum; felelős; ellenőrzött sandbox/property; pontos commit; tesztazonosító és eredmény; anonimizált szolgáltatói referencia; fennmaradó korlát. Titkos kulcs, token, cookie vagy éles vendégadat nem része a jegyzőkönyvnek.

Az áraknál külön összevetendő: felnőtt és gyermekes foglalás, ház/egység minimum alapár, 1 éj és szezon, 20%-os törzsvendégkedvezmény és annak igazolása, 2027-es tarifa, IFA, pótágy, kisállat és dézsa. A mostani üzleti logikát nem szabad a szolgáltatói válaszhoz igazítva csendben megváltoztatni; eltérés emberi döntést kér.

A rögzített előleg-/lemondási szabályok forrása a két 2026-10-22-i tulajdonosi döntési dokumentum. Nincs 30 napos lemondás. Fizetési ablak és tényleges előlegbeérkezés külön tény.

## Bekötési sorrend

1. Hivatalos dokumentáció és olvasási jogosultság, sandbox/hold-mentesség igazolása.
2. Property és a 23 egység tulajdonosi/szolgáltatói megfeleltetése; rate plan, adó és időzóna.
3. Tényleges szerveroldali transzport implementálása a meglévő adapter mögött, dokumentált wire szerződéssel. A fixture adapter nem alakítható élő bizonyítékká átnevezéssel.
4. Célzott negatív szerződéstesztek; csak a változással érintett csomag. Kapacitási algoritmus módosításánál az AGENTS.md teljes regressziós követelménye érvényes.
5. Engedélyezett szintetikus sandbox-olvasás és kezelői egyeztetés, külön ár- és kapacitásbizonyíték.
6. Pontos tesztdeploy, iPhone-elfogadás és külön élesítési döntés.

A foglaláslétrehozás/finalizálás későbbi, külön dokumentációt és felhatalmazást igénylő képesség. Szolgáltatói idempotencia, visszakeresés, tartós egyedi intent és bizonytalan írási kimenet egyeztetése nélkül nincs írás. Jelenleg minden írás tiltott.

## 23 egység megfeleltetési munkalap

Az alábbi helyi azonosítók a meglévő üzleti konfigurációból származnak. A szolgáltatói oszlopok szándékosan kitöltetlenek; az elnevezések jelentése belső, nem állítás a hivatalos API mezőneveiről.

| Helyi egység | Fizikai ház | Szolgáltatói egységazonosító | Szolgáltatói típusazonosító | Igazolás |
| --- | --- | --- | --- | --- |
| 11 | 11 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 12 | 12 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 13 | 13 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 14 | 14 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 2 | 2 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 3 | 3 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 4 | 4 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 5 | 5 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 6 | 6 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 1 | 1 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 15 | 15 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 7A | 7 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 7B | 7 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 7C | 7 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 8A | 8 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 8B | 8 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 8C | 8 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 9A | 9 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 9B | 9 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 9C | 9 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 10A | 10 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 10B | 10 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
| 10C | 10 | KITÖLTENDŐ | KITÖLTENDŐ | NEM IGAZOLT |
