import express from 'express';
import { WebSocketServer } from 'ws';
import {
  createRoom,
  getRoom,
  addClientToRoom,
  removeClientFromRoom,
  assignPlayer,
  touchSession,
  persistRoom,
  generateRoomId,
  registerDeckForSession,
  roomReady
} from './roomManager.js';
import { ACTION_TYPES, SERVER_EVENTS, VALID_GAME_ACTION_TYPES } from '../shared/actions.js';
import { applyAction } from '../shared/state.js';
import { createGameState } from '../shared/state.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(process.cwd()));

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateCardArray(arr, maxLen = 80) {
  if (!Array.isArray(arr) || arr.length > maxLen) return false;
  return arr.every((card) => !card || isPlainObject(card));
}

function validateBenchArray(arr) {
  if (!Array.isArray(arr) || arr.length !== 3) return false;
  return arr.every((card) => card === null || isPlainObject(card));
}

function validateCustomDeckCards(cards) {
  if (cards == null) return true;
  if (!Array.isArray(cards) || cards.length === 0 || cards.length > 80) return false;
  return cards.every((card) => (
    isPlainObject(card) &&
    typeof card.name === 'string' &&
    card.name.length > 0 &&
    card.name.length <= 120 &&
    typeof card.cardCategory === 'string' &&
    card.cardCategory.length > 0 &&
    card.cardCategory.length <= 40
  ));
}

function isPlausibleStateSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) return false;
  if (![1, 2].includes(Number(snapshot.currentPlayer))) return false;
  if (!Number.isInteger(snapshot.turn) || snapshot.turn < 1 || snapshot.turn > 5000) return false;
  if (typeof snapshot.randomState !== 'undefined' && !Number.isFinite(Number(snapshot.randomState))) return false;
  if (!isPlainObject(snapshot.players)) return false;

  for (const playerNum of [1, 2]) {
    const player = snapshot.players[playerNum];
    if (!isPlainObject(player)) return false;
    if (!validateCardArray(player.hand, 80)) return false;
    if (!validateCardArray(player.deck, 120)) return false;
    if (!validateCardArray(player.discard, 200)) return false;
    if (!validateBenchArray(player.bench)) return false;
    if (!(player.active === null || isPlainObject(player.active))) return false;
    if (!Number.isInteger(Number(player.koCount)) || Number(player.koCount) < 0 || Number(player.koCount) > 10) return false;
  }

  if (!(snapshot.stadium === null || isPlainObject(snapshot.stadium))) return false;
  if (snapshot.log && !Array.isArray(snapshot.log)) return false;
  return true;
}

function normalizeRequestedRoomId(roomId) {
  if (!roomId) return null;
  const cleaned = String(roomId).trim().replace(/\D/g, '');
  if (cleaned.length !== 4) return null;
  return cleaned;
}

function isValidDeckName(deckName) {
  if (typeof deckName !== 'string') return false;
  const trimmed = deckName.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('custom:')) return trimmed.length > 7;
  // Allow template identifiers used by the client.
  const validTemplates = new Set([
    'strings-aggro',
    'piano-control',
    'percussion-midrange',
    'choir-healing',
    'brass-tempo',
    'woodwinds-control',
    'tank-control',
    'piano-choir-control',
    'strings-woodwinds',
    'all-types',
    'high-hp'
  ]);
  return validTemplates.has(trimmed);
}

