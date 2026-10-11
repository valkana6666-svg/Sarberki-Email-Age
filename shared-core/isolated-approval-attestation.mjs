// Server-only proof for the disposable approval DB. Never sent to a client before approval.
import {createHmac} from 'node:crypto';
export function createIsolatedApprovalAttestor(key){
 if(typeof key!=='string'||! /^[a-f0-9]{64}$/.test(key))throw Error('SETUP_REQUIRED');
 return (tenant,caseId,revision,draftHash,evidence)=>{
  const values=[tenant,caseId,revision,draftHash,evidence?.tenantId,evidence?.source,evidence?.status,evidence?.unit,evidence?.arrival,evidence?.departure,evidence?.availableUnits,evidence?.checkedAt];
  if(values.some(v=>v===undefined||v===null||String(v)===''||/[\r\n]/.test(String(v))))throw Error('INVALID_EVIDENCE');
  return {...evidence,attestation:createHmac('sha256',Buffer.from(key,'hex')).update(values.map(String).join('\n')).digest('hex')};
 };
}
