import test from 'node:test';
import assert from 'node:assert/strict';
import {runScenarios} from '../scripts/chat-booking-scenarios.mjs';

// Owner 2026-11-16 („célzottan teszteket a chatbottal”): multi-turn booking conversations must stay understood.
test('chat booking scenarios (HU/DE/EN/SI, typos, pieces, changes, nights, all-adults)',()=>{
 const bad=runScenarios().filter(r=>!r.ok).map(r=>r.name+': '+r.bad.join('; '));
 assert.deepEqual(bad,[]);
});
