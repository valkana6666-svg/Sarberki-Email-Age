import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerCaseService, CaseServiceError } from '../shared-core/server-case-service.mjs';

// Test-only stand-in; production must use durable storage with atomic CAS.
function fixture() {
  const records = new Map();
  const key = (tenantId, caseId) => `${tenantId}\u0000${caseId}`;
  const repository = {
    async get(tenantId, caseId) { return structuredClone(records.get(key(tenantId, caseId)) ?? null); },
    async list(tenantId) { return structuredClone([...records.values()].filter(record => record.tenantId === tenantId)); },
    async insert(tenantId, caseId, record) {
      if (records.has(key(tenantId, caseId))) return false;
      records.set(key(tenantId, caseId), structuredClone(record)); return true;
    },
    async compareAndSwap(tenantId, caseId, revision, record) {
      const current = records.get(key(tenantId, caseId));
      if (!current || current.revision !== revision) return false;
      records.set(key(tenantId, caseId), structuredClone(record)); return true;
    }
  };
  const resolveAuthority = async ctx => ({
    subject: ctx?.verifiedSession?.subject,
    tenants: ctx?.verifiedSession?.tenants
  });
  const service = createServerCaseService({ repository, resolveAuthority, clock: () => '2026-10-09T07:00:00.000Z' });
  const admin = { verifiedSession: { subject: 'operator-1', tenants: { sarberki: ['read', 'write'] } } };
  const reader = { verifiedSession: { subject: 'operator-2', tenants: { sarberki: ['read'] } } };
  const other = { verifiedSession: { subject: 'foreign', tenants: { demo: ['read', 'write'] } } };
  const bookingCase = { id: 'case-1234', tenantId: 'sarberki', sender: 'guest@example.invalid', state: { values: { guests: 2 } } };
  return { service, repository, admin, reader, other, bookingCase, records };
}
const errorCode = code => error => error instanceof CaseServiceError && error.code === code;

test('refuses use without storage or trusted authority resolver', () => {
  assert.throws(() => createServerCaseService(), errorCode('SETUP_REQUIRED'));
  assert.throws(() => createServerCaseService({ repository: {} }), errorCode('SETUP_REQUIRED'));
});
test('rejects anonymous and foreign tenant access before storage calls', async () => {
  const { service, other } = fixture();
  await assert.rejects(service.listCases({ requestContext: {}, tenantId: 'sarberki' }), errorCode('FORBIDDEN'));
  await assert.rejects(service.listCases({ requestContext: other, tenantId: 'sarberki' }), errorCode('FORBIDDEN'));
});
test('authenticated writer can create and reader can read but not write', async () => {
  const { service, admin, reader, bookingCase } = fixture();
  const result = await service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase });
  assert.equal(result.revision, 1);
  assert.equal((await service.getCase({ requestContext: reader, tenantId: 'sarberki', caseId: bookingCase.id })).data.sender, bookingCase.sender);
  await assert.rejects(service.createCase({ requestContext: reader, tenantId: 'sarberki', bookingCase: { ...bookingCase, id: 'case-5678' } }), errorCode('FORBIDDEN'));
});
test('rejects cross-tenant case payload and unknown tenant access', async () => {
  const { service, admin, bookingCase } = fixture();
  await assert.rejects(service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase: { ...bookingCase, tenantId: 'demo' } }), errorCode('INVALID_CASE'));
  await assert.rejects(service.listCases({ requestContext: admin, tenantId: 'demo' }), errorCode('FORBIDDEN'));
});
test('optimistic concurrency rejects stale updates and preserves latest data', async () => {
  const { service, admin, bookingCase } = fixture();
  await service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase });
  const change = { ...bookingCase, state: { values: { guests: 4 } } };
  const next = await service.updateCase({ requestContext: admin, tenantId: 'sarberki', caseId: bookingCase.id, expectedRevision: 1, bookingCase: change });
  assert.equal(next.revision, 2);
  await assert.rejects(service.updateCase({ requestContext: admin, tenantId: 'sarberki', caseId: bookingCase.id, expectedRevision: 1, bookingCase }), errorCode('CASE_CONFLICT'));
  assert.equal((await service.getCase({ requestContext: admin, tenantId: 'sarberki', caseId: bookingCase.id })).data.state.values.guests, 4);
});
test('duplicate inserts reject instead of overwriting a case', async () => {
  const { service, admin, bookingCase } = fixture();
  await service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase });
  await assert.rejects(service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase }), errorCode('CASE_CONFLICT'));
});
test('returned objects are copies and cannot modify underlying storage', async () => {
  const { service, admin, bookingCase } = fixture();
  const output = await service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase });
  output.data.state.values.guests = 99;
  const read = await service.getCase({ requestContext: admin, tenantId: 'sarberki', caseId: bookingCase.id });
  assert.equal(read.data.state.values.guests, 2);
});
test('fails closed when storage returns another tenant case', async () => {
  const { repository, admin } = fixture();
  repository.get = async () => ({ tenantId: 'demo', caseId: 'case-1234' });
  const service = createServerCaseService({ repository, resolveAuthority: async ctx => ctx.verifiedSession });
  await assert.rejects(service.getCase({ requestContext: admin, tenantId: 'sarberki', caseId: 'case-1234' }), errorCode('ISOLATION_FAILURE'));
});
test('fails closed on a foreign tenant appearing in list result', async () => {
  const { repository, admin } = fixture();
  repository.list = async () => [{ tenantId: 'demo', caseId: 'case-1234' }];
  const service = createServerCaseService({ repository, resolveAuthority: async ctx => ctx.verifiedSession });
  await assert.rejects(service.listCases({ requestContext: admin, tenantId: 'sarberki' }), errorCode('ISOLATION_FAILURE'));
});
test('rejects invalid IDs and revision values', async () => {
  const { service, admin, bookingCase } = fixture();
  await assert.rejects(service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase: { ...bookingCase, id: '../x' } }), errorCode('INVALID_CASE'));
  await service.createCase({ requestContext: admin, tenantId: 'sarberki', bookingCase });
  await assert.rejects(service.updateCase({ requestContext: admin, tenantId: 'sarberki', caseId: bookingCase.id, expectedRevision: 0, bookingCase }), errorCode('INVALID_REVISION'));
});
