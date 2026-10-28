# V1 bizonytalan vendéglétszám – 2026-10-28

Kiindulópont: `ed0383dd6fa390244b24d238635a8c2c3cd79f1e`; kizárólag `gmail-test-subject-allowlist`.

## Igazolt hiba és elv

Korábban az aktív 2 fős ügy után a `2 vagy 3 felnőtt`, `2 or 3 adults`, `2 ali 3 odrasli` üzenet 3 főként jelent meg. A német `zwei oder drei Erwachsene` nem adott új értéket, de az előző 2 fős adat maradt érvényben. Egyetlen érték sem igazolt. Ilyenkor a kiválasztott létszám alapján nem készíthető érvényes kapacitásdöntés.

A közös adatértelmező felismeri a tesztelt HU/DE/EN/SI alternatív és intervallumos létszámokat; a megosztott döntés és chatbot/összefűzött ügy törli a bizonytalan részt és az összlétszámot. Gyermeklétszám bizonytalanságánál a korábbi életkorlista is törlődik. A többi ismert ügyadat megmarad. Az új egyértelmű válasz után ismét felépülhet a létszám, de kapacitás és ár továbbra külön bizonyítékot igényel.

Összekapcsolt szintetikus e-mail-esetnél a megváltozott tények a korábbi árat és kapacitást törlik, és a jóváhagyás pending állapotú. Nem történt Gmail-hozzáférés vagy küldés. A tesztelt minta nem bizonyítja tetszőleges nyelvi fordulat felismerését.

## Bizonyítékhatár

A célzott regresszió a négy nyelvű csatornaparitást, aktív többüzenetes beszélgetést, gyermek-/teljes létszám kétértelműségét, egyértelmű válasszal helyreállítást és a szintetikus kapcsolt e-mail ügyet ellenőrzi. Kötelező teljes `npm test` és a tesztági kapacitás-/négynyelvű CI; külön Chromium/WebKit 390px mobilpróba. A fizikai iPhone nem helyettesíthető a mobil-emulációval.

Nincs védett üzleti szabályváltoztatás, automatikus levél, valódi foglalás, Previo-lekérdezés vagy éles módosítás. V2/V3 szempontból ugyanaz a központi bizonytalansági értelmezés és csatornafüggetlen döntés marad az alap.
