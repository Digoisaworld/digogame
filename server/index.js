/**
 * DIGO EVOLUTION — game API server.
 *
 * Responsibilities
 *  - Serve the built client (dist/) and the JSON API from one port.
 *  - Issue HMAC-signed run tickets so a submitted score can be tied to a real
 *    run that started on the server (server-side reward validation).
 *  - Keep a per-mode leaderboard with plausibility checks on submitted runs.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || '';
const RUN_SECRET = process.env.RUN_SECRET || crypto.randomBytes(32).toString('hex');
const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || 'mainnet-beta';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MODES = ['endless', 'time', 'mission', 'boss', 'daily'];
const WORLDS = ['island', 'cyber', 'temple', 'space', 'lava', 'crystal', 'frozen'];
const REWARD_KINDS = ['coin', 'diamond', 'energy', 'chest', 'legendary'];
const STAGES = [1, 2, 3, 4, 5];

/** Mode time limits in seconds (null = open ended). */
const MODE_DURATION = { endless: null, time: 60, mission: null, boss: null, daily: 75 };
/** Generous upper bound of score per second of play, used to reject absurd claims. */
const MAX_SCORE_PER_SECOND = 620;
const TICKET_TTL_MS = 3 * 60 * 60 * 1000;
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
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', RUN_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
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
app.set('trust proxy', true);
app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* Simple per-IP throttle for the mutating endpoints. */
const hits = new Map();
function throttle(req, res, next) {
  const key = req.ip || 'anon';
  const now = Date.now();
  const bucket = hits.get(key) ?? { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  hits.set(key, bucket);
  if (bucket.count > 120) return res.status(429).json({ error: 'Too many requests, slow down.' });
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'digo-evolution',
    uptime: Math.round(process.uptime()),
    cluster: SOLANA_CLUSTER,
    storage: STORE_FILE ? 'file' : 'memory',
    runs: { started: store.runsStarted, accepted: store.runsAccepted, rejected: store.runsRejected },
  });
});

/* ------------------------------- runs ------------------------------ */

app.post('/api/runs/start', throttle, (req, res) => {
  const { world, mode, stage } = req.body ?? {};
  if (!WORLDS.includes(world)) return res.status(400).json({ error: 'Unknown world.' });
  if (!MODES.includes(mode)) return res.status(400).json({ error: 'Unknown mode.' });
  if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Unknown stage.' });

  const payload = {
    rid: crypto.randomUUID(),
    seed: crypto.randomInt(1, 2 ** 31 - 1),
    world,
    mode,
    stage,
    iat: Date.now(),
  };
  store.runsStarted += 1;
  saveStoreSoon();
  res.json({
    runId: payload.rid,
    seed: payload.seed,
    startedAt: payload.iat,
    token: signTicket(payload),
  });
});

app.post('/api/runs', throttle, (req, res) => {
  const { token, result, name, address } = req.body ?? {};
  const ticket = readTicket(token);
  if (!ticket) {
    store.runsRejected += 1;
    saveStoreSoon();
    return res.status(400).json({ accepted: false, reason: 'Invalid or expired run ticket.' });
  }

  const elapsed = num(result?.elapsed);
  const score = num(result?.score);
  if (elapsed === null || score === null || elapsed < 0 || score < 0) {
    return res.status(400).json({ accepted: false, reason: 'Malformed run result.' });
  }

  const mode = ticket.mode;
  const duration = MODE_DURATION[mode];
  const ageSec = (Date.now() - ticket.iat) / 1000;
  const reasons = [];

  if (result.mode !== mode || result.world !== ticket.world) reasons.push('Run identity mismatch.');
  if (elapsed > ageSec + 3) reasons.push('Reported play time exceeds real elapsed time.');
  if (duration !== null && elapsed > duration + 5) reasons.push('Reported play time exceeds the mode limit.');
  if (score > elapsed * MAX_SCORE_PER_SECOND + 5000) reasons.push('Score is not plausible for that play time.');

  const collected = result.collected ?? {};
  let collectedTotal = 0;
  for (const kind of REWARD_KINDS) {
    const value = int(collected[kind] ?? 0);
    if (value === null || value < 0 || value > 5000) reasons.push('Invalid collection counts.');
    else collectedTotal += value;
  }
  if (collectedTotal > elapsed * 12 + 40) reasons.push('Too many rewards for that play time.');
  if (int(result.hits) === null || int(result.hits) < 0) reasons.push('Invalid damage count.');

  if (reasons.length) {
    store.runsRejected += 1;
    saveStoreSoon();
    return res.status(200).json({ accepted: false, reason: reasons[0] });
  }

  const cleanAddress = validAddress(address) ? address : null;
  const entry = {
    id: crypto.randomUUID(),
    name: cleanName(name),
    score: Math.round(score),
    mode,
    world: ticket.world,
    stage: ticket.stage,
    elapsed: Math.round(elapsed),
    coins: int(result.coins) ?? 0,
    at: Date.now(),
    address: cleanAddress,
  };

  const list = store.leaderboard[mode] ?? (store.leaderboard[mode] = []);
  list.push(entry);
  list.sort((x, y) => y.score - x.score || x.at - y.at);
  store.leaderboard[mode] = list.slice(0, LEADERBOARD_LIMIT);
  store.runsAccepted += 1;
  if (cleanAddress) store.wallets[cleanAddress] = { linkedAt: Date.now(), lastSeen: Date.now() };
  saveStoreSoon();

  const rank = store.leaderboard[mode].findIndex((e) => e.id === entry.id);
  res.json({
    accepted: true,
    runId: ticket.rid,
    best: store.leaderboard[mode][0]?.score ?? entry.score,
    rank: rank >= 0 ? rank + 1 : null,
    verified: true,
  });
});

