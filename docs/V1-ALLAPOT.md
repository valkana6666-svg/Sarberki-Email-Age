# Sárberki – aktuális állapot (legfeljebb 40 sor; minden feladat a saját commitjában frissíti)
Frissítve: 2026-11-23. Teljes előzmény, minden engedély és eredmény szó szerint: [`V1-ALLAPOT-NAPLO-2026-11.md`](V1-ALLAPOT-NAPLO-2026-11.md) (archívum, ne bővítsd). Tiltások: AGENTS.md.

## Hol tartunk (TEST: leafy-chimera-2403e5, Previo 73521, tesztpostafiók)
| Terület | Állapot | Bizonyíték |
|---|---|---|
| E-mail: Gmail → közös AI → napi kezelő → jóváhagyás → küldés (tesztpár) | ÉLŐ PASS | archívum: TEST-MAIL-SEND, ONECLICK-V2 |
| Chat: azonnali ajánlat (ár, szabad ház, alternatívák drágábbal elöl) → véglegesítés → Pushover → Previo-opció 48 h | ÉLŐ PASS | Teszt Anna 11-22, Teszt Gábor 11-22 |
| Személyzet megerősít a Previóban → „Visszaigazoló levél küldése” (egy kattintás) | ÉLŐ PASS | levelek 11-22 12:25, 12:57 |
| Ütközés A/B/C (tulajdonos, chat, 11-22/23) | **PASS** | A: Gábor → 3-as ház; B: Hanna VIP okt. 1–3. opció (1-es ház, lejár 11-25 21:52, szándékosan nem megerősítve → időzítős lemondás próbája), Iván ugyanarra: „nincs szabad”, alternatívák drágábbal elöl; C: Deluxe jún. 10–13. foglalt (4 tesztfoglalás), VIP/Családi/Osztott C |
| „Foglaló beérkezett” gomb → „Lezárt”; foglaló-határidő jelzés (lista + következő lépés: ⏳ 2 napon belül / ⚠️ lejárt); **vendég-emlékeztető** a határidő előtti utolsó 2 napban, egy kattintással, foglalásonként egyszer (tulajdonos 11-23) | KÓD KÉSZ TEST; DB `deposit-reminder.sql` **TELEPÍTVE** (tulajdonosi jóváhagyás, run 45271593899, VERIFY PASS, mentés 45271124080); élő emlékeztető-próba: Teszt Lili, 11-28 22:13-tól | `116ef7b`, e commit |
| Lejárt **chates** opció automatikus lemondása (15 percenként, +15 perc türelem, friss újraolvasás írás előtt; az e-mailes úton foglalt opciót nem mondja le – tulajdonos 11-23 „B”, ismérv: Previo-megjegyzés „Chatből…”) | BEKAPCSOLVA, 4/4 PASS (kézi indítás) | `c08944f`; időzítős futás NEM IGAZOLT |
| Törzsvendég 20% (név+e-mail+telefon; 730 nap az érkezéstől; dézsa is) | BEKAPCSOLVA, 7 eset PASS | archívum: TÖRZSVENDÉG |
| Vendéglevél sima szöveg + telefonbarát HTML (voucher táblázatban) | **ÉLŐ PASS iPhone Gmail 11-23 22:13** | Teszt Lili: chat → Previo 2-es ház → személyzeti megerősítés → levél (186 450 Ft = 181 500 + 4 950 IFA) |
| Napi kezelő: olvasható opció-lejárat, Previóban lemondott ügynél nincs teendő | KÉSZ TEST, élő olvasás PASS | `4d230de` |
| Napi Drive-mentés + visszaállítás | minden reggel PASS | #9 napi komment |
| Netlify | 11-23: a keret elfogyott (`usage_exceeded`, az oldal leállt) → tulajdonos Pro-csomagra váltott, 3 párhuzamos telepítés; **telepítéseket összevonni** (doksi: `[skip netlify]`) | – |

## Aktív kapcsolók (Netlify TEST, „Production” context) és állandó engedélyek
- `CHAT_PREVIO_PREFILL=test-only` – PERM-20261119-CHAT-PREFILL; `OPTION_EXPIRY_CANCEL=test-only` – PERM-20261122-OPTION-EXPIRY-CANCEL; `RETURNING_GUEST_CHECK=test-only`; Previo-írás csak 73521 (`PREVIO_WRITE_ENABLED=sandbox-73521-only`), az éles 753011-et a kód elutasítja.
- Új Previo-írási engedély: végrehajtás ELŐTT ide, az „Engedélyek” alá (ki, mikor, pontos művelet, tesztadat, zárás).

