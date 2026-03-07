import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function cherryAttack(page) {
  const before = await readState(page);
  const attackerId = before.players?.[0]?.active?.id;
  const targetId = before.players?.[1]?.active?.id;
  assert(attackerId && targetId, 'Cherry attack requires active attacker and target.');

  await page.evaluate(({ attackerId, targetId }) => {
    window.executeAttack(attackerId, 'Cherry Flavored Valve Oil', targetId);
  }, { attackerId, targetId });
  await page.waitForTimeout(260);

  let sawCherryModal = false;
  const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('action-modal');
    return !!m && !m.classList.contains('hidden');
  });
  if (modalVisible) {
    const title = await page.locator('#action-modal h2').innerText();
    if (/Cherry Flavored Valve Oil/i.test(title)) {
      sawCherryModal = true;
      const optionCount = await page.locator('#action-modal .target-option').count();
      if (optionCount > 0) {
        await page.locator('#action-modal .target-option').first().click();
        await page.waitForTimeout(220);
      } else {
        await page.evaluate(() => window.closeModal('action-modal'));
      }
    }
  }

  const after = await readState(page);
  return {
    sawCherryModal,
    beforeDiscardP2: Number(before.players?.[1]?.discard || 0),
    afterDiscardP2: Number(after.players?.[1]?.discard || 0)
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');

  const p1Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' });
  const p2Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' });
  await page.evaluate(() => {
    window.addPlaytestCard('character', 'VINCENT_CHEN');
    window.addPlaytestCard('character', 'DAVID_MAN');
  });
  await page.waitForTimeout(140);

  if (await p1Column.locator('.setup-guide__choice', { hasText: 'Active: Vincent Chen' }).count()) {
    await p1Column.locator('.setup-guide__choice', { hasText: 'Active: Vincent Chen' }).first().click();
  } else {
    await p1Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  }
  // Ensure a bench target exists for Cherry heal modal.
  if (await p1Column.locator('.setup-guide__choice', { hasText: 'Bench:' }).count()) {
    await p1Column.locator('.setup-guide__choice', { hasText: 'Bench:' }).first().click();
  }

  await p2Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p1Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await p2Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');

  let koAttackSawCherryModal = false;
  for (let i = 0; i < 6; i += 1) {
    const result = await cherryAttack(page);
    const koHappened = result.afterDiscardP2 > result.beforeDiscardP2;
    if (koHappened) {
      koAttackSawCherryModal = result.sawCherryModal;
      break;
    }

    const state = await readState(page);
    if (Number(state.currentPlayer) === 2) {
      await page.click('#end-turn-btn');
      await page.waitForTimeout(220);
    }
  }

  assert(koAttackSawCherryModal, 'Expected Cherry heal modal to appear on the KO-causing Cherry Flavored Valve Oil attack.');
  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Cherry KO regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
