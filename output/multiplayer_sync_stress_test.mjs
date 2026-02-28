import { chromium } from 'playwright';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeState(raw) {
  return {
    phase: raw.phase,
    turn: raw.turn,
    currentPlayer: raw.currentPlayer,
    setupPending: raw.setupPending,
    p1: {
      deck: raw.players?.[0]?.deck,
      hand: raw.players?.[0]?.hand,
      discard: raw.players?.[0]?.discard,
      ko: raw.players?.[0]?.ko,
      active: raw.players?.[0]?.active ? {
        name: raw.players[0].active.name,
        damage: raw.players[0].active.damage,
        attachedEnergy: raw.players[0].active.attachedEnergy
      } : null,
      bench: (raw.players?.[0]?.bench || []).map((b) => b ? ({ name: b.name, damage: b.damage, attachedEnergy: b.attachedEnergy }) : null)
    },
    p2: {
      deck: raw.players?.[1]?.deck,
      hand: raw.players?.[1]?.hand,
      discard: raw.players?.[1]?.discard,
      ko: raw.players?.[1]?.ko,
      active: raw.players?.[1]?.active ? {
        name: raw.players[1].active.name,
        damage: raw.players[1].active.damage,
        attachedEnergy: raw.players[1].active.attachedEnergy
      } : null,
      bench: (raw.players?.[1]?.bench || []).map((b) => b ? ({ name: b.name, damage: b.damage, attachedEnergy: b.attachedEnergy }) : null)
    },
    stadium: raw.stadium ? raw.stadium.name : null,
    lastLog: raw.lastLog || []
  };
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function waitForLocalPlayer(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const localPlayer = await page.evaluate(() => {
      if (window.render_game_to_text) {
        try {
          const fromState = Number(JSON.parse(window.render_game_to_text()).localPlayer);
          if (fromState === 1 || fromState === 2) return fromState;
        } catch {}
      }
      const identityText = (document.getElementById('in-game-player-identity')?.textContent || '').toLowerCase();
      if (identityText.includes('player 1')) return 1;
      if (identityText.includes('player 2')) return 2;
      return null;
    });
    if (localPlayer === 1 || localPlayer === 2) return localPlayer;
    await page.waitForTimeout(120);
  }
  throw new Error('Timed out waiting for multiplayer local player assignment.');
}

async function waitForMainPhase(page, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const phase = (await readState(page)).phase;
    if (phase === 'main') return;
    await page.waitForTimeout(150);
  }
  throw new Error('Timed out waiting for main phase.');
}

async function waitForCurrentPlayer(p1, p2, expected, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [s1, s2] = await Promise.all([readState(p1), readState(p2)]);
    if (Number(s1.currentPlayer) === expected && Number(s2.currentPlayer) === expected) return;
    await p1.waitForTimeout(120);
  }
  throw new Error(`Timed out waiting for currentPlayer=${expected} on both clients.`);
}

async function assertSynced(p1, p2, label) {
  await p1.waitForTimeout(240);
  const s1 = normalizeState(await readState(p1));
  const s2 = normalizeState(await readState(p2));
  const j1 = JSON.stringify(s1);
  const j2 = JSON.stringify(s2);
  assert(j1 === j2, `${label}: client states diverged\nP1=${j1}\nP2=${j2}`);
  assert(!s1.lastLog.some((msg) => String(msg).includes('Action rejected:')), `${label}: found action rejection in game log.`);
}

async function chooseActiveAndConfirm(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const state = await readState(page);
    const localPlayer = Number(state.localPlayer);
    const pendingKey = localPlayer === 2 ? 'p2' : 'p1';
    if (state.setupPending && state.setupPending[pendingKey] === false) return;

    const activeChoices = page.locator('#setup-guide .setup-guide__choice', { hasText: 'Active:' });
    if (await activeChoices.count()) {
      await activeChoices.first().click();
      await page.waitForTimeout(120);
    }

    const confirmBtn = page.locator('#setup-guide .setup-guide__choice', { hasText: /Confirm Setup|Ready/ });
    if (await confirmBtn.count()) {
      await confirmBtn.first().click();
    }
    await page.evaluate(() => {
      const state = JSON.parse(window.render_game_to_text());
      const local = Number(state.localPlayer);
      if (local === 1 || local === 2) window.setOpeningReady(local);
    });
    await page.waitForTimeout(200);
  }

  const finalState = await readState(page);
  throw new Error(`Failed to confirm setup for local player ${finalState.localPlayer}: ${JSON.stringify(finalState.setupPending)}`);
}

