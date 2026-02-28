import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForMainPhase(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const phase = await page.evaluate(() => {
      if (!window.render_game_to_text) return null;
      return JSON.parse(window.render_game_to_text()).phase;
    });
    if (phase === 'main') return;
    await page.waitForTimeout(200);
  }
  throw new Error('Timed out waiting for main phase.');
}

async function chooseActiveAndConfirm(page) {
  await page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(180);
  const confirmBtn = page.locator('#setup-guide .setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first();
  if (await confirmBtn.count()) {
    await confirmBtn.click();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p1 = await ctx.newPage();
  const p2 = await ctx.newPage();
  const room = `9${Math.floor(Math.random() * 900 + 100)}`;

  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);

  await Promise.all([
    p1.check('#multiplayer-toggle'),
    p2.check('#multiplayer-toggle')
  ]);
  await Promise.all([
    p1.check('#playtest-mode-toggle'),
    p2.check('#playtest-mode-toggle')
  ]);
  await Promise.all([
    p1.fill('#multiplayer-room', room),
    p2.fill('#multiplayer-room', room)
  ]);

  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');
  await Promise.all([
    p1.waitForSelector('#game-container:not(.hidden)'),
    p2.waitForSelector('#game-container:not(.hidden)')
  ]);
  await p1.waitForFunction(() => {
    const text = (document.getElementById('in-game-player-identity') || {}).textContent || '';
    return text.includes('Player 1');
  });
  await p2.waitForFunction(() => {
    const text = (document.getElementById('in-game-player-identity') || {}).textContent || '';
    return text.includes('Player 2');
  });

  // Opening setup: each player picks local active.
  await chooseActiveAndConfirm(p1);
  await chooseActiveAndConfirm(p2);
  await Promise.all([waitForMainPhase(p1), waitForMainPhase(p2)]);

  const p1State = await p1.evaluate(() => JSON.parse(window.render_game_to_text()));
  const p2State = await p2.evaluate(() => JSON.parse(window.render_game_to_text()));
  const actorPage = Number(p1State.localPlayer) === Number(p1State.currentPlayer) ? p1 : p2;
  const responderPage = actorPage === p1 ? p2 : p1;

  // Current-turn player plays Michelle supporter, which prompts opponent discard choice.
  await actorPage.evaluate(() => {
    window.addPlaytestCard('supporter', 'MICHELLE');
  });
  await actorPage.waitForTimeout(200);
  await actorPage.locator('#hand-cards .card', { hasText: 'Michelle' }).first().click();
  await actorPage.waitForTimeout(180);
  await actorPage.locator('#action-modal .action-btn', { hasText: 'Play Supporter' }).first().click();
  await actorPage.waitForTimeout(900);

  const actorWaiting = await actorPage.locator('#remote-prompt-overlay').evaluate((el) => !el.classList.contains('hidden'));
  const actorEndTurnDisabled = await actorPage.locator('#end-turn-btn').isDisabled();

  assert(actorWaiting, 'Current turn player should show waiting overlay while opponent response is pending.');
  assert(actorEndTurnDisabled, 'End turn should be disabled while waiting for opponent modal response.');

  const responderModalVisible = await responderPage.locator('#action-modal').evaluate((el) => !el.classList.contains('hidden'));
  assert(responderModalVisible, 'Opponent should receive the opponent-choice modal.');

  // Resolve prompt on opponent page.
  await responderPage.locator('#action-modal .target-option').first().click();
  await responderPage.locator('#action-modal .action-btn', { hasText: 'Confirm Discard' }).click();
  await actorPage.waitForTimeout(800);

  const actorWaitingAfter = await actorPage.locator('#remote-prompt-overlay').evaluate((el) => !el.classList.contains('hidden'));
  assert(!actorWaitingAfter, 'Waiting overlay should clear after opponent resolves modal.');

  await browser.close();
  console.log('Multiplayer prompt pause test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
