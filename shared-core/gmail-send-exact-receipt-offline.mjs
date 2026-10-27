import {matchesExactGmailEditRecord} from './server-exact-gmail-receipt.mjs';

// Pure adapter to the EXISTING exact receipt matcher.
// Only a trusted server may provide the privately configured receipt.
// No OAuth, network calls, browser-provided proof, or Gmail sending.
export function createOfflineExactGmailReceiptVerifier(trustedReceipt) {
  return async record => {
    if (!trustedReceipt || typeof trustedReceipt.matchesRecord !== 'function') return false;
    try { return matchesExactGmailEditRecord(record,trustedReceipt) === true; }
    catch { return false; }
  };
}
