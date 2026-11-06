#!/usr/bin/env python3
"""Restore drill (owner plan 2026-11-06, docs/UJRAEPITESI-PROBA.md): restore the package that was just
uploaded to and downloaded back from Drive (same run, exact-ID readback) into a NEW, EMPTY Supabase
project. Never the TEST project, never a non-empty database. Prints only counts and fixed codes.

Status: prepared, NOT VERIFIED against a real new Supabase project yet (that is the drill itself).
"""
import importlib.util, json, os, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEST_REF = 'mojnqizbcaczstguikpv'


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), ROOT / (name + '.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod


def fail(code):
    print(f'BLOCKED (stage=drill, code={code})'); sys.exit(1)


def target_ref(url):
    refs = set(re.findall(r'(?<![a-z])([a-z]{20})(?![a-z])', url or ''))
    if len(refs) != 1:
        fail('DRILL_TARGET_UNVERIFIED')
    ref = refs.pop()
    if ref == TEST_REF:
        fail('DRILL_TARGET_IS_TEST_PROJECT')
    return ref


def psql(url, sql):
    p = subprocess.run(['psql', url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], capture_output=True)
    if p.returncode:
        fail('DRILL_SQL_FAILED')
    return p.stdout.decode().strip()


def restore(url, args, dump, code):
    p = subprocess.run(['pg_restore', '--exit-on-error', '--no-owner', '--dbname=' + url, *args, str(dump)], capture_output=True)
    if p.returncode:
        for line in p.stderr.decode(errors='replace').splitlines():
            if 'ERROR:' in line:
                safe = line.split('ERROR:', 1)[1].strip()
                if re.fullmatch(r'[A-Za-z0-9_ "().:,-]{1,200}', safe):
                    print('pg_restore ERROR:', safe)
                break
        fail(code)


def copy_counts(dump, schema, tables=None):
    """Expected row counts per table, from the dump's own COPY sections."""
    args = ['pg_restore', '--data-only', '--file=-', '--schema=' + schema] + [f'--table={t}' for t in (tables or [])] + [str(dump)]
    text = subprocess.run(args, capture_output=True, check=True).stdout.decode(errors='replace')
    counts, current = {}, None
    for line in text.splitlines():
        m = re.match(r'COPY ([\w."]+) \(', line)
        if m:
            current = m.group(1).replace('"', '').split('.')[-1]; counts[current] = 0; continue
        if current:
            if line == '\\.':
                current = None
            else:
                counts[current] += 1
    return counts


def main():
    url = os.environ.get('SARBERKI_RESTORE_DRILL_DB_URL', '')
    ref = target_ref(url)
    if psql(url, "select count(*) from information_schema.tables where table_schema='public'") != '0':
        fail('DRILL_TARGET_NOT_EMPTY')
    rs = load('backup-v2-restore'); cloud = rs.cloud
    values = dict(os.environ)
    identity, _ = rs.restore_input_identity('drive-readback-v1', values)
    expected, provenance = rs.fresh_identity(rs.DRIVE_DIRECTORY, identity)
    encrypted = rs.read_ciphertexts(rs.DRIVE_DIRECTORY, expected)
    phrase = os.environ.pop('SARBERKI_BACKUP_PASSPHRASE')
    with tempfile.TemporaryDirectory(prefix='drill-gpg-') as gh, tempfile.TemporaryDirectory(dir='/dev/shm') as ram:
        dump_plain = cloud.symmetric_command(['--decrypt'], dict(os.environ, GNUPGHOME=gh), phrase, data=encrypted['database.dump.gpg'])
        phrase = None
        if not dump_plain.startswith(b'PGDMP'):
            fail('NOT_POSTGRES_ARCHIVE')
        dump = Path(ram) / 'snapshot.dump'; dump.write_bytes(dump_plain); dump.chmod(0o600)
        want_public = copy_counts(dump, 'public')
        want_auth = copy_counts(dump, 'auth', ['users', 'identities'])
        # 1. Application schema with its grants/RLS (privileges kept: Supabase's default grants must be revoked as in the source).
        restore(url, ['--schema=public'], dump, 'DRILL_PUBLIC_RESTORE_FAILED')
        # 2. Login accounts only (users + identities); sessions/tokens are deliberately not restored.
        restore(url, ['--data-only', '--schema=auth', '--table=users', '--table=identities'], dump, 'DRILL_AUTH_RESTORE_FAILED')
    got_public = {t: int(psql(url, f'select count(*) from public."{t}"')) for t in want_public}
    got_auth = {t: int(psql(url, f'select count(*) from auth."{t}"')) for t in want_auth}
    mismatch = sorted([t for t in want_public if got_public[t] != want_public[t]] + ['auth.' + t for t in want_auth if got_auth[t] != want_auth[t]])
    rls_off = psql(url, "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'sc\\_%' and not c.relrowsecurity")
    anon_exec = psql(url, "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'sc\\_%' and has_function_privilege('anon',p.oid,'execute')")
    report = {'target_project': ref, 'source_run': provenance['run_id'], 'public_tables': len(want_public),
              'rows_match': not mismatch, 'mismatched': mismatch, 'sc_tables_without_rls': int(rls_off),
              'sc_functions_executable_by_anon': int(anon_exec),
              'cases': got_public.get('sc_cases'), 'audit_rows': got_public.get('sc_audit'),
              'memberships': got_public.get('sc_memberships'), 'auth_users': got_auth.get('users')}
    print(json.dumps(report, indent=1))
    if mismatch or int(rls_off) or int(anon_exec):
        fail('DRILL_VERIFICATION_FAILED')
    print('DRILL RESTORE PASS (database). Next: Supabase/Netlify/Google settings per docs/HELYREALLITASI-LELTAR.md.')


if __name__ == '__main__':
    main()