async function addPlaytestCardByName(page, type, cardName) {
  const keyMap = {
    item: {
      'Printed Score': 'PRINTED_SCORE',
      'Annotated Score': 'ANNOTATED_SCORE',
      'Dress Rehearsal Roster': 'REHEARSAL_ROSTER',
      'Concert Program': 'CONCERT_PROGRAM',
      'Cast Reserve': 'CAST_RESERVE'
    },
    supporter: {
      Michelle: 'MICHELLE'
    }
  };
  const key = keyMap[type] ? keyMap[type][cardName] : null;
  assert(!!key, `No playtest key mapping for ${type} card "${cardName}".`);

  const ok = await page.evaluate(({ type, key }) => {
    if (typeof window.addPlaytestCard !== 'function') return false;
    window.addPlaytestCard(type, key);
    return true;
  }, { type, key });

  assert(ok, `Failed to add ${type} card ${cardName} (${key}) via playtest.`);
}

async function isModalVisible(page) {
  return page.locator('#action-modal').evaluate((el) => !el.classList.contains('hidden'));
}

async function isRemoteOverlayVisible(page) {
  const overlay = page.locator('#remote-prompt-overlay');
  if (!(await overlay.count())) return false;
  return overlay.evaluate((el) => !el.classList.contains('hidden'));
}

async function resolveModalOnPage(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('remote-prompt-overlay');
    if (overlay && !overlay.classList.contains('hidden')) return false;

    const modal = document.getElementById('action-modal');
    if (!modal || modal.classList.contains('hidden')) return false;
    const content = document.getElementById('action-content');
    const contentText = content ? (content.textContent || '') : '';

    const allOptions = Array.from(modal.querySelectorAll('.target-option'));
    const selectedCountMatch = contentText.match(/Selected:\s*(\d+)\s*\/\s*(\d+)/i);
    if (selectedCountMatch && allOptions.length > 0) {
      const selectedNow = Number(selectedCountMatch[1]);
      const required = Number(selectedCountMatch[2]);
      for (let i = selectedNow; i < Math.min(required, allOptions.length); i += 1) {
        allOptions[i].click();
      }
    } else if (allOptions.length > 0) {
      allOptions[0].click();
    }

    const buttons = Array.from(modal.querySelectorAll('.action-btn'))
      .filter((el) => el && !el.disabled);
    if (buttons.length === 0) return allOptions.length > 0;

    const preferred = [
      /Confirm Discard/i,
      /Confirm Selection/i,
      /^Confirm$/i,
      /Place on Top/i,
      /Place on Bottom/i,
      /^Done$/i,
      /^OK$/i
    ];
    for (const pattern of preferred) {
      const btn = buttons.find((el) => pattern.test((el.textContent || '').trim()));
      if (btn) {
        btn.click();
        return true;
      }
    }

    // Last resort: choose first visible non-cancel button.
    const nonCancel = buttons.find((el) => !/(cancel|close)/i.test((el.textContent || '').trim()));
    (nonCancel || buttons[0]).click();
    return true;
  });
}

async function resolveAllModals(actorPage, responderPage, maxCycles = 32) {
  for (let cycle = 0; cycle < maxCycles; cycle += 1) {
    let acted = false;
    acted = (await resolveModalOnPage(responderPage)) || acted;
    acted = (await resolveModalOnPage(actorPage)) || acted;

    const actorVisible = await isModalVisible(actorPage);
    const responderVisible = await isModalVisible(responderPage);
    const actorOverlay = await isRemoteOverlayVisible(actorPage);
    const responderOverlay = await isRemoteOverlayVisible(responderPage);
    const actorActionable = actorVisible && !actorOverlay;
    const responderActionable = responderVisible && !responderOverlay;

    if (!actorActionable && !responderActionable) return;
    if (!acted) {
      await actorPage.waitForTimeout(180);
    } else {
      await actorPage.waitForTimeout(120);
    }
  }

  throw new Error('Modal resolution loop exceeded max cycles.');
}

