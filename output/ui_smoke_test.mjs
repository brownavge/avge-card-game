import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.addInitScript(() => {
    localStorage.setItem('customDecks', '{broken-json');
  });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  assert(pageErrors.length === 0, `Page errors on load: ${pageErrors.join('\n')}`);
  const bgmMenu = await page.evaluate(() => window.__bgmDebugState && window.__bgmDebugState());
  assert(bgmMenu && bgmMenu.currentTrack === 'menu', `Expected menu BGM on start screen, got ${JSON.stringify(bgmMenu)}`);
  await page.screenshot({ path: 'output/ui-smoke-start.png', fullPage: true });

  await page.click('#view-cards-btn');
  await page.waitForTimeout(300);
  const cardBrowserVisible = await page.locator('#card-browser-modal').evaluate((el) => !el.classList.contains('hidden'));
  assert(cardBrowserVisible, 'Card browser modal should open from View All Cards button.');
  const initialCountText = await page.locator('#cards-browser-count').innerText();
  assert(/card/.test(initialCountText), `Card browser count missing: ${initialCountText}`);
  await page.fill('#card-browser-search', 'main hall');
  await page.waitForTimeout(200);
  const filteredCountText = await page.locator('#cards-browser-count').innerText();
  const filteredCount = parseInt(filteredCountText, 10);
  assert(Number.isFinite(filteredCount), `Filtered count not parseable: ${filteredCountText}`);
  assert(filteredCount >= 0, 'Filtered count should be non-negative.');
  await page.locator('#card-browser-modal .close-modal').click();
  await page.waitForTimeout(150);

  await page.click('#start-game-btn');
  await page.waitForTimeout(300);

  const setupVisible = await page.locator('#setup-guide').evaluate((el) => !el.classList.contains('hidden'));
  assert(setupVisible, 'Setup guide should be visible after starting game.');

  const endTurnDisabled = await page.locator('#end-turn-btn').isDisabled();
  assert(endTurnDisabled, 'End Turn should be disabled during opening setup.');

  const stateBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert(stateBefore.bgm && stateBefore.bgm.currentTrack === 'battle', `Expected battle BGM after game start, got ${JSON.stringify(stateBefore.bgm)}`);
  assert(stateBefore.phase === 'setup', `Expected setup phase before choosing active, got ${stateBefore.phase}`);
  assert(stateBefore.setupPending.p1 === true, 'Player 1 should still need opening active before choice.');
  assert(stateBefore.setupPending.p2 === true, 'Player 2 should still need opening active before choice.');

  const p1ChoiceCount = await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice').count();
  const p2ChoiceCount = await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice').count();
  assert(p1ChoiceCount >= 1, 'Expected at least one Player 1 opening setup choice.');
  assert(p2ChoiceCount >= 1, 'Expected at least one Player 2 opening setup choice.');
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForTimeout(120);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForTimeout(120);
  await page.waitForTimeout(300);

  const stateAfter = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert(stateAfter.phase === 'main', `Expected main phase after choosing active, got ${stateAfter.phase}`);
  assert(stateAfter.setupPending.p1 === false, 'Player 1 setup should be complete after choosing active.');
  assert(stateAfter.setupPending.p2 === false, 'Player 2 setup should be complete after choosing active.');
  assert(stateAfter.players[0].active, 'Player 1 active should be set after choosing active.');
  assert(stateAfter.players[1].active, 'Player 2 active should be set after choosing active.');

  const setupHidden = await page.locator('#setup-guide').evaluate((el) => el.classList.contains('hidden'));
  assert(setupHidden, 'Setup guide should hide after opening setup completes.');

  const toolbarAttackLabel = await page.locator('#toolbar-attack-btn').innerText();
  assert(toolbarAttackLabel.toLowerCase().includes('ends turn'), `Toolbar attack label should mention end turn: ${toolbarAttackLabel}`);

  const p1MidlineVisible = await page.locator('#p1-midline-panel').evaluate((el) => window.getComputedStyle(el).display !== 'none');
  const p2MidlineVisible = await page.locator('#p2-midline-panel').evaluate((el) => window.getComputedStyle(el).display !== 'none');
  assert(!p1MidlineVisible && !p2MidlineVisible, 'Midline active summary panels should be hidden in the refactored layout.');

  await page.click('#toolbar-energy-btn');
  await page.waitForTimeout(150);
  const attachModalTitle = await page.locator('#action-modal h2').innerText();
  assert(/Attach Energy/i.test(attachModalTitle), `Expected Attach Energy picker modal, got ${attachModalTitle}`);
  const attachOptions = page.locator('#action-modal .action-btn');
  const optionCount = await attachOptions.count();
  assert(optionCount >= 2, 'Expected attach-energy target buttons plus Cancel.');
  await attachOptions.first().click();
  await page.waitForTimeout(200);
  const energyStatus = await page.locator('#energy-status').innerText();
  assert(energyStatus.startsWith('1/'), `Energy status should update after attach, got ${energyStatus}`);
  const toolbarEnergyDisabled = await page.locator('#toolbar-energy-btn').isDisabled();
  assert(toolbarEnergyDisabled, 'Toolbar Attach Energy should be disabled after energy attach.');

  const handCount = await page.locator('#hand-cards .hand-card-wrapper').count();
  assert(handCount >= 1, 'Expected at least one hand card after opening setup.');
  await page.locator('#hand-cards .hand-card-wrapper').first().click();
  await page.waitForTimeout(150);
  const inspectorDisplayed = await page.locator('#selection-inspector').evaluate((el) => window.getComputedStyle(el).display);
  assert(inspectorDisplayed === 'none', `Selection inspector should be hidden in canonical layout, got display=${inspectorDisplayed}`);
  await page.locator('#action-modal .close-modal').click();
  await page.waitForTimeout(100);

  await page.click('.active-slot[data-player="1"] .card', { force: true });
  await page.waitForTimeout(150);
  const activeActionButtons = await page.locator('#action-modal .action-btn').allInnerTexts();
  assert(activeActionButtons.some((t) => t.toLowerCase().includes('attack (ends turn)')), `Active card actions should include attack end-turn label: ${activeActionButtons.join(' | ')}`);
  await page.locator('#action-modal .close-modal').click();
  await page.waitForTimeout(100);

  await page.click('#toggle-log-btn');
  await page.waitForTimeout(100);
  const logCollapsed = await page.locator('#game-container').evaluate((el) => el.classList.contains('game-log-collapsed'));
  assert(logCollapsed, 'Game log should collapse after toggle.');

  await page.click('#toggle-log-btn');
  await page.waitForTimeout(100);
  const logExpanded = await page.locator('#game-container').evaluate((el) => !el.classList.contains('game-log-collapsed'));
  assert(logExpanded, 'Game log should expand after second toggle.');

  await page.click('#end-turn-btn');
  await page.waitForTimeout(200);
  const logText = await page.locator('#log-content').innerText();
  assert(!logText.includes('═'), 'Game log should not include decorative separator lines.');

  await page.screenshot({ path: 'output/ui-smoke-game.png', fullPage: true });
  await browser.close();
  console.log('UI smoke test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
