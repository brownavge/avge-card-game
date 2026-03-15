import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function completeOpeningSetup(page) {
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(80);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(80);
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForTimeout(80);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.addInitScript(() => {
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');
  await completeOpeningSetup(page);

  // Player 1 plays Riley Hall.
  await page.evaluate(() => window.addPlaytestCard('stadium', 'RILEY_HALL'));
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'Riley Hall' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play Stadium/i }).first().click();
  await page.waitForTimeout(160);

  const afterP1Stadium = await readState(page);
  assert(afterP1Stadium.stadium && afterP1Stadium.stadium.name === 'Riley Hall', `Expected Riley Hall in play, got ${JSON.stringify(afterP1Stadium.stadium)}`);
  const p1DiscardBeforeRemoval = Number(afterP1Stadium.players?.[0]?.discard || 0);

  // Pass turn to Player 2.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(180);

  // Player 2 uses BAI Email to remove stadium.
  await page.evaluate(() => window.addPlaytestCard('item', 'BAI_EMAIL'));
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'BAI Email' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play Item/i }).first().click();
  await page.waitForTimeout(200);

  const afterBAI = await readState(page);
  const p1DiscardAfterRemoval = Number(afterBAI.players?.[0]?.discard || 0);
  assert(!afterBAI.stadium, `Expected no stadium in play after BAI Email, got ${JSON.stringify(afterBAI.stadium)}`);
  assert(
    p1DiscardAfterRemoval === p1DiscardBeforeRemoval + 1,
    `Expected removed stadium to go to Player 1 discard. Before=${p1DiscardBeforeRemoval}, After=${p1DiscardAfterRemoval}`
  );

  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('Stadium owner discard regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
