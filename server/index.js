/**
 * DIGO EVOLUTION — game API server.
 *
 * Responsibilities
 *  - Serve the built client (dist/) and the JSON API from one port.
 *  - Issue HMAC-signed run tickets so a submitted score can be tied to a real
 *    run that started on the server (server-side reward validation).
 *  - Keep a per-level leaderboard with plausibility checks on submitted runs.
 *  - Verify Phantom wallet ownership with an ed25519 message signature.
 *
 * Security notes
 *  - No private key or seed phrase is ever requested, received or stored.
 *  - No Solana transaction is created or sent. DIGO points are game points.
 *  - All request bodies are validated and size limited.
 */
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { verifyDatabase, databaseStatus, closeDatabase, query, pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || '';
const configuredRunSecret = process.env.RUN_SECRET || '';
if (process.env.NODE_ENV === 'production' && Buffer.byteLength(configuredRunSecret, 'utf8') < 32) {
  throw new Error('RUN_SECRET must be configured with at least 32 bytes in production.');
}
const RUN_SECRET = configuredRunSecret || crypto.randomBytes(32).toString('hex');
const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || 'mainnet-beta';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const REWARD_KINDS = ['coin', 'crate', 'gem', 'relic'];

/**
 * Campaign table. Mirrors src/game/levels.ts: the server needs the world, the
 * time limit and the completion bonus so a submitted run can be checked
 * against the level that was actually started. Generated in ./campaign.js from
 * the same logarithmic rules, and scripts/verify-campaign.ts asserts that both
 * sides agree on all 100 levels.
 */
import { LEVEL_MAP } from './campaign.js';

/** Generous upper bound of score per second of play, used to reject absurd claims. */
const MAX_SCORE_PER_SECOND = 620;
/** Highest DIGO a single collected reward can be worth (legendary relic). */
const MAX_DIGO_PER_REWARD = 15;
const TICKET_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const usedRuns = new Map();
const LEADERBOARD_LIMIT = 100;

/* ------------------------------------------------------------------ */
/* Storage (in-memory, optional JSON snapshot when DATA_DIR is writable) */
/* ------------------------------------------------------------------ */

const STORE_FILE = DATA_DIR ? path.join(DATA_DIR, 'digo-store.json') : null;

const store = {
  leaderboard: {}, // mode -> entry[]
  wallets: {}, // address -> { linkedAt, lastSeen }
  nonces: {}, // address -> { message, expiresAt }
  runsStarted: 0,
  runsAccepted: 0,
  runsRejected: 0,
};

function loadStore() {
  if (!STORE_FILE) return;
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      store.leaderboard = parsed.leaderboard ?? {};
      store.wallets = parsed.wallets ?? {};
      store.runsStarted = parsed.runsStarted ?? 0;
      store.runsAccepted = parsed.runsAccepted ?? 0;
      store.runsRejected = parsed.runsRejected ?? 0;
    }
  } catch {
    /* first boot or unreadable snapshot: start clean */
  }
}

let saveTimer = null;
function saveStoreSoon() {
  if (!STORE_FILE) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(
        STORE_FILE,
        JSON.stringify({
          leaderboard: store.leaderboard,
          wallets: store.wallets,
          runsStarted: store.runsStarted,
          runsAccepted: store.runsAccepted,
          runsRejected: store.runsRejected,
        }),
      );
    } catch {
      /* read-only filesystem: stay in memory */
    }
  }, 400);
}

loadStore();

/* Periodic bounded cleanup for process-local security state. This is not a
 * substitute for shared PostgreSQL/Redis state in a multi-instance deploy. */
const MAX_SESSIONS = 50_000;
const MAX_NONCES = 20_000;
const MAX_RATE_KEYS = 10_000;

function cleanupEphemeralState() {
  const now = Date.now();
  for (const [sid, session] of sessions) {
    if (!session || now >= session.expiresAt) sessions.delete(sid);
  }
  for (const [rid, expiresAt] of usedRuns) {
    if (!Number.isFinite(expiresAt) || now >= expiresAt) usedRuns.delete(rid);
  }
  for (const [key, challenge] of Object.entries(store.nonces)) {
    if (!challenge || now >= challenge.expiresAt) delete store.nonces[key];
  }
  for (const [key, bucket] of hits) {
    if (!bucket || now >= bucket.reset) hits.delete(key);
  }
}
const cleanupTimer = setInterval(cleanupEphemeralState, 60_000);
cleanupTimer.unref();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signTicket(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', RUN_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function readTicket(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  if (!body || !mac || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(mac)) return null;
  const expected = crypto.createHmac('sha256', RUN_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || typeof payload.rid !== 'string' || !Number.isSafeInteger(payload.seed)
      || !Number.isSafeInteger(payload.level) || typeof payload.world !== 'string'
      || typeof payload.address !== 'string' || !Number.isFinite(payload.iat)) return null;
    return payload;
  } catch {
    return null;
  }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

