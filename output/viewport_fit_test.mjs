import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runCase(browser, viewport, name) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await page.click('#start-game-btn');
  await page.waitForTimeout(250);
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
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      hasVerticalScroll: root.scrollHeight > window.innerHeight + 2
    };
  });

  await page.screenshot({ path: `output/viewport-fit-${name}.png`, fullPage: true });
  await page.close();

  assert(!metrics.hasVerticalScroll, `${name}: vertical scroll detected (${metrics.scrollHeight} > ${metrics.innerHeight})`);
  return metrics;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  });

  const cases = [
    [{ width: 1280, height: 720 }, '1280x720'],
    [{ width: 1366, height: 768 }, '1366x768']
  ];

  const results = [];
  for (const [viewport, name] of cases) {
    results.push({ name, metrics: await runCase(browser, viewport, name) });
  }

  await browser.close();
  console.log('Viewport fit test passed');
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
