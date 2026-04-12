import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function wait(page, ms = 100) {
  await page.waitForTimeout(ms);
}

async function bootPlaytest(page) {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await wait(page, 300);
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await wait(page, 250);
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await wait(page, 100);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await wait(page, 100);
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await wait(page, 80);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await wait(page, 250);
  assert(pageErrors.length === 0, `Page errors on boot: ${pageErrors.join('\n')}`);
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function ensureTurn(page, playerNum) {
  for (let i = 0; i < 4; i += 1) {
    const state = await getState(page);
    if (state.currentPlayer === playerNum) return;
    await page.evaluate(() => window.endTurnAction());
    await wait(page, 150);
  }
  const state = await getState(page);
  assert(state.currentPlayer === playerNum, `Expected turn for player ${playerNum}, got ${state.currentPlayer}`);
}

async function addCard(page, type, key) {
  await page.evaluate(([t, k]) => window.addPlaytestCard(t, k), [type, key]);
  await wait(page, 50);
}

async function getHandCardIdByName(page, name) {
  return page.evaluate((targetName) => {
    const cards = [...document.querySelectorAll('#hand-cards .card')];
    const match = cards.find((card) => {
      const label = card.querySelector('.card-name');
      return label && label.textContent.trim() === targetName;
    });
    return match ? match.getAttribute('data-card-id') : null;
  }, name);
}

async function playCharacterToBenchByName(page, name) {
  const state = await getState(page);
  const player = state.players[state.currentPlayer - 1];
  const slot = player.bench.findIndex((entry) => entry === null);
  assert(slot !== -1, `No empty bench slot for ${name}`);
  const cardId = await getHandCardIdByName(page, name);
  assert(cardId, `Hand card not found: ${name}`);
  await page.evaluate(([id, benchSlot]) => window.playCharacterToBench(id, benchSlot), [cardId, slot]);
  await wait(page, 100);
  return slot;
}

async function attachEnergyTo(page, target, count) {
  for (let i = 0; i < count; i += 1) {
    await page.evaluate((resolvedTarget) => window.attachEnergy(resolvedTarget), target);
    await wait(page, 25);
  }
}

async function switchBenchNameToActive(page, name) {
  const state = await getState(page);
  const player = state.players[state.currentPlayer - 1];
  const benchEntry = player.bench.find((entry) => entry && entry.name === name);
  assert(benchEntry, `Bench card not found for switch: ${name}`);
  await page.evaluate((cardId) => window.switchToActive(cardId), benchEntry.id);
  await wait(page, 100);
  const confirmVisible = await page.locator('#action-modal .action-btn', { hasText: 'Confirm Switch' }).count();
  if (confirmVisible > 0) {
    await page.locator('#action-modal .action-btn', { hasText: 'Confirm Switch' }).click();
    await wait(page, 120);
  }
}

async function getActiveId(page, playerNum) {
  const state = await getState(page);
  return state.players[playerNum - 1].active && state.players[playerNum - 1].active.id;
}

async function getBenchEntry(page, playerNum, name) {
  const state = await getState(page);
  return state.players[playerNum - 1].bench.find((entry) => entry && entry.name === name) || null;
}

async function attachToolFromHand(page, toolName, target) {
  const toolId = await getHandCardIdByName(page, toolName);
  assert(toolId, `Tool not found in hand: ${toolName}`);
  await page.evaluate(([id, resolvedTarget]) => window.attachTool(id, resolvedTarget), [toolId, target]);
  await wait(page, 100);
}

async function executeAttack(page, attackerId, moveName, targetId) {
  await page.evaluate(([a, m, t]) => window.executeAttack(a, m, t), [attackerId, moveName, targetId]);
  await wait(page, 180);
}

async function nextDialog(page, response = true) {
  const dialog = await page.waitForEvent('dialog');
  if (typeof response === 'string') {
    await dialog.accept(response);
  } else if (response) {
    await dialog.accept();
  } else {
    await dialog.dismiss();
  }
}

async function withOptionalDialog(page, response, action, timeoutMs = 1200) {
  const dialogPromise = page.waitForEvent('dialog', { timeout: timeoutMs })
    .then(async (dialog) => {
      if (typeof response === 'string') {
        await dialog.accept(response);
      } else if (response) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
      return true;
    })
    .catch(() => false);
  await action();
  const handled = await dialogPromise;
  await wait(page, 120);
  return handled;
}

async function testGraceRoyalties(browser) {
  console.log('Running: Grace Royalties');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await bootPlaytest(page);
  await ensureTurn(page, 1);
  await addCard(page, 'character', 'GRACE_ZHAO');
  await playCharacterToBenchByName(page, 'Grace Zhao');
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);

  await addCard(page, 'tool', 'AVGE_TSHIRT');
  await attachToolFromHand(page, 'AVGE T-Shirt', 'active');

  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);

  const state = await getState(page);
  const p2Active = state.players[1].active;
  assert(p2Active && p2Active.damage === 10, `Grace Royalties should damage the one eligible AVGE-equipped target for 10. Active damage: ${p2Active && p2Active.damage}`);
  await page.close();
}

