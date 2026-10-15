# Sárberki AI-agent — V2 ötlettár és végrehajtási backlog
Dátum: 2026-10-15. Állapot: tervezés, nem implementáció.
Forrás: korábbi Previo-videóelemzések és 2026-10-15-i 1:28-as videó megfigyelései. A korábbi teljes nyers videók újbóli képkockás ellenőrzése nem történt meg.

## Alapelv
A V1 Gmail-olvasás, emberi jóváhagyás és megbízható foglaltságellenőrzés fejlesztése elsőbbséget élvez. A V2 ötletek nem módosíthatják a main/production rendszert; vendégadat, éles e-mail-küldés és Previo-írás tilos külön jóváhagyás és tesztelés nélkül.

## V2 tervezett feladatok
| ID | Feladat | Prioritás | Ellenőrzés / elfogadási feltétel |
|---|---|---|---|
| V2-01 | Previo foglalási állapotok és színkódok dokumentálása | magas | A színek és az ideiglenes/végleges foglalás jelentése hiteles forrásból igazolt; színből önmagában nincs szabadhely-következtetés. |
| V2-02 | Előleg, befizetés, hátralék és fizetési határidő figyelése | magas | Külön kezeljük a foglalás és a fizetés állapotát; csak tesztadatok, kezdetben jelzés. |
| V2-03 | Törzsvendég-felismerés | magas | 730 napos vendégkönyvi előzmény; 20% kedvezmény csak szállás- és dézsadíjra; személyazonosság ellenőrzése. |
| V2-04 | Lemondott / meg nem valósult érdeklődések és felszabaduló helyek követése | közepes | Érdeklődő hozzájárulása, lejárat, duplikáció és elérhetőség újraellenőrzése; automatikus üzenetküldés nincs alapból. |
| V2-05 | Foglalás és módosítások auditnaplója | magas | Dátum, egység, állapot és változások visszakövethetők, jogosultság szerint. |
| V2-06 | Previo-független belső adatmodell | közepes | Foglalás, vendég, egység, pénzügyi állapot külön entitás; későbbi PMS-csere támogatott. |
| V2-07 | 7–10. osztott házak A/B/C kombinációinak kezelése | magas | 12 önálló egység; azonos ház preferált; 7C +1 férőhely és egységárak tisztázandók. |
| V2-08 | Belső adatok és vendégválaszok szigorú elválasztása | magas | Személyes/pénzügyi belső mezők nem kerülhetnek vendégválaszba. |
| V2-09 | Voucher, díjbekérő, előlegszámla és IFA összefüggései | közepes | Üzemeltetővel és hiteles Previo-mezőkkel egyeztetett szabálytábla. |
| V2-10 | Ismeretlen „ATK” mező azonosítása | alacsony | Jelentése ellenőrizve; addig semmilyen üzleti szabály nem épül rá. |
| V2-11 | Previo csak-olvasás integráció megvalósíthatósága | magas | Dokumentált jogosultságok, tesztelhető hozzáférés, naplózás; nincs éles írás. |
| V2-12 | Többnyelvű és foglaltság-alapú proaktív ajánlatok | közepes | HU/DE/EN/SL; csak igazoltan elérhető egység; aktuális ár újraellenőrizve. |

## Fokozatos beépítési sorrend
1. V1 lezárásáig: csak tudásbázis és feladatlista, V1 blokkoló hibák kivételével.
2. V2 tervezés: mező- és állapottérkép, adatvédelmi határok, hiányzó szabályok jóváhagyása.
3. V2 prototípus: szintetikus tesztadatok és olvasási műveletek.
4. V2 ellenőrzés: regressziós tesztek, emberi kontroll, visszaállíthatóság.
5. Éles funkció csak külön engedéllyel és bizonyított működés után.

## Nyitott kérdések
Previo színek jelentése; tartott foglalások lejárata; 7C +1; osztott árak; ATK; voucher/díjbekérő/előlegszámla/IFA; ügyfélértesítések hozzájárulása; hozzáférési jogok.

## Bizonyítékszintek
- Megfigyelt: naptár, különböző színű blokkok, foglalási adatlap megnyitható.
- Korábbi elemzésben szerepel: pénzügyi mezők, foglalási előzmények és egyéb Previo-adatok; az eredeti felvételeken ismét ellenőrizendő.
- Javasolt: a V2-01–12 fejlesztések; egyik sem tekinthető késznek.
