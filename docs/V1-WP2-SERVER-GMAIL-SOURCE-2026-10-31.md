# V1 – 2. munkacsomag: szerveroldali Gmail-forrásellenőrzés (2026-10-31)

Ág: `gmail-test-subject-allowlist`. Kiinduló HEAD `1cfde646f43036b83e1bb122ea74ce96bd3afa8c`. AGENTS.md blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`.

## Hiány (bizonyítva a kódból)
- Nem volt szerveroldali függvény, amely a szerver által olvasott Gmail-tartalomból állítja elő a meglévő kizárólagos-nyugta formátumot; ma a kliens küldi a tartalmat, és csak egyetlen előre rögzített levél fogadható el.
- A „Sárberki élő teszt” tárgyjelölő-kapu csak a kliensen létezett.
- Nem volt forrás-tanúsítás; a meglévő attestor csak jóváhagyási mezőket ír alá.

## Megvalósítás (meglévő modulokra)
- `gmail-subject.mjs`: `isMarkedTestSubject` – egyetlen, közös kapu; a `napi-kezelo/napi-email.mjs` ezt importálja.
- `shared-core/server-gmail-source.mjs` (csak szerver, a build `server-` előtag miatt kizárja):
  - `readVerifiedTestMailboxMessage`: a meglévő `readTestGmailInbox` pontos-azonosítós módja (tesztfiók-profil, egy levél, INBOX és dátumablak), a kezelő átmeneti tokenjével. További feltételek: jelölt tárgy, nincs In-Reply-To/References, egyetlen címzett a tesztfiók, érvényes feladó és Message-ID, explicit `text/plain` rész, nem üres, legfeljebb 20 000 karakter. Rögzített hibakódok; a token és a Gmail-hibaszöveg nem kerül ki.
  - `attestTestMailboxSource` / `verifyTestMailboxAttestation`: HMAC a meglévő szerverkulccsal, saját hatókörrel (`test-mailbox-source-v1`), a forrásmezőkre és a törzs SHA-256-jára; az adatbázis `sc_isolated_approval_mac` segédje ugyanígy újraszámolhatja.
- Nincs bekötve ügyírásba, nincs SQL, nincs kapcsoló, nincs telepítés. A felhős mentés a 3. munkacsomag (hosztolt migráció) után kapcsolható be.

## Bizonyíték
- `tests/server-gmail-source.test.mjs`: pozitív eset, 9 Gmail-/fiókhiba, 7 hibás bemenet, 13 tartalmi elutasítás, 13 manipulációs eset (köztük aláírt törzs-hash és tartományelválasztás).
- `tests/static-chatbot-build.test.mjs`: a szerveroldali modul és a hatókör-azonosító nem kerülhet a `dist`-be.
- 10 negatív ellenpróba mind bukik a teszteken.
