# Teljes újraépítési próba – forgatókönyv (Claude, 2026-11-06)

**Cél:** bizonyítani, hogy a Drive-mentésből egy **teljesen új** Supabase-projektben és egy **új** Netlify-oldalon a TEST-rendszer újraépíthető. Célérték: legfeljebb 4 óra helyreállítás (RTO), legfeljebb 24 óra adatvesztés (RPO). Csak a TEST-adatok (kitalált ügyek); az eredeti TEST-projekt és -oldal **érintetlen marad**.

**Mai helyzet (tény):** a napi Drive-mentés + visszaolvasás + visszaállítás egy *ideiglenes* PostgreSQL-be naponta PASS. Ami még **nincs igazolva**: visszaállítás egy *valódi új* Supabase-projektbe, Auth/RLS működéssel, és az alkalmazás (Netlify) rákötése.

## Előkészítés Claude-nál (a próba előtt, kb. 1 munkamenet, tőled nem kell semmi)
1. Új GitHub-folyamat: „visszaállítás új Supabase-projektbe” – csak egy új, üres, külön jóváhagyási környezetben (`restore-drill`) megadott projektbe ír, előtte ellenőrzi, hogy **nem** a TEST (`mojnqizbcaczstguikpv`) és nem az éles projekt; a Drive-ról letöltött, ellenőrzött csomagot tölti vissza; utána tábla-, ügy-, audit- és tagsági egyezést mér.
2. Ellenőrző lista a Netlify-oldal beállításához (változók: a régiekből, de az új projekt címével; titkok újragenerálva, nem másolva).

## A te részed (kb. 1–1,5 óra, számítógép vagy telefon böngészője)
| Lépés | Hol | Idő |
|---|---|---|
| 1. Új, ingyenes Supabase-projekt (név pl. `sarberki-restore-drill`, régió: EU) | supabase.com → New project | 5 perc |
| 2. GitHub: `restore-drill` környezet (jóváhagyó: te) + a projekt kapcsolódási címe titokként | github.com → Settings → Environments | 10 perc |
| 3. Jóváhagyás a GitHub-alkalmazásban, amikor Claude szól | telefon | 1 perc |
| 4. Új Netlify-oldal ugyanebből a repóból, a tesztágról (Claude lépésenként vezet) | app.netlify.com | 20–30 perc |
| 5. Belépés az új oldalon egy teszt-fiókkal, egy ügy megnyitása | telefon | 10 perc |
| 6. A próba után: az új Supabase-projekt **törlése vagy szüneteltetése**, az új Netlify-oldal törlése | felületek | 5 perc |

**Fontos:** az ingyenes Supabase-csomag szervezetenként **2 aktív projektet** enged. A TEST mellett a próbaprojekt a második; a későbbi éles projekt előtt a próbaprojektet törölni kell.

## Siker, ha (Claude méri)
- minden tábla és sor egyezik a mentéssel (ügyek, audit, tagságok hash-e);
- a kitalált fiókkal be lehet lépni, és csak a saját jogú ügyek látszanak (RLS);
- a napi kezelő az új oldalon megnyitja az ügyet; levélküldés és Previo **nincs** bekapcsolva;
- a teljes idő ≤ 4 óra.

## Mikor
A terv szerint a valódi postafiók TEST-beállítása után és **mindenképp valódi vendégadat előtt**. Szólj, ha van rá 1,5 órád: Claude előtte elkészíti az 1. pont folyamatát.
