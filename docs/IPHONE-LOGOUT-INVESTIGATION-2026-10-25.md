# iPhone kijelentkezés vizsgálata – 2026-10-25

Tulajdonosi képek: IMG_9185–IMG_9197. Hitelesített auditolvasás v3 / internally_approved, egy jóváhagyási esemény. Kijelentkezéskor az audit eltűnt és a gombok letiltódtak. Visszatéréskor hitelesített státusz és ismét olvasható audit jelent meg. A tulajdonos szerint nem emlékszik új belépésre; automatikus e-mail-kitöltést látott. A pontos böngésző-/fül-/munkamenetsorrend nem bizonyított. Fizikai logout/back elfogadás: NEM IGAZOLT.

Célzott VM-próba: a régi kód explicit kijelentkezés után pageshow/visibility eseménynél ismét GET session-visszaállítást végez, és pozitív szerverválasz esetén feloldja a felületet. Új regresszió javítás előtt 6 PASS / 1 FAIL. Javítás után a három érintett lifecycle/session suite összesen 55 PASS / 0 FAIL / 0 SKIP. Szintetikus HTTP/DOM, nem új fizikai vagy élő Auth-bizonyíték.

A jóváhagyási oldalon explicit logout után az automatikus resume tiltott az oldal élettartamára; csak sikeres explicit login törli a tiltást. Normál háttérből visszatérés ellenőrzése változatlan. Ez nem szerveroldali revokációs javítás vagy minden fülre/újratöltésre kiterjedő logoutgarancia. A szerveres cookie/revokáció és a fizikai incidens pontos oka további elkülönített ellenőrzést igényel.

Nincs Netlify-deploy; a telefonon még a korábbi build fut. Production/main/PR7 és mentési ág nem módosult. Nincs új jóváhagyás, adatírás, levél/Pushover vagy Previo-hívás. V2/V3: explicit kijelentkezés és automatikus visszaállítás elkülönítése, jogosultságbővítés nélkül.
