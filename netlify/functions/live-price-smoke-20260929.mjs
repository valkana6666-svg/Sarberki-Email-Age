import { fetchPublicBookingQuote } from '../../price-source/sarberki-public-booking.mjs';

const TEST_HOST = 'leafy-chimera-2403e5.netlify.app';
const TEST_INPUT = {
  arrival: '2026-10-16',
  departure: '2026-10-18',
  cabin: 'deluxe',
  adults: 2,
  children: []
};

export default async (request) => {
  let host = '';
  try { host = new URL(request.url).hostname; } catch {}
  if (request.method !== 'GET' || host !== TEST_HOST) {
    return Response.json({ status: 'blocked' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  try {
    const result = await fetchPublicBookingQuote(TEST_INPUT);
    return Response.json({
      smokeTest: true,
      input: TEST_INPUT,
      result
    }, { status: 200, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({
      smokeTest: true,
      input: TEST_INPUT,
      status: 'failed',
      error: error?.message || String(error)
    }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
};
