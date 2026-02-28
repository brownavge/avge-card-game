import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');

  // Complete opening setup for both players.
  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' })
    .locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(120);
  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' })
    .locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' })
    .locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(120);
  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' })
    .locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');

  // Add and play Michelle (modal supporter flow).
  await page.evaluate(() => {
    window.addPlaytestCard('supporter', 'MICHELLE');
  });
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'Michelle' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: 'Play Supporter' }).first().click();
  await page.waitForTimeout(200);

  // Resolve Michelle discard prompt with the exact required number.
  const modalText = await page.locator('#action-content').innerText();
  const requiredMatch = modalText.match(/Selected:\s*\d+\s*\/\s*(\d+)/i);
  const requiredCount = requiredMatch ? Number(requiredMatch[1]) : 0;
  const targetCount = await page.locator('#action-modal .target-option').count();
  const toSelect = Math.min(targetCount, requiredCount);
  for (let i = 0; i < toSelect; i += 1) {
    await page.locator('#action-modal .target-option').nth(i).click();
  }
  await page.locator('#action-modal .action-btn', { hasText: 'Confirm Discard' }).first().click();
  await page.waitForTimeout(200);

  const supporterStatus = await page.locator('#supporter-status').innerText();
  assert(supporterStatus.trim() === 'Yes', `Expected supporter status Yes after playing Michelle, got "${supporterStatus}"`);

  // Try adding a second supporter and ensure play is blocked this turn.
  await page.evaluate(() => {
    window.addPlaytestCard('supporter', 'WILL');
  });
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'Will' }).first().click();

  const alreadyPlayedMsg = await page.locator('#action-content').innerText();
  assert(alreadyPlayedMsg.includes('Already played a Supporter this turn'), 'Expected second supporter to be blocked.');

  await browser.close();
  console.log('Supporter limit regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
