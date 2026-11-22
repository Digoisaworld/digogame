/**
 * Functional regression check for DIGO EVOLUTION.
 *
 * Runs in plain Node with the browser bits stubbed, loading the real game
 * modules through Vite's SSR loader so the TypeScript sources are exercised as
 * shipped (no duplicated logic in the test).
 *
 * Covers the four areas that were reworked:
 *   1. the 100-level campaign: ids, objectives, time limits, difficulty ramp
 *      and agreement with the server's campaign table;
 *   2. the logarithmic completion-bonus curve (increasing, diminishing steps);
 *   3. the save file: lifetime totals, journeys and the new-journey reset that
 *      keeps lifetime points and achievements;
 *   4. the finger controller: relative drag, dead zone, swipe-up jump, release
 *      (no stuck movement), multi-touch and keyboard fallback.
 *
 * Usage: npm test
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

/* ------------------------- browser stubs ------------------------- */

const windowListeners = new Map();

globalThis.window = globalThis;
globalThis.addEventListener = (type, fn) => {
  if (!windowListeners.has(type)) windowListeners.set(type, []);
  windowListeners.get(type).push(fn);
};
globalThis.removeEventListener = (type, fn) => {
  const list = windowListeners.get(type);
  if (!list) return;
  const index = list.indexOf(fn);
  if (index >= 0) list.splice(index, 1);
};
globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
  };
})();

function fireWindow(type, event) {
  for (const fn of windowListeners.get(type) ?? []) fn(event);
}

/** Minimal stand-in for the touch pad element. */
function fakePad(width = 360) {
  const handlers = new Map();
  return {
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = handlers.get(type) ?? [];
      const index = list.indexOf(fn);
      if (index >= 0) list.splice(index, 1);
    },
    getBoundingClientRect: () => ({ width, height: 300, left: 0, top: 0, right: width, bottom: 300, x: 0, y: 0 }),
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
    fire(type, event) {
      for (const fn of handlers.get(type) ?? []) fn(event);
    },
    handlerCount: (type) => (handlers.get(type) ?? []).length,
  };
}

function pointer(x, y, pointerId = 1) {
  return { pointerId, pointerType: 'touch', button: 0, clientX: x, clientY: y, preventDefault() {} };
}

/* ----------------------------- harness ---------------------------- */

const vite = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

const { LEVELS, TOTAL_LEVELS, CHAPTERS, LAST_LEVEL, levelById } = await vite.ssrLoadModule(
  '/src/game/levels.ts',
);
const { levelBonus, bonusStep, bonusFormula, rewardRows } = await vite.ssrLoadModule(
  '/src/game/rewards.ts',
);
const progressMod = await vite.ssrLoadModule('/src/game/progress.ts');
const { InputController } = await vite.ssrLoadModule('/src/game/systems/InputController.ts');
const serverCampaign = await import('../server/campaign.js');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

/* ------------------------- 1. campaign --------------------------- */

check('campaign has 100 contiguous, distinct levels', () => {
  assert.equal(TOTAL_LEVELS, 100);
  assert.equal(LEVELS.length, 100);
  assert.equal(LAST_LEVEL, 100);
  assert.deepEqual(
    LEVELS.map((l) => l.id),
    Array.from({ length: 100 }, (_, i) => i + 1),
  );
  const signatures = new Set(
    LEVELS.map((l) => `${l.spawn.interval}|${l.spawn.speed}|${l.spawn.dangerBias}|${l.goal.kind}|${l.goal.target}`),
  );
  assert.ok(signatures.size > 60, `expected varied level tuning, got ${signatures.size} distinct setups`);
});

check('every level is winnable (objective reachable inside its time limit)', () => {
  for (const level of LEVELS) {
    assert.ok(level.timeLimit >= 55, `level ${level.id} is too short`);
    assert.ok(level.goal.target > 0, `level ${level.id} has no objective`);
    // Even at one qualifying object per second the target must be reachable.
    assert.ok(
      level.goal.target <= level.timeLimit,
      `level ${level.id} needs ${level.goal.target} in ${level.timeLimit}s`,
    );
    assert.ok(level.stars[0] > 0 && level.stars[0] < level.stars[1] && level.stars[1] < level.stars[2]);
  }
});

check('difficulty ramps from level 1 to level 100', () => {
  const first = levelById(1);
  const last = levelById(100);
  assert.ok(last.spawn.interval < first.spawn.interval, 'objects should fall more often');
  assert.ok(last.spawn.speed > first.spawn.speed, 'objects should fall faster');
  assert.ok(last.spawn.dangerBias > first.spawn.dangerBias, 'more danger later');
  assert.ok(last.spawn.maxDangers >= first.spawn.maxDangers);
});

