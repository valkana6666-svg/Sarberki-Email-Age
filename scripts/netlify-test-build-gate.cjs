const { execFileSync } = require('node:child_process');

// This file is present only on the authorized development branch.
// Netlify ignore: 0 = skip, 1 = build. Other sites retain their normal build path.
function shouldSkip(env, message) {
  if (env.SITE_NAME !== 'leafy-chimera-2403e5') return false;
  if (env.BRANCH !== 'gmail-test-subject-allowlist') return true;
  return !/^\[netlify-test-release\](?:\s|$)/m.test(message);
}
if (require.main === module) {
  let message = '';
  if (process.env.SITE_NAME === 'leafy-chimera-2403e5') {
    try { message = execFileSync('git', ['log', '-1', '--format=%B'], { encoding: 'utf8', timeout: 5000 }); }
    catch { console.log('Test deploy skipped: release identity unavailable.'); process.exit(0); }
  }
  const skip = shouldSkip(process.env, message);
  console.log(skip ? 'Test deploy skipped: collect and verify changes before an explicit release.' : 'Build path permitted.');
  process.exit(skip ? 0 : 1);
}
module.exports = { shouldSkip };
