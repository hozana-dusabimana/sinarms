/**
 * OpenRouter "polish" layer.
 *
 * Purpose: rewrite an answer already produced by our local intent classifier /
 * FAQ matcher into a more natural sentence. The LLM never decides *what* to
 * answer — it only reshapes the text we already have. This keeps credit spend
 * predictable and keeps the product behaviour deterministic.
 *
 * Guards (to keep cost bounded):
 *  - API key is read from OPENROUTER_API_KEY. If unset, we return the raw
 *    local answer unchanged — the chatbot still works without the LLM.
 *  - We skip the LLM entirely when the local answer is already confident
 *    (see `shouldPolish`).
 *  - max_tokens, temperature and timeout are hard-coded low.
 */

const https = require('https');
const { URL } = require('url');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';
const TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 2000);
const MAX_TOKENS = 120;
const TEMPERATURE = 0.3;

function isEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim());
}

/**
 * Decide whether to call the LLM. We polish everything that has any answer
 * text so responses feel consistent and natural. Greetings stay untouched
 * (fast canned replies), and empty answers are skipped.
 */
function shouldPolish(localAnswer) {
  if (!localAnswer || !isEnabled()) return false;

  const answer = String(localAnswer.answer || '').trim();
  if (!answer) return false;

  if (localAnswer.type === 'greeting') return false;

  return true;
}

function httpPostJson(url, body, headers = {}, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = Buffer.from(JSON.stringify(body), 'utf8');

    const req = https.request(
      {
        method: 'POST',
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search || ''}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          Accept: 'application/json',
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`OpenRouter ${res.statusCode}: ${raw.slice(0, 200)}`));
          }
          try {
            resolve(raw ? JSON.parse(raw) : null);
          } catch (error) {
            reject(new Error(`OpenRouter response parse failed: ${error.message}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`OpenRouter timeout after ${timeoutMs}ms`));
    });

    req.write(payload);
    req.end();
  });
}

function buildSystemPrompt() {
  return [
    'You are the SINARMS visitor assistant in an office building.',
    'Rewrite the provided answer so it sounds natural, short (<=2 sentences), and friendly.',
    'You may ONLY mention destinations that appear in the "Available destinations" list below or in the local system answer.',
    'NEVER invent new destinations, room numbers, staff names, or facts.',
    'If the user asked for a place that is not recognized and the local system says "not sure", offer 2-3 of the closest-looking options from "Available destinations" as suggestions (e.g. "Did you mean Reception or the Meeting Room?").',
    'If the local answer confirms a destination or proposes a location switch, keep that intact.',
    'Reply in the same language as the user.',
    'Do not add greetings, sign-offs, or disclaimers.',
  ].join(' ');
}

function buildUserPrompt(query, localAnswer, context) {
  const lines = [
    `User question: ${query}`,
    `Local system answer: ${localAnswer.answer}`,
  ];
  if (localAnswer.type) lines.push(`Answer type: ${localAnswer.type}`);
  if (localAnswer.status) lines.push(`Status: ${localAnswer.status}`);
  if (context && context.destinationLabel) {
    lines.push(`Destination label: ${context.destinationLabel}`);
  }
  if (context && context.locationName) {
    lines.push(`Location: ${context.locationName}`);
  }
  if (context && Array.isArray(context.availableDestinations) && context.availableDestinations.length) {
    lines.push(`Available destinations: ${context.availableDestinations.join(', ')}`);
  }
  lines.push('Rewrite the local system answer. You may pull from "Available destinations" for suggestions, but invent nothing else.');
  return lines.join('\n');
}

/**
 * Polish a local answer into a natural sentence. If the LLM is disabled,
 * misconfigured, unreachable, or declines to respond, the original local
 * answer is returned unchanged.
 */
async function polishAnswer({ query, localAnswer, context }) {
  if (!shouldPolish(localAnswer)) {
    return localAnswer;
  }

  try {
    const response = await httpPostJson(
      OPENROUTER_URL,
      {
        model: DEFAULT_MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(query, localAnswer, context || {}) },
        ],
      },
      {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost',
        'X-Title': 'SINARMS Visitor Assistant',
      },
    );

    const polished = response
      && response.choices
      && response.choices[0]
      && response.choices[0].message
      && String(response.choices[0].message.content || '').trim();

    if (!polished) {
      return localAnswer;
    }

    return { ...localAnswer, answer: polished, polishedBy: 'openrouter' };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn('[openrouter] polish failed, using local answer:', error.message);
    }
    return localAnswer;
  }
}

module.exports = {
  isEnabled,
  polishAnswer,
  shouldPolish,
};