check('campaign is organised into ten chapters of ten levels', () => {
  assert.equal(CHAPTERS.length, 10);
  for (const chapter of CHAPTERS) {
    assert.equal(chapter.levels.length, 10);
    for (const level of chapter.levels) assert.ok(level.world === chapter.world);
  }
  assert.deepEqual(
    CHAPTERS.flatMap((c) => c.levels.map((l) => l.id)),
    Array.from({ length: 100 }, (_, i) => i + 1),
  );
});

check('server campaign table matches the client', () => {
  assert.equal(serverCampaign.LAST_LEVEL, TOTAL_LEVELS);
  for (const level of LEVELS) {
    const mirrored = serverCampaign.LEVEL_MAP.get(level.id);
    assert.ok(mirrored, `server is missing level ${level.id}`);
    assert.equal(mirrored.bonus, level.bonus);
    assert.equal(mirrored.duration, level.timeLimit);
    assert.equal(mirrored.world, level.world);
  }
});

/* -------------------------- 2. rewards --------------------------- */

check('completion bonus grows logarithmically with diminishing steps', () => {
  assert.equal(levelById(7).bonus, levelBonus(7));
  let previousStep = Number.POSITIVE_INFINITY;
  for (let id = 1; id < TOTAL_LEVELS; id++) {
    assert.ok(levelBonus(id + 1) > levelBonus(id), `bonus must increase at level ${id + 1}`);
    // Integer rounding can wobble a single point; the trend must still fall.
    const step = bonusStep(id);
    assert.ok(step <= previousStep + 1, `increment must not grow (level ${id})`);
    previousStep = step;
  }
  assert.ok(bonusStep(1) > bonusStep(98), 'early levels must gain more than late levels');
  // Logarithmic, not linear: level 100 is worth a few times level 1, not 100x.
  const ratio = levelBonus(100) / levelBonus(1);
  assert.ok(ratio > 2 && ratio < 4, `level 100 / level 1 ratio was ${ratio.toFixed(2)}`);
  assert.match(bonusFormula(12), /log/i);
});

check('payout rows add up to the reported total', () => {
  const bonus = levelBonus(20);
  const total = 1200 + 300 + bonus + 250;
  const rows = rewardRows({
    score: 1200,
    digo: 300,
    bonus,
    achievementPoints: 250,
    total,
    lifetimePoints: total * 3,
  });
  const amount = (label) => {
    const row = rows.find((r) => r.label === label);
    assert.ok(row, `missing row: ${label}`);
    return Number(row.value.replace(/[^0-9.-]/g, ''));
  };
  const sum =
    amount('Level score') +
    amount('DIGO collected') +
    amount('Completion bonus') +
    amount('Achievement bonus');
  assert.equal(sum, total, 'the visible rows must add up to the total earned');
  assert.equal(amount('Total earned'), total);
  assert.equal(amount('Lifetime points'), total * 3);
});

/* -------------------------- 3. save file ------------------------- */

function victory(levelId, score = 5000) {
  const level = levelById(levelId);
  return {
    level: levelId,
    world: level.world,
    score,
    digo: 120,
    bonus: levelBonus(levelId),
    total: score + 120,
    elapsed: level.timeLimit,
    collected: { coin: 90, crate: 20, gem: 8, relic: 2 },
    hits: 0,
    dodged: 30,
    maxCombo: 12,
    victory: true,
    stars: 3,
    reason: 'goal',
  };
}

check('clearing all 100 levels completes the journey and keeps lifetime totals', () => {
  progressMod.loadProgress();
  let last = null;
  for (let id = 1; id <= 100; id++) {
    last = progressMod.recordRun(victory(id));
    assert.equal(last.campaignComplete, id === 100, `campaignComplete wrong at level ${id}`);
  }
  const progress = progressMod.getProgress();
  assert.equal(progress.unlocked, 100);
  assert.equal(last.cyclesCompleted, 1);
  assert.equal(progress.campaignComplete, true);
  assert.ok(last.lifetimePoints > 0);
  assert.equal(last.bonus, levelBonus(100));
  assert.ok(last.lifetimeBonus >= levelBonus(100));
  assert.equal(last.levelsCleared, 100);
});

check('starting a new journey restarts at level 1 without erasing lifetime progress', () => {
  const before = progressMod.getProgress();
  const points = before.lifetime.points;
  const digo = before.digo;
  const achievements = [...before.achievements];

  progressMod.startNewJourney();

  const after = progressMod.getProgress();
  assert.equal(after.unlocked, 1);
  assert.equal(after.cycle, 2);
  assert.equal(after.cyclesCompleted, 1);
  assert.equal(after.campaignComplete, false);
  assert.equal(after.lifetime.points, points, 'lifetime points must survive a new journey');
  assert.equal(after.digo, digo, 'collected DIGO must survive a new journey');
  assert.deepEqual(after.achievements, achievements, 'achievements must survive a new journey');
  assert.equal(Object.keys(after.levels).length, 0, 'current journey level records restart');
});

/* ------------------------- 4. gestures -------------------------- */

