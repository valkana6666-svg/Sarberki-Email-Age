# Gmail küldési jogosultság – lezárt kódaudit, 2026-10-27

**NINCS KÜLDÉS. NINCS DEPLOY. NINCS HOSTED ADATMÓDOSÍTÁS.**

A tesztágon lévő `shared-core/gmail-send-verified-preview.mjs` jelenleg csak injektált, megbízható `requireSender` és `getCase` függvényekkel futtatható offline szimulátor, nincs HTTP route-hoz bekötve.

## Konkrét hiányzó jogosultság
- `shared-core/supabase-case-repository.mjs` felhős Auth/membership jogai: `read`, `write`, `approve` (sc_memberships: can_read, can_write, can_approve).
- `shared-core/operator-cookie-session.mjs` védett végpontjai: `protectedRead`, `protectedWrite`, `protectedApproval`.
- **`send` vagy `sender` felhős szerepkör nincs bizonyítva.** Writer/Approver ne legyen automatikusan küldésre jogosult. Ne vezessük be a küldést egy tetszőleges böngészőből érkező `operator.role='sender'` attribútummal.
- A meglévő `netlify/functions/booking-cases.mjs` csak a konkrét teszt-telepítést és auth/session/CSRF korlátokat fogadja; nem szabad kontroll nélkül hozzáadni send műveletet.

## Ajánlott legközelebbi külön feladat
1. Tulajdonosi jóváhagyással külön, alapból tiltott TEST-only küldési jogosultság és teszt-címzett allowlist, külön audit.
2. Friss Auth és DB-membership ellenőrzés, hiteles cookie, CSRF, tenant/ügy kötés, valóban elkülönített operator-szerep.
3. Csak read-only szerveroldali előnézet, amely a valóban tárolt `clarificationApproval` és draft hashét vizsgálja; nem fogad teljes case rekordot a kliensből.
4. Negative CI, staleness/revocation, concurrency, uncertain Gmail API response, idempotency, RLS és rollback ellenőrzése.
5. **Csak ezek után** kerülhet szóba a Gmail OAuth `gmail.send` és az explicit tulajdonosi tesztküldési engedély.

A készülő termékként újrahasznosítható közös komponensek maradjanak elkülönítve a Sárberki-konfigurációtól. A jelenlegi `sender` mező a szimulátor saját előfeltétele, nem valódi felhős jogosultság.
