#!/usr/bin/env python3
"""Gate for the owner-approved TEST database install workflow (owner decision 2026-11-06).

Checks, without printing any secret:
  1. the commit marker names exactly one allowed SQL file under deployment/ that exists;
  2. the install URL targets the TEST project only (mojnqizbcaczstguikpv);
  3. a successful Drive backup (upload + exact-ID readback + restore from the Drive bytes) of this
     branch finished at most 3 hours ago; its evidence artifact digest becomes the backup reference.
Writes GITHUB_OUTPUT: sql_file, backup_run, backup_sha256.
"""
import json, os, re, sys, time, urllib.request
from datetime import datetime, timezone

TEST_REF = 'mojnqizbcaczstguikpv'
BRANCH = 'gmail-test-subject-allowlist'
MAX_AGE_S = 3 * 3600
REQUIRED_STEPS = ('Private Drive snapshots and exact-file SHA256 readback',
                  'Restore the downloaded Drive package without source credentials')


def fail(code):
    print(f'BLOCKED (stage=gate, code={code})')
    sys.exit(1)


def marker_file(message):
    found = re.findall(r'\[test-db-install ([^\]\s]+)\]', message or '')
    if len(found) != 1:
        fail('MARKER_REQUIRED')
    path = found[0]
    if not re.fullmatch(r'deployment/[a-z0-9-]+/[a-z0-9-]+\.sql', path) or '..' in path or not os.path.isfile(path):
        fail('SQL_FILE_NOT_ALLOWED')
    return path


def target_ok(url):
    # Supabase pooler user is postgres.<ref>; direct host is db.<ref>.supabase.co. Either must be the TEST ref,
    # and no other 20-letter project ref may appear.
    refs = set(re.findall(r'(?<![a-z])([a-z]{20})(?![a-z])', url or ''))
    return bool(url) and TEST_REF in refs and refs <= {TEST_REF}


def api(path):
    req = urllib.request.Request('https://api.github.com' + path, headers={
        'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'], 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def fresh_backup(repo, now=None):
    now = now or time.time()
    runs = api(f'/repos/{repo}/actions/workflows/sarberki-backup-v2.yml/runs?branch={BRANCH}&status=success&per_page=10')
    for run in runs.get('workflow_runs', []):
        finished = datetime.fromisoformat(run['updated_at'].replace('Z', '+00:00')).timestamp()
        if now - finished > MAX_AGE_S:
            continue
        jobs = api(f"/repos/{repo}/actions/runs/{run['id']}/jobs")['jobs']
        steps = {s['name']: s['conclusion'] for j in jobs if j['name'] == 'export-restore' for s in j.get('steps', [])}
        if all(steps.get(name) == 'success' for name in REQUIRED_STEPS):
            arts = api(f"/repos/{repo}/actions/runs/{run['id']}/artifacts").get('artifacts', [])
            digests = [a.get('digest', '') for a in arts if re.fullmatch(r'sha256:[a-f0-9]{64}', a.get('digest') or '')]
            if digests:
                return run['id'], digests[0].split(':', 1)[1]
    fail('FRESH_DRIVE_BACKUP_REQUIRED')


def main():
    sql = marker_file(os.environ.get('HEAD_COMMIT_MESSAGE', ''))
    if not target_ok(os.environ.get('SARBERKI_TEST_DB_INSTALL_URL', '')):
        fail('TEST_PROJECT_ONLY')
    run_id, digest = fresh_backup(os.environ['GITHUB_REPOSITORY'])
    with open(os.environ['GITHUB_OUTPUT'], 'a') as out:
        out.write(f'sql_file={sql}\nbackup_run={run_id}\nbackup_sha256={digest}\n')
    print(f'GATE PASS: file={sql} backup_run={run_id}')


if __name__ == '__main__':
    main()
