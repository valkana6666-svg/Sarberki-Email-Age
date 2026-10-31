# Sárberki V1 – Gmail → AI-előnézet: célzott elfogadási kapuk (2026-10-31)

## Kiindulás, bizonyíték és korlát
- Tesztág: `gmail-test-subject-allowlist`; AGENTS.md teljes tartalma ellenőrizve. Blob SHA: `be27bd2dfb4795496bd9f3d64ad60ada1123de5b` (nem commit SHA).
- A `napi-kezelo/napi-email.mjs` a `gmail.readonly` jogosultságú tesztpostafiók-olvasót megvalósítja, de a kijelölt levél átadását nem.
- A `napi-kezelo/napi.mjs` rendelkezik védett szerveres szintetikus chat klienssel, amely külön, jelenleg rejtett tesztfelületet használ.
- A `shared-core/server-chat-preview.mjs` alapértelmezetten tiltott, operátori cookie/CSRF és kijelölt TESZT-origin mellett engedélyezhető; a jelenlegi API szerződés `{language,messages}`.
- Sem a tényleges Gmail→AI átadás, sem a hosztolt OAuth/jóváhagyási folyamat nincs e dokumentummal igazolva.

## Választott minimális irány
A meglévő Gmail-olvasó kijelölt üzenetéhez helyi, nem perzisztált, kizárólag szintetikus előnézetet kapcsoljunk a már létező szerveres AI-előnézeti útvonalon, ha ez a jelenlegi biztonsági szerződés mellett bizonyítható. Ne hozzunk létre második motort, új ügytárat vagy Gmail-integrációt. **A jelenlegi szerveres chat `{language,messages}` végpontja nem vállal explicit Gmail-üzenetazonosító-, mailbox- vagy forrásbizonyíték-szemantikát.** Ezért az élő Gmailből kiválasztott valós/titkos üzenet automatikus átadása NEM engedélyezett pusztán a kliensoldali összekötéssel. Ha a kívánt funkció valós postafiók-üzenet előnézete, előbb külön, biztonságos és ellenőrizhető adatkezelési terv szükséges.

Alternatívák:
1. Meglévő szintetikus chat-útvonalhoz célzott, csak szintetikus üzenet-előnézet: gyorsabb és kevesebb jogosultsági változás, de nem teljes Gmail E2E.
2. Éles Gmail-üzenet biztonságos szerveres átvétele: forrásbizonyíték/engedély, adatvédelmi és tenant-kapuk szükségesek, ezért nem nevezhető egyszerű UI-bekötésnek.
Választás: elsőként (1), kifejezetten korlátozott bizonyítékkal; (2) csak külön vizsgálat/jóváhagyás után.

## Elfogadási tesztek
- Tesztfiók és `gmail.readonly` változatlan; nincs gmail.send, szerveres levélküldés, Previo-írás.
- Operátor nélkül, rossz tenant/CSRF, hibás Origin, lejárt session esetén a szintetikus előnézet elutasított; nincs cache, fallbackból kitalált ügy, vagy automatikus retry.
- Kijelölt levél váltásakor a korábbi előnézet törlődik; lassú/visszatérő válasz nem jelenhet meg másik üzenet alatt.
- Kijelentkezés, lap elrejtése és lejárt kezelői munkamenet törli az előnézetet; Google-popup alatti állapotkezelés nem szivárogtat üzenettörzset.
- Kizárólag kitalált fixture-ekkel: üzenetválasztás → közös előnézeti kliens → magyar válasz; nincs ügymentés, jóváhagyás, ár-/kapacitásbizonyíték vagy vendégnek küldhető ajánlat.
- Két egymás utáni különböző üzenet és gyors váltás, hálózati 401/403/429/503, megszakított kérés; negatív teszt.
- A napló, HTML és GitHub sem tartalmazhat valódi e-mail-törzset, tokent vagy ügyféladatot.
- Egyezés a meglévő központi döntési motorral; az előnézet semmit nem állíthat igazolt foglalhatóságnak, ha a kapacitás nem bizonyított.
- Friss HEAD, célzott tesztek és teljes CI: konkrét SHA/run ID; külön hosztolt OAuth → AI → kezelő → Approver és fizikai iPhone-próba. Unit/mobil-emuláció != hosztolt E2E.

## Külön tiltások és munkamegosztás
- A Claude által esetleg módosított `napi-kezelo/napi-email.mjs`, `napi-kezelo/napi.mjs`, `napi-kezelo/index.html` és AI-kód párhuzamosan nem írható felül.
- Csak `gmail-test-subject-allowlist`. Nincs `main`, production, telepítés, új ág, force push, tényleges levélküldés, foglalás vagy SQL-migráció külön engedély nélkül.
- Ez elfogadási specifikáció, **nem kódimplementáció és nem PASS igazolás**. A jóváhagyott üzleti szabályok és V2/V3 adat-/jogosultsághatárok változatlanok.

## Jóváhagyott architekturális eltérés – 2026-10-31

Projektvezetői döntés: a fenti „szerveres AI-előnézeti útvonal” helyett az **A) változat** – a meglévő közös e-mail-adapter (`shared-core/inquiry-channel-adapters.mjs` → `buildEmailInquiryDraft` → `central-inquiry-decision.mjs`) közvetlenül a böngészőben, helyben fut.

- Indok: a szerveres `server-chat-preview` hosztoltan tiltott (503), `{language,messages}` szerződése nem e-mailre készült, élő rate limitje nem igazolt. A kliensoldali út nem igényel új hosztolt kaput, és a levéltörzs nem hagyja el a böngészőt.
- Kompatibilitási bizonyíték: a valódi `scripts/build-static.cjs` a teljes, 15 modulos import-láncot publikálja (nincs bare/`node:` import); Chromiumban és Node-ban azonos bemenetre bájtra azonos szöveg és döntés (5/5). A chatbot böngészős modulja már ugyanezt az adaptert használja.
- Hatókör: kizárólag a lezárt szintetikus registry (`shared-core/synthetic-mail-fixtures.mjs`, `closedMailRequestFromGmailRecord`) pontos levelei kaphatnak előnézetet. Minden más vagy módosított Gmail-levélnél a gomb tiltott; tetszőleges levél feldolgozása külön jóváhagyást igényel.
- A szerveroldali CSRF/Origin/401/403/429/503 kapuk helyett: nincs előnézeti hálózati kérés; minden előnézet előtt friss kezelői munkamenet-ellenőrzés (`restoreSession`), hibánál nincs automatikus újrapróbálás.
- Változatlan: nincs ügymentés, jóváhagyás, levélküldés, foglalás, tartós tárolás vagy naplózás; Gmail `gmail.readonly`; üzleti szabályok, tenant- és jogosultsági határok; a részletes Gmail-nézet (`gmail-readonly.js`) érintetlen.
- Ismert, külön kezelendő eltérés (P1): a részletes Gmail-nézet a régi `sarberki-core` láncot használja, ezért a két felület tervezete eltérhet; mértéke NEM IGAZOLT.
