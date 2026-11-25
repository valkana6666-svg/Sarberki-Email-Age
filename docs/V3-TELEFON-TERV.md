# V3 – telefonos AI-asszisztens: műszaki terv (Claude, 2026-11-25)

Forrás: tulajdonosi prioritás (#9 7162244163), Work szolgáltatói felmérése (#9 7162574575, hivatalos árlisták és dokumentáció 11-25).
Állapot: **terv**. Nincs regisztráció, előfizetés, telefonszám, bekötés vagy élő hívás. Szolgáltatót választani, fizetni és élő vonalat bekötni csak külön tulajdonosi döntéssel lehet.

## 1. Alapelv: nincs új motor
A telefon a chatbot harmadik csatornája. Ugyanazt a közös magot használja:
- beszélgetés: `createChatInquirySession`;
- döntés, ár és kapacitás: `central-inquiry-decision`, `chat-offer` (Previo TEST csak olvasás);
- tényhez kötött szabad válasz: `chat-assist`;
- igényleadás és Pushover: `chat-intake`.

A szolgáltató csak beszédfelismerést (ASR), beszédet (TTS), hívásvezérlést és átadást ad. Ár, kapacitás, előleg és foglalás **soha nem a szolgáltató LLM-jéből** származik.

```
Hívó → szolgáltató (ASR) → „Custom LLM” végpont: voice-turn (Netlify, TEST)
     → közös motor (ugyanaz, mint a chatbotnál) + chat-offer + chat-assist
     → beszédre rövidített válasz → szolgáltató (TTS) → hívó
     → átadás: transfer_to_number (recepció) | igény: chat-intake (+Pushover)
```

## 2. Szolgáltatók összevetése (dokumentált tények, élő próba még nincs)
| Szempont | ElevenLabs Agents | Retell AI |
|---|---|---|
| Saját motor bekötése | Custom LLM: OpenAI-formátumú **HTTP/SSE**. Minden fordulóban a teljes eddigi beszélgetést küldi. | Custom LLM: hívásonként **tartós WebSocket** |
| Hosting nálunk | A meglévő Netlify-függvény elég: állapotmentes, a beszélgetés minden fordulóban újrajátszható a közös motorral. | Netlify-függvény nem tart nyitva WebSocketet: külön, folyamatosan futó szerver kell (új infrastruktúra). |
| HU/DE/EN/SL | `eleven_v3` mind a négyet listázza (Flash v2.5-ben nincs SL, Multilingual v2-ben nincs HU). | ASR/TTS táblázat mind a négyet listázza (SL pl. Azure/Soniox). |
| Átadás emberhez | `transfer_to_number` (telefon/SIP; a REFER-hez trunk-jog kell) | Saját LLM mellett a szolgáltató szerint warm transfer **nem** támogatott (2026-05-16) |
| Ár (nyilvános) | Free: 15 perc; Starter: 6 USD/hó, 75 perc (+ LLM-, szám-, telefondíj) | 10 USD induló kredit; 0,07–0,31 USD/perc konfigurációtól függően |

**Javaslat:** a TEST-pilot az **ElevenLabs** Custom LLM útján induljon. Ennek oka: állapotmentes HTTP, nem kell új szerver, és van dokumentált átadás. A Retell tartalék marad; akkor kerül előre, ha a hangpróbán jobb a magyar és a szlovén felismerés. Ez nem végleges döntés; a négynyelvű hangpróba dönt.

## 3. Megvalósítási lépések (mind TEST, kapcsolóval, alapból KI)
- **V3-0 – hangpróba böngészőben** (Work/tulajdonos, ingyenes keret). Szolgáltatónként 8–12 perc, négy nyelven. Mérendő: dátum, létszám, háztípus, félrehallás, közbevágás, nyelvváltás, emberkérés. Szintetikus adatokkal, élő vonal nélkül.
- **V3-1 – `voice-turn` adapter** (Claude). OpenAI-kompatibilis végpont: a kapott üzenetlistát a közös motoron újrajátssza, és a chatbot szabályai szerint válaszol. Kapcsoló: `VOICE_TURN=test-only`; szolgáltatói titok csak Netlify-ban. Tartalma:
  - hívásonként idempotens állapot;
  - sebességkorlát és időtúllépés;
  - hiba esetén „átadom a kollégának”.
- **V3-2 – beszédre szabott válasz** (Claude):
  - rövid mondatok, felsorolás nélkül;
  - kimondott dátum és ár;
  - egy kérdés fordulónként;
  - ismert adatot nem kérdez újra.

  A 100 nyelvi forgatókönyv (`scripts/chat-language-e2e.mjs`) változatlanul lefut a voice-turn végponton is; ez a csatornaparitás bizonyítéka.
- **V3-3 – átadás és igényleadás**:
  - emberkérésre vagy bizonytalanságra `transfer_to_number` egy tesztszámra;
  - foglalási szándéknál a meglévő chat-intake indul, a Pushover a meglévő szabály szerint jelez;
  - munkatárs → AI visszaadás: PBX-feladat, a Telekom-felmérés után.
- **V3-4 – Telekom/PBX felmérés** (tulajdonos + Work, csak olvasás): pontos termék, PBX típusa, átirányítás vagy SIP trunk, REFER, díjak. Élő vonalat nem módosítunk.
- **V3-5 – pilot**: külön tesztszám, időkorlát és napi percplafon. Éles bekötés csak tulajdonosi döntéssel.

## 4. Stabilitási kapuk (#9 7162244163) – mai állapot
| Kapu | Bizonyíték | Állapot |
|---|---|---|
| 1. Kommunikáció | 100 chat- és 100 e-mail-forgatókönyv (25/nyelv). Motor 99/100, e-mail 100/100, a javítások előtt 53 és 74. `npm test` zöld. Élő TEST-alapmérés folyamatban. | Részben PASS; az élő mérés a javított kiadás után NEM IGAZOLT |
| 2. Previo ár/kapacitás/szabály | Meglévő paritás- és kapacitástesztek; chat-offer TEST-olvasás | PASS (TEST); éles összevetés külön |
| 3. Foglalás és jóváhagyás E2E | ONECLICK, chat-prefill, visszaigazolás – korábbi élő PASS-ok (V1-ALLAPOT) | PASS (TEST) |
| 4. Pénzügy, határidő, értesítés | Pénzügyi kezelő, foglaló-Pushover (08:00); minden csatornás Previo-lista kódja kész | Részben PASS; fizetés foglaláshoz kötése blokkolt (`getAccountItems`-jog) |
| 5. Hiba, újrapróbálás, duplikáció, jelzés | Idempotens írások, Previo-hiba → „ismeretlen”, igényenként egy Pushover | PASS (TEST); telefonos hibaút NEM IGAZOLT |

## 5. Költség és adatvédelem (a döntéshez)
- **Becsült perc-költség:**
  - ElevenLabs: Starter 6 USD/75 perc (≈ 0,08 USD/perc), plusz az LLM-hívás (a közös motor saját OpenAI-költsége), a telefonszám és a hívásdíj;
  - Retell: 0,07–0,31 USD/perc, plusz ugyanezek.
  - A Telekom- vagy SIP-díj ismeretlen: NEM IGAZOLT.
- **Adatvédelem:**
  - A hang és az átirat a szolgáltatónál keletkezik: adatfeldolgozói szerződés (DPA), EU-s adattárolás és a felvétel kikapcsolhatósága szolgáltatónként ellenőrizendő (NEM IGAZOLT).
  - A hívás elején tájékoztatás szükséges (AI-asszisztens, adatkezelés).
  - Valódi vendéghívás csak éles döntés után; a TEST-ben csak kitalált adat.
- **Titkok:** a szolgáltatói kulcs és a webhook-titok csak Netlify-ban lehet; GitHubra, chatbe és #9-be nem kerülhet.

## 6. Tulajdonosi döntések
1. Ingyenes fiók a V3-0 hangpróbához: a regisztráció személyes lépés.
2. Szolgáltató a próba után; fizetős csomag csak az összeg előzetes jóváhagyásával.
3. Telekom-adatok (V3-4) és egy tesztszám az átadáshoz.
4. Az éles bekötés feltételei: tájékoztató szöveg, munkaidő, percplafon.
