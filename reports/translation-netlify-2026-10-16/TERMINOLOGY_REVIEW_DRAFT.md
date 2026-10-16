# Sárberki V1 – fordítási terminológia és minőségellenőrzés (tervezet)
Dátum: 2026-10-16
Állapot: szakmai tervezet, NEM élesítési jóváhagyás.
Forrás: reports/translation-netlify-2026-10-16/REPORT.md
Kizárólag a gmail-test-subject-allowlist tesztág szintetikus mintáihoz.

## Megfigyelt három szolgáltatói fordítás
- EN: „Üdvözlöm! Egy Deluxe kabin 2026-10-23-tól 2026-10-25-ig 2 felnőtt és 0 gyermek számára. Telefon: +36 00 000 0000.”
- DE: „Jó napot! Deluxe nyaralóház 2026-10-23-tól 2026-10-25-ig, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.”
- SI: „Üdvözlöm! Deluxe házikó 2026-10-23-tól 2026-10-25-ig, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.”

## Javasolt kanonikus magyar szótár (emberi felülvizsgálatra)
| Fogalom | Magyar megnevezés | Megjegyzés |
|---|---|---|
| Deluxe cabin / holiday house / cottage | Deluxe faház | Ne „kabin”, „házikó”, „nyaralóház” |
| Family house | Családi faház | Háztípus |
| VIP house | VIP faház | Háztípus |
| Split unit A/B | Osztott kétfős apartman | A/B külön foglalható |
| Split unit C | Osztott négyfős apartman | 4 fő alap, legfeljebb 5 fő pótággyal |
| Hot tub | Dézsa (külön bérelhető) | Ne állítsa, hogy minden egységben van |
| Fishing pier | Horgászstég | A/B közös stég, C külön |
| Deposit | Előleg | 50%, 10 napon belül, a szabálymotor dönt |
| Cancellation | Lemondási feltételek | 15 fő alatt 14 nap; 15 fő felett 30 nap |
| Availability | Igazolt szabad kapacitás | NEM IGAZOLT állapotot tilos szabadként megjeleníteni |

## Kötelező ellenőrzési szempontok
1. Az eredeti levél változatlan marad; a fordítás külön megjelölt, nem hitelesített nézet.
2. Dátumok, időtartamok, felnőtt/gyermek adatok, gyermekkorok, telefonszámok és pénzösszegek megőrzése; hiányzó gyermekadat nem válik automatikusan 0-vá.
3. A háztípusokat pontosan azonosítsa; az általános „négyfős apartman” ne legyen automatikusan C.
4. Ne ígérjen szabad házat vagy árat a determinisztikus Previo- és árszabályok ellenőrzése nélkül.
5. Ne ígérjen automatikus küldést, jóváhagyást vagy foglalásrögzítést.
6. Visszafordításnál a vendég nyelvére a szándék és a számadatok megőrzése fontosabb, mint a szó szerinti egyezés.
7. Tesztkorpusz: rövid és hosszú EN/DE/SI szintetikus levelek; hiányzó gyermekadat, több ház, A+B közelségi kérés, 6 fő C-ben, 15 fős küszöb, dézsa, előleg, lemondás, bizonytalan dátum, hibás telefonszám.
8. Automatikus szövegellenőrzés mellett emberi nyelvi kontroll szükséges, különösen SI esetén.

## Biztonsági határok
Csak zárt szintetikus teszt; nincs új API-hívás, valós vendégadat, automatikus e-mail/Pushover, Previo-írás, production/main módosítás. A korábban beszélgetésbe került API-kulcs élesítés előtti cseréje nyitott feladat.

## Következő fejlesztési feladat
A meglévő zárt fordító végpont számára determinisztikus magyar terminológiai utóellenőrzés tervezése, az eredeti fordítás megőrzésével. Először tesztek és szakmai jóváhagyás, utána külön kódmódosítás. A 1547 PASS regressziót ne futtassuk újra pusztán e dokumentáció miatt.
