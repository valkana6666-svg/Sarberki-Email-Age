# Sárberki V1 – translation terminology review (2026-10-16)

Scope: documentation-only review of the three previously verified closed synthetic EN/DE/SI → HU translations. No new API request or claim of production readiness.

## Observed terms
- EN: “Deluxe kabin” → preferred **„Deluxe faház”**.
- DE: “Deluxe nyaralóház” → preferred **„Deluxe faház”**.
- SI: “Deluxe házikó” → preferred **„Deluxe faház”**.

The verified samples retained arrival 2026-10-23, departure 2026-10-25, 2 adults, 0 children and fictional phone +36 00 000 0000. These checks do not establish general translation quality.

## Proposed glossary for later implementation (requires human domain review)
| Meaning | Preferred Hungarian |
|---|---|
| cabin / lodge / Ferienhaus / hiška (when referring to the property's lodging) | faház |
| Deluxe cabin | Deluxe faház |
| family cabin | Családi faház |
| VIP cabin | VIP faház |
| split apartment, section C | osztott négyfős apartman (C egység) |
| fishing pier | horgászstég |
| hot tub / Badezuber | dézsa (külön bérelhető) |
| deposit / Anzahlung | előleg |
| cancellation deadline | lemondási határidő |

Important: do not automatically map a generic 'four-person apartment' to section C without clarification. Do not turn absent child counts into confirmed zero. Preserve dates, amounts, person counts, phone numbers and intent exactly. Never insert prices, availability or promises that are not in the source. House numbers must not be exposed in guest-facing replies.

## Proposed next tests (synthetic, offline-first)
1. Check terminology normalization separately from numeric integrity.
2. Check negation, uncertainty and questions (e.g. 'is it available?' must not become 'it is available').
3. Check 0 children vs unspecified children.
4. Check multi-unit A/B/C requests and adjacency conditions.
5. Check dates, currencies, deposits, cancellation rules, and hot-tub optionality.
6. Check ambiguous housing types and escalation rather than guessing.
7. Keep source text visible and require human review before use.

## Guardrails
Only gmail-test-subject-allowlist. No main/production changes, real guest data, mail/Pushover send, Previo write, API key exposure or new paid translation calls. This file is review documentation, not a tested code change. Existing CI/Netlify evidence remains the earlier b7f8597 checkpoint.
