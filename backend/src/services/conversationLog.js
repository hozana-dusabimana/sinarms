/**
 * Append-only CSV log of every chatbot interaction.
 *
 * Each row is one query / response pair. The file is written to
 * ``ai/data/conversation_log.csv`` (relative to the project root) so the
 * Python training pipeline picks it up alongside the Kaggle bootstrap CSV.
 *
 * The file is RFC 4180 compliant: fields containing ``,`` ``"`` or newlines
 * are wrapped in double quotes and embedded quotes are doubled. We avoid an
 * external CSV library to keep the backend dependency surface unchanged.
 *
 * Disable by setting ``CONVERSATION_LOG_DISABLED=1``.
 */

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '..', '..', '..', 'ai', 'data', 'conversation_log.csv');
const HEADER = [
  'timestamp',
  'location_id',
  'organization_id',
  'language',
  'query',
  'answer',
  'source',
  'type',
  'confidence',
  'resolved',
  'faq_id',
  'destination_node_id',
];

let initialised = false;

function escapeField(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function ensureHeader() {
  if (initialised) return;
  initialised = true;
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    if (!fs.existsSync(LOG_PATH) || fs.statSync(LOG_PATH).size === 0) {
      fs.writeFileSync(LOG_PATH, `${HEADER.join(',')}\n`, { encoding: 'utf8' });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[conversation-log] init failed:', error.message);
  }
}

function record({ query, result, locationId, organizationId, language }) {
  if (process.env.CONVERSATION_LOG_DISABLED === '1') return;

  ensureHeader();

  const safeResult = result || {};
  const resolved = Boolean(
    safeResult.status === 'resolved'
    || safeResult.faqId
    || (safeResult.type === 'navigation' && safeResult.destinationNodeId)
    || safeResult.type === 'greeting',
  );

  const row = [
    new Date().toISOString(),
    locationId || '',
    organizationId || '',
    language || '',
    query || '',
    safeResult.answer || '',
    safeResult.source || '',
    safeResult.type || '',
    safeResult.confidence != null ? safeResult.confidence : '',
    resolved ? '1' : '0',
    safeResult.faqId || '',
    safeResult.destinationNodeId || '',
  ].map(escapeField).join(',');

  try {
    fs.appendFileSync(LOG_PATH, `${row}\n`, { encoding: 'utf8' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[conversation-log] append failed:', error.message);
  }
}

module.exports = {
  record,
  LOG_PATH,
};
