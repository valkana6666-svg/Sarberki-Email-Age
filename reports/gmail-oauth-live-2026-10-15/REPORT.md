# Friss Gmail OAuth-olvasás – 2026-10-15

## Igazolt élő felületi eredmény

Kiinduló tesztági HEAD és a tesztoldal látható buildje:
`e2de485871d8c40b6e750967d6c571f73e44df50`.
Kizárólag `gmail-test-subject-allowlist`,
`https://leafy-chimera-2403e5.netlify.app/`.

A Google a korábbi hitelesítési kísérletet helytelen jelszóval elutasította.
A koordinátor védett hitelesítési kérést, majd kézi átadást használt;
jelszó, token vagy cookie nem került ebbe a jelentésbe.
A felhasználó folytatási jelzése után az OAuth-ablak már bezárult, és a
tesztoldalon friss, pozitív Gmail-beolvasási eredmény volt látható
(helyi esemény ideje: 2026-10-15T19:40:05.497Z).

A beolvasott, önmagát kifejezetten szintetikus tesztérdeklődésnek nevező HU
levélből a kezelőfelületen megjelent:

- érkezés 2026-11-13, távozás 2026-11-15, 2 éjszaka;
- 2 felnőtt, 2 gyermek, összesen 4 fő;
- horgászati és dézsahasználati kérés, HU nyelv;
- hiányzó gyermekkorok és telefonszám;
- helyi választervezet, nem elküldve;
- nem igazolt ár és kapacitás, tiltott belső jóváhagyás.

Ugyanezen egyértelműen kitalált levél újbóli kiválasztása és megnyitása a
korábban megjelent helyi ügyazonosítót adta vissza `duplicate` állapotban.
Ez helyi ismételt megnyitási bizonyíték, nem új felhős deduplikációs próba.
A beolvasási felület pozitív állapotot és az érdeklődések listáját mutatja;
pusztán az OAuth-ablak bezárásából nem következtettünk sikerre.

## Bizonyítékhatár

Ez friss, tényleges Google OAuth/Gmail olvasás után megfigyelt kezelőfelületi
eredmény, nem fake GIS vagy kézi canonical JSON-import. A Google-fiók a
bejelentkezési folyamatban a kijelölt tesztfiók volt; az olvasási útvonal
`gmail.readonly` scope-ja és olvasás előtti fiókellenőrzése a kiinduló
commit kódjában szerepel. Hozzáférési tokent nem olvastunk ki.

A most megnyitott HU levél nem azonos a korábban privátan engedélyezett
egyetlen felhős receipt-tel. Nem nyomtuk meg a Writer-mentés gombot, nem
bővítettük a privát allowlistet. Új Writer/Reader/jóváhagyási felhős
eredményt nem állítunk; a korábbi eredmények érvényesek maradnak.
A Gmail-lista nem tárgy- vagy feladó-allowlist: ezt a meglévő policy és
`docs/V1_GMAIL_AUDIT_2026-10-15.md` már dokumentálja.

## Korábbi CI és mentés friss ellenőrzése, újrafuttatás nélkül

- [CI 38721455452](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38721455452):
  SUCCESS, napló szerint **1522 PASS / 0 FAIL / 0 SKIP** a kiinduló commiton.
  Élő Previo-smoke külön SKIPPED.
- [Kapacitásregresszió 38721455403](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38721455403): SUCCESS.
- [Mentés 38721455399](https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38721455399):
  export és izolált restore SUCCESS; napló: `full_restore=PASS`,
  `case_manifest=PASS`, `tables_compared=47`, `verification_completed=true`.
  Ez meglévő workflow-bizonyíték; ma nem futtattuk újra a restore-t, nem
  jelent új Auth API-login próbát vagy új, tartósan letöltött csomagot.

Production/main, mentések és felhős ügyek változatlanok. E-mail/Pushover-küldés,
Previo-kérés/írás és foglalás nem indult. A friss olvasás bizonyítása után a
nyitott canonical létszám/gyermek-visszakérdezés eltérésének célzott vizsgálata
következik; a magyar fordítás és a Previo hold-mentesség továbbra is külön feladat.

