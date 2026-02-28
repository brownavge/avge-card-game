import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function waitForLocalPlayer(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readState(page);
    const local = Number(state.localPlayer);
    if (local === 1 || local === 2) return local;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for local player assignment.');
}

async function waitForMainPhase(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readState(page);
    if (state.phase === 'main') return;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for main phase.');
}

async function completeOpeningSetup(page) {
  for (let i = 0; i < 5; i += 1) {
    const state = await readState(page);
    const local = Number(state.localPlayer);
    const pendingKey = local === 2 ? 'p2' : 'p1';
    if (state.setupPending && state.setupPending[pendingKey] === false) return;

    const activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
    if (await activeChoices.count()) {
      await activeChoices.first().click();
      await page.waitForTimeout(140);
    }

    const confirmChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: /Confirm Setup|Ready/ });
    if (await confirmChoices.count()) {
      await confirmChoices.first().click();
      await page.waitForTimeout(180);
    }
  }

  const finalState = await readState(page);
  const local = Number(finalState.localPlayer);
  const pendingKey = local === 2 ? 'p2' : 'p1';
  throw new Error(`Failed to complete setup for Player ${local}. setupPending=${JSON.stringify(finalState.setupPending)} key=${pendingKey}`);
}

async function waitForCurrentPlayer(p1, p2, expected, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [s1, s2] = await Promise.all([readState(p1), readState(p2)]);
    if (Number(s1.currentPlayer) === expected && Number(s2.currentPlayer) === expected) return;
    await p1.waitForTimeout(150);
  }
  throw new Error(`Timed out waiting for currentPlayer=${expected} on both clients.`);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const c1 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const c2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();
  const errors = [];

  p1.on('pageerror', (err) => errors.push(`p1:${String(err)}`));
  p2.on('pageerror', (err) => errors.push(`p2:${String(err)}`));

  const room = `9${Math.floor(Math.random() * 900 + 100)}`;

  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);

  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.check('#playtest-mode-toggle'), p2.check('#playtest-mode-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);

  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');

  await Promise.all([
    p1.waitForSelector('#game-container:not(.hidden)'),
    p2.waitForSelector('#game-container:not(.hidden)')
  ]);

  const [lp1, lp2] = await Promise.all([waitForLocalPlayer(p1), waitForLocalPlayer(p2)]);
  assert(lp1 !== lp2, `Expected different local players, got ${lp1} and ${lp2}`);

  await completeOpeningSetup(p1);
  await completeOpeningSetup(p2);
  await Promise.all([waitForMainPhase(p1), waitForMainPhase(p2)]);

  const state = await readState(p1);
  const firstTurn = Number(state.currentPlayer);
  const secondTurn = firstTurn === 1 ? 2 : 1;

  const firstActor = lp1 === firstTurn ? p1 : p2;

  assert(!(await firstActor.locator('#end-turn-btn').isDisabled()), 'First actor end turn should be enabled.');
  await firstActor.click('#end-turn-btn');
  await waitForCurrentPlayer(p1, p2, secondTurn);

  assert(errors.length === 0, `Page errors detected:\n${errors.join('\n')}`);

  await browser.close();
  console.log('Basic multiplayer game flow test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