async function testRossAttack(browser) {
  console.log('Running: Ross Attack');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await bootPlaytest(page);
  await ensureTurn(page, 1);
  await addCard(page, 'character', 'ROSS_WILLIAMS');
  await playCharacterToBenchByName(page, 'Ross Williams');
  await addCard(page, 'item', 'MATCHA_LATTE');
  const matchaId = await getHandCardIdByName(page, 'Matcha Latte');
  await page.evaluate((id) => window.playItem(id), matchaId);
  await wait(page, 120);
  await attachEnergyTo(page, 'active', 2);

  const before = await getState(page);
  const attackerId = await getActiveId(page, 1);
  const targetId = await getActiveId(page, 2);
  await withOptionalDialog(page, '1', async () => {
    await executeAttack(page, attackerId, 'Ross Attack!', targetId);
  });

  const after = await getState(page);
  assert(after.players[0].discard === before.players[0].discard - 1, `Ross Attack should remove one card from discard. Before ${before.players[0].discard}, after ${after.players[0].discard}`);
  assert(after.players[0].deck === before.players[0].deck + 1, `Ross Attack should place one card on top of deck. Before ${before.players[0].deck}, after ${after.players[0].deck}`);
  await page.close();
}

async function testMeyaLock(browser) {
  console.log('Running: Meya lock');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await bootPlaytest(page);
  await ensureTurn(page, 1);
  await addCard(page, 'character', 'MEYA_GAO');
  await playCharacterToBenchByName(page, 'Meya Gao');
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'Meya Gao');

  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  await addCard(page, 'character', 'CHRISTMAS_KIM');
  await playCharacterToBenchByName(page, 'Christmas Kim');
  await addCard(page, 'character', 'OWEN_LANDRY');
  const owenSlot = await playCharacterToBenchByName(page, 'Owen Landry');
  await attachEnergyTo(page, owenSlot, 2);
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'Christmas Kim');
  await attachEnergyTo(page, 'active', 1);

  const christmasId = await getActiveId(page, 2);
  const meyaId = await getActiveId(page, 1);
  await executeAttack(page, christmasId, 'Strum', meyaId);

  await page.click('.active-slot[data-player="1"] .card', { force: true });
  await wait(page, 100);
  const attackButtonText = await page.locator('#action-modal .action-btn').allInnerTexts();
  assert(attackButtonText.some((text) => text.includes('Cannot Attack')), `Expected Meya to be attack-locked. Buttons: ${attackButtonText.join(' | ')}`);
  await page.locator('#action-modal .close-modal').click();
  await wait(page, 80);

  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'Owen Landry');
  const owenId = await getActiveId(page, 2);
  const p1ActiveId = await getActiveId(page, 1);
  const before = await getState(page);
  await executeAttack(page, owenId, 'Feedback Loop', p1ActiveId);
  const after = await getState(page);
  assert(after.players[0].active.damage > before.players[0].active.damage, 'Expected switched-in Owen to be able to attack despite Christmas being the locked source.');
  await page.close();
}

async function testSasCybersecurity(browser) {
  console.log('Running: Sas Cybersecurity');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await bootPlaytest(page);
  await ensureTurn(page, 1);
  await addCard(page, 'character', 'SAS_MAJUMDER');
  await playCharacterToBenchByName(page, 'Sas Majumder');
  const beforeP1 = await getState(page);
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);

  await addCard(page, 'character', 'ROBERTO_GONZALES');
  await playCharacterToBenchByName(page, 'Roberto Gonzales');
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'Roberto Gonzales');
  await attachEnergyTo(page, 'active', 2);
  const robertoId = await getActiveId(page, 2);
  const p1ActiveId = await getActiveId(page, 1);
  const cybersecurityPromptHandled = await withOptionalDialog(page, true, async () => {
    await executeAttack(page, robertoId, 'Guitar Shredding', p1ActiveId);
  });
  const after = await getState(page);
  const logText = (after.lastLog || []).join(' | ');
  assert(cybersecurityPromptHandled, 'Expected Sas Cybersecurity confirmation dialog when a card entered discard during the opponent turn.');
  assert(/Cybersecurity/.test(logText), `Expected Sas Cybersecurity log after opponent discard event. Logs: ${logText}`);
  assert(after.players[0].discard === 1, `Expected Sas Cybersecurity to return one of two burned cards, leaving exactly one card in discard. Got ${after.players[0].discard}`);
  await page.close();
}

