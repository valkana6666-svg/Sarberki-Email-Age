# Sárberki V1 – fixed hot-tub resource rules (2026-10-16)

Scope: test branch design contract. This document is NOT proof of live Previo availability and does not enable production, sending or Previo writes.

## Confirmed operator rules

- Physical hot tubs are fixed to houses 1–6 and 11–15; houses 7–10 have no tub on site.
- A guest staying in ANY house, including 7–10, may rent an available tub physically located at ANOTHER house.
- A tub cannot be moved. Never infer the requested tub's house from the guest's accommodation house.
- One physical tub may be assigned to only ONE booking for any overlapping interval, regardless of the accommodation house of the renter.
- Tub rental is separate from accommodation; availability, price and approval require their own verification.

## Data separation

Keep distinct: accommodationHouse, tubHouse, tubResourceId, startInstant, endInstant, bookingReference, noteReference, evidenceVersion and evidenceCheckedAt. In the calendar, resourceId MUST uniquely identify the actual fixed tub (not the accommodation house, nor a generic shared resource ID). The house eligibility list concerns tubHouse only.

## Previo note source – proposed read-only adapter

Operator reports that tub booking date/time/duration are entered in the Previo booking note. Read only through an authorized, verified source. No API capability, note completeness or consistent syntax is yet verified. Parse a note only as a candidate reservation; do not treat absence of a tub note as proof of availability. Require a complete, fresh, source-authenticated calendar covering the requested tub and interval before AVAILABLE can be emitted.

If a note is ambiguous, missing a tub-house mapping, contradictory, or a cancellation cannot be tied to an exact reservation, fail closed as UNKNOWN; never silently omit a conflicting entry. A note from an accommodation reservation for house 8 may refer to the fixed tub at house 12. Such an entry blocks house 12's tub only.

## Synthetic test cases (not live evidence)

1. Accommodation house 8, tub house 12, 2026-10-24 18:00 for 24 hours: reserve resource tub-12, not tub-8.
2. Accommodation house 10, tub house 12, 2026-10-25 12:00 for 3 hours: overlap with case 1 => UNAVAILABLE.
3. Accommodation house 7, tub house 11, same interval as case 1: distinct physical resource; no conflict solely because of case 1, but AVAILABLE still requires a complete authenticated tub-11 calendar.
4. Accommodation house 12, tub house 12, same interval as case 1: UNAVAILABLE, even if the guest resides at house 12.
5. Accommodation house 9, tub unspecified: UNKNOWN; never assume tub-9 exists or assign an arbitrary tub.
6. A missing or ambiguous Previo note, unverified cancellation, incomplete calendar or expired evidence: UNKNOWN, no approval.
7. A valid, complete snapshot with a confirmed reservation overlap: UNAVAILABLE; only complete and fresh conflict-free evidence can yield AVAILABLE.

## Integration constraint

Existing `createTubAvailabilityChecker` expects a trusted provider and short-lived complete snapshots; existing `createTubServiceApproval` separately checks authenticated binding, availability, case revisions, permissions and approval. Connect a read-only Previo-note adapter only after verifying data coverage and physical resource IDs. Preserve production/main restrictions, synthetic-only testing and human approval.
