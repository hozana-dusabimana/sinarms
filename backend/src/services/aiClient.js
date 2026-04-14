const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_ENGINE_TIMEOUT_MS || 1500);

const DISABLED = process.env.AI_ENGINE_DISABLED === '1';

const backoffState = {
  disabledUntil: 0,
};

function httpRequest(method, url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;

    const options = {
      method,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search || ''}`,
      headers: {
        Accept: 'application/json',
      },
    };

    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = payload.length;
    }

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`AI engine ${method} ${url} -> ${res.statusCode} ${raw}`));
        }

        try {
          resolve(raw ? JSON.parse(raw) : null);
        } catch (error) {
          reject(new Error(`Failed to parse AI engine response: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`AI engine timeout after ${timeoutMs}ms`));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function isAvailable() {
  if (DISABLED) {
    return false;
  }
  return Date.now() >= backoffState.disabledUntil;
}

function markUnavailable(error) {
  backoffState.disabledUntil = Date.now() + 30 * 1000;
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn('[aiClient] disabled for 30s:', error.message);
  }
}

async function call(path, body) {
  if (!isAvailable()) {
    return null;
  }

  try {
    return await httpRequest('POST', `${DEFAULT_URL}${path}`, body, DEFAULT_TIMEOUT_MS);
  } catch (error) {
    markUnavailable(error);
    return null;
  }
}

async function classifyIntent({ text, locationId, language }) {
  return call('/ai/classify-intent', { text, locationId, language: language || 'en' });
}

async function calculateRoute({ fromNode, toNode, locationId }) {
  return call('/ai/calculate-route', { fromNode, toNode, locationId });
}

async function chatbot({ query, locationId, organizationId, type }) {
  return call('/ai/chatbot', { query, locationId, organizationId, type });
}

async function refreshGraph(maps) {
  return call('/ai/refresh-graph', { maps });
}

async function refreshFaq(faq) {
  return call('/ai/refresh-faq', { faq });
}

async function healthCheck() {
  if (!isAvailable()) {
    return null;
  }

  try {
    return await httpRequest('GET', `${DEFAULT_URL}/healthz`, null, DEFAULT_TIMEOUT_MS);
  } catch (error) {
    markUnavailable(error);
    return null;
  }
}

function resetBackoff() {
  backoffState.disabledUntil = 0;
}

module.exports = {
  calculateRoute,
  chatbot,
  classifyIntent,
  healthCheck,
  refreshFaq,
  refreshGraph,
  resetBackoff,
  get url() {
    return DEFAULT_URL;
  },
};
