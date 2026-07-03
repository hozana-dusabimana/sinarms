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
// gpt-4o-mini follows the grounding + intent-tag protocol reliably and is very
// cheap (~$0.0001/reply). Small free models (llama-3.2-3b:free) hallucinated
// destinations and, via OpenRouter's Cloudflare provider, mis-fired tool calls.
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 4000);
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
  if (localAnswer.source === 'llm-fallback') return false;

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

/**
 * Generate an answer from scratch using the LLM, grounded in the facility's
 * destinations and FAQ. Used as a last-chance fallback when neither the intent
 * classifier nor the FAQ matcher could answer. The LLM is instructed to stay
 * grounded and to admit uncertainty rather than invent facts.
 */
async function answerWithKnowledge({ query, context }) {
  if (!isEnabled()) return null;
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;

  const destinations = (context && Array.isArray(context.availableDestinations))
    ? context.availableDestinations.slice(0, 40)
    : [];
  const faq = (context && Array.isArray(context.faq)) ? context.faq.slice(0, 25) : [];

  const system = [
    'You are the SINARMS visitor assistant in an office building reception.',
    'Answer the visitor\'s question using ONLY the facts provided below (destinations and FAQ).',
    'Keep the reply short (1-2 sentences), friendly, and in the same language as the user.',
    'If the question asks about a place, direct them using the destination names from the list.',
    'If the answer is not in the provided facts, say you are not sure and suggest asking the Reception desk — do NOT invent room numbers, staff names, phone numbers, or policies.',
    'Do not greet, sign off, or add disclaimers.',
  ].join(' ');

  const knowledgeLines = [];
  if (context && context.locationName) {
    knowledgeLines.push(`Current location: ${context.locationName}`);
  }
  if (destinations.length) {
    knowledgeLines.push(`Available destinations: ${destinations.join(', ')}`);
  }
  if (faq.length) {
    knowledgeLines.push('FAQ facts:');
    faq.forEach((entry, idx) => {
      const q = String(entry.question || '').trim();
      const a = String(entry.answer || '').trim();
      if (q && a) knowledgeLines.push(`${idx + 1}. Q: ${q}\n   A: ${a}`);
    });
  }

  const user = [
    `Visitor question: ${trimmed}`,
    '',
    knowledgeLines.join('\n'),
    '',
    'Reply directly with the answer only.',
  ].join('\n');

  try {
    const response = await httpPostJson(
      OPENROUTER_URL,
      {
        model: DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 160,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost',
        'X-Title': 'SINARMS Visitor Assistant',
      },
    );

    const text = response
      && response.choices
      && response.choices[0]
      && response.choices[0].message
      && String(response.choices[0].message.content || '').trim();

    if (!text) return null;
    return text;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn('[openrouter] knowledge answer failed:', error.message);
    }
    return null;
  }
}

/**
 * Primary conversational layer. The LLM is the "brain": it reads the facility's
 * real destinations + FAQ and answers the visitor naturally, and — when the
 * visitor wants to go somewhere — names the matching destination via a trailing
 * intent tag. Returns { reply, destination, confirm } or null when the LLM is
 * disabled/unreachable (caller then falls back to the local deterministic flow).
 *
 * We use a plain-text tag protocol ([GO: name] / [ASK: name] / [NONE]) rather
 * than asking for JSON: the small model behind OpenRouter's Cloudflare provider
 * interprets a JSON-schema instruction as a function call and returns
 * `content: null` (finish_reason "tool_calls"), which would give us nothing to
 * show. A trailing tag keeps the response as normal text we can parse and strip.
 * `destination` is copied from the provided list; the caller re-validates it
 * against the map, so a hallucinated name is simply dropped.
 */
async function converse({ query, context }) {
  if (!isEnabled()) return null;
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;

  const destinations = (context && Array.isArray(context.availableDestinations))
    ? context.availableDestinations.slice(0, 60)
    : [];
  const faq = (context && Array.isArray(context.faq)) ? context.faq.slice(0, 25) : [];

  const system = [
    'You are the SINARMS visitor assistant inside an office/campus building.',
    context && context.locationName ? `The visitor is currently at: ${context.locationName}.` : '',
    destinations.length
      ? `Available destinations: ${destinations.join(', ')}.`
      : 'No destinations are configured yet.',
    'Answer using ONLY these destinations and the FAQ facts below. NEVER invent destinations, room numbers, floors, staff names, phone numbers, opening hours, or policies. If the answer is not in the facts, say you are not sure and suggest asking the Reception desk.',
    "Reply to the visitor in ONE short, friendly sentence in the visitor's language, then ALWAYS end your message with exactly one tag:",
    '[GO: <exact destination name>] ONLY when the visitor explicitly names a destination from the list (an exact or near-exact name match);',
    '[ASK: <exact destination name>] when you INFER a likely destination from a need, symptom, or vague request — phrase the reply as a question so the visitor can confirm;',
    '[NONE] for greetings, thanks, or general questions, or when nothing on the list clearly fits.',
    'Copy destination names EXACTLY from the list.',
    'Examples: "take me to the store" => "Sure, taking you to the Store now. [GO: Store]" ||| "i feel sick" => "Would you like me to take you to the Clinic? [ASK: Clinic]" ||| "hi" => "Hi! I can help you find places here. [NONE]"',
  ].filter(Boolean).join(' ');

  const knowledgeLines = [];
  if (faq.length) {
    knowledgeLines.push('FAQ facts:');
    faq.forEach((entry, idx) => {
      const q = String(entry.question || '').trim();
      const a = String(entry.answer || '').trim();
      if (q && a) knowledgeLines.push(`${idx + 1}. Q: ${q} A: ${a}`);
    });
  }

  const user = knowledgeLines.length
    ? `Visitor: ${trimmed}\n\n${knowledgeLines.join('\n')}`
    : `Visitor: ${trimmed}`;

  try {
    const response = await httpPostJson(
      OPENROUTER_URL,
      {
        model: DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 140,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost',
        'X-Title': 'SINARMS Visitor Assistant',
      },
    );

    let text = response
      && response.choices
      && response.choices[0]
      && response.choices[0].message
      && String(response.choices[0].message.content || '').trim();

    if (!text) return null;

    // Parse the trailing intent tag and strip it (and any stray brackets) from
    // the visible reply.
    let destination = null;
    let confirm = false;
    const tag = text.match(/\[\s*(GO|ASK|NONE)\s*(?::\s*([^\]]*))?\]/i);
    if (tag) {
      const kind = tag[1].toUpperCase();
      const name = (tag[2] || '').trim();
      if (kind === 'GO' && name) {
        destination = name;
        confirm = false;
      } else if (kind === 'ASK' && name) {
        destination = name;
        confirm = true;
      }
    }
    text = text.replace(/\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim();
    if (!text) {
      text = destination
        ? `Taking you to ${destination}.`
        : 'How can I help you find your way?';
    }

    return { reply: text, destination, confirm };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn('[openrouter] converse failed:', error.message);
    }
    return null;
  }
}

module.exports = {
  isEnabled,
  polishAnswer,
  shouldPolish,
  answerWithKnowledge,
  converse,
};
