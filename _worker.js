const PRODUCT_PREFIX = 'boutique:product:';
const INDEX_KEY = 'boutique:products:index';
const SETTINGS_KEY = 'boutique:settings';
const SYSTEME_SECRET_KEY = 'boutique:systeme:webhook-secret';
const SUPERADMIN_ID = 'superadmin';
const PORTAL_IDS = ['nyxia', 'diane', 'eric', 'lena', 'selena', 'kael', 'alex'];
const ADMIN_ORIGINS = new Set(['https://univers.nyxia.top', 'https://boutique.nyxia.top']);

const DEFAULT_PORTALS = [
  { id: 'nyxia', name: 'NyXia', intro: 'Solutions techniques, accompagnement et services Done For You.', imageUrl: '/images/nyxia.png', order: 1, active: true },
  { id: 'diane', name: 'Diane', intro: 'Parcours, livres et créations de la fondatrice de l’écosystème.', imageUrl: '/images/diane.png', order: 2, active: true },
  { id: 'eric', name: 'Éric', intro: 'Marketing relationnel, communication et univers CashFlow™.', imageUrl: '/images/eric.png', order: 3, active: true },
  { id: 'lena', name: 'Léna', intro: 'Dons, outils spirituels et méthode DDM.', imageUrl: '/images/lena.png', order: 4, active: true },
  { id: 'selena', name: 'Séléna', intro: 'Libération émotionnelle, miroir et méthode A.M.I.E.™.', imageUrl: '/images/selena.png', order: 5, active: true },
  { id: 'kael', name: 'Kael', intro: 'Relations, activités et expériences à vivre à deux.', imageUrl: '/images/kael.png', order: 6, active: true },
  { id: 'alex', name: 'Alex', intro: 'Écriture, livres et parcours pour aller jusqu’au mot FIN.', imageUrl: '/images/alex.png', order: 7, active: true }
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
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function withAdminHeaders(response, request) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('Origin') || '';
  if (ADMIN_ORIGINS.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Univers-Token');
  headers.set('Vary', 'Origin');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function adminJson(data, status, request) {
  return withAdminHeaders(new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }), request);
}

function withAssetHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; media-src 'self' https: blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; base-uri 'self'; form-action https:");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cleanId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}

function cleanText(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 5000);
}

function cleanHttpsUrl(value) {
  const raw = cleanText(value, 2000);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch (_) {
    return '';
  }
}

function optionalPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Les commissions doivent être entre 0 et 100 %.');
  return Math.round(n * 10000) / 10000;
}

