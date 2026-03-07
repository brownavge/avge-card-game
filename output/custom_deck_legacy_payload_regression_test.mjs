import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
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
    const lp = Number(state.localPlayer);
    if (lp === 1 || lp === 2) return lp;
    await page.waitForTimeout(120);
  }
  throw new Error('Timed out waiting for local player assignment');
}

async function chooseActiveAndReady(page) {
  const lp = await waitForLocalPlayer(page);
  await page.evaluate((localPlayer) => {
    const cards = Array.from(document.querySelectorAll('#hand-cards .card'));
    const chosen = cards.find((card) => {
      const label = (card.textContent || '').toLowerCase();
      return label.includes('david man') || label.includes('owen landry');
    }) || cards[0];
    const cardId = chosen ? chosen.getAttribute('data-card-id') : null;
    if (cardId) {
      window.chooseOpeningActive(cardId, localPlayer);
      window.setOpeningReady(localPlayer);
    }
  }, lp);
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

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx1 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();
  const pageErrors = [];
  p1.on('pageerror', (err) => pageErrors.push(`p1:${String(err)}`));
  p2.on('pageerror', (err) => pageErrors.push(`p2:${String(err)}`));

  const hostDeck = Array.from({ length: 20 }, () => ({ name: 'Owen Landry', cardCategory: 'character' }));
  const guestLegacyDeck = Array.from({ length: 20 }, () => ({ name: 'David Man', type: ['Piano'] }));

  await p1.addInitScript((deck) => {
    localStorage.setItem('customDecks', JSON.stringify({ HostCustom: deck }));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  }, hostDeck);

  await p2.addInitScript((legacyDeck) => {
    localStorage.setItem('customDecks', JSON.stringify({ GuestLegacy: legacyDeck }));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  }, guestLegacyDeck);

  const room = `7${Math.floor(Math.random() * 900 + 100)}`;
  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);

  await p1.selectOption('#player1-deck-select', 'custom:HostCustom');
  await p2.selectOption('#player1-deck-select', 'custom:GuestLegacy');

  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);

  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');

  await Promise.all([waitForSetup(p1), waitForSetup(p2)]);
  await Promise.all([chooseActiveAndReady(p1), chooseActiveAndReady(p2)]);

  const stateP1 = await waitForMain(p1);
  const p1SeesP2Active = stateP1.players?.[1]?.active?.name;

  assert(
    p1SeesP2Active === 'David Man',
    `Expected Player 1 to see Player 2 active from legacy custom deck as David Man, got: ${p1SeesP2Active}`
  );
  assert(pageErrors.length === 0, `Page errors found:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Custom deck legacy payload regression test passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
