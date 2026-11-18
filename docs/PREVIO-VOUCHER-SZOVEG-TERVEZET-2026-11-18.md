# Previo TEST (73521) – visszaigazolási/voucher szövegtervezet (Claude, 2026-11-18)

**Ez csak tervezet.** Hely: Previo TEST → Beállítások → Foglalások → Visszaigazolás (`pms2.previo.app/73521/settings/reservations/voucher`), a Work-felmérés alapján (#9 6975370095). A mezők beírása és mentése Previo-írás, ezért csak a tulajdonos előzetes, a `docs/V1-ALLAPOT.md` „Engedélyek” részébe rögzített engedélyével történhet, Work hajtja végre. Éles 753011: semmi.

Forrás: jóváhagyott tények (`business-config.mjs`, `shared-core/chat-assist.mjs`) és az éles voucher szerkezete (#9 6897808952, képelemzés). A `[…]` jelölt adatot a tulajdonos adja meg; ezeket nem találtam ki.

## Mező: „További információk (fizetési útmutató stb.)”

**HU**
> Bejelentkezés: 14:00 és 2:00 között, kijelentkezés: 10:00-ig. Recepciónk a nap 24 órájában elérhető.
> Az előleget banki átutalással kérjük: [kedvezményezett], [bankszámlaszám], közlemény: a foglalási szám. A fennmaradó összeget a helyszínen bankkártyával, készpénzzel vagy SZÉP-kártyával is rendezheti.
> Az áramot faházanként mérőóra alapján, a szállásdíjon felül számoljuk el; érkezéskor és távozáskor közösen leolvassuk.
> Cím: 8960 Lenti, Sárberki tó utca 1. GPS: [koordináta]. Telefon: +36 30 640 7621.

**DE**
> Check-in: zwischen 14:00 und 2:00 Uhr, Check-out: bis 10:00 Uhr. Unsere Rezeption ist rund um die Uhr erreichbar.
> Die Anzahlung erbitten wir per Banküberweisung: [Empfänger], [IBAN], Verwendungszweck: Buchungsnummer. Den Restbetrag können Sie vor Ort mit Bankkarte, bar oder mit SZÉP-Karte bezahlen.
> Strom wird je Haus nach Zählerstand zusätzlich zum Übernachtungspreis abgerechnet; der Zähler wird bei Anreise und Abreise gemeinsam abgelesen.
> Adresse: 8960 Lenti, Sárberki tó utca 1. GPS: [Koordinaten]. Telefon: +36 30 640 7621.

**EN**
> Check-in: between 14:00 and 2:00, check-out: by 10:00. Our reception is available 24 hours a day.
> Please pay the deposit by bank transfer: [beneficiary], [IBAN], reference: booking number. The remaining amount can be paid on site by bank card, in cash or with a SZÉP card.
> Electricity is charged per cabin by meter reading, on top of the accommodation price; the meter is read together on arrival and departure.
> Address: 8960 Lenti, Sárberki tó utca 1. GPS: [coordinates]. Phone: +36 30 640 7621.

**SL**
> Prijava: med 14:00 in 2:00, odjava: do 10:00. Naša recepcija je na voljo 24 ur na dan.
> Predplačilo prosimo z bančnim nakazilom: [prejemnik], [IBAN], sklic: številka rezervacije. Preostali znesek lahko plačate na kraju samem z bančno kartico, z gotovino ali s kartico SZÉP.
> Elektrika se obračuna po števcu za vsako hiško, poleg cene nastanitve; števec skupaj odčitamo ob prihodu in odhodu.
> Naslov: 8960 Lenti, Sárberki tó utca 1. GPS: [koordinate]. Telefon: +36 30 640 7621.

## Mezők: „Tárgy” és „E-mail szöveg” (most üresek)
- Tárgy – HU: `Sárberki Horgásztó – foglalás visszaigazolása` · DE: `Sárberki Horgásztó – Buchungsbestätigung` · EN: `Sárberki Horgásztó – booking confirmation` · SL: `Sárberki Horgásztó – potrditev rezervacije`
- E-mail szöveg: rövid kísérőszöveg, a részletek a csatolt visszaigazolásban vannak – HU: „Köszönjük foglalását! A visszaigazolást csatoltan küldjük.”; DE: „Vielen Dank für Ihre Buchung! Die Bestätigung finden Sie im Anhang.”; EN: „Thank you for your booking! Please find the confirmation attached.”; SL: „Hvala za vašo rezervacijo! Potrditev je priložena.”

## Nyitott (tulajdonos)
1. Kedvezményezett neve, bankszámlaszám/IBAN, GPS-koordináta – az éles voucherről (csak ezek a mezők, vendégadat nélkül).
2. Engedély a fenti szövegek beírására a TEST-ben (műveletenként: melyik mező, mely nyelvek). Küldés (boríték ikon) ezzel nem engedélyezett.
