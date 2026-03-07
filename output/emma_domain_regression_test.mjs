import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

function normalizeState(raw) {
  return {
    phase: raw.phase,
    turn: raw.turn,
    currentPlayer: raw.currentPlayer,
    setupPending: raw.setupPending,
    p1: {
      deck: raw.players?.[0]?.deck,
      hand: raw.players?.[0]?.hand,
      discard: raw.players?.[0]?.discard,
      ko: raw.players?.[0]?.ko,
      active: raw.players?.[0]?.active ? {
        id: raw.players[0].active.id,
        name: raw.players[0].active.name,
        damage: raw.players[0].active.damage,
        attachedEnergy: raw.players[0].active.attachedEnergy
      } : null,
      bench: (raw.players?.[0]?.bench || []).map((b) => b ? ({ id: b.id, name: b.name, damage: b.damage, attachedEnergy: b.attachedEnergy }) : null)
    },
    p2: {
      deck: raw.players?.[1]?.deck,
      hand: raw.players?.[1]?.hand,
      discard: raw.players?.[1]?.discard,
      ko: raw.players?.[1]?.ko,
      active: raw.players?.[1]?.active ? {
        id: raw.players[1].active.id,
        name: raw.players[1].active.name,
        damage: raw.players[1].active.damage,
        attachedEnergy: raw.players[1].active.attachedEnergy
      } : null,
      bench: (raw.players?.[1]?.bench || []).map((b) => b ? ({ id: b.id, name: b.name, damage: b.damage, attachedEnergy: b.attachedEnergy }) : null)
    }
  };
}

async function waitForLocalPlayer(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readState(page);
    const localPlayer = Number(state.localPlayer);
    if (localPlayer === 1 || localPlayer === 2) return localPlayer;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for multiplayer local player assignment.');
}

async function waitForMainPhase(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshot = await readState(page);
    if (snapshot.phase === 'main') return;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for main phase.');
}

async function chooseActiveAndConfirm(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await readState(page);
    const localPlayer = Number(state.localPlayer);
    const pendingKey = localPlayer === 2 ? 'p2' : 'p1';
    if (state.setupPending && state.setupPending[pendingKey] === false) return;

    const activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
    if (await activeChoices.count()) {
      await activeChoices.first().click();
      await page.waitForTimeout(100);
    }

    const confirmButtons = page.locator('#setup-guide .setup-guide__choice', { hasText: /Confirm Setup|Ready/ });
    if (await confirmButtons.count()) {
      await confirmButtons.first().click();
      await page.waitForTimeout(120);
    }

    await page.evaluate(() => {
      const s = JSON.parse(window.render_game_to_text());
      const lp = Number(s.localPlayer);
      if (lp === 1 || lp === 2) window.setOpeningReady(lp);
    });
    await page.waitForTimeout(220);
  }

  const finalState = await readState(page);
  throw new Error(`Failed to confirm setup for local player ${finalState.localPlayer}`);
}

async function playerPage(p1, p2, playerNum) {
  const s1 = await readState(p1);
  const s2 = await readState(p2);
  if (Number(s1.localPlayer) === playerNum) return p1;
  if (Number(s2.localPlayer) === playerNum) return p2;
  throw new Error(`Could not resolve page for player ${playerNum}`);
}

async function assertSynced(p1, p2, label) {
  await p1.waitForTimeout(350);
  const a = JSON.stringify(normalizeState(await readState(p1)));
  const b = JSON.stringify(normalizeState(await readState(p2)));
  assert(a === b, `${label}: client states diverged\nP1=${a}\nP2=${b}`);
}

