import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function completeSetup(page) {
  await page.waitForSelector('#setup-guide:not(.hidden)');
  const p1 = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' });
  const p2 = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' });
  await p1.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p2.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p1.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await p2.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  // Tiny custom deck to hit empty-deck draw behavior naturally.
  const tinyDeck = [
    { name: 'Owen Landry', cardCategory: 'character' },
    { name: 'Owen Landry', cardCategory: 'character' },
    { name: 'Owen Landry', cardCategory: 'character' },
    { name: 'Owen Landry', cardCategory: 'character' }
  ];

  await page.addInitScript((deck) => {
    localStorage.setItem('customDecks', JSON.stringify({ TinyDeck: deck }));
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  }, tinyDeck);

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');
  await page.selectOption('#player1-deck-select', 'custom:TinyDeck');
  await page.selectOption('#player2-deck-select', 'custom:TinyDeck');
  await page.click('#start-game-btn');

  const setupState = await readState(page);
  assert(setupState.players?.[0]?.hand === 4, `Expected player 1 starting hand to be 4, got ${setupState.players?.[0]?.hand}`);
  assert(setupState.players?.[1]?.hand === 4, `Expected player 2 starting hand to be 4, got ${setupState.players?.[1]?.hand}`);

  await completeSetup(page);

  // First-turn restrictions for player 1.
  await page.evaluate(() => {
    window.addPlaytestCard('item', 'PRINTED_SCORE');
    window.addPlaytestCard('supporter', 'MICHELLE');
    window.addPlaytestCard('stadium', 'MAIN_HALL');
  });
  await page.waitForTimeout(120);

  const beforeRestriction = await readState(page);
  const p1HandBefore = beforeRestriction.players[0].hand;

  await page.evaluate(() => {
    const handCards = Array.from(document.querySelectorAll('#hand-cards .card'));
    const findId = (name) => {
      const cardEl = handCards.find((el) => (el.textContent || '').includes(name));
      return cardEl ? cardEl.getAttribute('data-card-id') : null;
    };
    const printedId = findId('Printed Score');
    const michelleId = findId('Michelle');
    const mainHallId = findId('Main Hall');
    if (printedId) window.playItem(printedId);
    if (michelleId) window.playSupporter(michelleId);
    if (mainHallId) window.playStadium(mainHallId);
  });

  const afterRestriction = await readState(page);
  assert(afterRestriction.players[0].hand === p1HandBefore, 'Restricted first-turn cards should remain unplayed in hand.');

  // No deck-out loss on turn draw: both decks are already empty after setup with tiny deck.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(220);
  await page.click('#end-turn-btn');
  await page.waitForTimeout(220);
  const noDeckOutState = await readState(page);
  assert(noDeckOutState.phase !== 'gameover', 'Empty deck draw should not cause game over.');

  // Type matchup info visible on character cards.
  await page.evaluate(() => window.addPlaytestCard('character', 'OWEN_LANDRY'));
  await page.waitForTimeout(120);
  const matchupVisible = await page.locator('#hand-cards .card').filter({ hasText: 'Strong vs:' }).count();
  assert(matchupVisible > 0, 'Expected character card to show Strong vs / Weak to info.');

  assert(pageErrors.length === 0, `Page errors found:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('Rules update regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
