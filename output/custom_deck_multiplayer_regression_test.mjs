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
    if (visible) {
      const text = await page.locator('#setup-guide').innerText();
      return text;
    }
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for setup guide.');
}

async function waitForDeckIdentity(page, expectedLocalPlayer, expectedHandName, expectedOpponentStartName, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshot = await page.evaluate(() => ({
      state: JSON.parse(window.render_game_to_text()),
      handNames: [...document.querySelectorAll('#hand-cards .card .card-name')].map((el) => el.textContent.trim())
    }));
    const localPlayer = Number(snapshot.state.localPlayer);
    const opponentIndex = expectedLocalPlayer === 1 ? 1 : 0;
    const opponentLastLog = Array.isArray(snapshot.state.lastLog) ? snapshot.state.lastLog.join(' | ') : '';
    const handOk =
      snapshot.handNames.length > 0 &&
      snapshot.handNames.every((name) => name === expectedHandName);
    const logOk = opponentLastLog.includes(`Player ${expectedLocalPlayer === 1 ? 2 : 1} starts with ${expectedOpponentStartName}`);
    if (
      snapshot.state.phase === 'setup' &&
      localPlayer === expectedLocalPlayer &&
      handOk &&
      snapshot.state.players?.[opponentIndex]?.deck === 16 &&
      logOk
    ) {
      return snapshot;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`Timed out waiting for deck identity: player ${expectedLocalPlayer}, hand ${expectedHandName}, opponent ${expectedOpponentStartName}`);
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
  const guestDeck = Array.from({ length: 20 }, () => ({ name: 'David Man', cardCategory: 'character' }));

  await p1.addInitScript((deck) => {
    localStorage.setItem('customDecks', JSON.stringify({ HostCustom: deck }));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  }, hostDeck);
  await p2.addInitScript((deck) => {
    localStorage.setItem('customDecks', JSON.stringify({ GuestCustom: deck }));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  }, guestDeck);

  const room = `5${Math.floor(Math.random() * 900 + 100)}`;
  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);

  await p1.selectOption('#player1-deck-select', 'custom:HostCustom');
  await p2.selectOption('#player1-deck-select', 'custom:GuestCustom');

  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);

  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');

  await Promise.all([waitForSetup(p1), waitForSetup(p2)]);
  const [stateP1, stateP2] = await Promise.all([
    waitForDeckIdentity(p1, 1, 'Owen Landry', 'David Man'),
    waitForDeckIdentity(p2, 2, 'David Man', 'Owen Landry')
  ]);

  assert(stateP1.handNames.every((name) => name === 'Owen Landry'), `Expected Player 1 opening hand to be Owen-only, got: ${stateP1.handNames.join(', ')}`);
  assert(stateP2.handNames.every((name) => name === 'David Man'), `Expected Player 2 opening hand to be David-only, got: ${stateP2.handNames.join(', ')}`);

  assert(pageErrors.length === 0, `Page errors found:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('Custom deck multiplayer regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
