// PMS- and business-independent inquiry envelope for accommodation agents.
// Business-specific parsing, rules and adapters stay outside this module.

export const INQUIRY_CHANNELS = Object.freeze([
  'manual',
  'gmail',
  'web_form',
  'phone_ai'
]);

const ALLOWED_CHANNELS = new Set(INQUIRY_CHANNELS);

export function createInquiryEnvelope({
  schemaVersion,
  sourceChannel,
  rawText,
  receivedAt = null,
  sender = null,
  normalized = {}
} = {}) {
  if (!schemaVersion || typeof schemaVersion !== 'string') {
    throw new Error('Hiányzó inquiry schema verzió.');
  }
  if (!ALLOWED_CHANNELS.has(sourceChannel)) {
    throw new Error('Ismeretlen bemeneti csatorna.');
  }

  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('Üres vendégüzenet nem normalizálható.');
  }

  return {
    schema_version: schemaVersion,
    source: {
      channel: sourceChannel,
      received_at: receivedAt,
      sender: sender || null
    },
    original_text: text,
    normalized: { ...normalized }
  };
}
