import test from 'node:test';
import assert from 'node:assert/strict';
import {dateRangeFromText, adultCountFromText, cabinFromText} from './sarberki-core.mjs';

const now = new Date('2026-10-12T12:00:00Z');
const samples = [
  'November 26.–28. két felnőtt részére érdekelne egy VIP faház. Van szabad helyük?',
  'november 26-28 két felnőtt részére VIP faház',
  'nov. 26–28. két felnőtt részére VIP faház',
  '11.26–11.28. két felnőtt részére VIP faház',
  '2026.11.26–28. két felnőtt részére VIP faház',
];
for (const message of samples) {
  test('Hungarian guest date variant: '+message, () => {
    assert.deepEqual(dateRangeFromText(message, now), {
      arrival:'2026-11-26', departure:'2026-11-28', inferredYear: !message.includes('2026')
    });
    assert.equal(adultCountFromText(message),2);
    assert.equal(cabinFromText(message),'VIP');
  });
}
test('ambiguous alternatives must not be silently chosen', () => {
  assert.equal(dateRangeFromText('november 26–28 vagy december 3–5',now),null);
});
