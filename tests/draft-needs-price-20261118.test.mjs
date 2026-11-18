import test from 'node:test';
import assert from 'node:assert/strict';
import {draftNeedsPrice} from '../shared-core/server-test-mailbox-price.mjs';
import {PRICE_LINE} from '../shared-core/price-insert-sentence.mjs';
import {CAPACITY_PENDING_LINE,LEGACY_CAPACITY_PENDING_LINE} from '../shared-core/inquiry-channel-adapters.mjs';

test('draftNeedsPrice: generic price sentence or pending capacity line → true; priced text → false',()=>{
 assert.equal(draftNeedsPrice('Szállás\n'+PRICE_LINE.hu+'\nÜdvözlettel','hu'),true);
 assert.equal(draftNeedsPrice('x\n'+CAPACITY_PENDING_LINE.de+' y','de'),true);
 assert.equal(draftNeedsPrice('x\n'+LEGACY_CAPACITY_PENDING_LINE.hu,'hu'),true);
 assert.equal(draftNeedsPrice('Ár: 184 950 Ft (szállás 180 000 Ft + IFA 4 950 Ft).','hu'),false);
 assert.equal(draftNeedsPrice(null,'hu'),false);
 assert.equal(draftNeedsPrice(PRICE_LINE.hu,'xx'),true); // unknown language → Hungarian
});
