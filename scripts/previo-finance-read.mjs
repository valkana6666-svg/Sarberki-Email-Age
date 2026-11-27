// Read-only (Claude, owner 2026-11-27 „nézd meg, hogy a pénzügyi kezelőben ez most hogy jelenik meg”): exactly what the
// finance view's Previo side (finance-previo-list → previoFinanceReader) returns for Previo TEST 73521. Items carry no
// guest name, e-mail or phone (booking number, state, dates, unit, price, origin, payment link only). No write.
import {previoFinanceReader} from '../shared-core/server-previo-finance.mjs';
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const reader=previoFinanceReader({PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:key});
const r=await reader();
console.log('WINDOW',JSON.stringify(r.window),'ITEMS',r.items.length);
for(const it of r.items)console.log('ITEM',JSON.stringify({res:it.resIds,v:it.voucher&&(/^SC-/.test(it.voucher)?it.voucher:'other'),state:it.state,from:it.from,to:it.to,unit:it.unit,house:it.house,rooms:it.rooms,price:it.price,cur:it.currency,
 opt:it.optionExpiration,created:it.created,source:it.source,pay:it.payment}));