function cookieValue(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp('(?:^|;\\s*)' + escaped + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : '';
}

async function requireUniversAdmin(request, env) {
  const token = cleanText(request.headers.get('X-Univers-Token') || cookieValue(request, 'nyxia_univers'), 300);
  if (!token || !env.CASHFLOW_KV) return false;
  return !!(await env.CASHFLOW_KV.get('univers:session:' + token));
}

async function productIds(env) {
  const raw = await env.CASHFLOW_KV.get(INDEX_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
  }
  const ids = [];
  let cursor;
  do {
    const listed = await env.CASHFLOW_KV.list({ prefix: PRODUCT_PREFIX, cursor });
    for (const key of (listed.keys || [])) ids.push(key.name.slice(PRODUCT_PREFIX.length));
    cursor = listed.list_complete ? null : listed.cursor;
  } while (cursor);
  return ids.filter(Boolean);
}

async function allKvProducts(env) {
  const ids = await productIds(env);
  const rows = await Promise.all(ids.map(async (id) => {
    const raw = await env.CASHFLOW_KV.get(PRODUCT_PREFIX + id);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }));
  return rows.filter(Boolean);
}

async function products(env) {
  return (await allKvProducts(env)).filter((item) => item.active).sort((a, b) =>
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
      portals: DEFAULT_PORTALS.map((portal) => {
        const savedPortal = savedPortals.find((item) => item && item.id === portal.id) || {};
        return { ...portal, ...savedPortal, imageUrl: savedPortal.imageUrl || portal.imageUrl };
      })
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

/* =========================================================
   COMMERCE / COMMISSIONS — D1 partagé avec Cercles + Promoteurs
   Les rôles ne définissent JAMAIS les niveaux de commission.
   N1 = propriétaire du ref_code de la vente, puis parent_id pour N2/N3.
   ========================================================= */

async function ensureCommerceSchema(env) {
  if (!env.DB) throw new Error('Le binding D1 DB est absent sur la Boutique.');

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'affiliate',
    affiliate_code TEXT UNIQUE,
    parent_id TEXT,
    paypal_email TEXT,
    webhook_secret TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    commission_l1 REAL DEFAULT 25,
    commission_l2 REAL DEFAULT 10,
    commission_l3 REAL DEFAULT 5,
    owner_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketplace_products (
    id TEXT PRIMARY KEY,
    seller_id TEXT,
    category_id INTEGER,
    title TEXT NOT NULL,
    description_short TEXT,
    description_long TEXT,
    image_url TEXT,
    price REAL DEFAULT 0,
    price_monthly REAL DEFAULT 0,
    billing_type TEXT DEFAULT 'one_time',
    commission_n1 REAL,
    commission_n2 REAL,
    commission_n3 REAL,
    affiliate_link TEXT,
    promo_code TEXT,
    status TEXT DEFAULT 'draft',
    created_at TEXT,
    updated_at TEXT
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS commissions (
    id TEXT PRIMARY KEY,
    sale_id TEXT,
    product_id TEXT,
    seller_id TEXT,
    beneficiary_id TEXT,
    beneficiary_code TEXT,
    level INTEGER DEFAULT 1,
    amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'CAD',
    status TEXT DEFAULT 'pending',
    buyer_email TEXT,
    ref_code TEXT,
    source TEXT,
    created_at TEXT,
    paid_at TEXT
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS nyxia_sales (
    id TEXT PRIMARY KEY,
    external_id TEXT UNIQUE,
    product_id TEXT,
    seller_id TEXT,
    buyer_email TEXT,
    amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'CAD',
    ref_code TEXT,
    source TEXT,
    status TEXT,
    event_type TEXT,
    raw_json TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run();

  const alters = [
    `ALTER TABLE marketplace_products ADD COLUMN systeme_price_plan_id TEXT`,
    `ALTER TABLE marketplace_products ADD COLUMN systeme_price_plan_name TEXT`,
    `ALTER TABLE marketplace_products ADD COLUMN systeme_checkout_url TEXT`,
    `ALTER TABLE marketplace_products ADD COLUMN commission_enabled INTEGER DEFAULT 1`,
    `ALTER TABLE nyxia_sales ADD COLUMN raw_json TEXT`
  ];
  for (const sql of alters) {
    try { await env.DB.prepare(sql).run(); } catch (_) {}
  }
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comm_sale ON commissions(sale_id)`).run(); } catch (_) {}
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comm_benef ON commissions(beneficiary_id)`).run(); } catch (_) {}
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_comm_seller ON commissions(seller_id)`).run(); } catch (_) {}
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sys_plan ON marketplace_products(systeme_price_plan_id)`).run(); } catch (_) {}
}

async function generateAffiliateCode(env) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    const buf = crypto.getRandomValues(new Uint8Array(8));
    let code = '';
    for (let i = 0; i < buf.length; i++) code += chars[buf[i] % chars.length];
    const exists = await env.DB.prepare(`SELECT id FROM users WHERE affiliate_code = ? LIMIT 1`).bind(code).first();
    if (!exists) return code;
  }
  return ('N' + crypto.randomUUID().replace(/-/g, '')).slice(0, 10).toUpperCase();
}

