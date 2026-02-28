import WebSocket from 'ws';

function waitForMessage(ws, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for message')), timeoutMs);
    ws.once('message', (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

async function run() {
  const ws = new WebSocket('ws://localhost:3001');

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  ws.send(JSON.stringify({
    type: 'JOIN',
    deckName: 'strings-aggro',
    playtestMode: false
  }));

  let joined = false;
  let roomId = null;
  for (let i = 0; i < 4; i += 1) {
    const msg = await waitForMessage(ws);
    if (msg.type === 'ROOM_JOINED') {
      joined = true;
      roomId = msg.roomId;
      break;
    }
  }

  if (!joined) {
    throw new Error('Did not receive ROOM_JOINED');
  }

  ws.send(JSON.stringify({
    type: 'ACTION',
    clientSeq: 1,
    action: {
      type: 'CALL',
      playerNumber: 1,
      payload: {
        name: 'noopTest',
        state: {
          currentPlayer: 1,
          turn: 1,
          players: { 1: { hand: [] } } // intentionally invalid shape
        }
      }
    }
  }));

  let sawRejection = false;
  for (let i = 0; i < 4; i += 1) {
    const msg = await waitForMessage(ws);
    if (msg.type === 'ACTION_REJECTED') {
      sawRejection = true;
      if (!String(msg.reason || '').includes('Invalid state snapshot')) {
        throw new Error(`Unexpected rejection reason: ${msg.reason}`);
      }
      break;
    }
  }

  ws.close();
  if (!sawRejection) {
    throw new Error(`Invalid snapshot was not rejected for room ${roomId}`);
  }
  console.log('Server snapshot validation test passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