wss.on('connection', (ws) => {
  ws.rateLimit = {
    windowStart: Date.now(),
    count: 0
  };
  ws.lastClientSeq = 0;

  ws.on('message', (raw) => {
    const rawSize = typeof raw === 'string' ? raw.length : (raw?.length || 0);
    if (rawSize > 1_000_000) {
      ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Message too large' }));
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (error) {
      ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid JSON' }));
      return;
    }

    if (msg.type === ACTION_TYPES.JOIN) {
      const {
        roomId: requestedRoomId,
        deckName = null,
        customDeckCards = null,
        playtestMode = false
      } = msg;
      if (!isValidDeckName(deckName)) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid deck selection.' }));
        return;
      }
      if (!validateCustomDeckCards(customDeckCards)) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid custom deck payload.' }));
        return;
      }

      const normalizedRequestedRoomId = normalizeRequestedRoomId(requestedRoomId);
      let roomId = normalizedRequestedRoomId;
      let room = roomId ? getRoom(roomId) : null;

      if (!room) {
        roomId = roomId || generateRoomId();
        room = createRoom(roomId, { playtestMode });
      }

      addClientToRoom(roomId, ws);
      ws.roomId = roomId;
      const session = assignPlayer(room);
      if (!session || !session.playerNumber) {
        removeClientFromRoom(roomId, ws);
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Room is full.' }));
        return;
      }
      ws.playerNumber = session.playerNumber;
      ws.sessionToken = session.sessionToken;

      registerDeckForSession(room, session.sessionToken, deckName, customDeckCards);

      if (roomReady(room) && !room.state) {
        room.state = createGameState({
          deck1Name: room.config.deck1Name,
          deck2Name: room.config.deck2Name,
          playtestMode: !!room.config.playtestMode,
          seed: room.config.seed
        });
      }

      ws.send(JSON.stringify({
        type: SERVER_EVENTS.ROOM_JOINED,
        roomId,
        seed: room.config.seed,
        config: room.config,
        playerNumber: session.playerNumber,
        sessionToken: session.sessionToken,
        waitingForOpponent: !roomReady(room)
      }));

      if (roomReady(room) && !room.readyAnnounced) {
        room.readyAnnounced = true;
        broadcast(room, {
          type: SERVER_EVENTS.ROOM_READY,
          roomId,
          seed: room.config.seed,
          config: room.config,
          serverSeq: room.serverSeq
        }, null);
      }

      if (room.state) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.FULL_STATE, state: room.state, serverSeq: room.serverSeq }));
      }
      return;
    }

    if (msg.type === ACTION_TYPES.RESUME) {
      const {
        roomId,
        sessionToken,
        deckName = null,
        customDeckCards = null
      } = msg;
      const room = getRoom(roomId);
      if (!room || !sessionToken || !room.sessions.has(sessionToken)) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid resume token.' }));
        return;
      }
      if (!validateCustomDeckCards(customDeckCards)) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid custom deck payload.' }));
        return;
      }

      addClientToRoom(roomId, ws);
      ws.roomId = roomId;
      ws.sessionToken = sessionToken;
      const session = room.sessions.get(sessionToken);
      ws.playerNumber = session.playerNumber;
      touchSession(room, sessionToken);
      if (deckName) {
        if (!isValidDeckName(deckName)) {
          ws.send(JSON.stringify({ type: SERVER_EVENTS.ERROR, message: 'Invalid deck selection.' }));
          return;
        }
        registerDeckForSession(room, sessionToken, deckName, customDeckCards);
      }

      if (roomReady(room) && !room.state) {
        room.state = createGameState({
          deck1Name: room.config.deck1Name,
          deck2Name: room.config.deck2Name,
          playtestMode: !!room.config.playtestMode,
          seed: room.config.seed
        });
      }

      ws.send(JSON.stringify({
        type: SERVER_EVENTS.ROOM_JOINED,
        roomId,
        seed: room.config.seed,
        config: room.config,
        playerNumber: session.playerNumber,
        sessionToken,
        waitingForOpponent: !roomReady(room)
      }));
      if (room.state) {
        ws.send(JSON.stringify({ type: SERVER_EVENTS.FULL_STATE, state: room.state, serverSeq: room.serverSeq }));
      }
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

      const isEndTurnAction = action.type === 'CALL' && action.payload && action.payload.name === 'endTurnAction';

      const incomingState = action.payload && action.payload.state ? action.payload.state : null;
      const effectiveCurrentPlayer = (incomingState && incomingState.currentPlayer) || (room.state && room.state.currentPlayer);

      if (!isEndTurnAction && action.type === 'STATE_SNAPSHOT' && effectiveCurrentPlayer && action.playerNumber) {
        if (action.playerNumber !== effectiveCurrentPlayer) {
          ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Not your turn.' }));
          return;
        }
      }

      if (action.type === 'CALL' && action.payload && action.payload.name) {
        const actionName = action.payload.name;
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
          'executeSteinertPracticeDiscard',
          'STATE_SNAPSHOT',
          'executeGachaGaming',
          'executeGachaGamingStep',
          'finalizeGachaGaming'
        ]);
        const modalInteractionPrefixes = ['show', 'toggle', 'confirm', 'cancel', 'select', 'set'];
        const prefixAllowed = modalInteractionPrefixes.some((prefix) => actionName.startsWith(prefix));
        const canPlaceInitialActive = actionName === 'chooseOpeningActive';
        const canConfirmInitialSetup = actionName === 'setOpeningReady';
        if (effectiveCurrentPlayer && action.playerNumber) {
          const isOffTurnAllowed = offTurnAllowed.has(actionName) || prefixAllowed || canPlaceInitialActive || canConfirmInitialSetup;
          if (!isEndTurnAction && !isOffTurnAllowed && action.playerNumber !== effectiveCurrentPlayer) {
            ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Not your turn.' }));
            return;
          }
        }
      }

      const actionName = action && action.type === 'CALL' && action.payload ? action.payload.name : null;
      const isUiOnlyShowAction = typeof actionName === 'string' && actionName.startsWith('show');
      const modalWorkflowPrefixes = ['show', 'toggle', 'confirm', 'cancel', 'select', 'choose', 'execute', 'place', 'add', 'move', 'finalize', 'complete', 'discard', 'set'];
      const isModalWorkflowAction = typeof actionName === 'string' && modalWorkflowPrefixes.some((prefix) => actionName.startsWith(prefix));
      let stateUpdated = false;

      if (!isUiOnlyShowAction && action.payload && action.payload.state) {
        if (Number(ws.playerNumber) !== 1 && !isModalWorkflowAction) {
          ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Only host may sync state.' }));
          return;
        }
        if (!isPlausibleStateSnapshot(action.payload.state)) {
          ws.send(JSON.stringify({ type: SERVER_EVENTS.ACTION_REJECTED, reason: 'Invalid state snapshot.' }));
          return;
        }
        try {
          room.state = applyAction(room.state, {
            type: 'STATE_SNAPSHOT',
            payload: { state: action.payload.state }
          });
          room.hasSyncedState = true;
          stateUpdated = true;
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

      if (!isUiOnlyShowAction && stateUpdated) {
        broadcast(room, {
          type: SERVER_EVENTS.STATE_UPDATE,
          state: room.state,
          serverSeq: room.serverSeq
        }, null);
      }
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
