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

async function maybePickTarget(page) {
  await page.waitForTimeout(120);
  const targetCount = await page.locator('#action-modal .target-option').count();
  if (targetCount > 0) {
    await page.locator('#action-modal .target-option').first().click();
  }
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

  // Move to Player 1 turn 2.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(160);
  await page.click('#end-turn-btn');
  await page.waitForTimeout(160);

  // Setup Arranger + discard cards for both Arranger triggers:
  // - Matcha Latte (item) in discard for on-damage shuffle.
  // - Standard Musescore File in discard for KO retrieval.
  await page.evaluate(() => {
    window.addPlaytestCard('tool', 'MUSESCORE_SUB');
    window.addPlaytestCard('item', 'MATCHA_LATTE');
    window.addPlaytestCard('item', 'MUSESCORE_FILE');
  });
  await page.waitForTimeout(180);

  await page.locator('#hand-cards .card', { hasText: 'Matcha Latte' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play Item/i }).first().click();
  await page.waitForTimeout(160);

  await page.locator('#hand-cards .card', { hasText: 'Musescore Subscription' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play Item/i }).first().click();
  await page.locator('#action-modal .target-option').first().click(); // attach to active
  await page.waitForTimeout(160);

  await page.locator('#hand-cards .card', { hasText: 'Standard Musescore File' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play Item/i }).first().click();
  await page.waitForTimeout(180);

  // Opponent attacks to trigger Arranger on-damage discard selection.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(180);
  await page.evaluate(() => {
    window.attachEnergy('active');
    window.attachEnergy('active');
    window.attachEnergy('active');
  });
  await page.waitForTimeout(100);
  await page.click('#toolbar-attack-btn');
  await page.waitForTimeout(100);
  await page.locator('#action-modal .action-btn').first().click();
  await maybePickTarget(page);
  await page.waitForTimeout(220);

  const arrangerModalText = await page.locator('#action-content').innerText();
  assert(
    /Select from Discard Pile/i.test(arrangerModalText) && /item/i.test(arrangerModalText),
    `Expected Arranger on-damage discard selection modal, got: ${arrangerModalText.slice(0, 220)}`
  );

  // Choose and confirm shuffle-back item.
  await page.locator('#action-modal .target-option', { hasText: 'Matcha Latte' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Confirm Selection/i }).first().click();
  await page.waitForTimeout(220);

  // Continue turns until KO retrieval modal appears (Arranger on KO).
  let sawMusescoreRetrieval = false;
  for (let step = 0; step < 16 && !sawMusescoreRetrieval; step += 1) {
    const state = await readState(page);
    const currentPlayer = Number(state.currentPlayer);
    if (currentPlayer === 1) {
      await page.click('#end-turn-btn');
      await page.waitForTimeout(170);
      continue;
    }

    await page.evaluate(() => {
      window.attachEnergy('active');
      window.attachEnergy('active');
      window.attachEnergy('active');
    });
    await page.waitForTimeout(100);
    await page.click('#toolbar-attack-btn');
    await page.waitForTimeout(100);
    await page.locator('#action-modal .action-btn').first().click();
    await maybePickTarget(page);
    await page.waitForTimeout(220);

    const modalText = await page.locator('#action-content').innerText();
    if (/Select from Discard Pile/i.test(modalText) && /Musescore File/i.test(modalText)) {
      sawMusescoreRetrieval = true;
      await page.locator('#action-modal .target-option').first().click();
      await page.locator('#action-modal .action-btn', { hasText: /Confirm Selection/i }).first().click();
      await page.waitForTimeout(180);
      break;
    }
  }

  assert(sawMusescoreRetrieval, 'Did not observe Arranger KO musescore retrieval modal within expected turn window.');
  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Arranger status verification test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
