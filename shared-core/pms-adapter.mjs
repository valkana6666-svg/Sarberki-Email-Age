// Generic read-only PMS adapter contract.
// The shared core knows only capabilities and normalized operations.
// Provider-specific URLs, IDs, request validation and parsing live in adapter modules.

export function createReadOnlyPmsAdapter({
  id,
  label,
  fetchAvailability,
  fetchQuote,
  capabilities={}
}={}){
  if(!id || typeof id!=='string') throw new Error('A PMS adapter azonosítója kötelező.');
  if(typeof fetchAvailability!=='function') throw new Error('A PMS adapter availability művelete hiányzik.');
  if(typeof fetchQuote!=='function') throw new Error('A PMS adapter quote művelete hiányzik.');

  const normalizedCapabilities=Object.freeze({
    readAvailability:true,
    readQuote:true,
    createBooking:false,
    modifyBooking:false,
    cancelBooking:false,
    ...capabilities
  });

  if(normalizedCapabilities.createBooking||normalizedCapabilities.modifyBooking||normalizedCapabilities.cancelBooking){
    throw new Error('A read-only PMS adapter nem kaphat foglalásmódosító jogosultságot.');
  }

  return Object.freeze({
    id,
    label:label||id,
    capabilities:normalizedCapabilities,
    async getAvailability(input){
      return fetchAvailability(input);
    },
    async getQuote(input){
      return fetchQuote(input);
    }
  });
}

export function assertReadOnlyPmsAdapter(adapter){
  if(!adapter||typeof adapter!=='object') throw new Error('Érvénytelen PMS adapter.');
  if(typeof adapter.getAvailability!=='function'||typeof adapter.getQuote!=='function') throw new Error('Hiányos PMS adapter.');
  if(adapter.capabilities?.createBooking||adapter.capabilities?.modifyBooking||adapter.capabilities?.cancelBooking){
    throw new Error('Foglalásmódosító PMS adapter nem engedélyezett ebben a workflow-ban.');
  }
  return adapter;
}
