import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
        name: raw.players[0].active.name,
        damage: raw.players[0].active.damage,
        attachedEnergy: raw.players[0].active.attachedEnergy
      } : null,
      bench: (raw.players?.[0]?.bench || []).map((b) => b ? ({ name: b.name, damage: b.damage, attachedEnergy: b.attachedEnergy }) : null)
    },
    p2: {
      deck: raw.players?.[1]?.deck,
      hand: raw.players?.[1]?.hand,
      discard: raw.players?.[1]?.discard,
      ko: raw.players?.[1]?.ko,
      active: raw.players?.[1]?.active ? {
        name: raw.players[1].active.name,
        damage: raw.players[1].active.damage,
        attachedEnergy: raw.players[1].active.attachedEnergy
      } : null,
      bench: (raw.players?.[1]?.bench || []).map((b) => b ? ({ name: b.name, damage: b.damage, attachedEnergy: b.attachedEnergy }) : null)
    },
    stadium: raw.stadium ? raw.stadium.name : null
  };
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
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
    const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const phase = snapshot.phase;
    if (phase === 'main') return;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for main phase.');
}

async function assertSynced(p1, p2, label) {
  await p1.waitForTimeout(400);
  const s1 = normalizeState(await readState(p1));
  const s2 = normalizeState(await readState(p2));
  const j1 = JSON.stringify(s1);
  const j2 = JSON.stringify(s2);
  assert(j1 === j2, `${label}: client states diverged\nP1=${j1}\nP2=${j2}`);
}

async function chooseActiveAndConfirm(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await readState(page);
    const localPlayer = Number(state.localPlayer);
    const pendingKey = localPlayer === 2 ? 'p2' : 'p1';
    if (state.setupPending && state.setupPending[pendingKey] === false) return;

    let activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
    let choiceCount = await activeChoices.count();
    if (choiceCount === 0) {
      await page.evaluate(() => {
        const fallbacks = ['EMILY_WANG', 'KATIE_XIANG', 'LUKE_XU', 'ROSS_WILLIAMS'];
        for (const key of fallbacks) window.addPlaytestCard('character', key);
        if (typeof window.updateUI === 'function') window.updateUI();
      });
      await page.waitForTimeout(200);
      activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
      choiceCount = await activeChoices.count();
    }
    if (choiceCount > 0) {
      await activeChoices.first().click();
      await page.waitForTimeout(120);
    }

    const confirmButtons = page.locator('#setup-guide .setup-guide__choice', { hasText: /Confirm Setup|Ready/ });
    if (await confirmButtons.count()) {
      await confirmButtons.first().click();
      await page.waitForTimeout(120);
    }

    await page.evaluate(() => {
      const s = JSON.parse(window.render_game_to_text());
      const localPlayer = Number(s.localPlayer);
      if (localPlayer === 1 || localPlayer === 2) window.setOpeningReady(localPlayer);
    });
    await page.waitForTimeout(220);
  }

  const finalState = await readState(page);
  throw new Error(`Failed to confirm setup for local player ${finalState.localPlayer}: ${JSON.stringify(finalState.setupPending)}`);
}

async function playerPage(p1, p2, playerNum) {
  const p1State = await readState(p1);
  const p2State = await readState(p2);
  if (Number(p1State.localPlayer) === playerNum) return p1;
  if (Number(p2State.localPlayer) === playerNum) return p2;
  throw new Error(`Could not resolve page for player ${playerNum}`);
}

async function playPrintedScore(page) {
  await page.evaluate(() => window.addPlaytestCard('item', 'PRINTED_SCORE'));
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'Printed Score' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: 'Play Item' }).first().click();
  await page.waitForTimeout(220);
  const options = page.locator('#action-modal .target-option');
  assert(await options.count() >= 1, 'Printed Score: expected at least one target option.');
  await options.first().click();
  await page.locator('#action-modal .action-btn', { hasText: 'Confirm' }).first().click();
}

async function playAnnotatedScore(page) {
  await page.evaluate(() => window.addPlaytestCard('item', 'ANNOTATED_SCORE'));
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'Annotated Score' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: 'Play Item' }).first().click();
  await page.waitForTimeout(220);

  const options = page.locator('#action-modal .target-option');
  const count = await options.count();
  assert(count >= 2, `Annotated Score: expected at least 2 target options, found ${count}`);
  await options.nth(0).click();
  await options.nth(1).click();
  await page.locator('#action-modal .action-btn', { hasText: 'Confirm' }).first().click();
}

async function run() {
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
  await Promise.all([p1.waitForSelector('#game-container:not(.hidden)'), p2.waitForSelector('#game-container:not(.hidden)')]);
  await Promise.all([waitForLocalPlayer(p1), waitForLocalPlayer(p2)]);

  await chooseActiveAndConfirm(p1);
  await chooseActiveAndConfirm(p2);
  const preMainP1 = await readState(p1);
  const preMainP2 = await readState(p2);
  console.log('pre-main p1', JSON.stringify({ phase: preMainP1.phase, setupPending: preMainP1.setupPending, localPlayer: preMainP1.localPlayer }));
  console.log('pre-main p2', JSON.stringify({ phase: preMainP2.phase, setupPending: preMainP2.setupPending, localPlayer: preMainP2.localPlayer }));
  await Promise.all([waitForMainPhase(p1), waitForMainPhase(p2)]);
  await assertSynced(p1, p2, 'after setup');

  const p1Page = await playerPage(p1, p2, 1);
  const p2Page = await playerPage(p1, p2, 2);

  // Player 1 turn item sync checks.
  await playPrintedScore(p1Page);
  await assertSynced(p1, p2, 'after p1 Printed Score');
  await playAnnotatedScore(p1Page);
  await assertSynced(p1, p2, 'after p1 Annotated Score');

  // Pass turn to player 2.
  await p1Page.click('#end-turn-btn');
  await p1.waitForTimeout(500);
  await assertSynced(p1, p2, 'after end turn to p2');

  // Player 2 turn same checks.
  await playPrintedScore(p2Page);
  await assertSynced(p1, p2, 'after p2 Printed Score');
  await playAnnotatedScore(p2Page);
  await assertSynced(p1, p2, 'after p2 Annotated Score');

  // Generic discard-choice modal sync check (root cause for "select exactly N cards" desync).
  await p1Page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text());
    const opponentNum = Number(state.currentPlayer) === 1 ? 2 : 1;
    window.showOpponentDiscardChoice(opponentNum, 2, null, { logMessage: 'sync-test discard choice' });
  });
  await p1.waitForTimeout(250);
  const p2DiscardOptions = p2Page.locator('#action-modal .target-option');
  const optionCount = await p2DiscardOptions.count();
  assert(optionCount >= 2, `Discard sync test: expected at least 2 options, found ${optionCount}`);
  await p2DiscardOptions.nth(0).click();
  await p2DiscardOptions.nth(1).click();
  await p2Page.locator('#action-modal .action-btn', { hasText: 'Confirm Discard' }).first().click();
  await assertSynced(p1, p2, 'after opponent discard choice (2 cards)');

  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Multiplayer item sync test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
