import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clickSetupChoiceOrFallback(column, preferredText) {
  const preferred = column.locator('.setup-guide__choice', { hasText: preferredText });
  if (await preferred.count()) {
    await preferred.first().click();
    return;
  }
  await column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
}

async function playHandCardByName(page, cardName, actionTextRegex) {
  await page.locator('#hand-cards .card', { hasText: cardName }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: actionTextRegex }).first().click();
  await page.waitForTimeout(120);
}

async function runDomainExpansion(page) {
  await page.locator('.active-slot[data-player="1"] .card').first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Attack/i }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#action-modal .action-btn', { hasText: 'Domain Expansion' }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#action-modal .target-option.action-btn').first().click();
  await page.waitForTimeout(300);
}

async function getBenchDamageByName(page, playerNum, name) {
  return await page.evaluate(({ targetPlayer, targetName }) => {
    const state = JSON.parse(window.render_game_to_text());
    const player = state.players.find((p) => p.player === targetPlayer);
    if (!player) return null;
    const match = (player.bench || []).find((c) => c && c.name === targetName);
    return match ? Number(match.damage || 0) : null;
  }, { targetPlayer: playerNum, targetName: name });
}

async function getState(page) {
  return await page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');

  await page.evaluate(() => {
    window.addPlaytestCard('character', 'OWEN_LANDRY');
  });
  await page.waitForTimeout(120);

  const p1Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' });
  const p2Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' });

  await clickSetupChoiceOrFallback(p1Column, 'Active: Owen Landry');
  await page.waitForTimeout(100);
  await p1Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await p2Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(100);
  await p2Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');
  {
    const state = await getState(page);
    const p1 = state.players.find((p) => p.player === 1);
    assert(p1?.active?.name === 'Owen Landry', `Expected Player 1 active Owen Landry, got ${p1?.active?.name || 'none'}`);
  }

  // Configure opponent bench target on Player 2 turn.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(180);

  await page.evaluate(() => {
    window.addPlaytestCard('character', 'FILIP_KAMINSKI');
  });
  await page.waitForTimeout(100);
  await playHandCardByName(page, 'Filip Kaminski', /Play to Bench/i);
  {
    const state = await getState(page);
    const p2 = state.players.find((p) => p.player === 2);
    const filipBench = (p2?.bench || []).find((c) => c && c.name === 'Filip Kaminski');
    assert(!!filipBench, 'Expected Filip Kaminski to be on Player 2 bench before baseline attack.');
  }

  // Back to Player 1 for baseline attack.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(220);

  await page.evaluate(() => {
    window.attachEnergy('active');
    window.attachEnergy('active');
    window.attachEnergy('active');
  });
  await page.waitForTimeout(120);

  const beforeBaseline = await getBenchDamageByName(page, 2, 'Filip Kaminski');
  {
    const state = await getState(page);
    const p1 = state.players.find((p) => p.player === 1);
    assert(p1?.active?.name === 'Owen Landry', `Expected Owen active before baseline attack, got ${p1?.active?.name || 'none'}`);
  }
  await runDomainExpansion(page);
  const afterBaseline = await getBenchDamageByName(page, 2, 'Filip Kaminski');

  assert(beforeBaseline !== null && afterBaseline !== null, 'Could not read baseline Filip damage from bench state.');
  const baselineDelta = afterBaseline - beforeBaseline;
  if (!(baselineDelta > 0)) {
    const state = await getState(page);
    throw new Error(`Expected baseline Domain Expansion to damage bench target, got delta=${baselineDelta}. Last log: ${(state.lastLog || []).join(' | ')}`);
  }

  // End Player 2 turn quickly.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(200);

  // Second Player 1 attack with Folding Stand.
  await page.evaluate(() => {
    window.addPlaytestCard('item', 'FOLDING_STAND');
  });
  await page.waitForTimeout(100);
  await playHandCardByName(page, 'Folding Stand', /Play Item/i);

  await page.evaluate(() => {
    window.attachEnergy('active');
    window.attachEnergy('active');
    window.attachEnergy('active');
  });
  await page.waitForTimeout(120);

  const beforeBuffed = await getBenchDamageByName(page, 2, 'Filip Kaminski');
  await runDomainExpansion(page);
  const afterBuffed = await getBenchDamageByName(page, 2, 'Filip Kaminski');

  assert(beforeBuffed !== null && afterBuffed !== null, 'Could not read buffed Filip damage from bench state.');
  const buffedDelta = afterBuffed - beforeBuffed;
  assert(
    buffedDelta === baselineDelta + 10,
    `Expected Folding Stand to add +10 to bench damage. Baseline=${baselineDelta}, buffed=${buffedDelta}`
  );

  assert(pageErrors.length === 0, `Page errors:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Folding Stand bench modifier test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
