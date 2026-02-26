import crypto from 'crypto';
import { createGameState } from '../shared/state.js';
import { loadRoom, saveRoom } from './storage/RoomStore.js';

const rooms = new Map();

function normalizeRoomId(roomId) {
  if (!roomId) return null;
  const cleaned = String(roomId).trim().replace(/\D/g, '');
  if (cleaned.length !== 4) return null;
  return cleaned;
}

function isRoomReady(room) {
  return !!(room && room.config && room.config.deck1Name && room.config.deck2Name);
}

export function generateRoomId() {
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code) && !loadRoom(code)) {
      return code;
    }
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function createRoom(roomId, { deck1Name = null, deck2Name = null, playtestMode = false } = {}) {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const config = { deck1Name, deck2Name, playtestMode, seed };
  const state = (deck1Name && deck2Name)
    ? createGameState({ deck1Name, deck2Name, playtestMode, seed })
    : null;
  const room = {
    id: roomId,
    state,
    config,
    clients: new Set(),
    nextPlayerNumber: 1,
    hasSyncedState: false,
    serverSeq: 0,
    actionLog: [],
    sessions: new Map(),
    players: {},
    readyAnnounced: false
  };
  rooms.set(roomId, room);
  saveRoom(room);
  return room;
}

export function getRoom(roomId) {
  const normalizedId = normalizeRoomId(roomId) || String(roomId || '').trim();
  if (rooms.has(normalizedId)) return rooms.get(normalizedId);
  const persisted = loadRoom(normalizedId);
  if (!persisted) return null;

  const room = {
    id: persisted.id,
    state: persisted.state,
    config: persisted.config,
    clients: new Set(),
    nextPlayerNumber: 1,
    hasSyncedState: true,
    serverSeq: persisted.serverSeq || 0,
    actionLog: persisted.actionLog || [],
    sessions: new Map(),
    players: persisted.players || {},
    readyAnnounced: !!(persisted.config && persisted.config.deck1Name && persisted.config.deck2Name)
  };

  const assignedPlayers = Object.keys(room.players).length;
  room.nextPlayerNumber = Math.min(assignedPlayers + 1, 3);

  Object.values(room.players).forEach((player) => {
    if (player && player.sessionToken) {
      room.sessions.set(player.sessionToken, {
        sessionToken: player.sessionToken,
        playerNumber: player.playerNumber || null,
        lastSeen: Date.now()
      });
    }
  });

  rooms.set(normalizedId, room);
  return room;
}

export function addClientToRoom(roomId, client) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.clients.add(client);
  return room;
}

export function assignPlayer(room, requestedSessionToken = null) {
  if (requestedSessionToken && room.sessions.has(requestedSessionToken)) {
    const session = room.sessions.get(requestedSessionToken);
    return session;
  }

  const sessionToken = crypto.randomBytes(16).toString('hex');
  const playerNumber = room.nextPlayerNumber <= 2 ? room.nextPlayerNumber : null;
  if (room.nextPlayerNumber <= 2) {
    room.nextPlayerNumber += 1;
  }

  const session = {
    sessionToken,
    playerNumber,
    lastSeen: Date.now()
  };
  room.sessions.set(sessionToken, session);
  if (playerNumber) {
    room.players[playerNumber] = { sessionToken, playerNumber };
  }
  saveRoom(room);
  return session;
}

export function registerDeckForSession(room, sessionToken, deckName) {
  if (!room || !sessionToken || !deckName || !room.sessions.has(sessionToken)) return;
  const session = room.sessions.get(sessionToken);
  if (!session || !session.playerNumber) return;

  const playerNumber = session.playerNumber;
  if (!room.players[playerNumber]) {
    room.players[playerNumber] = { sessionToken, playerNumber };
  }
  room.players[playerNumber].deckName = deckName;

  if (playerNumber === 1 && !room.config.deck1Name) {
    room.config.deck1Name = deckName;
  }
  if (playerNumber === 2 && !room.config.deck2Name) {
    room.config.deck2Name = deckName;
  }

  if (isRoomReady(room) && !room.state) {
    room.state = createGameState({
      deck1Name: room.config.deck1Name,
      deck2Name: room.config.deck2Name,
      playtestMode: !!room.config.playtestMode,
      seed: room.config.seed
    });
  }

  saveRoom(room);
}

export function roomReady(room) {
  return isRoomReady(room);
}

export function removeClientFromRoom(roomId, client) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.clients.delete(client);
  if (room.clients.size === 0) {
    saveRoom(room);
    rooms.delete(roomId);
  }
}

export function touchSession(room, sessionToken) {
  if (!sessionToken || !room.sessions.has(sessionToken)) return;
  const session = room.sessions.get(sessionToken);
  session.lastSeen = Date.now();
  room.sessions.set(sessionToken, session);
}

export function persistRoom(room) {
  saveRoom(room);
}