function cleanName(raw) {
  if (typeof raw !== 'string') return 'Player';
  const trimmed = raw.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
  return trimmed || 'Player';
}

function validAddress(addr) {
  if (typeof addr !== 'string') return false;
  if (addr.length < 32 || addr.length > 44) return false;
  try {
    const bytes = bs58.decode(addr);
    return bytes.length === 32;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb', strict: true }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* Bounded in-process throttling. Shared limits will move to persistent infrastructure later. */
const hits = new Map();
function throttle(req, res, next) {
  const key = `${req.ip || 'anon'}:${req.path}`;
  const now = Date.now();
  if (hits.size >= MAX_RATE_KEYS && !hits.has(key)) cleanupEphemeralState();
  if (hits.size >= MAX_RATE_KEYS && !hits.has(key)) return res.status(503).json({ error: 'Rate limiter capacity reached. Retry shortly.' });
  const bucket = hits.get(key) ?? { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  hits.set(key, bucket);
  if (hits.size > 10000) {
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }
  if (bucket.count > 60) return res.status(429).json({ error: 'Too many requests, slow down.' });
  next();
}

async function issueSession(address) {
  cleanupEphemeralState();
  const sid = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = crypto.randomBytes(32).toString('base64url');
  if (pool) {
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query(`
      SELECT create_player_session($1, players.id, $2, $3) AS created
      FROM players WHERE wallet_address = $4 AND disabled_at IS NULL
    `, [sid, digest, new Date(expiresAt), address]);
    if (!result.rows[0]?.created) return null;
    return { token, expiresAt };
  }
  if (sessions.size >= MAX_SESSIONS) return null;
  sessions.set(sid, { address, expiresAt });
  const body = b64url(JSON.stringify({ sid, address, exp: expiresAt }));
  const mac = crypto.createHmac('sha256', RUN_SECRET).update('session.' + body).digest('base64url');
  return { token: body + '.' + mac, expiresAt };
}

async function requireSession(req, res, next) {
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Wallet sign-in required.' });
  if (pool) {
    try {
      const digest = crypto.createHash('sha256').update(match[1]).digest('hex');
      const result = await query('SELECT * FROM validate_player_session($1)', [digest]);
      const row = result.rows[0];
      if (!row) return res.status(401).json({ error: 'Session expired. Sign in again.' });
      req.player = { address: row.wallet_address, id: row.player_id, sid: null };
      return next();
    } catch (error) {
      console.error('Session validation failed:', error.message);
      return res.status(503).json({ error: 'Authentication storage temporarily unavailable.' });
    }
  }
  const parts = match[1].split('.');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid session.' });
  const [body, mac] = parts;
  if (!body || !mac) return res.status(401).json({ error: 'Invalid session.' });
  const expected = crypto.createHmac('sha256', RUN_SECRET).update('session.' + body).digest('base64url');
  const a = Buffer.from(mac); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid session.' });
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return res.status(401).json({ error: 'Invalid session.' }); }
  if (!payload || typeof payload !== 'object' || typeof payload.sid !== 'string'
    || typeof payload.address !== 'string' || !Number.isFinite(payload.exp)) return res.status(401).json({ error: 'Invalid session.' });
  const session = sessions.get(payload.sid);
  if (!session || session.address !== payload.address || session.expiresAt !== payload.exp || Date.now() >= payload.exp) {
    sessions.delete(payload.sid);
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
  req.player = { address: session.address, sid: payload.sid };
  next();
}

app.post('/api/auth/logout', requireSession, async (req, res) => {
  try {
    if (pool && req.player.sid) await query('SELECT revoke_player_session($1, $2)', [req.player.sid, req.player.id]);
    else if (pool) {
      const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
      if (token) await query("UPDATE player_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_sha256 = $1", [crypto.createHash('sha256').update(token).digest('hex')]);
    } else sessions.delete(req.player.sid);
    res.json({ ok: true });
  } catch (error) {
    console.error('Logout persistence failed:', error.message);
    res.status(503).json({ error: 'Could not revoke session. Retry.' });
  }
});

app.get('/api/health', async (_req, res) => {
  let dbHealthy = false;
  try { dbHealthy = await verifyDatabase(); } catch { dbHealthy = false; }
  const db = databaseStatus();
  res.status(db.configured && !dbHealthy ? 503 : 200).json({
    ok: !db.configured || dbHealthy,
    service: 'digo-evolution',
    database: { ...db, ready: dbHealthy },
    uptime: Math.round(process.uptime()),
    cluster: SOLANA_CLUSTER,
    storage: 'legacy-json-snapshot (gameplay persistence integration pending)',
    productionSecretConfigured: process.env.NODE_ENV !== 'production' || configuredRunSecret.length >= 32,
    runs: { started: store.runsStarted, accepted: store.runsAccepted, rejected: store.runsRejected },
  });
});

/* ------------------------------- runs ------------------------------ */

app.post('/api/runs/start', throttle, requireSession, async (req, res) => {
  const level = int(req.body?.level);
  const def = level === null ? null : LEVEL_MAP.get(level);
  if (!def) return res.status(400).json({ error: 'Unknown level.' });
  const payload = {
    rid: crypto.randomUUID(), seed: crypto.randomInt(1, 2 ** 31 - 1),
    level: def.id, world: def.world, address: req.player.address, iat: Date.now(),
  };
  try {
    if (pool) {
      await query(`INSERT INTO game_runs
        (id,player_id,level_id,world_id,seed,ticket_sha256,started_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [payload.rid, req.player.id, payload.level, payload.world, payload.seed,
        crypto.createHash('sha256').update(signTicket(payload)).digest('hex'),
        new Date(payload.iat), new Date(payload.iat + TICKET_TTL_MS)]);
    }
    store.runsStarted += 1;
    saveStoreSoon();
    res.json({ runId: payload.rid, seed: payload.seed, startedAt: payload.iat, token: signTicket(payload) });
  } catch (error) {
    console.error('Run start persistence failed:', error.message);
    res.status(503).json({ error: 'Could not start a durable game run. Retry shortly.' });
  }
});

app.post('/api/runs', throttle, requireSession, (req, res) => {
  const { token, result, name } = req.body ?? {};
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return res.status(400).json({ accepted: false, reason: 'Malformed run result.' });
  }
  const ticket = readTicket(token);
  if (!ticket) {
    store.runsRejected += 1;
    saveStoreSoon();
    return res.status(400).json({ accepted: false, reason: 'Invalid or expired run ticket.' });
  }

  if (result.collected !== undefined && (!result.collected || typeof result.collected !== 'object' || Array.isArray(result.collected))) {
    return res.status(400).json({ accepted: false, reason: 'Malformed collection data.' });
  }
  const elapsed = num(result?.elapsed);
  const score = num(result?.score);
  if (elapsed === null || score === null || elapsed < 0 || score < 0) {
    return res.status(400).json({ accepted: false, reason: 'Malformed run result.' });
  }

  if (ticket.address !== req.player.address) return res.status(403).json({ accepted: false, reason: 'Run belongs to another wallet.' });
  if (usedRuns.has(ticket.rid)) return res.status(409).json({ accepted: false, reason: 'Run result already submitted.' });
  if (!Number.isFinite(ticket.iat) || Date.now() - ticket.iat > TICKET_TTL_MS || Date.now() < ticket.iat - 5000) return res.status(400).json({ accepted: false, reason: 'Run ticket expired.' });

  const def = LEVEL_MAP.get(ticket.level);
  if (!def) {
    store.runsRejected += 1;
    saveStoreSoon();
    return res.status(400).json({ accepted: false, reason: 'Run ticket references an unknown level.' });
  }

  const ageSec = (Date.now() - ticket.iat) / 1000;
  const reasons = [];

  if (int(result.level) !== def.id || result.world !== ticket.world) reasons.push('Run identity mismatch.');
  if (elapsed > ageSec + 3) reasons.push('Reported play time exceeds real elapsed time.');
  if (elapsed > def.duration + 5) reasons.push('Reported play time exceeds the level limit.');
  if (score > elapsed * MAX_SCORE_PER_SECOND + def.bonus + 5000) reasons.push('Score is not plausible for that play time.');

  const collected = result.collected ?? {};
  let collectedTotal = 0;
  for (const kind of REWARD_KINDS) {
    const value = int(collected[kind] ?? 0);
    if (value === null || value < 0 || value > 5000) reasons.push('Invalid collection counts.');
    else collectedTotal += value;
  }
  if (collectedTotal > elapsed * 12 + 40) reasons.push('Too many rewards for that play time.');
  if (int(result.hits) === null || int(result.hits) < 0) reasons.push('Invalid damage count.');

  const digo = int(result.digo);
  if (digo === null || digo < 0 || digo > collectedTotal * MAX_DIGO_PER_REWARD + 40) {
    reasons.push('DIGO collected is not plausible for those rewards.');
  }
  const bonus = int(result.bonus) ?? 0;
  if (bonus < 0 || bonus > def.bonus) reasons.push('Completion bonus exceeds the level award.');
  if (bonus > 0 && elapsed < def.duration * 0.5) reasons.push('Completion bonus claimed too early.');

  if (reasons.length) {
    store.runsRejected += 1;
    saveStoreSoon();
    return res.status(200).json({ accepted: false, reason: reasons[0] });
  }

  const cleanAddress = req.player.address;
  const stars = Math.min(3, Math.max(0, int(result.stars) ?? 0));
  const total = Math.round(score) + bonus;
  const entry = {
    id: crypto.randomUUID(),
    name: cleanName(name),
    level: def.id,
    world: def.world,
    score: Math.round(score),
    total,
    bonus,
    digo: digo ?? 0,
    stars,
    victory: Boolean(result.victory),
    elapsed: Math.round(elapsed),
    at: Date.now(),
    address: cleanAddress,
  };

  const key = String(def.id);
  const list = store.leaderboard[key] ?? (store.leaderboard[key] = []);
  usedRuns.set(ticket.rid, Date.now() + TICKET_TTL_MS);
  if (usedRuns.size > 20000) {
    const now = Date.now();
    for (const [id, expiry] of usedRuns) if (expiry < now) usedRuns.delete(id);
  }
  list.push(entry);
  list.sort((x, y) => y.total - x.total || x.at - y.at);
  store.leaderboard[key] = list.slice(0, LEADERBOARD_LIMIT);
  store.runsAccepted += 1;
  if (cleanAddress) store.wallets[cleanAddress] = { linkedAt: Date.now(), lastSeen: Date.now() };
  saveStoreSoon();

  const rank = store.leaderboard[key].findIndex((e) => e.id === entry.id);
  res.json({
    accepted: true,
    runId: ticket.rid,
    total,
    best: store.leaderboard[key][0]?.total ?? total,
    rank: rank >= 0 ? rank + 1 : null,
    stars,
    verified: true,
  });
});

app.get('/api/leaderboard', (req, res) => {
  const level = int(req.query.level) ?? 1;
  const def = LEVEL_MAP.get(level);
  if (!def) return res.status(400).json({ error: 'Unknown level.' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const list = store.leaderboard[String(def.id)] ?? [];
  const entries = list.slice(0, limit).map((e) => ({
    name: e.name,
    level: e.level,
    world: e.world,
    score: e.score,
    total: e.total,
    stars: e.stars,
    at: e.at,
    address: e.address ? `${e.address.slice(0, 4)}…${e.address.slice(-4)}` : null,
  }));
  res.json({ level: def.id, entries, source: 'server', total: list.length });
});

/* ------------------------------ wallet ----------------------------- */

app.post('/api/wallet/nonce', throttle, async (req, res) => {
  const address = req.body?.address;
  if (!validAddress(address)) return res.status(400).json({ error: 'Invalid Solana address.' });
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 5 * 60 * 1000;
  const message = [
    'DIGO EVOLUTION — wallet verification', '',
    'Signing proves you own this address.',
    'No transaction will be sent and no funds can move.',
    'DIGO never asks for a seed phrase or private key.', '',
    `Address: ${address}`,
    `Nonce: ${crypto.randomBytes(16).toString('hex')}`,
    `Issued: ${new Date(issuedAt).toISOString()}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
  ].join('\\n');
  try {
    if (pool) {
      const digest = crypto.createHash('sha256').update(message).digest('hex');
      await query('DELETE FROM wallet_challenges WHERE expires_at < now() OR consumed_at IS NOT NULL');
      await query(`INSERT INTO wallet_challenges(wallet_address,message,message_sha256,expires_at)
        VALUES($1,$2,$3,$4)`, [address, message, digest, new Date(expiresAt)]);
    } else {
      cleanupEphemeralState();
      if (!Object.hasOwn(store.nonces, address) && Object.keys(store.nonces).length >= MAX_NONCES)
        return res.status(503).json({ error: 'Wallet challenge capacity reached. Retry shortly.' });
      store.nonces[address] = { message, expiresAt };
    }
    res.json({ address, message, expiresAt });
  } catch (error) {
    console.error('Challenge persistence failed:', error.message);
    res.status(503).json({ error: 'Wallet verification is temporarily unavailable.' });
  }
});

app.post('/api/wallet/verify', throttle, async (req, res) => {
  const { address, signature, message } = req.body ?? {};
  if (!validAddress(address)) return res.status(400).json({ error: 'Invalid Solana address.' });
  if (typeof signature !== 'string' || typeof message !== 'string' || message.length > 2048 || signature.length > 128)
    return res.status(400).json({ error: 'Signature and message are required.' });

  if (pool) {
    const check = await query(`SELECT 1 FROM wallet_challenges
      WHERE wallet_address=$1 AND message_sha256=$2 AND message=$3
        AND consumed_at IS NULL AND expires_at > now() LIMIT 1`,
    [address, crypto.createHash('sha256').update(message).digest('hex'), message]);
    if (!check.rowCount) return res.status(400).json({ error: 'Unknown or reused challenge. Request a new one.' });
  } else {
    const pending = store.nonces[address];
    if (!pending || pending.message !== message)
      return res.status(400).json({ error: 'Unknown or reused challenge. Request a new one.' });
    if (Date.now() > pending.expiresAt) {
      delete store.nonces[address];
      return res.status(400).json({ error: 'Challenge expired. Request a new one.' });
    }
  }

  let verified = false;
  try {
    const sig = Buffer.from(signature, 'base64');
    if (sig.length === nacl.sign.signatureLength && sig.toString('base64') === signature) {
      verified = nacl.sign.detached.verify(Buffer.from(message, 'utf8'), sig, bs58.decode(address));
    }
  } catch { verified = false; }
  if (!verified) return res.status(400).json({ error: 'Signature verification failed.' });

  try {
    if (pool) {
      const digest = crypto.createHash('sha256').update(message).digest('hex');
      const consumed = await query('SELECT * FROM consume_wallet_challenge($1,$2)', [address, digest]);
      if (!consumed.rowCount) return res.status(409).json({ error: 'Challenge was already used or expired. Request a new one.' });
      const player = await query(`INSERT INTO players(wallet_address,display_name,last_seen_at)
        VALUES($1,'Player',now())
        ON CONFLICT(wallet_address) DO UPDATE SET last_seen_at=now()
        WHERE players.disabled_at IS NULL
        RETURNING id`, [address]);
      if (!player.rowCount) return res.status(403).json({ error: 'This wallet is not permitted to sign in.' });
    } else {
      delete store.nonces[address];
      const linkedAt = Date.now();
      store.wallets[address] = { linkedAt, lastSeen: linkedAt };
      saveStoreSoon();
    }
    const session = await issueSession(address);
    if (!session) return res.status(503).json({ error: 'Session capacity reached. Retry shortly.' });
    res.json({ verified: true, address, linkedAt: Date.now(), token: session.token, expiresAt: session.expiresAt });
  } catch (error) {
    console.error('Wallet verification persistence failed:', error.message);
    res.status(503).json({ error: 'Wallet sign-in storage is temporarily unavailable.' });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));

/* ------------------------------ static ----------------------------- */

if (fs.existsSync(DIST_DIR)) {
  app.use(
    express.static(DIST_DIR, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send('Client bundle missing. Run "npm run build" before starting the server.');
  });
}

let server;
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    await verifyDatabase();
    console.log('  database: PostgreSQL connection verified');
  }
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`DIGO EVOLUTION server listening on 0.0.0.0:${PORT}`);
    console.log(`  client:  ${fs.existsSync(DIST_DIR) ? DIST_DIR : 'not built yet'}`);
    console.log(`  storage: ${databaseStatus().engine}`);
    console.log(`  cluster: ${SOLANA_CLUSTER} (wallet verification only, no transactions)`);
  });
}
startServer().catch((error) => {
  console.error('DIGO EVOLUTION startup failed:', error.message);
  process.exitCode = 1;
  closeDatabase().finally(() => process.exit(1));
});

function shutdown(signal) {
  console.log(`${signal} received, closing server`);
  if (server) server.close(() => closeDatabase().finally(() => process.exit(0)));
  else closeDatabase().finally(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
