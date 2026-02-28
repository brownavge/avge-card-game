import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.addInitScript(() => {
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => '';
  });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  await page.check('#playtest-mode-toggle');
  await page.click('#start-game-btn');
  await page.waitForTimeout(300);

  // Complete opening setup quickly.
  await page.locator('#setup-guide .setup-guide__column').nth(0).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(120);
  await page.locator('#setup-guide .setup-guide__column').nth(1).locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(350);

  const phase = await page.evaluate(() => JSON.parse(window.render_game_to_text()).phase);
  assert(phase === 'main', `Expected main phase after opening setup, got ${phase}`);

  const summary = await page.evaluate(() => {
    const result = {
      energyAfterFiveAttaches: 0,
      modalFnsChecked: 0,
      modalFnsAvailable: 0,
      thrownFunctions: []
    };

    // 1) Playtest unlimited energy attach regression.
    for (let i = 0; i < 5; i += 1) {
      window.attachEnergy('active');
    }
    const stateAfterAttach = JSON.parse(window.render_game_to_text());
    result.energyAfterFiveAttaches = Number(stateAfterAttach.players?.[0]?.active?.attachedEnergy || 0);

    // 2) Broad modal handler safety sweep.
    const modalLikeFns = Object.keys(window)
      .filter((name) => /^(confirm|toggle|choose|select|cancel)/.test(name))
      .filter((name) => typeof window[name] === 'function')
      .filter((name) => !/\[native code\]/.test(String(window[name])))
      .filter((name) => !['confirm', 'toggle'].includes(name));

    result.modalFnsAvailable = modalLikeFns.length;

    modalLikeFns.forEach((name) => {
      try {
        // Intentionally sparse args: handlers should fail gracefully, not crash runtime.
        window[name]();
        result.modalFnsChecked += 1;
      } catch (err) {
        result.thrownFunctions.push(`${name}: ${err && err.message ? err.message : String(err)}`);
      }
    });

    return result;
  });

  assert(summary.energyAfterFiveAttaches >= 5, `Expected unlimited playtest attach to allow >=5 energy, got ${summary.energyAfterFiveAttaches}`);
  assert(summary.modalFnsAvailable >= 20, `Expected broad modal sweep, only found ${summary.modalFnsAvailable} candidate functions.`);
  assert(summary.thrownFunctions.length === 0, `Modal function calls threw:\n${summary.thrownFunctions.join('\n')}`);
  assert(pageErrors.length === 0, `Browser page errors detected:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Modal/item regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
