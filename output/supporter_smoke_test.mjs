import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const supporterKeys = [
  'JOHANN',
  'RICHARD',
  'MICHELLE',
  'WILL',
  'LUCAS',
  'ANGEL',
  'LIO',
  'EMMA',
  'VICTORIA'
];

const keyToName = {
  JOHANN: 'Johann',
  RICHARD: 'Richard',
  MICHELLE: 'Michelle',
  WILL: 'Will',
  LUCAS: 'Lucas',
  ANGEL: 'Angel',
  LIO: 'Lio',
  EMMA: 'Emma',
  VICTORIA: 'Victoria Chen'
};

async function completeOpeningSetup(page) {
  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' })
    .locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' })
    .locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' })
    .locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' })
    .locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');
}

async function resolveModalForSupporter(page, supporterKey) {
  if (supporterKey === 'MICHELLE') {
    const modalText = await page.locator('#action-content').innerText();
    const requiredMatch = modalText.match(/Selected:\s*\d+\s*\/\s*(\d+)/i);
    const requiredCount = requiredMatch ? Number(requiredMatch[1]) : 0;
    const options = page.locator('#action-modal .target-option');
    const optionCount = await options.count();
    const toPick = Math.min(requiredCount, optionCount);
    for (let i = 0; i < toPick; i += 1) {
      await options.nth(i).click();
    }
    await page.locator('#action-modal .action-btn', { hasText: 'Confirm Discard' }).first().click();
    await page.waitForTimeout(120);
    return;
  }

  if (supporterKey === 'LUCAS') {
    const options = page.locator('#action-modal .target-option');
    if (await options.count()) {
      await options.first().click();
    }
    const confirmBtn = page.locator('#action-modal .action-btn', { hasText: 'Confirm Selection' }).first();
    if (await confirmBtn.count()) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(120);
    return;
  }

  if (supporterKey === 'VICTORIA') {
    const typeOptions = page.locator('#action-modal .target-option');
    if (await typeOptions.count()) {
      await typeOptions.first().click();
      await page.waitForTimeout(80);
      const charOptions = page.locator('#action-modal .target-option');
      if (await charOptions.count()) {
        await charOptions.first().click();
      }
      const confirmBtn = page.locator('#action-modal .action-btn', { hasText: 'Confirm Selection' }).first();
      if (await confirmBtn.count()) {
        await confirmBtn.click();
      }
    } else {
      const closeBtn = page.locator('#action-modal .action-btn', { hasText: /Cancel|Close/i }).first();
      if (await closeBtn.count()) await closeBtn.click();
    }
    await page.waitForTimeout(120);
    return;
  }

  if (supporterKey === 'JOHANN') {
    for (let i = 0; i < 3; i += 1) {
      const visible = await page.evaluate(() => {
        const modal = document.getElementById('action-modal');
        return modal && !modal.classList.contains('hidden');
      });
      if (!visible) break;
      const skipBtn = page.locator('#action-modal .action-btn', { hasText: 'Skip' }).first();
      if (await skipBtn.count()) {
        await skipBtn.click();
      } else {
        const confirmBtn = page.locator('#action-modal .action-btn', { hasText: /Confirm|Close|Cancel/i }).first();
        if (await confirmBtn.count()) await confirmBtn.click();
      }
      await page.waitForTimeout(80);
    }
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      await dialog.accept('');
    } else {
      await dialog.accept();
    }
  });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');
  await completeOpeningSetup(page);

  let previousErrorCount = 0;

  for (const key of supporterKeys) {
    const supporterName = keyToName[key];

    await page.evaluate(() => window.closeModal('action-modal'));
    await page.waitForTimeout(80);

    await page.evaluate((supporterKey) => window.addPlaytestCard('supporter', supporterKey), key);
    await page.waitForTimeout(120);
    await page.locator('#hand-cards .card', { hasText: supporterName }).first().click();
    await page.locator('#action-modal .action-btn', { hasText: 'Play Supporter' }).first().click();

    await page.waitForTimeout(160);
    await resolveModalForSupporter(page, key);
    await page.waitForTimeout(160);
    await page.evaluate(() => window.closeModal('action-modal'));
    await page.waitForTimeout(80);

    const { errorCount, logText } = await page.evaluate(() => {
      const text = document.getElementById('log-content')?.innerText || '';
      const matches = text.match(/Action\s+"[^"]+"\s+failed/gi) || [];
      return { errorCount: matches.length, logText: text };
    });

    if (errorCount > previousErrorCount) {
      throw new Error(`Supporter ${supporterName} introduced runtime action failure.\n${logText}`);
    }

    previousErrorCount = errorCount;

    await page.evaluate(() => window.endTurnAction());
    await page.waitForTimeout(80);
    await page.evaluate(() => window.endTurnAction());
    await page.waitForTimeout(100);
  }

  assert(pageErrors.length === 0, `Page errors encountered:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Supporter smoke test passed for all supporters');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