async function runEmmaMultiplayer() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx1 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();
  const pageErrors = [];
  p1.on('pageerror', (err) => pageErrors.push(`p1:${String(err)}`));
  p2.on('pageerror', (err) => pageErrors.push(`p2:${String(err)}`));

  await p1.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });
  await p2.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });

  const room = `7${Math.floor(Math.random() * 900 + 100)}`;
  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);
  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.check('#playtest-mode-toggle'), p2.check('#playtest-mode-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);
  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');
  await Promise.all([p1.waitForSelector('#game-container:not(.hidden)'), p2.waitForSelector('#game-container:not(.hidden)')]);
  await Promise.all([waitForLocalPlayer(p1), waitForLocalPlayer(p2)]);
  await chooseActiveAndConfirm(p1);
  await chooseActiveAndConfirm(p2);
  await Promise.all([waitForMainPhase(p1), waitForMainPhase(p2)]);

  const p1Page = await playerPage(p1, p2, 1);
  const p2Page = await playerPage(p1, p2, 2);

  // Put one bench character on Player 2 so Emma has a valid target.
  await p1Page.click('#end-turn-btn');
  await p1Page.waitForTimeout(300);
  await p2Page.evaluate(() => window.addPlaytestCard('character', 'DAVID_MAN'));
  await p2Page.waitForTimeout(120);
  await p2Page.locator('#hand-cards .card', { hasText: 'David Man' }).first().click();
  await p2Page.locator('#action-modal .action-btn', { hasText: /Play to Bench|Play to Active/i }).first().click();
  await p2Page.waitForTimeout(180);
  await p2Page.click('#end-turn-btn');
  await p2Page.waitForTimeout(300);

  // Emma should open chooser modal for the user (P1), not opponent.
  await p1Page.evaluate(() => window.addPlaytestCard('supporter', 'EMMA'));
  await p1Page.waitForTimeout(120);
  await p1Page.locator('#hand-cards .card', { hasText: 'Emma' }).first().click();
  await p1Page.locator('#action-modal .action-btn', { hasText: /Play Supporter/i }).first().click();
  await p1Page.waitForTimeout(220);

  const p1EmmaOptions = await p1Page.locator('#action-modal .target-option').count();
  assert(p1EmmaOptions >= 1, `Expected Emma options for player using Emma, found ${p1EmmaOptions}`);

  const p2ModalVisible = await p2Page.evaluate(() => {
    const modal = document.getElementById('action-modal');
    return modal ? !modal.classList.contains('hidden') : false;
  });
  assert(!p2ModalVisible, 'Opponent client should not receive Emma chooser modal.');

  await p1Page.locator('#action-modal .target-option').first().click();
  await assertSynced(p1, p2, 'after Emma switch selection');

  assert(pageErrors.length === 0, `Page errors during Emma test:\n${pageErrors.join('\n')}`);
  await browser.close();
}

async function runDomainSinglePlayer() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');

  const p1Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' });
  const p2Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' });
  await page.evaluate(() => window.addPlaytestCard('character', 'OWEN_LANDRY'));
  await page.waitForTimeout(140);

  if (await p1Column.locator('.setup-guide__choice', { hasText: 'Active: Owen Landry' }).count()) {
    await p1Column.locator('.setup-guide__choice', { hasText: 'Active: Owen Landry' }).first().click();
  } else {
    await p1Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  }
  await p2Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p1Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await p2Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');

  // Add a benched opponent for all-opponents damage coverage.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.addPlaytestCard('character', 'DAVID_MAN'));
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'David Man' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play to Bench|Play to Active/i }).first().click();
  await page.waitForTimeout(180);
  await page.click('#end-turn-btn');
  await page.waitForTimeout(220);

  const before = await readState(page);
  assert(before.players?.[0]?.active?.name === 'Owen Landry', `Expected Owen Landry active for test, got ${before.players?.[0]?.active?.name || 'none'}`);
  const p1Before = {
    active: before.players?.[0]?.active?.damage || 0,
    bench: (before.players?.[0]?.bench || []).map((c) => c ? c.damage || 0 : null)
  };
  const p2BeforeTotal = (before.players?.[1]?.active?.damage || 0) + (before.players?.[1]?.bench || []).reduce((s, c) => s + (c ? c.damage || 0 : 0), 0);

  const attackerId = before.players?.[0]?.active?.id;
  const targetId = before.players?.[1]?.active?.id;
  assert(attackerId && targetId, 'Expected active attacker and target for Domain Expansion test.');

  await page.evaluate(({ attackerId, targetId }) => {
    window.executeAttack(attackerId, 'Domain Expansion', targetId);
  }, { attackerId, targetId });
  await page.waitForTimeout(280);

  const after = await readState(page);
  const p1After = {
    active: after.players?.[0]?.active?.damage || 0,
    bench: (after.players?.[0]?.bench || []).map((c) => c ? c.damage || 0 : null)
  };
  const p2AfterTotal = (after.players?.[1]?.active?.damage || 0) + (after.players?.[1]?.bench || []).reduce((s, c) => s + (c ? c.damage || 0 : 0), 0);

  assert(JSON.stringify(p1After) === JSON.stringify(p1Before), `Domain Expansion should not damage own side. before=${JSON.stringify(p1Before)} after=${JSON.stringify(p1After)}`);
  assert(p2AfterTotal > p2BeforeTotal, `Domain Expansion should damage opponent side. before=${p2BeforeTotal} after=${p2AfterTotal}`);

  assert(pageErrors.length === 0, `Page errors during Domain Expansion test:\n${pageErrors.join('\n')}`);
  await browser.close();
}

async function run() {
  await runEmmaMultiplayer();
  await runDomainSinglePlayer();
  console.log('Emma + Domain Expansion regression tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
