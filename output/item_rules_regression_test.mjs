import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function completeSetup(page) {
  const p1Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 1' });
  const p2Column = page.locator('#setup-guide .setup-guide__column', { hasText: 'Player 2' });

  const p1Owen = p1Column.locator('.setup-guide__choice', { hasText: 'Active: Owen Landry' });
  if (await p1Owen.count()) {
    await p1Owen.first().click();
  } else {
    await p1Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  }
  await page.waitForTimeout(100);
  await p1Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await p2Column.locator('.setup-guide__choice', { hasText: 'Active:' }).first().click();
  await page.waitForTimeout(100);
  await p2Column.locator('.setup-guide__choice', { hasText: /Confirm Setup|Ready/ }).first().click();

  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'main');
}

async function playHandCard(page, cardName, actionTextRegex) {
  await page.evaluate(() => window.closeModal('action-modal'));
  await page.waitForTimeout(80);
  await page.locator('#hand-cards .card', { hasText: cardName }).first().click();
  await page.locator('#action-modal .action-btn', { hasText: actionTextRegex }).first().click();
  await page.waitForTimeout(120);
}

async function getActiveTypeClasses(page, playerNum) {
  return await page.evaluate((num) => {
    const icons = Array.from(document.querySelectorAll(`.active-slot[data-player="${num}"] .type-icon`));
    return icons
      .map((icon) => Array.from(icon.classList).find((c) => c.startsWith('type-') && c !== 'type-icon'))
      .filter(Boolean)
      .sort();
  }, playerNum);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.check('#playtest-mode-toggle');

  await page.click('#start-game-btn');
  await page.waitForSelector('#game-container:not(.hidden)');
  await completeSetup(page);

  await page.evaluate(() => {
    window.addPlaytestCard('tool', 'BUCKET');
  });
  await page.waitForTimeout(100);

  // Bucket: mono percussion while attached.
  const initialTypes = await getActiveTypeClasses(page, 1);
  assert(initialTypes.length >= 1, `Expected Player 1 to have at least one active type icon, got ${initialTypes.join(', ')}`);

  await playHandCard(page, 'Bucket', /Play Item/i);
  await page.locator('#action-modal .target-option', { hasText: '(Active)' }).first().click();
  await page.waitForTimeout(150);

  const bucketTypes = await getActiveTypeClasses(page, 1);
  assert(bucketTypes.length === 1 && bucketTypes[0] === 'type-percussion', `Expected mono percussion with Bucket, got ${bucketTypes.join(', ')}`);

  // AVGE Birb removes tool and restores original type.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(200);

  await page.evaluate(() => window.addPlaytestCard('item', 'AVGE_BIRB'));
  await playHandCard(page, 'AVGE Birb', /Play Item/i);

  const revertedTypes = await getActiveTypeClasses(page, 1);
  assert(
    JSON.stringify(revertedTypes) === JSON.stringify(initialTypes),
    `Expected exact type revert after Bucket removed. Initial=${initialTypes.join(', ')}, reverted=${revertedTypes.join(', ')}`
  );

  // Back to Player 1.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(220);

  // Cast Reserve: ensure pulled cards keep text/name data.
  await page.evaluate(() => window.addPlaytestCard('item', 'CAST_RESERVE'));
  await playHandCard(page, 'Cast Reserve', /Play Item/i);

  const reserveOptions = page.locator('#action-modal .target-option');
  const reserveCount = await reserveOptions.count();
  assert(reserveCount >= 3, `Expected at least 3 Cast Reserve options, got ${reserveCount}`);
  await reserveOptions.nth(0).click();
  await reserveOptions.nth(1).click();
  await reserveOptions.nth(2).click();
  await page.locator('#action-modal .action-btn', { hasText: /Confirm/i }).first().click();
  await page.waitForTimeout(150);

  const opponentRevealOptions = page.locator('#action-modal .target-option');
  const revealTexts = await opponentRevealOptions.allInnerTexts();
  assert(revealTexts.length >= 3, 'Expected 3 Cast Reserve reveal choices for opponent.');
  assert(revealTexts.every((t) => t.trim().length > 0), `Expected non-empty Cast Reserve option labels, got: ${JSON.stringify(revealTexts)}`);

  const keptName = revealTexts[2].trim();
  await opponentRevealOptions.first().click();
  await opponentRevealOptions.nth(1).click();
  await page.locator('#action-modal .action-btn', { hasText: 'Confirm Discard' }).first().click();
  await page.waitForTimeout(200);

  await page.locator('#hand-cards .card', { hasText: keptName }).first().click();
  const actionText = await page.locator('#action-content').innerText();
  assert(!/undefined/i.test(actionText), `Cast Reserve pulled card should have full text, got: ${actionText}`);
  await page.locator('#action-modal .close-modal').first().click();
  await page.waitForTimeout(80);

  // Concert Ticket: verify updated threshold/log semantics for 3-card refill target.
  const handBeforeConcert = await page.locator('#hand-cards .hand-card-wrapper').count();
  await page.evaluate(() => window.addPlaytestCard('item', 'CONCERT_TICKET'));
  await page.waitForTimeout(100);
  await playHandCard(page, 'Concert Ticket', /Play Item/i);

  const handAfterConcert = await page.locator('#hand-cards .hand-card-wrapper').count();
  assert(handAfterConcert >= handBeforeConcert - 1, `Concert Ticket should not unexpectedly reduce hand size. Before=${handBeforeConcert}, after=${handAfterConcert}`);
  const concertLogText = await page.locator('#log-content').innerText();
  assert(concertLogText.includes('reach 3 in hand'), 'Expected Concert Ticket log to reference 3-card hand target.');
  assert(!concertLogText.includes('reach 4 in hand'), 'Concert Ticket log should no longer reference 4-card hand target.');

  // Video Camera: top-deck item from discard (not to hand immediately).
  await page.evaluate(() => window.addPlaytestCard('item', 'VIDEO_CAMERA'));
  await page.waitForTimeout(100);
  await playHandCard(page, 'Video Camera', /Play Item/i);

  const videoOptions = page.locator('#action-modal .target-option');
  const videoCount = await videoOptions.count();
  assert(videoCount >= 1, 'Expected at least one discard item target for Video Camera.');

  let selectedVideoTarget = 'Concert Ticket';
  const concertChoice = page.locator('#action-modal .target-option', { hasText: 'Concert Ticket' });
  if (await concertChoice.count()) {
    await concertChoice.first().click();
  } else {
    selectedVideoTarget = (await videoOptions.first().innerText()).trim();
    await videoOptions.first().click();
  }
  const countNameInHand = async (name) => {
    const names = await page.locator('#hand-cards .card .card-name').allInnerTexts();
    return names.filter((n) => n.trim() === name).length;
  };
  const countBeforeTurnCycle = await countNameInHand(selectedVideoTarget);
  await page.locator('#action-modal .action-btn', { hasText: /Confirm Selection/i }).first().click();
  await page.waitForTimeout(180);

  const logText = await page.locator('#log-content').innerText();
  assert(logText.includes('on top of deck'), `Expected top-of-deck log for Video Camera, got log tail: ${logText.split('\n').slice(-8).join(' | ')}`);

  // Cycle turns so P1 draws from top deck.
  await page.click('#end-turn-btn');
  await page.waitForTimeout(220);
  await page.click('#end-turn-btn');
  await page.waitForTimeout(260);

  const countAfterTurnCycle = await countNameInHand(selectedVideoTarget);
  assert(
    countAfterTurnCycle >= countBeforeTurnCycle + 1,
    `Expected to draw ${selectedVideoTarget} from top deck next turn. Before=${countBeforeTurnCycle}, after=${countAfterTurnCycle}`
  );

  assert(pageErrors.length === 0, `Page errors encountered:\n${pageErrors.join('\n')}`);

  await browser.close();
  console.log('Item rules regression test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
