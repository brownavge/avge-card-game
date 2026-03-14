import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

  // Complete opening setup.
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');

  // Move to Player 1 turn 2 so attacking is allowed.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(160);
  await page.click('#end-turn-btn');
  await page.waitForTimeout(180);

  // Add Emily and a tool, then place Emily on bench and attach tool.
  await page.evaluate(() => {
    window.addPlaytestCard('character', 'EMILY_WANG');
    window.addPlaytestCard('tool', 'KIKI_HEADBAND');
  });
  await page.waitForTimeout(180);

  await page.locator('#hand-cards .card', { hasText: 'Emily Wang' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play to Bench/i }).first().click();
  await page.waitForTimeout(150);

  await page.locator('#hand-cards .card', { hasText: /Kiki.*Headband/i }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play Item/i }).first().click();
  await page.locator('#action-modal .target-option', { hasText: /Emily Wang/ }).first().click();
  await page.waitForTimeout(150);

  // Ensure active has enough energy to use a move.
  await page.evaluate(() => {
    window.attachEnergy('active');
    window.attachEnergy('active');
    window.attachEnergy('active');
  });
  await page.waitForTimeout(120);

  // Attack with active (not Emily) and verify Profit Margins prompt appears.
  await page.click('#toolbar-attack-btn');
  await page.waitForTimeout(100);
  await page.locator('#action-modal .action-btn').first().click();
  await page.waitForTimeout(100);
  if (await page.locator('#action-modal .target-option').count()) {
    await page.locator('#action-modal .target-option').first().click();
  }

  await page.waitForTimeout(250);
  const modalState = await page.evaluate(() => {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    return {
      visible: !!(modal && !modal.classList.contains('hidden')),
      text: content ? content.textContent || '' : ''
    };
  });

  assert(modalState.visible, 'Expected Profit Margins modal to be visible before attack.');
  assert(modalState.text.includes('Profit Margins'), `Expected Profit Margins text in modal, got: ${modalState.text.slice(0, 160)}`);

  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('Profit Margins regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
