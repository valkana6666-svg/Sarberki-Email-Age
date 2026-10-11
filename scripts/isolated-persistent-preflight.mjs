// Offline only: never connects, deploys, writes a database or activates approval.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateIsolatedPersistentConfig} from '../shared-core/isolated-persistent-config.mjs';

export async function runPreflight(args, {read = readFile, write = console.log} = {}) {
  if (args.length !== 2 || args[0] !== '--config' || !args[1]) {
    write(JSON.stringify({status:'BLOCKED', error:'CONFIG_FILE_REQUIRED', activated:false}));
    return 2;
  }
  let config;
  try { config = JSON.parse(await read(args[1], 'utf8')); }
  catch {
    write(JSON.stringify({status:'BLOCKED', error:'CONFIG_FILE_UNREADABLE_OR_INVALID', activated:false}));
    return 2;
  }
  try {
    const result = validateIsolatedPersistentConfig(config);
    if (result.validated !== true) {
      write(JSON.stringify({status:'BLOCKED', error:'CONFIG_REJECTED', activated:false}));
      return 1;
    }
    write(JSON.stringify({status:'CONFIG_VALID', activated:false, deploymentVerified:false,
      authenticationVerified:false, persistenceVerified:false,
      secretMaterial:'not-disclosed', next:'verify isolated hosting, TLS, real operator Auth and volume restore'}));
    return 0;
  } catch {
    write(JSON.stringify({status:'BLOCKED', error:'CONFIG_REJECTED', activated:false}));
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runPreflight(process.argv.slice(2));
}
