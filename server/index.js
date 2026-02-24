import express from 'express';
import { WebSocketServer } from 'ws';
import { createRoom, getRoom, addClientToRoom, removeClientFromRoom, assignPlayer, touchSession, persistRoom } from './roomManager.js';
import { ACTION_TYPES, SERVER_EVENTS, VALID_GAME_ACTION_TYPES } from '../shared/actions.js';
import { applyAction } from '../shared/state.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(process.cwd()));

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.rateLimit = {
    windowStart: Date.now(),
    count: 0
  };
  ws.lastClientSeq = 0;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (error) {
      ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid JSON' }));
      return;
    }

    if (msg.type === ACTION_TYPES.JOIN) {
      const { roomId, deck1Name = 'strings-aggro', deck2Name = 'piano-control', playtestMode = false } = msg;
      let room = getRoom(roomId);
      if (!room) {
        room = createRoom(roomId, { deck1Name, deck2Name, playtestMode });
      }
      addClientToRoom(roomId, ws);
      ws.roomId = roomId;
      const session = assignPlayer(room);
      ws.playerNumber = session.playerNumber;
      ws.sessionToken = session.sessionToken;
      ws.send(JSON.stringify({
        type: SERVER_EVENTS.ROOM_JOINED,
        roomId,
        seed: room.config.seed,
        config: room.config,
        playerNumber: session.playerNumber,
        sessionToken: session.sessionToken
      }));
      ws.send(JSON.stringify({ type: SERVER_EVENTS.FULL_STATE, state: room.state, serverSeq: room.serverSeq }));
      return;
    }

    if (msg.type === ACTION_TYPES.RESUME) {
      const { roomId, sessionToken } = msg;
      const room = getRoom(roomId);
      if (!room || !sessionToken || !room.sessions.has(sessionToken)) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid resume token.' }));
        return;
      }

      addClientToRoom(roomId, ws);
      ws.roomId = roomId;
      ws.sessionToken = sessionToken;
      const session = room.sessions.get(sessionToken);
      ws.playerNumber = session.playerNumber;
      touchSession(room, sessionToken);

      ws.send(JSON.stringify({
        type: SERVER_EVENTS.ROOM_JOINED,
        roomId,
        seed: room.config.seed,
        config: room.config,
        playerNumber: session.playerNumber,
        sessionToken
      }));
      ws.send(JSON.stringify({ type: SERVER_EVENTS.FULL_STATE, state: room.state, serverSeq: room.serverSeq }));
      return;
    }

    if (msg.type === ACTION_TYPES.PING) {
      ws.send(JSON.stringify({ type: ACTION_TYPES.PONG, time: Date.now() }));
      return;
    }

    if (!ws.roomId) {
      ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Join a room first.' }));
      return;
    }

    const room = getRoom(ws.roomId);
    if (!room) {
      ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Room not found.' }));
      return;
    }

    if (msg.type === ACTION_TYPES.ACTION) {
      const { action, clientSeq } = msg;
      if (!action || !ws.playerNumber) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Invalid action or player.' }));
        return;
      }

      if (typeof clientSeq === 'number' && clientSeq <= ws.lastClientSeq) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Out-of-order action.' }));
        return;
      }
      if (typeof clientSeq === 'number') {
        ws.lastClientSeq = clientSeq;
      }

      if (!VALID_GAME_ACTION_TYPES.has(action.type)) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Unknown action type.' }));
        return;
      }

      const now = Date.now();
      if (now - ws.rateLimit.windowStart > 1000) {
        ws.rateLimit.windowStart = now;
        ws.rateLimit.count = 0;
      }
      ws.rateLimit.count += 1;
      if (ws.rateLimit.count > 30) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Rate limit exceeded.' }));
        return;
      }

      if (action.playerNumber && action.playerNumber !== ws.playerNumber) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Not your turn/action owner.' }));
        return;
      }

      if (action.type === 'STATE_SNAPSHOT' && room.state && room.state.currentPlayer && action.playerNumber) {
        if (action.playerNumber !== room.state.currentPlayer) {
          ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Not your turn.' }));
          return;
        }
      }

      if (action.type === 'CALL' && action.payload && action.payload.name) {
        const offTurnAllowed = new Set([
          'showSongVotingSelectionModal',
          'toggleSongVotingCard',
          'confirmSongVotingSelection',
          'showOpponentDiscardChoice',
          'toggleOpponentDiscardCard',
          'confirmOpponentDiscard',
          'showCastReserveOpponentChoice',
          'confirmCastReserveOpponentChoice',
          'chooseFriedmanCard',
          'shuffleBenchIntoDeck',
          'executeSteinertPracticeDiscard'
        ]);
        if (room.state && room.state.currentPlayer && action.playerNumber) {
          const isOffTurnAllowed = offTurnAllowed.has(action.payload.name);
          if (!isOffTurnAllowed && action.playerNumber !== room.state.currentPlayer) {
            ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Not your turn.' }));
            return;
          }
        }
      }

      if (action.payload && action.payload.state) {
        try {
          room.state = applyAction(room.state, {
            type: 'STATE_SNAPSHOT',
            payload: { state: action.payload.state }
          });
          room.hasSyncedState = true;
        } catch (error) {
          ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: error.message }));
          return;
        }
      }

      room.serverSeq += 1;
      room.actionLog.push({ serverSeq: room.serverSeq, clientSeq, playerNumber: ws.playerNumber, action });
      persistRoom(room);

      console.log(JSON.stringify({
        event: 'ACTION_BROADCAST',
        roomId: room.id,
        serverSeq: room.serverSeq,
        playerNumber: ws.playerNumber,
        actionType: action.type
      }));

      broadcast(room, {
        type: SERVER_EVENTS.ACTION_BROADCAST,
        action,
        serverSeq: room.serverSeq,
        playerNumber: ws.playerNumber
      }, null);
      return;
    }
  });

  ws.on('close', () => {
    if (ws.roomId) {
      removeClientFromRoom(ws.roomId, ws);
    }
  });
});

function broadcast(room, payload, exclude) {
  const data = JSON.stringify(payload);
  room.clients.forEach((client) => {
    if (client.readyState === 1 && client !== exclude) {
      client.send(data);
    }
  });
}
