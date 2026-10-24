{
  "as_of_utc": "2026-10-24T19:30:00Z",
  "project": "mojnqizbcaczstguikpv",
  "status": "ACTIVE_HEALTHY",
  "postgres_version": "17.11.0.003",
  "readonly_inventory": {
    "storage_buckets": 0,
    "storage_objects": 0,
    "vault_secret_count": 0,
    "pg_tables_excluding_system_schemas": 50,
    "note": "This catalog count includes schemas/internal tables and is not the 49 COPY-payload tables compared in the restore."
  },
  "edge_functions": [
    {
      "slug": "reader-password-reset",
      "version": 9,
      "verify_jwt": true,
      "status": "ACTIVE",
      "source_path": "recovery/edge-20261020/reader-password-reset/index.ts",
      "handler": "closed HTTP 410; no password mutation",
      "gateway_redeployment": "BLOCKED_UNVERIFIED"
    }
  ],
  "platform_gaps": {
    "netlify": "Authenticated test site general configuration opens login page; no account-level configuration or secret export read. Existing netlify.toml/Functions/source retained. New isolated HTTPS restore not run.",
    "supabase_auth": "Auth rows restored and DB checks PASS; managed Site URL, callback allowlist, provider/SMTP/MFA/session settings and signing keys not exported by current connector.",
    "storage": "No buckets or objects now; no object binaries to recover in this snapshot. Future nonempty storage requires separate object backup and settings verification.",
    "vault": "Extension and zero secrets restored; platform encryption root key availability not proven. Zero stored values does not prove future encrypted-value recovery.",
    "github": "Git history bundle, workflows and source in encrypted archive; repository Actions policies, repository/environment secrets, variable scopes, protections and account recovery must be re-provisioned from owner-controlled inventory.",
    "integrations": "Gmail readonly OAuth, Netlify session key, OpenAI, SMTP/Pushover credentials and Previo authorization need owner-controlled re-provisioning; no token export, outgoing message, booking write, or paid service created."
  }
}
