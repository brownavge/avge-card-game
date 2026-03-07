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
    const lp = Number(state.localPlayer);
    if (lp === 1 || lp === 2) return lp;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for local player assignment.');
}

async function waitForMain(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await readState(page);
    if (s.phase === 'main') return;
    await page.waitForTimeout(120);
  }
  throw new Error('Timed out waiting for main phase.');
}

async function chooseAliceAndReady(page) {
  const state = await readState(page);
  const lp = Number(state.localPlayer);
  await page.evaluate(() => window.addPlaytestCard('character', 'ALICE_WANG'));
  await page.waitForTimeout(140);
  await page.evaluate((localPlayer) => {
    const cards = Array.from(document.querySelectorAll('#hand-cards .card'));
    const alice = cards.find((el) => (el.textContent || '').includes('Alice Wang'));
    const chosen = alice || cards[0];
    const cardId = chosen ? chosen.getAttribute('data-card-id') : null;
    if (cardId) {
      window.chooseOpeningActive(cardId, localPlayer);
      window.setOpeningReady(localPlayer);
    }
  }, lp);
  await page.waitForTimeout(200);
}

async function pageForPlayer(p1, p2, n) {
  const s1 = await readState(p1);
  if (Number(s1.localPlayer) === n) return p1;
  return p2;
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

  const room = `4${Math.floor(Math.random() * 900 + 100)}`;
  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);

  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.check('#playtest-mode-toggle'), p2.check('#playtest-mode-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);

  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');
  await Promise.all([p1.waitForSelector('#setup-guide:not(.hidden)'), p2.waitForSelector('#setup-guide:not(.hidden)')]);
  await Promise.all([waitForLocalPlayer(p1), waitForLocalPlayer(p2)]);

  await chooseAliceAndReady(p1);
  await chooseAliceAndReady(p2);
  await Promise.all([waitForMain(p1), waitForMain(p2)]);

  const player1Page = await pageForPlayer(p1, p2, 1);
  const player2Page = await pageForPlayer(p1, p2, 2);

  const before = await readState(player1Page);
  const activePlayer = Number(before.currentPlayer);
  const activePage = activePlayer === 1 ? player1Page : player2Page;

  await activePage.evaluate(() => {
    window.addPlaytestCard('tool', 'KIKI_HEADBAND');
    window.addPlaytestCard('item', 'CONCERT_TICKET');
    window.addPlaytestCard('item', 'CONCERT_TICKET');
  });
  await activePage.waitForTimeout(180);

  await activePage.locator('#hand-cards .card', { hasText: "Kiki's Headband" }).first().click();
  await activePage.locator('#action-modal .action-btn', { hasText: /Play Item/i }).first().click();
  await activePage.locator('#action-modal .target-option', { hasText: '(Active)' }).first().click();
  await activePage.waitForTimeout(220);

  await activePage.click('#end-turn-btn');
  await activePage.waitForTimeout(260);

  const discardModalVisible = await activePage.evaluate(() => {
    const modal = document.getElementById('action-modal');
    return !!modal && !modal.classList.contains('hidden') && /Choose\s+\d+\s+cards?\s+to\s+discard/i.test((document.getElementById('action-content') || {}).innerText || '');
  });

  if (discardModalVisible) {
    const opts = activePage.locator('#action-modal .target-option');
    const count = await opts.count();
    if (count >= 2) {
      await opts.nth(0).click();
      await opts.nth(1).click();
      await activePage.locator('#action-modal .action-btn', { hasText: 'Confirm Discard' }).first().click();
      await activePage.waitForTimeout(350);
    }
  }

  const after1 = await readState(player1Page);
  const after2 = await readState(player2Page);
  assert(after1.currentPlayer === after2.currentPlayer, `Current player desynced: p1=${after1.currentPlayer}, p2=${after2.currentPlayer}`);

  const nextPlayer = Number(after1.currentPlayer);
  const nextPage = nextPlayer === 1 ? player1Page : player2Page;
  const nextEndTurnEnabled = await nextPage.locator('#end-turn-btn').isEnabled();
  assert(nextEndTurnEnabled, 'Next player appears unable to act (end turn button disabled).');

  assert(pageErrors.length === 0, `Page errors:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('Alice + Kiki end-turn sync test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
