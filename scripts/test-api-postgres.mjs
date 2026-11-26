/**
 * End-to-end PostgreSQL API smoke test.
 * Requires a migrated disposable database and DATABASE_URL.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, 'DATABASE_URL is required');
const port = Number(process.env.TEST_API_PORT || 39871);
const runSecret = crypto.randomBytes(48).toString('hex');
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server/index.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    RUN_SECRET: runSecret,
    DATABASE_URL: databaseUrl,
    DATA_DIR: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk; });
child.stderr.on('data', (chunk) => { logs += chunk; });

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API process exited early.\n${logs}`);
    try {
      const health = await request('/api/health');
      if (health.status === 200 && health.data.database?.ready) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API did not become healthy in time.\n${logs}`);
}

try {
  await waitForServer();

  const wallet = nacl.sign.keyPair();
  const address = bs58.encode(wallet.publicKey);
  const challenge = await request('/api/wallet/nonce', {
    method: 'POST', body: { address },
  });
  assert.equal(challenge.status, 200, JSON.stringify(challenge.data));
  assert.equal(challenge.data.address, address);
  assert.equal(typeof challenge.data.message, 'string');

  const signature = nacl.sign.detached(
    Buffer.from(challenge.data.message, 'utf8'),
    wallet.secretKey,
  );
  const verified = await request('/api/wallet/verify', {
    method: 'POST',
    body: {
      address,
      message: challenge.data.message,
      signature: Buffer.from(signature).toString('base64'),
    },
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  assert.equal(verified.data.verified, true);
  assert.ok(verified.data.token);

  const replayChallenge = await request('/api/wallet/verify', {
    method: 'POST',
    body: {
      address,
      message: challenge.data.message,
      signature: Buffer.from(signature).toString('base64'),
    },
  });
  assert.equal(replayChallenge.status, 400, 'wallet challenge must be single-use');

  const started = await request('/api/runs/start', {
    method: 'POST', token: verified.data.token, body: { level: 1 },
  });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.ok(started.data.runId && started.data.token);

  const submitted = await request('/api/runs', {
    method: 'POST',
    token: verified.data.token,
    body: {
      token: started.data.token,
      name: 'CI Player',
      result: {
        level: 1,
        world: 'island',
        elapsed: 0,
        score: 0,
        collected: { coin: 0, crate: 0, gem: 0, relic: 0 },
        hits: 0,
        digo: 0,
        bonus: 0,
        stars: 0,
        victory: false,
      },
    },
  });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
  assert.equal(submitted.data.accepted, true, JSON.stringify(submitted.data));
  assert.equal(submitted.data.verified, true);

  const duplicate = await request('/api/runs', {
    method: 'POST',
    token: verified.data.token,
    body: {
      token: started.data.token,
      result: {
        level: 1, world: 'island', elapsed: 0, score: 0,
        collected: {}, hits: 0, digo: 0, bonus: 0,
      },
    },
  });
  assert.equal(duplicate.status, 409, 'run ticket must be single-use');

  const leaderboard = await request('/api/leaderboard?level=1');
  assert.equal(leaderboard.status, 200, JSON.stringify(leaderboard.data));
  assert.equal(leaderboard.data.source, 'postgresql');
  assert.ok(leaderboard.data.entries.some((entry) => entry.name === 'CI Player'));

  console.log('PostgreSQL API integration passed: health, Phantom signature, single-use challenge, durable session, run ticket, accepted result, replay rejection and leaderboard.');
} catch (error) {
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
