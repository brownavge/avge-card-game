import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.click('#start-game-btn');
  await page.waitForSelector('#setup-guide:not(.hidden)');

  const p1Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' });
  const p2Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' });
  await p1Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p2Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await p1Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await p2Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');

  const opponentLabel = await page.locator('#opponent-hand-info').innerText();
  const opponentCount = await page.locator('#opponent-hand-count').innerText();
  const opponentKoLabel = await page.locator('#opponent-ko-info').innerText();
  const opponentKoCount = await page.locator('#opponent-ko-count').innerText();
  assert(/Opponent hand:/i.test(opponentLabel), `Opponent hand label missing: ${opponentLabel}`);
  assert(/^\d+$/.test(opponentCount), `Opponent hand count should be numeric, got: ${opponentCount}`);
  assert(/Opponent KOs:/i.test(opponentKoLabel), `Opponent KO label missing: ${opponentKoLabel}`);
  assert(/^\d+$/.test(opponentKoCount), `Opponent KO count should be numeric, got: ${opponentKoCount}`);

  assert(pageErrors.length === 0, `Page errors found:\n${pageErrors.join('\n')}`);
  await browser.close();
  console.log('Opponent hand counter test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
