# Consolidated test release — 2026-10-26

- Owner explicitly authorized temporary build activation whenever needed for the existing test project; restore Stopped after each consolidated release.
- Site: leafy-chimera-2403e5 only. Production moonlit-torrone-88b39d and main untouched.
- Deployed commit: 2f765068edc5a17f2fcc14c2b231cfcaa274daa6. Release marker commit has exactly the tested e4dea749c855490de06fbb876f19d7795ab0f321 tree (eed202afbca884848e195bb9017f9511802b28da).
- Full local npm test: 2158 PASS, 0 FAIL, 0 SKIP, 0 cancelled. Static build passed. No separate Actions run observed for the empty release marker; latest application CI: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40263671745 .
- Netlify deploy: https://app.netlify.com/projects/leafy-chimera-2403e5/deploys/6adf13201a26a969fe6e14d4 — Published, build 16 seconds, 13 functions.
- Rollback candidate retained: 6addf31de3bcf9847d3861d1, commit 75c2469f88589375310334f78b9b85708f38542b.
- Hosted /api/health returned exact new commit, ok true, autoSend false, autoBookingModification false, livePriceVerified false. Home UI displayed BUILD 2f76506.
- Netlify Build status restored to Stopped and read back; Trigger deploy disabled. Exactly one release triggered.
- No email, Pushover notification, booking, Previo query/write, schema migration or environment-secret change performed.

## Browser acceptance finding — OPEN
Manual-paste test input: "Szintetikus teszt: 2 felnőtt részére szeretnék Deluxe faházat. Érkezés: 2027-05-10. Távozás: 2027-05-12."
After processing the rendered summary still reported unknown arrival/departure/total/children, adults 2 and Deluxe. The reply requested dates. Re-observation confirmed this persisted. Earlier input using "Két felnőtt" likewise left total/children unknown. This is a narrow browser acceptance failure, not proof of all parser paths failing.
No verified availability or price was claimed and no booking was confirmed. Next task: reproduce against the manual extract/render path and central parser, add meaningful regression, fix with no live external calls. Full release acceptance remains NOT PROVEN.

## V2/V3 value and limits
The release preserves the shared decision core and server-side safety gates. SQL ledger migration, live Previo no-hold proof and full platform recovery remain separate open gates.