app.get('/api/leaderboard', (req, res) => {
  const mode = String(req.query.mode ?? 'endless');
  if (!MODES.includes(mode)) return res.status(400).json({ error: 'Unknown mode.' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const entries = (store.leaderboard[mode] ?? []).slice(0, limit).map((e) => ({
    name: e.name,
    score: e.score,
    mode: e.mode,
    world: e.world,
    at: e.at,
    address: e.address ? `${e.address.slice(0, 4)}…${e.address.slice(-4)}` : null,
  }));
  res.json({ mode, entries, source: 'server', total: store.leaderboard[mode]?.length ?? 0 });
});

/* ------------------------------ wallet ----------------------------- */

app.post('/api/wallet/nonce', throttle, (req, res) => {
  const address = req.body?.address;
  if (!validAddress(address)) return res.status(400).json({ error: 'Invalid Solana address.' });

  const issuedAt = Date.now();
  const expiresAt = issuedAt + 5 * 60 * 1000;
  const message = [
    'DIGO EVOLUTION — wallet verification',
    '',
    'Signing proves you own this address.',
    'No transaction will be sent and no funds can move.',
    'DIGO never asks for a seed phrase or private key.',
    '',
    `Address: ${address}`,
    `Nonce: ${crypto.randomBytes(16).toString('hex')}`,
    `Issued: ${new Date(issuedAt).toISOString()}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
  ].join('\n');

  store.nonces[address] = { message, expiresAt };
  res.json({ address, message, expiresAt });
});

app.post('/api/wallet/verify', throttle, (req, res) => {
  const { address, signature, message } = req.body ?? {};
  if (!validAddress(address)) return res.status(400).json({ error: 'Invalid Solana address.' });
  if (typeof signature !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Signature and message are required.' });
  }

  const pending = store.nonces[address];
  if (!pending || pending.message !== message) {
    return res.status(400).json({ error: 'Unknown or reused challenge. Request a new one.' });
  }
  if (Date.now() > pending.expiresAt) {
    delete store.nonces[address];
    return res.status(400).json({ error: 'Challenge expired. Request a new one.' });
  }

  let verified = false;
  try {
    const sig = Buffer.from(signature, 'base64');
    verified = nacl.sign.detached.verify(
      Buffer.from(message, 'utf8'),
      sig,
      bs58.decode(address),
    );
  } catch {
    verified = false;
  }

  delete store.nonces[address];
  if (!verified) return res.status(400).json({ error: 'Signature verification failed.' });

  const linkedAt = Date.now();
  store.wallets[address] = { linkedAt, lastSeen: linkedAt };
  saveStoreSoon();
  res.json({ verified: true, address, linkedAt });
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

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`DIGO EVOLUTION server listening on 0.0.0.0:${PORT}`);
  console.log(`  client:  ${fs.existsSync(DIST_DIR) ? DIST_DIR : 'not built yet'}`);
  console.log(`  storage: ${STORE_FILE ? STORE_FILE : 'in-memory'}`);
  console.log(`  cluster: ${SOLANA_CLUSTER} (wallet verification only, no transactions)`);
});

function shutdown(signal) {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
