# V1 magyar fordítás – alapból zárt szervertransport

Kiinduló tesztági commit: `90d5449a5ffa62c76918be5e780c9bf6a96e9a65`.
Ez helyi jelölt és offline bizonyíték, nem éles OpenAI-hívás vagy kész általános Gmail-fordítás.

## Elkészült

- A meglévő safe translation adapterhez ugyanazon originre küldő kliens és OpenAI Responses szervertransport készült. A két beérkező fordítási panel külön **Magyar fordítás kérése** gombot kapott. Feldolgozás, inputváltozás, munkamenet-visszaállítás és draftváltozás önmagában nem indít szolgáltatói fordítást.
- Kliens és szerver egyaránt csak a meglévő `syntheticMailEnvelope` három DE/EN/SI törzsének bájtpontos egyezését fogadja, a tényleges mintanyelvvel, `incoming` céllal és `hu` célkitűzéssel. A szerver nem bízik kliensoldali `synthetic:true` jelölésben. Eltérő szöveg, privát Gmail-receipt, választervezet és szerkesztett válasz tiltott. A céloldal előtt a kliens is lezárja az eltérő adatokat.
- A szerver az eredeti `createOperatorCookieSession.protectedWrite()` belépési pontot használja változtatás nélkül: teszthost/projekt/config, same-origin/CSRF, friss Auth és DB-tagság szerinti Writer-jog szükséges. Reader nem kezdeményezhet fizetős műveletet. Rotált cookie a providerhibánál és Writer-tiltásnál is megmarad, ha az eredeti helper kiadja. Nincs új Auth-rendszer, RPC, ügyírás vagy adatbázis-migráció.
- Alapból tiltott: `SARBERKI_TRANSLATION_ENABLED=closed-synthetic-only`, nem üres `OPENAI_TRANSLATION_API_KEY` és explicit `OPENAI_TRANSLATION_MODEL` együttesen szükséges. Nincs alapmodell. Ezeket a változókat nem állítottuk be, kulcsot nem kértünk és nem használtunk.
- A Responses HTTP-kérés `store:false`, `tools:[]`, `max_output_tokens:1200`, 15 másodperces timeout, `redirect:error`. Nincs provider retry és nincs tartalom-, kulcs- vagy providerhibanaplózás. A modell/kulcs nem kerül válaszba vagy kliensmodulba. A nyers HTTP `output[]` feldolgozása opcionális reasoning elemek mellett pontosan egy completed assistant message-et enged, kizárólag nem üres output_text elemekkel. Refusal, tool, incomplete, több assistant message és eltérő számok elutasítva. Az SDK `output_text` kényelmi mezőjére nem építünk.
- A `sameProtectedTokens` most pontos multisetet hasonlít: `2, 2` és `2, 3` már nem egyezik. A dátum/pénz/egységvédelem nem lazult.
- Dupla kattintás UI-szinten zárt; a kliens a munkamenet-objektumhoz kötött memóriában azonos kérést oszt meg. A szerver minden kérésnél újrahitelesít, és subject+CSRF+minta alapján legfeljebb öt percig (és a session lejártáig) ugyanazon Promise-t használja, a hibára is. Legfeljebb 128 bejegyzés, nincs csendes túlcsordulási retry. Ez példányonkénti költségcsökkentés, nem globális számlázási limit vagy tartós idempotencia.
- A késői kliensválasz munkamenetváltáskor elutasított; a panel forrásváltozáskor és session-eseménynél törlődik, generációval védi a késői választ. Az eredeti idegen nyelvű levél/draft változatlan. A magyar szerkesztés alapból továbbra zárolja a jóváhagyást, szolgáltatói visszafordítás nincs engedélyezve.

## Bizonyíték

`node --test tests/translation-button.test.mjs tests/translation-transport.test.mjs tests/bilingual-preview.test.mjs tests/safe-translation-adapter.test.mjs tests/bilingual-clone-preview.test.mjs tests/bilingual-edit-safety.test.mjs tests/channel-review-translation.test.mjs tests/operator-cookie-session.test.mjs`