V2/V3 érték: az olvasás és a külön hitelesített Writer-művelet határa megmarad.
Takarékosság: a meglévő sikeres CI-t és mentés/restore-t csak visszaolvastuk.

## Fordítás következő integrációs pontja

Forrásellenőrzés: `safe-translation-adapter.mjs` már tartalmazza az alapból
tiltott `createSafeTranslator({enabled=false,transport=null})` határt és
a védett számértékek ellenőrzését. A tényleges kliensbelépési pont
`bilingual-clone-preview.mjs` végén `initBilingualClone()` fordító nélkül fut;
a néhány zárt mintafordítás nem általános szolgáltatás. A meglévő modul
forrása szerint a transport hitelesített, szerveroldali integrációja későbbi
feladat. A mostani ellenőrzés nem konfigurált külső szolgáltatót, nem küldött
levelet fordításra és nem publikált szolgáltatói kulcsot.

## Gmail összlétszám – minimális javítás és koordinátori ellenőrzés

A Codex a kiinduló commit tényleges Gmail-transformerét VM-ben futtatva
reprodukálta: `8 adults` mellett `normalized.guests=null`, `adults=8`,
`children=null`, és a vendégek száma tévesen hiányként szerepel.
A jelenlegi HEAD-en az ismert felnőttlétszám melletti gyermek-visszakérdezés
már nem reprodukálható; annak korábbi javítását nem tulajdonítjuk ennek a
patchnek. A szerveres közös döntési mag már korábban helyesen 8 főt számolt.

A minimális módosítás a meglévő core parserekre épülő
`partyCountsFromText` projekció és annak Gmail-transform bekötése. Egyértelmű,
gyermekemlítés nélküli felnőttlétszámból pótolja az összlétszámot, az explicit
összlétszámot megőrzi, ismeretlen gyermekadatot nem változtat explicit nulláról
0-ra. Nincs új adatértelmezési motor. Az `intake-normalize.mjs` változatlan.

A köztes, szélesebb intake-total-deriválás followup/stressz regressziót okozott;
ezt teljesen visszavettük, a régi regressziós orákulumok gyengítése nélkül.
Az első teljes futásban hiányzó PGlite-függőség is hibát okozott; egyetlen
sikeres `npm ci` után a végleges teljes futás valódi PGlite-tal történt.

- Új `tests/gmail-party-parity.test.mjs`: 5 célzott teszt. HU/DE/EN/SI tényleges
  Gmail-transform + közös csatornák; kétértelmű gyermekemlítés; ellentmondó
  explicit total; hiányzó gyermekkor; hiányzó/idézett létszám. Nincs providerhívás.
- Két régi source assertion az új közös függvényhívást ellenőrzi;
  a tényleges viselkedéshez az új transformer/ellentmondási próbák tartoznak.
- Célzott javítás utáni futás: **310 PASS / 0 FAIL / 0 SKIP**.
- Végleges teljes `npm test`: **1527 PASS / 0 FAIL / 0 SKIP**, 28,171 s.
  A teljes futást a kapacitásbemenetet érintő létszámjavítás és az AGENTS.md
  követelménye indokolta; a célzott tesztek átfednek, nem összeadandók.
- Mindkét kódfájl `node --check`, statikus build a kiinduló teljes SHA-val,
  majd `git diff --check`: PASS. A build-info forrás visszaállítva.

A koordinátor külön átnézte a kóddiffet és az új tesztek orákulumait.
Módosított kód: `sarberki-core.mjs`, `gmail-readonly.js`; teszt:
`gmail-filter.test.mjs`, `tests/gmail-party-parity.test.mjs`.
Új felhős ügymentés vagy jogosultságmódosítás nincs. A publikált commit friss
CI/deploy-eredménye külön ellenőrizendő; a fenti 1527 eredmény helyi bizonyíték.
