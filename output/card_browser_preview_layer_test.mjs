import { chromium } from 'playwright';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
await page.click('#view-cards-btn');
await page.waitForSelector('#card-browser-modal:not(.hidden)');
await page.locator('#card-browser-modal .cards-browser-preview-btn').first().click();
await page.waitForTimeout(300);

const state = await page.evaluate(() => {
  const actionModal = document.getElementById('action-modal');
  const browserModal = document.getElementById('card-browser-modal');
  const actionHidden = actionModal?.classList.contains('hidden');
  const browserHidden = browserModal?.classList.contains('hidden');
  const actionZ = Number(getComputedStyle(actionModal).zIndex || 0);
  const browserZ = Number(getComputedStyle(browserModal).zIndex || 0);
  return { actionHidden, browserHidden, actionZ, browserZ };
});

assert(state.browserHidden === false, 'Card browser should remain visible.');
assert(state.actionHidden === false, 'Preview action modal should be visible.');
assert(state.actionZ > state.browserZ, `Action modal z-index (${state.actionZ}) must exceed browser modal (${state.browserZ}).`);

await browser.close();
console.log('Card browser preview layer test passed');
