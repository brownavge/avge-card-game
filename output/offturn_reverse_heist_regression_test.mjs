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

    let activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
    let choiceCount = await activeChoices.count();
    if (choiceCount === 0) {
      await page.evaluate(() => {
        const fallbacks = ['DAVID_MAN', 'EMILY_WANG', 'KATIE_XIANG', 'LUKE_XU'];
        for (const key of fallbacks) window.addPlaytestCard('character', key);
        if (typeof window.updateUI === 'function') window.updateUI();
      });
      await page.waitForTimeout(200);
      activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
      choiceCount = await activeChoices.count();
    }

    if (choiceCount > 0) {
      await activeChoices.first().click();
      await page.waitForTimeout(120);
    }

    const confirmButtons = page.locator('#setup-guide .setup-guide__choice', { hasText: /Confirm Setup|Ready/ });
    if (await confirmButtons.count()) {
      await confirmButtons.first().click();
      await page.waitForTimeout(120);
    }

    await page.evaluate(() => {
      const s = JSON.parse(window.render_game_to_text());
      const localPlayer = Number(s.localPlayer);
      if (localPlayer === 1 || localPlayer === 2) window.setOpeningReady(localPlayer);
    });
    await page.waitForTimeout(220);
  }

  const finalState = await readState(page);
  throw new Error(`Failed to confirm setup for local player ${finalState.localPlayer}: ${JSON.stringify(finalState.setupPending)}`);
}

async function playerPage(p1, p2, playerNum) {
  const p1State = await readState(p1);
  const p2State = await readState(p2);
  if (Number(p1State.localPlayer) === playerNum) return p1;
  if (Number(p2State.localPlayer) === playerNum) return p2;
  throw new Error(`Could not resolve page for player ${playerNum}`);
}

async function ensureCurrentPlayerPage(pageForP1, pageForP2, playerNum) {
  const s1 = await readState(pageForP1);
  if (Number(s1.currentPlayer) === playerNum) return;
  const s2 = await readState(pageForP2);
  if (Number(s2.currentPlayer) === playerNum) return;

  const activePage = playerNum === 1 ? pageForP2 : pageForP1;
  const endTurnBtn = activePage.locator('#end-turn-btn');
  if (await endTurnBtn.isEnabled()) {
    await endTurnBtn.click();
    await activePage.waitForTimeout(300);
  }
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

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx1 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();
  const pageErrors = [];

  p1.on('pageerror', (err) => pageErrors.push(`p1:${String(err)}`));
  p2.on('pageerror', (err) => pageErrors.push(`p2:${String(err)}`));
  await p1.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });
  await p2.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });

  const room = `8${Math.floor(Math.random() * 900 + 100)}`;
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
  const p2Page = await playerPage(p1, p2, 2);

  // Off-turn local hand clicks should open view-only modal.
  await ensureCurrentPlayerPage(p1Page, p2Page, 1);
  await p1Page.evaluate(() => window.addPlaytestCard('item', 'BUCKET'));
  await p1Page.waitForTimeout(140);
  await p1Page.click('#end-turn-btn');
  await p1Page.waitForTimeout(300);
  await p1Page.locator('#hand-cards .card', { hasText: 'Bucket' }).first().click();
  const offTurnModalText = await p1Page.locator('#action-content').innerText();
  assert(/View only \(not your turn\)/i.test(offTurnModalText), 'Expected off-turn hand card click to open view-only modal.');
  await p1Page.evaluate(() => window.closeModal('action-modal'));
  await p1Page.waitForTimeout(120);

  // Reverse Heist should conserve total card count and not duplicate cards.
  await p2Page.click('#end-turn-btn');
  await p2Page.waitForTimeout(350);
  await ensureCurrentPlayerPage(p1Page, p2Page, 1);

  await p1Page.evaluate(() => window.addPlaytestCard('character', 'DAVID_MAN'));
  await p1Page.waitForTimeout(120);
  await p1Page.locator('#hand-cards .card', { hasText: 'David Man' }).first().click();
  await p1Page.locator('#action-modal .action-btn', { hasText: /Play to Bench|Play to Active/i }).first().click();
  await p1Page.waitForTimeout(180);

  await p1Page.evaluate(() => {
    window.addPlaytestCard('item', 'CONCERT_TICKET');
    window.addPlaytestCard('item', 'CONCERT_TICKET');
    window.addPlaytestCard('item', 'CONCERT_TICKET');
  });
  await p1Page.waitForTimeout(180);

  await playHandCard(p1Page, 'Concert Ticket', /Play Item/i);
  await playHandCard(p1Page, 'Concert Ticket', /Play Item/i);
  await playHandCard(p1Page, 'Concert Ticket', /Play Item/i);

  const beforeHeist = await readState(p1Page);
  const beforeTotal = totalCards(beforeHeist);
  const beforeDiscard = Number(beforeHeist.players?.[0]?.discard || 0);
  assert(beforeDiscard >= 3, `Expected at least 3 cards in P1 discard before Reverse Heist, got ${beforeDiscard}`);

  const davidBoardCard = p1Page.locator('#player1-board .card', { hasText: 'David Man' }).first();
  await davidBoardCard.click();
  await p1Page.locator('#action-modal .action-btn', { hasText: /Use Reverse Heist/i }).first().click();
  await p1Page.waitForTimeout(220);

  const afterHeist = await readState(p1Page);
  const afterTotal = totalCards(afterHeist);
  assert(afterTotal === beforeTotal, `Reverse Heist should conserve card count. Before=${beforeTotal}, After=${afterTotal}`);

  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Off-turn click + Reverse Heist regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
