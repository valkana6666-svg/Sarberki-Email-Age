import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { shouldSkip } = createRequire(import.meta.url)('../scripts/netlify-test-build-gate.cjs');
const target = { SITE_NAME: 'leafy-chimera-2403e5', BRANCH: 'gmail-test-subject-allowlist' };
test('routine commits, CI and backup requests cannot authorize a test deploy', () => {
  for (const message of ['Fix Gmail', '[backup-v2-cloud-bridge-run] Daily cloud backup 2026-10-25', '[backup-v2-owner-key-probe] Readback', '', 'Mention [netlify-test-release] in docs'])
    assert.equal(shouldSkip(target, message), true);
});
test('explicit release marker permits only the pinned test branch', () => {
  assert.equal(shouldSkip(target, '[netlify-test-release] Verified Gmail batch'), false);
  for (const BRANCH of ['main', 'backup/issue-6-cloud-recovery', ''])
    assert.equal(shouldSkip({ ...target, BRANCH }, '[netlify-test-release] Verified batch'), true);
});
test('production site build path is unaffected', () => {
  assert.equal(shouldSkip({SITE_NAME:'moonlit-torrone-88b39d',BRANCH:'main'}, 'Ordinary production commit'), false);
});
test('push CI has no hosted dependency and deployed verification is explicit opt-in', () => {
  const workflow = readFileSync(new URL('../.github/workflows/sarberki-test.yml', import.meta.url), 'utf8');
  const offlineJob = workflow.split('  test:\n')[1].split('  deployed-test-verification:')[0];
  assert.doesNotMatch(offlineJob, /deployment-sync|deployed-|operator-cloud-preflight|netlify\.app/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.verify_deployed == true/);
  assert.doesNotMatch(workflow, /netlify deploy|api\.netlify\.com|build_hooks/);
});
