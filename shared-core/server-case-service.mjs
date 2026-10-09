// A channel-independent, server-only authorization seam for booking cases.
// This module deliberately exposes no HTTP routes, database credentials, or
// unauthenticated fallback. A deployment must inject a verified identity
// resolver AND a durable atomic repository before using it with real data.
const copy = value => structuredClone(value);
const tenantPattern = /^[a-z][a-z0-9-]{1,63}$/;
const casePattern = /^[a-zA-Z0-9_-]{4,128}$/;

export class CaseServiceError extends Error {
  constructor(code, message) { super(message); this.name = 'CaseServiceError'; this.code = code; }
}
const reject = (code, message) => { throw new CaseServiceError(code, message); };
const validTenant = id => typeof id === 'string' && tenantPattern.test(id);
const validCaseId = id => typeof id === 'string' && casePattern.test(id);

// The resolver MUST authenticate the caller server-side. A client-supplied
// userId, tenantId, role or bearer claims are not accepted as authority here.
export function createServerCaseService({ repository, resolveAuthority, clock = () => new Date().toISOString() } = {}) {
  if (!repository || ['get', 'list', 'insert', 'compareAndSwap'].some(method => typeof repository[method] !== 'function'))
    reject('SETUP_REQUIRED', 'Tartós, atomi verziókezelést biztosító ügytár szükséges.');
  if (typeof resolveAuthority !== 'function')
    reject('SETUP_REQUIRED', 'Szerveroldali hitelesítés szükséges.');

  async function authorize(requestContext, tenantId, operation) {
    if (!validTenant(tenantId)) reject('INVALID_TENANT', 'Érvénytelen vállalkozásazonosító.');
    const authority = await resolveAuthority(requestContext);
    // Only a trusted, server-validated authority returned by the injected
    // resolver may grant access. There is no anonymous/default tenant.
    if (!authority || typeof authority.subject !== 'string' || !authority.subject ||
      !authority.tenants || !Array.isArray(authority.tenants[tenantId]) ||
      !authority.tenants[tenantId].includes(operation))
      reject('FORBIDDEN', 'Nincs megfelelő hozzáférési jogosultság.');
    return authority.subject;
  }
  function validateStored(record, tenantId, caseId) {
    if (record !== null && (!record || typeof record !== 'object' || Array.isArray(record)))
      reject('STORAGE_FAILURE', 'Érvénytelen ügytárválasz.');
    if (record && (record.tenantId !== tenantId || (caseId && record.caseId !== caseId)))
      reject('ISOLATION_FAILURE', 'Vállalkozási vagy ügyhatár sérülése.');
    return record;
  }
  function validateBookingCase(bookingCase, tenantId, caseId) {
    if (!bookingCase || typeof bookingCase !== 'object' || Array.isArray(bookingCase) ||
      bookingCase.id !== caseId || (bookingCase.tenantId && bookingCase.tenantId !== tenantId))
      reject('INVALID_CASE', 'Eltérő vagy hiányos ügyadat.');
    return copy({ ...bookingCase, tenantId });
  }
  async function getCase({ requestContext, tenantId, caseId }) {
    await authorize(requestContext, tenantId, 'read');
    if (!validCaseId(caseId)) reject('INVALID_CASE', 'Érvénytelen ügyazonosító.');
    return copy(validateStored(await repository.get(tenantId, caseId), tenantId, caseId));
  }
  async function listCases({ requestContext, tenantId }) {
    await authorize(requestContext, tenantId, 'read');
    const records = await repository.list(tenantId);
    if (!Array.isArray(records)) reject('STORAGE_FAILURE', 'Érvénytelen ügytárválasz.');
    records.forEach(record => { if (!record) reject('STORAGE_FAILURE', 'Érvénytelen ügytárválasz.'); validateStored(record, tenantId); });
    return copy(records);
  }
  async function createCase({ requestContext, tenantId, bookingCase }) {
    const actor = await authorize(requestContext, tenantId, 'write');
    const caseId = bookingCase?.id;
    if (!validCaseId(caseId)) reject('INVALID_CASE', 'Érvénytelen ügyazonosító.');
    const data = validateBookingCase(bookingCase, tenantId, caseId);
    const at = clock();
    const record = { tenantId, caseId, revision: 1, createdAt: at, updatedAt: at, updatedBy: actor, data };
    const inserted = await repository.insert(tenantId, caseId, copy(record));
    if (typeof inserted !== 'boolean') reject('STORAGE_FAILURE', 'Érvénytelen ügytárválasz.');
    if (inserted !== true) reject('CASE_CONFLICT', 'Az ügyazonosító már létezik.');
    return copy(record);
  }
  async function updateCase({ requestContext, tenantId, caseId, expectedRevision, bookingCase }) {
    const actor = await authorize(requestContext, tenantId, 'write');
    if (!validCaseId(caseId)) reject('INVALID_CASE', 'Érvénytelen ügyazonosító.');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
      reject('INVALID_REVISION', 'Érvényes várt ügyverzió szükséges.');
    const data = validateBookingCase(bookingCase, tenantId, caseId);
    const current = validateStored(await repository.get(tenantId, caseId), tenantId, caseId);
    if (!current) reject('CASE_NOT_FOUND', 'Az ügy nem található.');
    if (current.revision !== expectedRevision)
      reject('CASE_CONFLICT', 'Az ügyet időközben másik kezelő módosította.');
    const record = { tenantId, caseId, revision: expectedRevision + 1,
      createdAt: current.createdAt, updatedAt: clock(), updatedBy: actor, data };
    // The repository MUST compare atomically (tenant, caseId, revision).
    const updated = await repository.compareAndSwap(tenantId, caseId, expectedRevision, copy(record));
    if (typeof updated !== 'boolean') reject('STORAGE_FAILURE', 'Érvénytelen ügytárválasz.');
    if (updated !== true) reject('CASE_CONFLICT', 'Az ügyet időközben másik kezelő módosította.');
    return copy(record);
  }
  return Object.freeze({ getCase, listCases, createCase, updateCase,
    requireApproval: ({requestContext,tenantId}) => authorize(requestContext,tenantId,'approve') });
}
