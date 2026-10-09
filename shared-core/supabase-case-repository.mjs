import { CaseServiceError } from './server-case-service.mjs';
const fail = code => { throw new CaseServiceError(code, code); };
export function createSupabaseTransport({ url, publishableKey, token, fetchImpl = fetch } = {}) {
 let base; try { base = new URL(url); } catch { fail('SETUP_REQUIRED'); }
 if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== '/' || !publishableKey || !token) fail('SETUP_REQUIRED');
 return async (path, { method = 'GET', body } = {}) => {
  let response;
  try { response = await fetchImpl(base.origin + path, { method, redirect:'error', signal:AbortSignal.timeout(10000), headers:{apikey:publishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, ...(body !== undefined ? {body:JSON.stringify(body)} : {}) }); }
  catch { fail('STORAGE_FAILURE'); }
  if (!response.ok) fail(response.status === 401 || response.status === 403 ? 'FORBIDDEN' : 'STORAGE_FAILURE');
  try { return await response.json(); } catch { fail('STORAGE_FAILURE'); }
 };
}
export function createSupabaseAuthority(transport) {
 return async () => {
  const user = await transport('/auth/v1/user'); // Auth verifies signature, expiry and identity remotely.
  if (!user || typeof user.id !== 'string' || user.is_anonymous === true) fail('FORBIDDEN');
  const rows = await transport('/rest/v1/sc_memberships?select=tenant_id,user_id,can_read,can_write,can_approve&user_id=eq.' + encodeURIComponent(user.id));
  if (!Array.isArray(rows)) fail('STORAGE_FAILURE');
  const tenants = Object.create(null);
  for (const row of rows) {
   if (row.user_id !== user.id || !/^[a-z][a-z0-9-]{1,63}$/.test(row.tenant_id)) fail('ISOLATION_FAILURE');
   tenants[row.tenant_id] = [row.can_read === true && 'read',row.can_write === true && 'write',row.can_approve === true && 'approve'].filter(Boolean);
  }
  return { subject:user.id, tenants };
 };
}
const mapRecord = row => {
 if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1 || !row.data || row.data.id !== row.case_id || row.data.tenantId !== row.tenant_id || !row.created_at || !row.updated_at || !row.updated_by) fail('STORAGE_FAILURE');
 return {tenantId:row.tenant_id,caseId:row.case_id,revision:row.revision,data:row.data,createdAt:row.created_at,updatedAt:row.updated_at,updatedBy:row.updated_by};
};
export function createSupabaseCaseRepository(transport) {
 const query = tenant => '/rest/v1/sc_cases?select=*&tenant_id=eq.' + encodeURIComponent(tenant);
 const write = async (tenant,caseId,expected,record) => {
  const result = await transport('/rest/v1/rpc/sc_write_case',{method:'POST',body:{p_tenant:tenant,p_case:caseId,p_expected:expected,p_data:record.data}});
  if (typeof result !== 'boolean') fail('STORAGE_FAILURE');
  return result;
 };
 return {
  async get(tenant,caseId) { const rows = await transport(query(tenant)+'&case_id=eq.'+encodeURIComponent(caseId)); if (!Array.isArray(rows) || rows.length > 1) fail('STORAGE_FAILURE'); return rows.length ? mapRecord(rows[0]) : null; },
  async list(tenant) {
   const result=[]; const size=200;
   for(let offset=0;offset<=10000;offset+=size){
    const rows=await transport(query(tenant)+`&order=case_id.asc&limit=${size}&offset=${offset}`);
    if(!Array.isArray(rows)||rows.length>size)fail('STORAGE_FAILURE');result.push(...rows.map(mapRecord));
    if(rows.length<size)return result;
   }
   fail('STORAGE_FAILURE'); // Never silently return a truncated list for case linking.
  },
  insert:(tenant,caseId,record)=>write(tenant,caseId,0,record),
  compareAndSwap:(tenant,caseId,expected,record)=>write(tenant,caseId,expected,record)
 };
}
