const fs = require('node:fs');
const sha = process.env.COMMIT_REF || '';
if (!/^[a-f0-9]{40}$/.test(sha)) {
  throw new Error('Netlify COMMIT_REF missing or invalid; refusing unverifiable build.');
}
fs.writeFileSync('build-info.mjs', `export const deployedCommit = ${JSON.stringify(sha)};\n`);