async function playCardInteraction(actorPage, responderPage, type, cardName) {
  await addPlaytestCardByName(actorPage, type, cardName);
  await actorPage.waitForTimeout(120);

  const handCard = actorPage.locator('#hand-cards .card', { hasText: cardName }).first();
  assert(await handCard.count(), `Hand card not found after add: ${cardName}`);
  await handCard.click();

  const actionLabel = type === 'supporter'
    ? 'Play Supporter'
    : (type === 'stadium' ? 'Play Stadium' : 'Play Item');

  const playBtn = actorPage.locator('#action-modal .action-btn', { hasText: actionLabel }).first();
  assert(await playBtn.count(), `Expected action button ${actionLabel} for ${cardName}`);
  await playBtn.click();

  await actorPage.waitForTimeout(180);
  try {
    await resolveAllModals(actorPage, responderPage);
  } catch (error) {
    const debug = await Promise.all([actorPage, responderPage].map(async (pg, idx) => {
      return pg.evaluate((pageIndex) => {
        const modal = document.getElementById('action-modal');
        const overlay = document.getElementById('remote-prompt-overlay');
        return {
          pageIndex,
          modalVisible: !!modal && !modal.classList.contains('hidden'),
          overlayVisible: !!overlay && !overlay.classList.contains('hidden'),
          modalText: (document.getElementById('action-content')?.textContent || '').slice(0, 220)
        };
      }, idx + 1);
    }));
    throw new Error(`${cardName} modal resolution failed: ${error.message} debug=${JSON.stringify(debug)}`);
  }
}

function pageForLocalPlayer(p1, p2, lp1, targetPlayer) {
  return lp1 === targetPlayer ? p1 : p2;
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const c1 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const c2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();

  const pageErrors = [];
  const consoleErrors = [];

  const captureConsole = (tag, msg) => {
    const type = msg.type();
    if (type === 'error') {
      const text = `${tag}:${msg.text()}`;
      consoleErrors.push(text);
    }
  };

  p1.on('pageerror', (err) => pageErrors.push(`p1:${String(err)}`));
  p2.on('pageerror', (err) => pageErrors.push(`p2:${String(err)}`));
  p1.on('console', (msg) => captureConsole('p1', msg));
  p2.on('console', (msg) => captureConsole('p2', msg));

  await p1.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });
  await p2.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => ''; });

  const room = `9${Math.floor(Math.random() * 900 + 100)}`;
  await Promise.all([
    p1.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' }),
    p2.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' })
  ]);

  await Promise.all([p1.check('#multiplayer-toggle'), p2.check('#multiplayer-toggle')]);
  await Promise.all([p1.check('#playtest-mode-toggle'), p2.check('#playtest-mode-toggle')]);
  await Promise.all([p1.fill('#multiplayer-room', room), p2.fill('#multiplayer-room', room)]);

  await p1.click('#start-game-btn');
  await p2.click('#start-game-btn');

  await Promise.all([
    p1.waitForSelector('#game-container:not(.hidden)'),
    p2.waitForSelector('#game-container:not(.hidden)')
  ]);

  const [lp1, lp2] = await Promise.all([waitForLocalPlayer(p1), waitForLocalPlayer(p2)]);
  assert(lp1 !== lp2, `Expected unique local players, got ${lp1} and ${lp2}`);

  await chooseActiveAndConfirm(p1);
  await chooseActiveAndConfirm(p2);
  await Promise.all([waitForMainPhase(p1), waitForMainPhase(p2)]);
  await assertSynced(p1, p2, 'after setup');

  const player1Page = pageForLocalPlayer(p1, p2, lp1, 1);
  const player2Page = pageForLocalPlayer(p1, p2, lp1, 2);

  const turn1Interactions = [
    { type: 'item', name: 'Printed Score' },
    { type: 'item', name: 'Annotated Score' },
    { type: 'item', name: 'Dress Rehearsal Roster' },
    { type: 'item', name: 'Concert Program' }
  ];

  for (const interaction of turn1Interactions) {
    await playCardInteraction(player1Page, player2Page, interaction.type, interaction.name);
    await assertSynced(p1, p2, `after P1 ${interaction.name}`);
  }

  await player1Page.click('#end-turn-btn');
  await waitForCurrentPlayer(p1, p2, 2);
  await assertSynced(p1, p2, 'after end turn to P2');

  const turn2Interactions = [
    { type: 'item', name: 'Printed Score' },
    { type: 'item', name: 'Annotated Score' },
    { type: 'item', name: 'Cast Reserve' }
  ];

  for (const interaction of turn2Interactions) {
    await playCardInteraction(player2Page, player1Page, interaction.type, interaction.name);
    await assertSynced(p1, p2, `after P2 ${interaction.name}`);
  }

  assert(pageErrors.length === 0, `Page errors detected:\n${pageErrors.join('\n')}`);
  assert(consoleErrors.length === 0, `Console errors detected:\n${consoleErrors.join('\n')}`);

  await browser.close();
  console.log('Multiplayer sync stress test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
