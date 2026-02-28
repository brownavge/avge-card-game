import WebSocket from 'ws';

function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

function nextMessage(ws, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timed out waiting for message')), timeoutMs);
    ws.once('message', (raw) => {
      clearTimeout(t);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

async function collectUntil(ws, predicate, maxMessages = 20) {
  const seen = [];
  for (let i = 0; i < maxMessages; i += 1) {
    const msg = await nextMessage(ws);
    seen.push(msg);
    if (predicate(msg, seen)) return { match: msg, seen };
  }
  throw new Error(`Predicate not satisfied. Messages: ${JSON.stringify(seen, null, 2)}`);
}

function sendJoin(ws, { roomId, deckName }) {
  ws.send(JSON.stringify({
    type: 'JOIN',
    roomId,
    deckName,
    playtestMode: false
  }));
}

async function run() {
  const host = new WebSocket('ws://localhost:3001');
  await waitForOpen(host);
  sendJoin(host, { roomId: '', deckName: 'strings-aggro' });
  const hostJoin = await collectUntil(host, (m) => m.type === 'ROOM_JOINED');
  const roomId = hostJoin.match.roomId;
  if (!roomId) throw new Error('Host join did not return roomId');

  const guest = new WebSocket('ws://localhost:3001');
  await waitForOpen(guest);
  sendJoin(guest, { roomId, deckName: 'piano-control' });

  const guestJoin = await collectUntil(guest, (m) => m.type === 'ROOM_JOINED');
  if (guestJoin.match.playerNumber !== 2) throw new Error(`Expected guest to be player 2, got ${guestJoin.match.playerNumber}`);

  const plausibleState = {
    currentPlayer: 1,
    turn: 1,
    randomState: 1,
    players: {
      1: {
        hand: [],
        deck: [],
        discard: [],
        bench: [null, null, null],
        active: null,
        koCount: 0
      },
      2: {
        hand: [],
        deck: [],
        discard: [],
        bench: [null, null, null],
        active: null,
        koCount: 0
      }
    },
    stadium: null,
    log: []
  };

  // Guest sends a CALL with a state snapshot; server should reject because only host may sync state.
  guest.send(JSON.stringify({
    type: 'ACTION',
    clientSeq: 1,
    action: {
      type: 'CALL',
      playerNumber: 2,
      payload: {
        name: 'toggleSongVotingCard', // off-turn/prefix-allowed name
        args: ['fake-card-id'],
        state: plausibleState
      }
    }
  }));

  const guestReject = await collectUntil(guest, (m) => m.type === 'ACTION_REJECTED');
  if (!String(guestReject.match.reason || '').includes('Only host may sync state')) {
    throw new Error(`Unexpected guest rejection reason: ${guestReject.match.reason}`);
  }

  // Guest sends an action without a snapshot. Server should broadcast ACTION_BROADCAST but not STATE_UPDATE.
  guest.send(JSON.stringify({
    type: 'ACTION',
    clientSeq: 2,
    action: {
      type: 'CALL',
      playerNumber: 2,
      payload: {
        name: 'toggleSongVotingCard',
        args: ['fake-card-id']
      }
    }
  }));

  let sawActionBroadcast = false;
  let sawStateUpdate = false;
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    const remaining = Math.max(50, deadline - Date.now());
    try {
      const msg = await nextMessage(host, remaining);
      if (msg.type === 'ACTION_BROADCAST') sawActionBroadcast = true;
      if (msg.type === 'STATE_UPDATE') sawStateUpdate = true;
      if (sawActionBroadcast) break;
    } catch {
      break;
    }
  }

  if (!sawActionBroadcast) {
    throw new Error('Expected host to receive ACTION_BROADCAST for guest action without snapshot');
  }
  if (sawStateUpdate) {
    throw new Error('Server should not send STATE_UPDATE for guest action without host snapshot');
  }

  // Host snapshot sync should still be accepted.
  host.send(JSON.stringify({
    type: 'ACTION',
    clientSeq: 1,
    action: {
      type: 'CALL',
      playerNumber: 1,
      payload: {
        name: 'STATE_SNAPSHOT',
        args: [],
        state: plausibleState
      }
    }
  }));

  const hostBroadcast = await collectUntil(host, (m) => m.type === 'ACTION_BROADCAST');
  if (hostBroadcast.match.type !== 'ACTION_BROADCAST') {
    throw new Error('Expected ACTION_BROADCAST after host snapshot');
  }
  const hostStateUpdate = await collectUntil(host, (m) => m.type === 'STATE_UPDATE');
  if (hostStateUpdate.match.type !== 'STATE_UPDATE') {
    throw new Error('Expected STATE_UPDATE after host snapshot');
  }

  host.close();
  guest.close();
  console.log('Host-authority multiplayer test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