async function testOminousChimes(browser) {
  console.log('Running: Ominous Chimes');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await bootPlaytest(page);
  await ensureTurn(page, 1);
  await addCard(page, 'character', 'PASCAL_KIM');
  await playCharacterToBenchByName(page, 'Pascal Kim');
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'Pascal Kim');
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  await addCard(page, 'character', 'OWEN_LANDRY');
  await playCharacterToBenchByName(page, 'Owen Landry');
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'Owen Landry');
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  await attachEnergyTo(page, 'active', 3);

  const beforeAttack = await getState(page);
  const pascalId = await getActiveId(page, 1);
  const targetId = await getActiveId(page, 2);
  await executeAttack(page, pascalId, 'Ominous Chimes', targetId);
  const afterAttack = await getState(page);
  assert(afterAttack.players[0].active === null || afterAttack.players[0].active.name !== 'Pascal Kim', 'Pascal should no longer be active after Ominous Chimes.');
  assert(afterAttack.players[0].deck >= beforeAttack.players[0].deck + 1, 'Pascal should be shuffled back into deck after Ominous Chimes.');
  const damageBeforeTrigger = afterAttack.players[1].active.damage;
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 180);
  const afterTrigger = await getState(page);
  assert(afterTrigger.players[1].active.damage >= damageBeforeTrigger + 70, `Ominous Chimes should deal delayed 70 damage. Before ${damageBeforeTrigger}, after ${afterTrigger.players[1].active.damage}`);
  await page.close();
}

async function testDamperPedal(browser) {
  console.log('Running: Damper Pedal');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await bootPlaytest(page);
  await ensureTurn(page, 1);
  await addCard(page, 'character', 'DAVID_MAN');
  await playCharacterToBenchByName(page, 'David Man');
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'David Man');
  await attachEnergyTo(page, 'active', 2);

  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  await addCard(page, 'character', 'CAROLYN_ZHENG');
  await playCharacterToBenchByName(page, 'Carolyn Zheng');
  await attachEnergyTo(page, 'active', 5);
  await switchBenchNameToActive(page, 'Carolyn Zheng');
  await attachEnergyTo(page, 'active', 3);
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);

  const davidId = await getActiveId(page, 1);
  const p2ActiveId = await getActiveId(page, 2);
  await executeAttack(page, davidId, 'Damper Pedal', p2ActiveId);
  const beforeBlast = await getState(page);
  const carolynId = await getActiveId(page, 2);
  const p1ActiveId = await getActiveId(page, 1);
  await executeAttack(page, carolynId, 'Blast', p1ActiveId);
  const afterBlast = await getState(page);
  const blastLogs = (afterBlast.lastLog || []).join(' | ');
  assert(/Damper Pedal: Attack damage halved!/.test(blastLogs), `Expected Damper Pedal halving log. Logs: ${blastLogs}`);
  await page.close();
}

async function testReverseHeist(browser) {
  console.log('Running: Reverse Heist');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await bootPlaytest(page);
  await ensureTurn(page, 1);
  await addCard(page, 'character', 'DAVID_MAN');
  await playCharacterToBenchByName(page, 'David Man');
  await addCard(page, 'item', 'MATCHA_LATTE');
  const matchaId = await getHandCardIdByName(page, 'Matcha Latte');
  await page.evaluate((id) => window.playItem(id), matchaId);
  await wait(page, 120);
  const before = await getState(page);
  await withOptionalDialog(page, true, async () => {
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.bench-slot[data-player="1"] .card')]
        .find((el) => el.querySelector('.card-name')?.textContent.trim() === 'David Man');
      if (!card) throw new Error('David Man not found on bench');
      window.useActivatedAbility(card.getAttribute('data-card-id'), 'ability');
    });
  });
  const afterAbility = await getState(page);
  assert(afterAbility.players[0].discard === before.players[0].discard - 1, `Reverse Heist should remove one discard card. Before ${before.players[0].discard}, after ${afterAbility.players[0].discard}`);
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  await page.evaluate(() => window.endTurnAction());
  await wait(page, 150);
  const handHasMatcha = await page.evaluate(() => {
    return [...document.querySelectorAll('#hand-cards .card .card-name')].some((el) => el.textContent.trim() === 'Matcha Latte');
  });
  assert(handHasMatcha, 'Reverse Heist should place the chosen discard card on top so it is drawn next turn.');
  await page.close();
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  });
  try {
    await testGraceRoyalties(browser);
    await testRossAttack(browser);
    await testMeyaLock(browser);
    await testSasCybersecurity(browser);
    await testOminousChimes(browser);
    await testDamperPedal(browser);
    await testReverseHeist(browser);
    console.log('Targeted regression test passed');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