**56 PASS / 0 FAIL / 0 SKIP**. Szintetikus HTTP/Auth/DB-tagság transport és DOM-emuláció. A tényleges cookie-t az eredeti AEAD session-helper készíti; a hálózati határok szimuláltak, nem élő Auth- vagy PostgreSQL-teszt. A meglévő jogosultsági teszteket az új provider belépési pontja indokolja. Üzleti döntés és kapacitásszámítás nem változott, teljes npm test nem indult.

A default (nem befecskendezett) UI-kliens külön próbája igazolja: tetszőleges szöveg gombnyomására **0 POST**, jól látható zárt-tesztminta figyelmeztetéssel; engedélyezett minta mellett szimulált `TRANSLATION_DISABLED` válasznál nincs kitalált fordítás. A cache-ből történő újrakérés is tiltottá válik frissen megvont Writer-tagságnál.

`node --check` az érintett végrehajtható modulokra és `git diff --check`: PASS. A statikus build a tényleges kiinduló `COMMIT_REF=90d5449a5ffa62c76918be5e780c9bf6a96e9a65` értékkel PASS; `dist/shared-core/server-translation.mjs` és `dist/netlify` nem létezik, a publikus kliens/policy függőségek léteznek, kulcs/modell-konfiguráció nincs a kliensmodulban. A build által generált `build-info.mjs` eredeti változata visszaállítva. Ez nem telepítési vagy új SHA-igazolás.

Fedi: három engedélyezett nyelv; hiányzó flag/key/model; önkényes vagy extra mezős szöveg; Reader; hibás CSRF/host/origin/projekt; visszavont Auth/DB-tagság; refusal/incomplete/tool/multiple message; hibás JSON és szám; 429/hálózati hiba retry nélkül; cookie-megőrzés; kliens dedup és session race; explicit gomb; forrás/session változás; edit approval lock; pontos számmultiplicitás.

## Korlát és következő lépés

- Nincs éles providerhívás, általános Gmail-fordítás vagy fordításminőségi bizonyíték. A `verified:true` kizárólag a válaszstruktúra és számtokenek ellenőrzését jelzi, nem emberi tartalmi jóváhagyást.
- A numerikus formázás szigorú: pl. `2 adults` → `2 fő` a számhoz kötött új egység miatt elutasulhat. Nem készült általános lokalizációs normalizáló; a védelem hibánál tiltva marad. A tesztfordítások azonos számformátumot tartanak.
- A korábbi helyi mintafordítások továbbra egyértelműen mesterséges minták, nem providereredmények. A választervezet és a magyar szerkesztés fordítása további külön scope.
- A kliens sikertelen kérését ugyanabban a session-objektumban nem ismétli. Új explicit belépés/visszaállítás vagy oldal-újratöltés ad új klienscache-t; a szerver legfeljebb ötperces hibacache-e ettől még megmaradhat.
- A `store:false` nem Zero Data Retention garancia. Provideraktiválás és további adatkör engedélyezése előtt külön adatkezelési és minőségi ellenőrzés szükséges.
- Következő konkrét lépés: koordinátori review, tesztági commit/CI és teszttelepítés; az alapból tiltott állapot igazolása. Ezután a fenti három már kitalált mintával konfigurált tényleges szolgáltatói próbát futtatni. A tényleges futás akadálya a szerverkulcs/modell és a Netlify-hitelesítés; nem új felhasználói felhatalmazás. További privát vagy valódi adatkör nincs engedélyezve.

V2/V3 érték: külön fordítási képesség a meglévő determinisztikus mag és az eredeti jogosultságkezelés mellett; fordítás nem ad küldési/foglalási/jóváhagyási jogot. Production/main, Previo, e-mail/Pushover és meglévő mentések nem módosultak.

Takarékosság: kizárólag indokolt célzott offline próbák; nincs valódi API-fogyasztás vagy automatikus retry.

Hivatalos API-alap: https://developers.openai.com/api/docs/guides/text és https://developers.openai.com/api/docs/guides/your-data .
