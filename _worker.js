const PRODUCT_PREFIX = 'boutique:product:';
const INDEX_KEY = 'boutique:products:index';
const SETTINGS_KEY = 'boutique:settings';
const PORTAL_IDS = ['nyxia', 'diane', 'eric', 'lena', 'selena', 'kael', 'alex'];

const DEFAULT_PORTALS = [
  { id: 'nyxia', name: 'NyXia', intro: 'Solutions techniques, accompagnement et services Done For You.', imageUrl: '', order: 1, active: true },
  { id: 'diane', name: 'Diane', intro: 'Parcours, livres et créations de la fondatrice de l’écosystème.', imageUrl: '', order: 2, active: true },
  { id: 'eric', name: 'Éric', intro: 'Marketing relationnel, communication et univers CashFlow™.', imageUrl: '', order: 3, active: true },
  { id: 'lena', name: 'Léna', intro: 'Dons, outils spirituels et méthode DDM.', imageUrl: '', order: 4, active: true },
  { id: 'selena', name: 'Séléna', intro: 'Libération émotionnelle, miroir et méthode A.M.I.E.™.', imageUrl: '', order: 5, active: true },
  { id: 'kael', name: 'Kael', intro: 'Relations, activités et expériences à vivre à deux.', imageUrl: '', order: 6, active: true },
  { id: 'alex', name: 'Alex', intro: 'Écriture, livres et parcours pour aller jusqu’au mot FIN.', imageUrl: '', order: 7, active: true }
];

function json(data, status = 200) {
  return withPublicHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }));
}

function withPublicHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function withAssetHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action https:");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function productIds(env) {
  const raw = await env.CASHFLOW_KV.get(INDEX_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
  }
  const listed = await env.CASHFLOW_KV.list({ prefix: PRODUCT_PREFIX });
  return (listed.keys || []).map((key) => key.name.slice(PRODUCT_PREFIX.length)).filter(Boolean);
}

async function products(env) {
  const ids = await productIds(env);
  const rows = await Promise.all(ids.map(async (id) => {
    const raw = await env.CASHFLOW_KV.get(PRODUCT_PREFIX + id);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }));
  return rows.filter((item) => item && item.active).sort((a, b) =>
    (Number(a.order) || 0) - (Number(b.order) || 0) ||
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );
}

async function settings(env) {
  const defaults = {
    title: 'Boutique NyXia',
    heroTitle: 'Sept portes. Sept univers. Une seule boutique vivante.',
    heroText: 'Choisis l’univers qui t’appelle et découvre ses livres, formations, outils, services, activités et événements.',
    appointmentUrl: '',
    appointmentLabel: 'Prendre un rendez-vous',
    portals: DEFAULT_PORTALS,
    updatedAt: null
  };
  const raw = await env.CASHFLOW_KV.get(SETTINGS_KEY);
  if (!raw) return defaults;
  try {
    const saved = JSON.parse(raw);
    const savedPortals = Array.isArray(saved.portals) ? saved.portals : [];
    return {
      ...defaults,
      ...saved,
      portals: DEFAULT_PORTALS.map((portal) => ({
        ...portal,
        ...(savedPortals.find((item) => item && item.id === portal.id) || {})
      }))
    };
  } catch (_) {
    return defaults;
  }
}

function publicProduct(product) {
  const expires = product.promoExpiresAt ? Date.parse(product.promoExpiresAt) : NaN;
  const promoActive = !!product.promoCode && (!Number.isFinite(expires) || expires >= Date.now());
  return {
    ...product,
    promoActive,
    promoCode: promoActive ? product.promoCode : '',
    promoText: promoActive ? product.promoText : ''
  };
}

async function catalog(request, env) {
  const url = new URL(request.url);
  const portal = String(url.searchParams.get('portal') || '').toLowerCase();
  const id = String(url.searchParams.get('id') || '');
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 200);
  let list = await products(env);
  if (portal && PORTAL_IDS.includes(portal)) list = list.filter((item) => item.portal === portal);
  if (id) list = list.filter((item) => item.id === id || item.slug === id);
  if (q) list = list.filter((item) =>
    [item.title, item.shortDescription, item.description, item.category, item.type]
      .join(' ').toLowerCase().includes(q)
  );
  return json({ products: list.map(publicProduct), count: list.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS' && path.startsWith('/api/')) {
      return withPublicHeaders(new Response(null, { status: 204 }));
    }
    if (request.method === 'GET' && path === '/api/catalog') return catalog(request, env);
    if (request.method === 'GET' && path === '/api/config') return json({ settings: await settings(env) });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Méthode refusée.' }, 405);

    if (!env.ASSETS) return new Response('Not found', { status: 404 });
    let assetRequest = request;
    if (path === '/' || path === '') assetRequest = new Request(new URL('/index.html', request.url), request);
    else if (/^\/univers\/[a-z0-9-]+\/?$/.test(path)) assetRequest = new Request(new URL('/univers.html' + url.search, request.url), request);
    else if (/^\/produit\/[a-zA-Z0-9_-]+\/?$/.test(path)) assetRequest = new Request(new URL('/produit.html' + url.search, request.url), request);
    return withAssetHeaders(await env.ASSETS.fetch(assetRequest));
  }
};