## Nyitott feladatok
| ID | Felelős | Teendő |
|---|---|---|
| ÜTKÖZÉS-B/C | tulajdonos (chat) → Claude visszaolvas | B: VIP okt. 1–3. Hanna, majd Iván (alternatívák); C: Deluxe jún. 10–13. |
| IFA-PREVIO | Work (#9 7081590641) | Új IFA-időszak 2026-11-22–12-31 a 2027-es szabály másolataként (PERM-20261122-TEST-IFA); oka: a szabály a foglalás létrehozásának dátumához kötődik. Utána Claude visszaolvassa. |
| FOGLALÓ-OLVASÁS | Work (#9 7078873700) → Claude | **Hatókör (tulajdonos 11-23): a rendszer feladata a foglaló beérkezéséig tart** („Lezárt” = befejezett ügy). Most kézi gomb; később a Previóban rögzített befizetés automatikus átvétele. **A művelet: XML `Hotel.getPayments` – létezik, de sem a TEST, sem az éles kulcsnak nincs rá joga** („Unauthorized access”, 11-24, csak olvasó próba) → Previótól kérendő. Pushover a foglaló beérkezéséről: az édesapa dönt, most NINCS. |
| PIACI-SZEGMENS | Work/Claude | A Previo mentéskor kötelezőnek kéri; beírható-e az API-n a létrehozáskor (dokumentáció). |
| CHATBOT-11 | tulajdonos (édesapa) | Dátumváltoztatási szabály. |
| ÉLES-PREVIO-OLVASÁS | Claude (saját GitHub-hozzáférés) | **Claude saját, csak olvasó éles próbája PASS 11-23** (`previo-live-read.yml`, titok `PREVIO_LIVE_API_KEY`, runok 45163738332, 45163917232): árlisták 200 (8, köztük „Törzsvendég 20% kedvezmény” 155701), típusok 200 (6/23), naptár 200 (jún. 15–17. minden típus olvasva), **árszámítás 200: Deluxe 2 éj 2 fő 128 200 Ft = a mi árlistánk IFA-val együtt**, foglaláskeresés 200 (2026. júl. 1–3.: 18 foglalás, teljes vendégadat-mezőkkel – csak darabszám/mezőnév rögzítve). 403: `Hotel.rooms`, `Hotel.getGuestCategories`. Befizetés-végpont: nem próbált. Napi kezelő 🔎 sor BEKAPCSOLVA (`PREVIO_LIVE_SHOW`). `PREVIO_LIVE_READ` KI. |
| ÉLES-1 | tulajdonos döntése | Éles postafiók csak olvasva (terv: archívum LIVE-MAILBOX-PLAN). Utána éles Previo olvasókulcs (levél kész, nincs elküldve), majd éles V2. |
| ÜGYFÉLSZERZÉS (V3 után) | HALASZTVA | Previót használó szálláshelyek: Work 20–30 nyilvános honlap → igazolt jelöltek adatlapja, testreszabási nehézség és feltételes költség, 2–3 pilot; automatizálás csak a kézi út bevált után (#9 7101032904). Most semmi. |
| V3 | később | Telefonos asszisztens (terv jóváhagyva 11-12, irány „A” 11-15). |

## Engedélyek (új bejegyzés ide; a korábbiak az archívumban)
| Típus | Engedélyező | Időpont | Pontos művelet | Tesztadat / zárás |
|---|---|---|---|---|
| ELŐZETES – PERM-20261123-LIVE-SHOW (éles OLVASÁS, nem írás) | Tulajdonos (Claude-munkamenet, 2026-11-23: „Megerősítem”, a kérdésre: olvashatja-e a rendszer az éles Previo szabadhely-naptárát, csak olvasva) | 2026-11-23, bekapcsolás ELŐTT | 753011: kizárólag GET `/rest/calendar/availability` a napi kezelő 🔎 sorához (`PREVIO_LIVE_SHOW=availability-only`, `PREVIO_LIVE_API_KEY`), típusonként és időszakonként, 5 perces gyorsítótár; foglalás, vendég, ár, írás TILOS | Megjelenítés csak a kezelőnek; zárás: `PREVIO_LIVE_SHOW` törlése + újratelepítés |
| ELŐZETES – PERM-20261123-LIVE-READ-PROBE (éles OLVASÁS, nem írás) | Tulajdonos (Claude-munkamenet, 2026-11-23: „próbáljátok ki teljesen … Amit nem próbáltuk, azt próbáljuk meg.”) | 2026-11-23, végrehajtás ELŐTT | 753011, az éles olvasókulccsal, végpontonként legfeljebb 1–2 hívás: árszámítás (suggester – csak ha a dokumentáció szerint nem hoz létre foglalást), foglalások keresése (kis időablak), egy foglalás részletei, befizetések, kódlisták (vendégkategória, piaci szegmens, étkezés). Írás, módosítás, lemondás TILOS | Valódi vendégadat sehova (issue, fájl, napló, chat): csak HTTP-kód, darabszám, mezőnevek; zárás: eredmény a #9-be |
