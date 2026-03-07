import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function waitForLocalPlayer(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readState(page);
    const localPlayer = Number(state.localPlayer);
    if (localPlayer === 1 || localPlayer === 2) return localPlayer;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for multiplayer local player assignment.');
}

async function waitForMainPhase(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshot = await readState(page);
    if (snapshot.phase === 'main') return;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for main phase.');
}

async function chooseActiveAndConfirm(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await readState(page);
    const localPlayer = Number(state.localPlayer);
    const pendingKey = localPlayer === 2 ? 'p2' : 'p1';
    if (state.setupPending && state.setupPending[pendingKey] === false) return;

    const activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
    if (await activeChoices.count()) {
      await activeChoices.first().click();
      await page.waitForTimeout(100);
    }
    const confirmButtons = page.locator('#setup-guide .setup-guide__choice', { hasText: /Confirm Setup|Ready/ });
    if (await confirmButtons.count()) {
      await confirmButtons.first().click();
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => {
      const s = JSON.parse(window.render_game_to_text());
      const lp = Number(s.localPlayer);
      if (lp === 1 || lp === 2) window.setOpeningReady(lp);
    });
    await page.waitForTimeout(220);
  }
  throw new Error('Failed setup confirm.');
}

async function playerPage(p1, p2, playerNum) {
  const s1 = await readState(p1);
  const s2 = await readState(p2);
  if (Number(s1.localPlayer) === playerNum) return p1;
  if (Number(s2.localPlayer) === playerNum) return p2;
  throw new Error(`Could not resolve page for player ${playerNum}`);
}

function totalCards(snapshot) {
  return (snapshot.players || []).reduce((sum, p) => {
    const benchCount = (p.bench || []).filter(Boolean).length;
    return sum + Number(p.deck || 0) + Number(p.hand || 0) + Number(p.discard || 0) + (p.active ? 1 : 0) + benchCount;
  }, 0);
}

async function playHandCard(page, cardName, actionLabelRegex) {
  await page.evaluate(() => window.closeModal('action-modal'));
  await page.waitForTimeout(80);
  await page.locator('#hand-cards .card', { hasText: cardName }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: actionLabelRegex }).first().click();
  await page.waitForTimeout(180);
}

async function runOffTurnCheck() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx1 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  await p1.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });
  await p2.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });

  const room = `6${Math.floor(Math.random() * 900 + 100)}`;
  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);
  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.check('#playtest-mode-toggle'), p2.check('#playtest-mode-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);
  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');
  await Promise.all([p1.waitForSelector('#game-container:not(.hidden)'), p2.waitForSelector('#game-container:not(.hidden)')]);
  await Promise.all([waitForLocalPlayer(p1), waitForLocalPlayer(p2)]);
  await chooseActiveAndConfirm(p1);
  await chooseActiveAndConfirm(p2);
  await Promise.all([waitForMainPhase(p1), waitForMainPhase(p2)]);

  const p1Page = await playerPage(p1, p2, 1);

  const firstHandCardName = (await p1Page.locator('#hand-cards .card .card-name').first().innerText()).trim();
  assert(firstHandCardName.length > 0, 'Expected at least one card in local hand for off-turn click check.');
  await p1Page.click('#end-turn-btn');
  await p1Page.waitForTimeout(280);

  await p1Page.locator('#hand-cards .card', { hasText: firstHandCardName }).first().click();
  const modalText = await p1Page.locator('#action-content').innerText();
  assert(/View only \(not your turn\)/i.test(modalText), 'Expected off-turn card click to open view-only modal.');

  await browser.close();
}

async function runReverseHeistCheck() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  await page.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');

  const p1Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' });
  const p2Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' });
  await p1Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p2Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p1Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await p2Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');

  await page.evaluate(() => window.addPlaytestCard('character', 'DAVID_MAN'));
  await page.waitForTimeout(120);
  await page.locator('#hand-cards .card', { hasText: 'David Man' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Play to Bench|Play to Active/i }).first().click();
  await page.waitForTimeout(180);

  await page.evaluate(() => {
    window.addPlaytestCard('item', 'CONCERT_TICKET');
    window.addPlaytestCard('item', 'CONCERT_TICKET');
    window.addPlaytestCard('item', 'CONCERT_TICKET');
  });
  await page.waitForTimeout(160);

  await playHandCard(page, 'Concert Ticket', /Play Item/i);
  await playHandCard(page, 'Concert Ticket', /Play Item/i);
  await playHandCard(page, 'Concert Ticket', /Play Item/i);

  const before = await readState(page);
  const beforeTotal = totalCards(before);
  const beforeDiscard = Number(before.players?.[0]?.discard || 0);
  assert(beforeDiscard >= 3, `Expected >=3 cards in discard before Reverse Heist, got ${beforeDiscard}`);

  await page.locator('#player1-board .card', { hasText: 'David Man' }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: /Use Reverse Heist/i }).first().click();
  await page.waitForTimeout(220);

  const after = await readState(page);
  const afterTotal = totalCards(after);
  assert(afterTotal === beforeTotal, `Reverse Heist should conserve total cards. before=${beforeTotal} after=${afterTotal}`);

  await browser.close();
}

async function run() {
  await runOffTurnCheck();
  await runReverseHeistCheck();
  console.log('Off-turn click + Reverse Heist regression tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
