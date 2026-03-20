import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
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

  await page.evaluate(() => window.addPlaytestCard('item', 'BAI_EMAIL'));
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'BAI Email' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play Item/i }).first().click();
  await page.waitForTimeout(150);

  const options = page.locator('#action-modal .target-option');
  const optionCount = await options.count();
  assert(optionCount > 0, 'Expected at least one stadium choice for BAI Email search.');

  const chosenName = (await options.first().innerText()).trim();
  assert(chosenName.length > 0, 'Expected non-empty stadium choice label.');
  await options.first().click();
  await page.waitForTimeout(180);

  const handText = await page.locator('#hand-cards').innerText();
  assert(handText.includes(chosenName), `Expected chosen stadium "${chosenName}" to be in hand.`);
  assert(!handText.includes('BAI Email'), 'Expected BAI Email to be consumed after resolving search.');

  const state = await readState(page);
  assert(state.stadium === null, 'BAI Email search should not put a stadium directly into play.');

  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('BAI Email choice test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
