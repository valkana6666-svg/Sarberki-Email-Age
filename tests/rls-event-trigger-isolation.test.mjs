import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

test('event trigger cannot be called directly and still fires after execute revocation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create function public.test_rls_event() returns event_trigger
      language plpgsql security definer set search_path = 'pg_catalog' as $$
      begin execute 'alter table public.test_rls_table enable row level security'; end $$;
      create event trigger test_rls_trigger on ddl_command_end
        when tag in ('CREATE TABLE') execute function public.test_rls_event();
    `);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(db.query('select public.test_rls_event()'), /trigger functions can only be called as triggers/i);
      } finally {
        await db.exec('reset role');
      }
    }
    await db.exec(`
      revoke execute on function public.test_rls_event() from public, anon, authenticated;
      create table public.test_rls_table (id integer);
    `);
    const result = await db.query("select relrowsecurity from pg_class where oid = 'public.test_rls_table'::regclass");
    assert.equal(result.rows[0].relrowsecurity, true);
    for (const role of ['anon', 'authenticated']) {
      const privilege = await db.query("select has_function_privilege($1, 'public.test_rls_event()', 'EXECUTE') as allowed", [role]);
      assert.equal(privilege.rows[0].allowed, false);
    }
  } finally {
    await db.close();
  }
});
