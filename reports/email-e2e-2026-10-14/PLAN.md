# Következő minimális V1-javítások – terv, nem végrehajtott változás

## Külön elbírálandó, védett vendégszöveget érintő javítás

Érintett fájl: `shared-core/inquiry-channel-adapters.mjs`. Az alábbi diffek
**nem lettek alkalmazva**. Nem változik foglalási, ár-, férőhely- vagy jogosultsági
szabály, a központi `buildCentralReply` renderer marad az alap.

### Teljes vendégszöveg azonossága a meglévő e-mail-levél megtartásával

Javasolt konkrét választás: a már meglévő e-mail-adapter teljes levélszövegét
használja a chatbot is. Így nem választunk új vagy rövidített alternatív szöveget;
a chatbot szövege lesz hosszabb. Előtte a chatbot csak közös státuszszöveget ad,
az e-mail teljes levelet és státuszt. Utána ugyanazon input/evidence esetén mindkét
csatorna teljes `.text` és magyar ellenőrző szövege betűre azonos. A `channel`
metaadat természetesen eltér, és nem kerül a vendégszövegbe.

```diff
 export function buildChatInquiryReply(options={}){
  const decision=evaluateCentralInquiry(options);
- return {decision,text:renderCentralConversation(decision),
-  operatorReviewText:renderCentralConversation(decision,{language:'hu'}),
+ const original=options.message||decision.facts.originalText||'';
+ return {decision,text:renderEmailDecision(decision,original,decision.facts.language),
+  operatorReviewText:renderEmailDecision(decision,original,'hu'),
   operatorReviewLanguage:'hu',channel:'chat',requiresApproval:true};
 }
```

Ez vendégoldali viselkedésmódosítás, ezért a védett szövegek jóváhagyása szükséges
alkalmazás előtt. A külön `prepareSyntheticBookingReview` tárolt review-szövegét
és a telepített chatbot/e-mail tényleges megjelenítő hívásait is össze kell vetni;
az adapterdiff önmagában nem bizonyít teljes telepített csatornaparitást. Nincs
felhatalmazás más működő renderelő felülírására. Elfogadási teszt: HU/DE/SI/EN,
azonos vendéginput és evidenciák → azonos teljes guest draft; ismert telefon nem
kérhető újra sem a kezdeti, sem a mentett review draftban; bizonytalan kapacitás/ár
továbbra sem lehet foglalható ajánlat.

## A meglévő Gmail UI szintetikus felhős bekötése

1. **Belépési pont:** `index.html` `displayGmailRecord()` után külön, explicit
   „Szintetikus tesztlevél mentése a felhős ügytárba” művelet; a Gmail read-only
   megtekintés és a jelenlegi helyi elemzés önmagában nem írhat a felhőbe.
2. **Ténykinyerés:** a meglévő Gmail transformból csak levél-envelope kerül a
   meglévő `createServerBookingRuntime.ingest(...,{persistDraft:true})` útvonalra.
   A szerver `extractServerMessage()` ismét saját tényeket nyer ki. Kliensoldali
   normalizált érték, AI-állítás vagy szerep nem ad bizonyítékot/jogosultságot.
3. **Hitelesítés:** a meglévő `createOperatorCookieSession.protectedWrite()`
   szolgál; hivatalos teszt-host, ugyanazon origin, POST, CSRF, friss Auth és
   valódi DB-membership szükséges. A Reader nem indíthatja a mentést. Nincs
   service role/admin SQL, böngészőnek visszaadott bearer vagy második Auth rendszer.
4. **Írási végpont:** a meglévő `booking-cases` `ingest-and-draft` művelete és
   `createSupabaseCaseRepository` használható. A cookie-POST jelenlegi allowlistje
   csak `review-draft` és `approve`; emiatt a UI-bekötéshez külön konkrét
   szintetikus-ingest határterv és szerveroldali allowlist-javítás szükséges.
   Ez a terv nem általános felhős levélbeolvasási aktiválás és nem új endpoint.
5. **Szintetikus határ:** a tesztprojekt/host és tenant mellett a rögzített
   szintetikus mailbox, tárgy-allowlist és `.invalid` feladó/kitalált tartalom
   ellenőrzése szükséges. A MIME-törzs méretkorlátja, megengedett envelope mezők,
   bázis64 kezelés és a jelenlegi szintetikus szervervalidáció megmarad. Valódi
   vendéglevél feltöltése és automatikus helyi→felhős migráció tiltott.
6. **Dedup/CAS:** a már meglévő mailbox+message-id dedup használható; azonos
   message-id eltérő feladó/törzs mellett konfliktus. Követő üzenethez csak a
   meglévő thread/RFC kapcsolási logika és várt verzió használható. Hibás vagy
   bizonytalan felhős válasz nem válthat automatikus helyi jóváhagyásra.
7. **Reader:** a mentés után a tényleges visszakapott caseId/revision alapján
   ugyanaz a read-only lista és tárolt draft-előnézet tölthető be; Reader write és
   approve továbbra is `FORBIDDEN`. A mentés nem foglalás vagy levélküldés.
8. **Jóváhagyási guard:** a jelenlegi cloud approval csak az eredeti
   `syntheticReaderFixtureRequest()` egyetlen mintáját engedi. Tetszőleges vagy
   akár más nyelvű tesztlevél jóváhagyására **nem általánosítható észrevétlenül**.
   Új nyelvi end-to-end UI-mintához előre elbírált, zárt, négy kitalált fixture
   konkrét guarddiffje és negatív bizonyítéka kell. A meglévő jóváhagyási RPC,
   HMAC, session, RLS, CAS, audit és külön read+approve szerep marad.

Az új integráció előtt a pontos fixture allowlist/guarddiffet és UI-hívást külön
reviewolni kell. Ez a dokumentum nem engedélyezi a védett üzleti szabályok
módosítását, valódi Gmail-adatok tartós feltöltését, élő Previo-írást vagy
automatikus vendégküldést. Elfogadás: hivatalos test hoston kitalált levél
→ explicit Writer mentés → Reader read-only → külön jóváhagyó → reload audit;
valódi/idegen/rossz tárgyú levél, Reader írás, ismeretlen kapacitás/ár és stale
revision mindenhol fail-closed. A meglévő sikeres cloud-mintát nem hagyjuk jóvá újra.
