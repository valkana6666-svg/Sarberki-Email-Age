-- Read-only catalog preflight; never applies a migration or enables notifications.
-- Caller MUST independently verify project mojnqizbcaczstguikpv (sarberki-test).
-- schema_ready is not deployment permission, rollback proof, or send authorization.
WITH conflicts AS (
 SELECT 'relation:'||c.relname AS object_name FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='sc_pushover_delivery_claims'
 UNION ALL
 SELECT 'type:'||t.typname FROM pg_catalog.pg_type t
 JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
 WHERE n.nspname='public' AND t.typname='sc_pushover_delivery_claims'
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.reltype=t.oid)
 UNION ALL
 SELECT 'function:'||p.proname FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('sc_pushover_claim_once','sc_pushover_mark_sent','sc_pushover_mark_unknown','sc_pushover_guard_update')
), roles AS (
 SELECT count(*)=3 AND bool_and(NOT rolsuper AND
   CASE WHEN rolname='service_role' THEN rolbypassrls ELSE NOT rolbypassrls END) AS ready
 FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role')
), prerequisites AS (
 SELECT (SELECT ready FROM roles) AS roles_ready,
 EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='public') AS schema_present,
 to_regprocedure('pg_catalog.gen_random_uuid()') IS NOT NULL AS uuid_available
)
SELECT 1 AS preflight_version,
 (roles_ready AND schema_present AND uuid_available AND NOT EXISTS(SELECT 1 FROM conflicts)) AS schema_ready,
 roles_ready,schema_present,uuid_available,
 ARRAY(SELECT object_name FROM conflicts ORDER BY object_name) AS conflicting_objects,
 false AS activation_authorized,
 'PROJECT_ID_AND_ROLLBACK_EVIDENCE_REQUIRED'::text AS external_gate
FROM prerequisites;
