import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.click('#start-game-btn');
  await page.waitForTimeout(350);

  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(150);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(120);
  const confirmButtons = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Confirm Setup' });
  const confirmCount = await confirmButtons.count();
  if (confirmCount >= 1) {
    await confirmButtons.nth(0).click();
    await page.waitForTimeout(120);
  }
  if (confirmCount >= 2) {
    await confirmButtons.nth(1).click();
  }
  await page.waitForTimeout(250);

  const defaultGeometry = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      p2Deck: rect('#player2-board .deck-discard-zone'),
      p2Bench: rect('#player2-board .bench-zone'),
      p1Deck: rect('#player1-board .deck-discard-zone'),
      p1Bench: rect('#player1-board .bench-zone')
    };
  });

  assert(defaultGeometry.p2Bench && defaultGeometry.p2Deck, 'Missing default geometry for Player 2 zones.');
  assert(defaultGeometry.p1Bench && defaultGeometry.p1Deck, 'Missing default geometry for Player 1 zones.');
  assert(defaultGeometry.p2Deck.x < defaultGeometry.p2Bench.x, 'Default top board should place deck/discard left of bench.');
  assert(defaultGeometry.p1Deck.x < defaultGeometry.p1Bench.x, 'Default bottom board should place deck/discard left of bench.');

  await page.evaluate(() => {
    document.body.classList.add('multiplayer-perspective-p2');
  });
  await page.waitForTimeout(100);

  const p2Geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      p2Deck: rect('#player2-board .deck-discard-zone'),
      p2Bench: rect('#player2-board .bench-zone'),
      p1Deck: rect('#player1-board .deck-discard-zone'),
      p1Bench: rect('#player1-board .bench-zone')
    };
  });

  assert(p2Geometry.p2Deck && p2Geometry.p2Bench, 'Missing perspective geometry for Player 2 zones.');
  assert(p2Geometry.p1Deck && p2Geometry.p1Bench, 'Missing perspective geometry for Player 1 zones.');
  assert(p2Geometry.p2Deck.x < p2Geometry.p2Bench.x, 'In Player 2 perspective, local board should place deck/discard left of bench.');
  assert(p2Geometry.p1Deck.x !== p2Geometry.p1Bench.x, 'In Player 2 perspective, remote board zones should remain separately positioned.');

  await browser.close();
  console.log('Perspective layout test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
