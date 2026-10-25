# Szerveroldali ledger adapter

Injektált Supabase rpc függvény; nincs hitelesítő, alapértelmezett hálózati kliens, retry vagy küldés. Pontos SQL RPC-nevek, teszt tenant/mailbox, UUID és szolgáltatói receipt ellenőrzés. false eredmény megőrzése; hibás válasz és timeout fail-closed. 5 helyi szintetikus teszt PASS, 0 FAIL, 0 SKIP. Nem új PostgreSQL vagy Supabase élő próba.

Még nincs automatikusan a végpontba kötve: protected RPC kliens és külön felhős migrációs kapu hiányzik. A markSent harmadik argumentuma szolgáltatói request ID; a koordinátor és sender receipt-továbbítását az adapter aktiválása előtt össze kell kötni és integráltan tesztelni. Request ID nem telefonos kézbesítés. claim timeout után nincs provider-hívás vagy automatikus újrafoglalás. Az időtúllépett RPC szerveroldali befejeződése bizonytalan maradhat; egyedi DB-kulcs tiltja az ismételt foglalást.

Deploy, migrációalkalmazás és valódi küldés nem történt.