async function ensureSuperAdminUser(env) {
  await ensureCommerceSchema(env);
  let row = await env.DB.prepare(`SELECT id,email,full_name,role,affiliate_code,parent_id FROM users WHERE id = ? LIMIT 1`).bind(SUPERADMIN_ID).first();
  if (!row) {
    const code = await generateAffiliateCode(env);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO users
      (id,email,password_hash,full_name,role,affiliate_code,parent_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(SUPERADMIN_ID, 'superadmin@nyxia.local', '$disabled$', 'Diane — Super Admin', 'superadmin', code, null, now, now).run();
    row = await env.DB.prepare(`SELECT id,email,full_name,role,affiliate_code,parent_id FROM users WHERE id = ?`).bind(SUPERADMIN_ID).first();
  } else if (!row.affiliate_code) {
    const code = await generateAffiliateCode(env);
    await env.DB.prepare(`UPDATE users SET affiliate_code=?, updated_at=? WHERE id=?`).bind(code, new Date().toISOString(), SUPERADMIN_ID).run();
    row.affiliate_code = code;
  }
  return row;
}

async function programDefaults(env) {
  await ensureCommerceSchema(env);
  const row = await env.DB.prepare(`SELECT commission_l1,commission_l2,commission_l3 FROM programs WHERE is_active=1 ORDER BY created_at ASC LIMIT 1`).first();
  return {
    n1: row && row.commission_l1 != null ? Number(row.commission_l1) : 25,
    n2: row && row.commission_l2 != null ? Number(row.commission_l2) : 10,
    n3: row && row.commission_l3 != null ? Number(row.commission_l3) : 5
  };
}

function hasExplicitRate(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

async function resolveRates(env, product) {
  if (product && product.commissionEnabled === false) return [0, 0, 0];
  if (product && Number(product.commission_enabled) === 0) return [0, 0, 0];
  const defaults = await programDefaults(env);
  const raw = [
    product && (product.commissionN1 !== undefined ? product.commissionN1 : product.commission_n1),
    product && (product.commissionN2 !== undefined ? product.commissionN2 : product.commission_n2),
    product && (product.commissionN3 !== undefined ? product.commissionN3 : product.commission_n3)
  ];
  const fallback = [defaults.n1, defaults.n2, defaults.n3];
  return raw.map((value, index) => hasExplicitRate(value) ? Number(value) : Number(fallback[index] || 0));
}

async function resolveChainByRef(env, refCode) {
  if (!refCode || !env.DB) return [];
  const u1 = await env.DB.prepare(
    `SELECT id,email,full_name,role,affiliate_code,parent_id FROM users WHERE affiliate_code=? LIMIT 1`
  ).bind(String(refCode).trim().toUpperCase()).first();
  if (!u1) return [];
  const chain = [u1];
  let parentId = u1.parent_id;
  for (let i = 0; i < 2 && parentId; i++) {
    const parent = await env.DB.prepare(
      `SELECT id,email,full_name,role,affiliate_code,parent_id FROM users WHERE id=? LIMIT 1`
    ).bind(parentId).first();
    if (!parent) break;
    chain.push(parent);
    parentId = parent.parent_id;
  }
  return chain;
}

function mediaFields(product) {
  const p = product || {};
  return {
    videoUrl: p.videoUrl || '',
    videoTitle: p.videoTitle || '',
    videoPosition: ['gallery', 'description', 'hidden'].includes(p.videoPosition) ? p.videoPosition : 'gallery',
    testimonialImageUrl: p.testimonialImageUrl || '',
    testimonialMode: ['text', 'image', 'both'].includes(p.testimonialMode) ? p.testimonialMode : (p.testimonialImageUrl && p.testimonialQuote ? 'both' : (p.testimonialImageUrl ? 'image' : 'text'))
  };
}

function commerceFields(kvProduct, d1Product) {
  const k = kvProduct || {};
  const d = d1Product || {};
  return {
    sellerId: k.sellerId || d.seller_id || SUPERADMIN_ID,
    commissionEnabled: k.commissionEnabled !== undefined ? k.commissionEnabled !== false : Number(d.commission_enabled) !== 0,
    commissionN1: k.commissionN1 !== undefined ? k.commissionN1 : (d.commission_n1 != null ? Number(d.commission_n1) : null),
    commissionN2: k.commissionN2 !== undefined ? k.commissionN2 : (d.commission_n2 != null ? Number(d.commission_n2) : null),
    commissionN3: k.commissionN3 !== undefined ? k.commissionN3 : (d.commission_n3 != null ? Number(d.commission_n3) : null),
    systemeCheckoutUrl: k.systemeCheckoutUrl || d.systeme_checkout_url || '',
    systemePricePlanId: String(k.systemePricePlanId || d.systeme_price_plan_id || ''),
    systemePricePlanName: k.systemePricePlanName || d.systeme_price_plan_name || ''
  };
}

async function mirrorKvProductToD1(env, product) {
  await ensureCommerceSchema(env);
  const id = cleanId(product.id);
  if (!id) throw new Error('Produit sans identifiant.');
  const commerce = commerceFields(product, {});
  const now = new Date().toISOString();
  const title = cleanText(product.title, 500) || id;
  const shortDescription = cleanText(product.shortDescription, 1200);
  const description = cleanText(product.description, 12000);
  const image = cleanHttpsUrl(product.imageMain) || cleanText(product.imageMain, 2000);
  const price = Number(product.price) || 0;
  const c1 = commerce.commissionEnabled ? commerce.commissionN1 : 0;
  const c2 = commerce.commissionEnabled ? commerce.commissionN2 : 0;
  const c3 = commerce.commissionEnabled ? commerce.commissionN3 : 0;
  const checkout = cleanHttpsUrl(commerce.systemeCheckoutUrl);

  const existing = await env.DB.prepare(`SELECT id,created_at,affiliate_link FROM marketplace_products WHERE id=?`).bind(id).first();
  if (existing) {
    await env.DB.prepare(`UPDATE marketplace_products SET
      seller_id=?, title=?, description_short=?, description_long=?, image_url=?, price=?,
      commission_n1=?, commission_n2=?, commission_n3=?, commission_enabled=?,
      systeme_price_plan_id=?, systeme_price_plan_name=?, systeme_checkout_url=?,
      affiliate_link=CASE WHEN ?<>'' THEN ? ELSE affiliate_link END,
      status=?, updated_at=? WHERE id=?`)
      .bind(
        commerce.sellerId || SUPERADMIN_ID, title, shortDescription, description, image || null, price,
        c1, c2, c3, commerce.commissionEnabled ? 1 : 0,
        commerce.systemePricePlanId || null, commerce.systemePricePlanName || null, checkout || null,
        checkout, checkout,
        product.active === false ? 'draft' : 'active', now, id
      ).run();
  } else {
    await env.DB.prepare(`INSERT INTO marketplace_products
      (id,seller_id,title,description_short,description_long,image_url,price,commission_n1,commission_n2,commission_n3,affiliate_link,status,created_at,updated_at,systeme_price_plan_id,systeme_price_plan_name,systeme_checkout_url,commission_enabled)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        id, commerce.sellerId || SUPERADMIN_ID, title, shortDescription, description, image || null, price,
        c1, c2, c3, checkout || null, product.active === false ? 'draft' : 'active', now, now,
        commerce.systemePricePlanId || null, commerce.systemePricePlanName || null, checkout || null,
        commerce.commissionEnabled ? 1 : 0
      ).run();
  }
  return id;
}

async function adminCommerceProducts(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  await ensureCommerceSchema(env);
  await ensureSuperAdminUser(env);

  const kv = await allKvProducts(env);
  const d1Rows = await env.DB.prepare(`SELECT id,seller_id,title,description_short,price,image_url,status,commission_n1,commission_n2,commission_n3,commission_enabled,systeme_price_plan_id,systeme_price_plan_name,systeme_checkout_url,affiliate_link,created_at,updated_at FROM marketplace_products ORDER BY created_at DESC LIMIT 500`).all();
  const d1 = d1Rows.results || [];
  const d1Map = new Map(d1.map((row) => [String(row.id), row]));
  const seen = new Set();
  const out = [];

  for (const product of kv) {
    const id = String(product.id || '');
    if (!id) continue;
    const d = d1Map.get(id) || null;
    seen.add(id);
    out.push({
      id,
      source: d ? 'boutique+repertoire' : 'boutique',
      title: product.title || (d && d.title) || id,
      portal: product.portal || '',
      active: product.active !== false,
      price: product.price == null ? null : Number(product.price),
      ...mediaFields(product),
      ...commerceFields(product, d)
    });
  }

  for (const row of d1) {
    const id = String(row.id || '');
    if (!id || seen.has(id)) continue;
    out.push({
      id,
      source: 'repertoire',
      title: row.title || id,
      portal: '',
      active: row.status === 'active' || row.status === 'published',
      price: row.price == null ? null : Number(row.price),
      videoUrl: '', videoTitle: '', videoPosition: 'hidden', testimonialImageUrl: '', testimonialMode: 'text',
      ...commerceFields(null, row)
    });
  }

  const defaults = await programDefaults(env);
  return adminJson({ success: true, products: out, defaults }, 200, request);
}

async function adminSellers(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  await ensureSuperAdminUser(env);
  const rows = await env.DB.prepare(`SELECT id,email,full_name,role,affiliate_code,parent_id FROM users WHERE role IN ('admin','superadmin') ORDER BY CASE WHEN id='superadmin' THEN 0 ELSE 1 END, full_name ASC`).all();
  return adminJson({ success: true, sellers: rows.results || [] }, 200, request);
}

async function adminSaveCommerce(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  await ensureCommerceSchema(env);
  await ensureSuperAdminUser(env);
  const body = await request.json().catch(() => ({}));
  const id = cleanId(body.id);
  if (!id) return adminJson({ error: 'Identifiant produit requis.' }, 400, request);

  const sellerId = cleanText(body.sellerId || SUPERADMIN_ID, 160);
  if (sellerId !== SUPERADMIN_ID) {
    const seller = await env.DB.prepare(`SELECT id,role FROM users WHERE id=? AND role IN ('admin','superadmin') LIMIT 1`).bind(sellerId).first();
    if (!seller) return adminJson({ error: 'Administrateur vendeur introuvable.' }, 400, request);
  }

  let n1, n2, n3;
  try {
    n1 = optionalPercent(body.commissionN1);
    n2 = optionalPercent(body.commissionN2);
    n3 = optionalPercent(body.commissionN3);
  } catch (e) {
    return adminJson({ error: e.message }, 400, request);
  }
  const commissionEnabled = body.commissionEnabled !== false;

  const checkoutRaw = cleanText(body.systemeCheckoutUrl, 2000);
  const checkout = cleanHttpsUrl(checkoutRaw);
  if (checkoutRaw && !checkout) return adminJson({ error: 'Le lien de paiement Systeme.io doit être une adresse https:// valide.' }, 400, request);
  const planId = cleanText(body.systemePricePlanId, 120);
  const planName = cleanText(body.systemePricePlanName, 300);

  const key = PRODUCT_PREFIX + id;
  const raw = await env.CASHFLOW_KV.get(key);
  let kvProduct = null;
  if (raw) {
    try { kvProduct = JSON.parse(raw); } catch (_) { return adminJson({ error: 'Produit Boutique illisible.' }, 500, request); }

    const videoRaw = cleanText(body.videoUrl, 2000);
    const testimonialImageRaw = cleanText(body.testimonialImageUrl, 2000);
    const videoUrl = cleanHttpsUrl(videoRaw);
    const testimonialImageUrl = cleanHttpsUrl(testimonialImageRaw);
    if (videoRaw && !videoUrl) return adminJson({ error: 'Le lien de la vidéo doit être une adresse https:// valide.' }, 400, request);
    if (testimonialImageRaw && !testimonialImageUrl) return adminJson({ error: 'Le lien de l’image du témoignage doit être une adresse https:// valide.' }, 400, request);

    kvProduct.schemaVersion = Math.max(3, Number(kvProduct.schemaVersion) || 1);
    kvProduct.videoUrl = videoUrl;
    kvProduct.videoTitle = cleanText(body.videoTitle, 180);
    kvProduct.videoPosition = ['gallery', 'description', 'hidden'].includes(body.videoPosition) ? body.videoPosition : 'gallery';
    kvProduct.testimonialImageUrl = testimonialImageUrl;
    kvProduct.testimonialMode = ['text', 'image', 'both'].includes(body.testimonialMode) ? body.testimonialMode : 'text';
    kvProduct.sellerId = sellerId;
    kvProduct.commissionEnabled = commissionEnabled;
    kvProduct.commissionN1 = n1;
    kvProduct.commissionN2 = n2;
    kvProduct.commissionN3 = n3;
    kvProduct.systemeCheckoutUrl = checkout;
    kvProduct.systemePricePlanId = planId;
    kvProduct.systemePricePlanName = planName;
    kvProduct.updatedAt = new Date().toISOString();
    await env.CASHFLOW_KV.put(key, JSON.stringify(kvProduct));
    await mirrorKvProductToD1(env, kvProduct);
  } else {
    const row = await env.DB.prepare(`SELECT id FROM marketplace_products WHERE id=?`).bind(id).first();
    if (!row) return adminJson({ error: 'Produit introuvable dans la Boutique ou le Répertoire.' }, 404, request);
    await env.DB.prepare(`UPDATE marketplace_products SET
      seller_id=?, commission_n1=?, commission_n2=?, commission_n3=?, commission_enabled=?,
      systeme_price_plan_id=?, systeme_price_plan_name=?, systeme_checkout_url=?,
      affiliate_link=CASE WHEN ?<>'' THEN ? ELSE affiliate_link END, updated_at=? WHERE id=?`)
      .bind(sellerId, n1, n2, n3, commissionEnabled ? 1 : 0, planId || null, planName || null, checkout || null, checkout, checkout, new Date().toISOString(), id).run();
  }

  return adminJson({ success: true, id, message: 'Commerce du produit enregistré.' }, 200, request);
}

async function adminSyncBoutique(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  await ensureSuperAdminUser(env);
  const list = await allKvProducts(env);
  let synced = 0;
  for (const product of list) {
    try { await mirrorKvProductToD1(env, product); synced++; } catch (e) { console.error('sync product', product && product.id, e); }
  }
  return adminJson({ success: true, synced }, 200, request);
}

async function adminSuperAffiliate(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  let user = await ensureSuperAdminUser(env);

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'regenerate') {
      const code = await generateAffiliateCode(env);
      await env.DB.prepare(`UPDATE users SET affiliate_code=?,updated_at=? WHERE id=?`).bind(code, new Date().toISOString(), SUPERADMIN_ID).run();
    } else {
      const parentCode = cleanText(body.parentCode, 120).toUpperCase();
      let parentId = null;
      if (parentCode) {
        const parent = await env.DB.prepare(`SELECT id FROM users WHERE affiliate_code=? LIMIT 1`).bind(parentCode).first();
        if (!parent) return adminJson({ error: 'Code du parent introuvable.' }, 400, request);
        if (parent.id === SUPERADMIN_ID) return adminJson({ error: 'Le Super Admin ne peut pas être son propre parent.' }, 400, request);
        parentId = parent.id;
      }
      await env.DB.prepare(`UPDATE users SET parent_id=?,updated_at=? WHERE id=?`).bind(parentId, new Date().toISOString(), SUPERADMIN_ID).run();
    }
    user = await env.DB.prepare(`SELECT id,email,full_name,role,affiliate_code,parent_id FROM users WHERE id=?`).bind(SUPERADMIN_ID).first();
  }

  let parent = null;
  if (user.parent_id) parent = await env.DB.prepare(`SELECT id,full_name,role,affiliate_code FROM users WHERE id=?`).bind(user.parent_id).first();
  return adminJson({ success: true, user, parent }, 200, request);
}

async function webhookSecret(env, create) {
  let secret = env.CASHFLOW_KV ? await env.CASHFLOW_KV.get(SYSTEME_SECRET_KEY) : '';
  if (!secret && create && env.CASHFLOW_KV) {
    secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await env.CASHFLOW_KV.put(SYSTEME_SECRET_KEY, secret);
  }
  return secret || '';
}

async function adminWebhookInfo(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  let secret = await webhookSecret(env, true);
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'regenerate') {
      secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      await env.CASHFLOW_KV.put(SYSTEME_SECRET_KEY, secret);
    }
  }
  const origin = new URL(request.url).origin;
  return adminJson({ success: true, webhookUrl: origin + '/api/webhooks/systeme?secret=' + encodeURIComponent(secret), secret }, 200, request);
}

async function adminRecentSales(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  await ensureCommerceSchema(env);
  const rows = await env.DB.prepare(`SELECT id,external_id,product_id,seller_id,buyer_email,amount,currency,ref_code,status,event_type,created_at,updated_at FROM nyxia_sales ORDER BY updated_at DESC LIMIT 50`).all();
  return adminJson({ success: true, sales: rows.results || [] }, 200, request);
}

function fieldFrom(container, key) {
  if (!container) return '';
  if (!Array.isArray(container) && typeof container === 'object') {
    if (container[key] != null) return String(container[key]);
    const foundKey = Object.keys(container).find((k) => String(k).toLowerCase() === key.toLowerCase());
    if (foundKey && container[foundKey] != null) return String(container[foundKey]);
  }
  if (Array.isArray(container)) {
    for (const item of container) {
      if (!item) continue;
      const name = String(item.key || item.name || item.slug || item.unique_key || '').toLowerCase();
      if (name === key.toLowerCase()) return String(item.value == null ? '' : item.value);
    }
  }
  return '';
}

function systemePayload(body) {
  const data = body && body.data ? body.data : (body || {});
  const customer = data.customer || data.contact || body.customer || body.contact || {};
  const plan = data.offer_price_plan || body.offer_price_plan || data.price_plan || body.price_plan || {};
  const order = data.order || body.order || {};
  const item = data.order_item || body.order_item || {};
  const fields = customer.fields || (data.contact && data.contact.fields) || {};
  const eventType = String(body.type || body.event || data.type || data.event || '').toLowerCase();
  const email = cleanText(customer.email || data.email || body.email, 320).toLowerCase();
  const planId = cleanText(plan.id || body.systeme_price_plan_id || body.price_plan_id, 120);
  const planName = cleanText(plan.inner_name || plan.name || body.product_name || body.offer || '', 300);
  let amount = plan.direct_charge_amount;
  if (amount == null) amount = data.amount;
  if (amount == null) amount = body.amount;
  amount = Number(amount) || 0;
  const currency = cleanText(plan.currency || data.currency || body.currency || 'CAD', 12).toUpperCase();
  const ref = cleanText(
    fieldFrom(fields, 'nyxia_ref') || fieldFrom(fields, 'ref') ||
    body.ref || body.affiliate_code || data.ref || data.affiliate_code || customer.ref || '',
    120
  ).toUpperCase();
  const orderId = cleanText(order.id || body.order_id || '', 120);
  const itemId = cleanText(item.id || body.order_item_id || '', 120);
  const created = cleanText(body.created_at || data.created_at || order.created_at || item.created_at || '', 100);
  const externalId = (orderId || itemId)
    ? ('systeme:' + (orderId || 'no-order') + ':' + (itemId || planId || 'no-item'))
    : ('systeme:fallback:' + (planId || 'no-plan') + ':' + (email || 'no-email') + ':' + (created || 'event'));
  return { data, customer, plan, eventType, email, planId, planName, amount, currency, ref, orderId, itemId, externalId };
}

async function findCommerceProduct(env, parsed) {
  await ensureCommerceSchema(env);
  let row = null;
  if (parsed.planId) {
    row = await env.DB.prepare(`SELECT * FROM marketplace_products WHERE systeme_price_plan_id=? LIMIT 1`).bind(parsed.planId).first();
  }
  if (!row && parsed.planName) {
    row = await env.DB.prepare(`SELECT * FROM marketplace_products WHERE lower(systeme_price_plan_name)=lower(?) LIMIT 1`).bind(parsed.planName).first();
  }
  if (row) return row;

  const kv = await allKvProducts(env);
  let product = null;
  if (parsed.planId) product = kv.find((p) => String(p.systemePricePlanId || '') === parsed.planId);
  if (!product && parsed.planName) product = kv.find((p) => String(p.systemePricePlanName || '').trim().toLowerCase() === parsed.planName.toLowerCase());
  if (product) {
    await mirrorKvProductToD1(env, product);
    return await env.DB.prepare(`SELECT * FROM marketplace_products WHERE id=?`).bind(product.id).first();
  }
  return null;
}

async function writeCommissionRows(env, saleId, product, parsed) {
  const chain = await resolveChainByRef(env, parsed.ref);
  const rates = await resolveRates(env, product);
  const created = [];
  for (let i = 0; i < chain.length && i < 3; i++) {
    const pct = Number(rates[i] || 0);
    if (!(pct > 0)) continue;
    const beneficiary = chain[i];
    const amount = Math.round((Number(parsed.amount) * pct / 100) * 100) / 100;
    if (!(amount > 0)) continue;
    const id = saleId + ':L' + (i + 1);
    await env.DB.prepare(`INSERT OR IGNORE INTO commissions
      (id,sale_id,product_id,seller_id,beneficiary_id,beneficiary_code,level,amount,currency,status,buyer_email,ref_code,source,created_at,paid_at)
      VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,NULL)`)
      .bind(
        id, saleId, product.id || null, product.seller_id || SUPERADMIN_ID,
        beneficiary.id, beneficiary.affiliate_code || null, i + 1, amount, parsed.currency || 'CAD',
        parsed.email || null, parsed.ref || null, 'systeme.io', new Date().toISOString()
      ).run();
    created.push({ level: i + 1, beneficiary_id: beneficiary.id, code: beneficiary.affiliate_code || null, percent: pct, amount });
  }
  return { rates, chainLength: chain.length, commissions: created };
}

async function processSystemeSale(env, body, force) {
  const parsed = systemePayload(body);
  const rawJson = JSON.stringify(body).slice(0, 60000);
  let sale = await env.DB.prepare(`SELECT * FROM nyxia_sales WHERE external_id=? LIMIT 1`).bind(parsed.externalId).first();
  if (sale && sale.status === 'completed' && !force) {
    return { success: true, duplicate: true, sale_id: sale.id, external_id: parsed.externalId };
  }

  const product = await findCommerceProduct(env, parsed);
  if (!product) {
    const now = new Date().toISOString();
    if (!sale) {
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO nyxia_sales
        (id,external_id,product_id,seller_id,buyer_email,amount,currency,ref_code,source,status,event_type,raw_json,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,'unmatched',?,?,?,?)`)
        .bind(id, parsed.externalId, null, null, parsed.email || null, parsed.amount, parsed.currency, parsed.ref || null, 'systeme.io', parsed.eventType || 'customer.sale.completed', rawJson, now, now).run();
      sale = { id };
    } else {
      await env.DB.prepare(`UPDATE nyxia_sales SET buyer_email=?,amount=?,currency=?,ref_code=?,status='unmatched',event_type=?,raw_json=?,updated_at=? WHERE id=?`)
        .bind(parsed.email || null, parsed.amount, parsed.currency, parsed.ref || null, parsed.eventType || 'customer.sale.completed', rawJson, now, sale.id).run();
    }
    return { success: true, matched: false, sale_id: sale.id, external_id: parsed.externalId, plan_id: parsed.planId || null, plan_name: parsed.planName || null };
  }

  const now = new Date().toISOString();
  if (!sale) {
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO nyxia_sales
      (id,external_id,product_id,seller_id,buyer_email,amount,currency,ref_code,source,status,event_type,raw_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,'processing',?,?,?,?)`)
      .bind(id, parsed.externalId, product.id, product.seller_id || SUPERADMIN_ID, parsed.email || null, parsed.amount, parsed.currency, parsed.ref || null, 'systeme.io', parsed.eventType || 'customer.sale.completed', rawJson, now, now).run();
    sale = { id };
  } else {
    await env.DB.prepare(`UPDATE nyxia_sales SET product_id=?,seller_id=?,buyer_email=?,amount=?,currency=?,ref_code=?,status='processing',event_type=?,raw_json=?,updated_at=? WHERE id=?`)
      .bind(product.id, product.seller_id || SUPERADMIN_ID, parsed.email || null, parsed.amount, parsed.currency, parsed.ref || null, parsed.eventType || 'customer.sale.completed', rawJson, now, sale.id).run();
  }

  const commissionResult = await writeCommissionRows(env, sale.id, product, parsed);
  await env.DB.prepare(`UPDATE nyxia_sales SET status='completed',updated_at=? WHERE id=?`).bind(new Date().toISOString(), sale.id).run();
  return {
    success: true,
    matched: true,
    sale_id: sale.id,
    external_id: parsed.externalId,
    product_id: product.id,
    seller_id: product.seller_id || SUPERADMIN_ID,
    buyer_email: parsed.email || null,
    amount: parsed.amount,
    currency: parsed.currency,
    ref: parsed.ref || null,
    ...commissionResult
  };
}

async function processSystemeCancellation(env, body) {
  const parsed = systemePayload(body);
  let sale = await env.DB.prepare(`SELECT * FROM nyxia_sales WHERE external_id=? LIMIT 1`).bind(parsed.externalId).first();
  if (!sale && parsed.email && parsed.planId) {
    sale = await env.DB.prepare(`SELECT s.* FROM nyxia_sales s LEFT JOIN marketplace_products p ON p.id=s.product_id WHERE lower(s.buyer_email)=lower(?) AND p.systeme_price_plan_id=? ORDER BY s.created_at DESC LIMIT 1`).bind(parsed.email, parsed.planId).first();
  }
  if (!sale) return { success: true, matched: false, canceled: false, external_id: parsed.externalId };

  await env.DB.prepare(`UPDATE nyxia_sales SET status='canceled',event_type=?,raw_json=?,updated_at=? WHERE id=?`)
    .bind(parsed.eventType || 'sale.canceled', JSON.stringify(body).slice(0, 60000), new Date().toISOString(), sale.id).run();
  await env.DB.prepare(`UPDATE commissions SET status='canceled',amount=0 WHERE sale_id=? AND status!='paid'`).bind(sale.id).run();
  const paid = await env.DB.prepare(`SELECT COUNT(*) AS c,COALESCE(SUM(amount),0) AS total FROM commissions WHERE sale_id=? AND status='paid'`).bind(sale.id).first();
  return { success: true, matched: true, canceled: true, sale_id: sale.id, paid_commissions_count: Number(paid && paid.c || 0), paid_commissions_total: Number(paid && paid.total || 0) };
}

async function handleSystemeWebhook(request, env) {
  await ensureCommerceSchema(env);
  const expected = await webhookSecret(env, true);
  const url = new URL(request.url);
  const supplied = cleanText(url.searchParams.get('secret') || request.headers.get('X-Webhook-Secret') || request.headers.get('X-Systeme-Secret'), 200);
  if (!supplied || supplied !== expected) return json({ error: 'Webhook non autorisé.' }, 401);

  const body = await request.json().catch(() => ({}));
  const parsed = systemePayload(body);
  if (/cancel|refund/.test(parsed.eventType)) return json(await processSystemeCancellation(env, body));
  if (parsed.eventType && !/sale.*completed|customer\.sale\.completed|new.?sale/.test(parsed.eventType)) {
    return json({ success: true, ignored: true, event: parsed.eventType });
  }
  return json(await processSystemeSale(env, body, false));
}

async function adminReprocessSale(request, env) {
  if (!(await requireUniversAdmin(request, env))) return adminJson({ error: 'Non autorisé.' }, 401, request);
  await ensureCommerceSchema(env);
  const body = await request.json().catch(() => ({}));
  const id = cleanText(body.id, 100);
  if (!id) return adminJson({ error: 'Vente requise.' }, 400, request);
  const sale = await env.DB.prepare(`SELECT id,raw_json FROM nyxia_sales WHERE id=?`).bind(id).first();
  if (!sale || !sale.raw_json) return adminJson({ error: 'Vente ou payload introuvable.' }, 404, request);
  let payload;
  try { payload = JSON.parse(sale.raw_json); } catch (_) { return adminJson({ error: 'Payload illisible.' }, 500, request); }
  const result = await processSystemeSale(env, payload, true);
  return adminJson(result, 200, request);
}

async function handleRefClick(request, env) {
  const body = await request.json().catch(() => ({}));
  const ref = cleanText(body.ref, 120).toUpperCase();
  const productId = cleanId(body.productId);
  if (!ref || !productId || !env.CASHFLOW_KV) return json({ success: true });
  const key = 'ref_click:' + ref + ':' + productId;
  let count = 0;
  try { count = parseInt(await env.CASHFLOW_KV.get(key) || '0', 10) || 0; } catch (_) {}
  await env.CASHFLOW_KV.put(key, String(count + 1));
  return json({ success: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/admin/')) {
      if (request.method === 'OPTIONS') return withAdminHeaders(new Response(null, { status: 204 }), request);
      if (path === '/api/admin/commerce-products' && request.method === 'GET') return adminCommerceProducts(request, env);
      if (path === '/api/admin/sellers' && request.method === 'GET') return adminSellers(request, env);
      if (path === '/api/admin/product-commerce' && request.method === 'POST') return adminSaveCommerce(request, env);
      if (path === '/api/admin/sync-boutique' && request.method === 'POST') return adminSyncBoutique(request, env);
      if (path === '/api/admin/superadmin-affiliate' && (request.method === 'GET' || request.method === 'POST')) return adminSuperAffiliate(request, env);
      if (path === '/api/admin/webhook-info' && (request.method === 'GET' || request.method === 'POST')) return adminWebhookInfo(request, env);
      if (path === '/api/admin/recent-sales' && request.method === 'GET') return adminRecentSales(request, env);
      if (path === '/api/admin/reprocess-sale' && request.method === 'POST') return adminReprocessSale(request, env);
      return adminJson({ error: 'Route admin introuvable.' }, 404, request);
    }

    if (path === '/api/webhooks/systeme' && request.method === 'POST') return handleSystemeWebhook(request, env);
    if (path === '/api/ref-click' && request.method === 'POST') return handleRefClick(request, env);

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