check('dragging moves DIGO relative to the finger, with no stuck movement', () => {
  const pad = fakePad(360);
  const input = new InputController({ getX: () => 0 });
  input.attachPad(pad);

  pad.fire('pointerdown', pointer(180, 220));
  assert.equal(input.holding, true, 'holding a finger should steer');

  pad.fire('pointermove', pointer(260, 220)); // +80px
  const right = input.targetX;
  assert.ok(right > 0.5, `dragging right should move right, got ${right}`);
  assert.ok(right <= 3.55, 'cannot leave the lane');

  pad.fire('pointermove', pointer(100, 220)); // -80px from the start
  assert.ok(input.targetX < -0.5, 'dragging left should move left');

  pad.fire('pointermove', pointer(184, 220)); // +4px: inside the dead zone
  assert.ok(input.targetX < -0.5, 'tiny jitter must not cancel a swipe');

  pad.fire('pointerup', pointer(184, 220));
  assert.equal(input.holding, false, 'release must stop steering');
  assert.equal(input.targetX, null, 'release must not leave a stale target');
  input.dispose();
});

check('swiping up jumps once per gesture', () => {
  const pad = fakePad(360);
  const input = new InputController({ getX: () => 1 });
  input.attachPad(pad);

  pad.fire('pointerdown', pointer(180, 260));
  pad.fire('pointermove', pointer(182, 200)); // 60px up
  assert.equal(input.consumeJump(), true, 'swipe up should queue a jump');
  assert.equal(input.consumeJump(), false, 'a gesture must not jump twice');

  pad.fire('pointermove', pointer(182, 150));
  assert.equal(input.consumeJump(), false, 'holding up should not repeat the jump');

  pad.fire('pointerup', pointer(182, 150));
  pad.fire('pointerdown', pointer(180, 260));
  pad.fire('pointermove', pointer(180, 190));
  assert.equal(input.consumeJump(), true, 'a new swipe should jump again');
  input.dispose();
});

check('multi-touch and cancellation are handled safely', () => {
  const pad = fakePad(360);
  const input = new InputController({ getX: () => 0 });
  input.attachPad(pad);

  pad.fire('pointerdown', pointer(180, 220, 1));
  pad.fire('pointerdown', pointer(40, 220, 2)); // second finger must be ignored
  pad.fire('pointermove', pointer(300, 220, 2));
  assert.equal(input.targetX, null, 'a stray second finger must not move DIGO');

  pad.fire('pointermove', pointer(260, 220, 1));
  const moved = input.targetX;
  assert.ok(moved > 0.5);

  pad.fire('pointercancel', pointer(260, 220, 1));
  assert.equal(input.holding, false);
  assert.equal(input.targetX, null);

  pad.fire('pointerdown', pointer(180, 220, 3));
  assert.equal(input.holding, true, 'a new touch after a cancel must work');
  pad.fire('pointerup', pointer(180, 220, 3));
  input.dispose();
  assert.equal(pad.handlerCount('pointerdown'), 0, 'dispose must detach listeners');
});

check('desktop keyboard still steers and jumps', () => {
  const pad = fakePad(360);
  const input = new InputController({ getX: () => 0 });
  input.attachPad(pad);

  fireWindow('keydown', { code: 'ArrowLeft', repeat: false, preventDefault() {} });
  assert.equal(input.direction, -1);
  fireWindow('keyup', { code: 'ArrowLeft' });
  assert.equal(input.direction, 0);
  fireWindow('keydown', { code: 'KeyD', repeat: false, preventDefault() {} });
  assert.equal(input.direction, 1);
  fireWindow('keyup', { code: 'KeyD' });
  assert.equal(input.direction, 0);
  fireWindow('keydown', { code: 'ArrowLeft', repeat: false, preventDefault() {} });
  fireWindow('keydown', { code: 'ArrowRight', repeat: false, preventDefault() {} });
  assert.equal(input.direction, 0, 'opposite keys cancel out');
  fireWindow('keyup', { code: 'ArrowLeft' });
  fireWindow('keyup', { code: 'ArrowRight' });

  fireWindow('keydown', { code: 'Space', repeat: false, preventDefault() {} });
  assert.equal(input.consumeJump(), true);

  input.dispose();
  fireWindow('keydown', { code: 'ArrowRight', repeat: false, preventDefault() {} });
  assert.equal(input.direction, 0, 'dispose must detach the keyboard');
});

check('gameplay screen exposes the gesture pad and no arrow buttons', () => {
  const screen = readFileSync(new URL('../src/ui/GameScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /control-pad/);
  assert.doesNotMatch(screen, /control-buttons/);
  assert.doesNotMatch(screen, /setDirection\(/);
});

/* ---------------------------- report ---------------------------- */

await vite.close();

const failed = results.filter((r) => !r.ok);
for (const result of results) {
  if (result.ok) console.log(`  ok   ${result.name}`);
  else console.log(`  FAIL ${result.name}\n       ${result.error?.message ?? result.error}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
