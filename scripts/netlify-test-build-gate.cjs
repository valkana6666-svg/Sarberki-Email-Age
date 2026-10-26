const { execFileSync } = require('node:child_process');

// This file is present only on the authorized development branch.
// Netlify ignore: 0 = skip, 1 = build. Production retains its normal build path.
const guardedSites = new Set(['leafy-chimera-2403e5', 'sarberki-v1-restore-20261024']);
function shouldSkip(env, message) {
  if (!guardedSites.has(env.SITE_NAME)) return false;
  // Recovery builds must never follow routine pushes or the V1 release marker.
  if (env.SITE_NAME === 'sarberki-v1-restore-20261024') return true;
  if (env.BRANCH !== 'gmail-test-subject-allowlist') return true;
  return !/^\[netlify-test-release\](?:\s|$)/m.test(message);
}
if (require.main === module) {
  let message = '';
  if (guardedSites.has(process.env.SITE_NAME)) {
    try { message = execFileSync('git', ['log', '-1', '--format=%B'], { encoding: 'utf8', timeout: 5000 }); }
    catch { console.log('Test deploy skipped: release identity unavailable.'); process.exit(0); }
  }
  const skip = shouldSkip(process.env, message);
  console.log(skip ? 'Test deploy skipped: collect and verify changes before an explicit release.' : 'Build path permitted.');
  process.exit(skip ? 0 : 1);
}
module.exports = { shouldSkip };
