import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function waitForMain(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readState(page);
    if (state.phase === 'main') return state;
    await page.waitForTimeout(120);
  }
  throw new Error('Timed out waiting for main phase');
}

async function waitForSetup(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const visible = await page.evaluate(() => {
      const guide = document.getElementById('setup-guide');
      return !!guide && !guide.classList.contains('hidden');
    });
    if (visible) return;
    await page.waitForTimeout(120);
  }
  throw new Error('Timed out waiting for setup guide');
}

async function waitForLocalPlayer(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readState(page);
    const localPlayer = Number(state.localPlayer);
    if (localPlayer === 1 || localPlayer === 2) return localPlayer;
    await page.waitForTimeout(120);
  }
  throw new Error('Timed out waiting for local player assignment');
}

async function chooseOpeningFor(page) {
  const localPlayer = await waitForLocalPlayer(page);
  await page.evaluate((targetPlayerNum) => {
    const cards = Array.from(document.querySelectorAll('#hand-cards .card'));
    const preferred = cards.find((card) => (card.textContent || '').includes('Pascal Kim')) || cards[0];
    const cardId = preferred ? preferred.getAttribute('data-card-id') : null;
    if (!cardId) return;
    window.chooseOpeningActive(cardId, targetPlayerNum);
    window.setOpeningReady(targetPlayerNum);
  }, localPlayer);
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

  const hostDeck = Array.from({ length: 20 }, () => ({ name: 'Pascal Kim', cardCategory: 'character' }));
  const guestDeck = Array.from({ length: 20 }, () => ({ name: 'Owen Landry', cardCategory: 'character' }));

  await p1.addInitScript((deck) => {
    localStorage.setItem('customDecks', JSON.stringify({ PascalDeck: deck }));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  }, hostDeck);
  await p2.addInitScript((deck) => {
    localStorage.setItem('customDecks', JSON.stringify({ OwenDeck: deck }));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  }, guestDeck);

  const room = `8${Math.floor(Math.random() * 900 + 100)}`;
  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);

  await p1.selectOption('#player1-deck-select', 'custom:PascalDeck');
  await p2.selectOption('#player1-deck-select', 'custom:OwenDeck');
  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);
  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');

  await Promise.all([waitForSetup(p1), waitForSetup(p2)]);
  await chooseOpeningFor(p1);
  await chooseOpeningFor(p2);
  await Promise.all([waitForMain(p1), waitForMain(p2)]);

  const beforeP1 = await readState(p1);
  const attackerId = beforeP1.players?.[0]?.active?.id;
  const targetId = beforeP1.players?.[1]?.active?.id;
  assert(attackerId && targetId, 'Expected attacker and target for Ominous Chimes');

  await p1.evaluate(({ attackerId: aId, targetId: tId }) => {
    window.executeAttack(aId, 'Ominous Chimes', tId);
  }, { attackerId, targetId });

  await p2.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    const p1Active = state.players?.[0]?.active;
    const latestLog = Array.isArray(state.lastLog) ? state.lastLog.join(' | ') : '';
    return (
      (!p1Active || p1Active.name !== 'Pascal Kim') &&
      /Ominous Chimes/i.test(latestLog)
    );
  }, { timeout: 15000 });

  const afterP2 = await readState(p2);
  const p2SeesP1Active = afterP2.players?.[0]?.active?.name || null;
  assert(p2SeesP1Active !== 'Pascal Kim', `Expected opponent to see Pascal removed from active; got ${p2SeesP1Active}`);

  assert(pageErrors.length === 0, `Page errors found:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('Ominous Chimes multiplayer regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
