const DEFAULT_APIFY_BASE_URL = 'https://api.apify.com/v2';
const DEFAULT_APIFY_ACTOR = 'magicfingers/techstack-detector';

function _normalizeActorId(actorId) {
  return String(actorId || DEFAULT_APIFY_ACTOR).trim().replace('/', '~');
}

function _coerceUrl(value) {
  return String(value || '').trim();
}

function _normalizeTechnology(entry = {}) {
  const categories = Array.isArray(entry.categories)
    ? entry.categories.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return {
    name: String(entry.name || '').trim(),
    version: String(entry.version || '').trim(),
    confidence: Number.isFinite(Number(entry.confidence)) ? Number(entry.confidence) : 0,
    categories,
  };
}

export function buildApifyTechStackRunUrl({
  actorId = process.env.APIFY_TECHSTACK_ACTOR || DEFAULT_APIFY_ACTOR,
  token = process.env.APIFY_PERSONAL_API || process.env.APIFY_TOKEN || process.env.APIFY_PASSWORD || '',
  baseUrl = process.env.APIFY_BASE_URL || DEFAULT_APIFY_BASE_URL,
} = {}) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('APIFY_PERSONAL_API, APIFY_TOKEN, or APIFY_PASSWORD is required for Apify tech stack lookup');
  }
  const url = new URL(`${String(baseUrl || DEFAULT_APIFY_BASE_URL).replace(/\/+$/, '')}/acts/${_normalizeActorId(actorId)}/run-sync-get-dataset-items`);
  url.searchParams.set('token', normalizedToken);
  url.searchParams.set('format', 'json');
  url.searchParams.set('clean', 'true');
  return url.toString();
}

export async function lookupApifyTechStack({
  url,
  token = process.env.APIFY_PERSONAL_API || process.env.APIFY_TOKEN || process.env.APIFY_PASSWORD || '',
  actorId = process.env.APIFY_TECHSTACK_ACTOR || DEFAULT_APIFY_ACTOR,
  baseUrl = process.env.APIFY_BASE_URL || DEFAULT_APIFY_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedUrl = _coerceUrl(url);
  if (!normalizedUrl) {
    throw new Error('A website URL is required for Apify tech stack lookup');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchImpl must be a function');
  }

  const requestUrl = buildApifyTechStackRunUrl({ actorId, token, baseUrl });
  const response = await fetchImpl(requestUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      urls: [normalizedUrl],
    }),
  });
  if (!response || !response.ok) {
    throw new Error(`Apify tech stack lookup failed with status ${response?.status ?? 'unknown'}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : [payload].filter(Boolean);
  return {
    request_url: requestUrl,
    results: items.map((item = {}) => {
      const technologies = Array.isArray(item.technologies)
        ? item.technologies.map((technology) => _normalizeTechnology(technology)).filter((technology) => technology.name)
        : [];
      const categories = Array.from(
        new Set(
          technologies.flatMap((technology) => technology.categories || []).filter(Boolean),
        ),
      );
      const vendors = Array.from(new Set(technologies.map((technology) => technology.name).filter(Boolean)));
      return {
        url: _coerceUrl(item.url) || normalizedUrl,
        technologies,
        categories,
        vendors,
        raw: item,
      };
    }),
  };
}
