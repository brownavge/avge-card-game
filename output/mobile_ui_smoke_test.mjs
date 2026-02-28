import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  assert(pageErrors.length === 0, `Page errors on mobile load: ${pageErrors.join('\n')}`);

  await page.screenshot({ path: 'output/mobile-ui-start.png', fullPage: true });

  await page.click('#start-game-btn');
  await page.waitForTimeout(350);

  const setupVisible = await page.locator('#setup-guide').evaluate((el) => !el.classList.contains('hidden'));
  assert(setupVisible, 'Setup guide should be visible on mobile after starting game.');

  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(150);
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForTimeout(120);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForTimeout(350);

  const toolbarVisible = await page.locator('#game-toolbar').isVisible();
  assert(toolbarVisible, 'Toolbar should be visible on mobile.');

  const handCards = page.locator('#hand-cards .hand-card-wrapper');
  const handCount = await handCards.count();
  assert(handCount >= 1, 'Expected hand cards on mobile after setup.');

  await handCards.first().click();
  await page.waitForTimeout(200);
  const inspectorDisplay = await page.locator('#selection-inspector').evaluate((el) => window.getComputedStyle(el).display);
  assert(inspectorDisplay === 'none', `Selection inspector should stay hidden on mobile, got ${inspectorDisplay}`);
  await page.locator('#action-modal .close-modal').click();
  await page.waitForTimeout(120);

  const logBeforeToggle = await page.locator('#game-container').evaluate((el) => el.classList.contains('game-log-collapsed'));
  await page.locator('#toggle-log-btn').click();
  await page.waitForTimeout(150);
  const logAfterToggle = await page.locator('#game-container').evaluate((el) => el.classList.contains('game-log-collapsed'));
  assert(logAfterToggle !== logBeforeToggle, 'Mobile log toggle should change log visibility state.');

  await page.screenshot({ path: 'output/mobile-ui-game.png', fullPage: true });
  await browser.close();
  console.log('Mobile UI smoke test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
