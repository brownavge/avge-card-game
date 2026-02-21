import crypto from 'crypto';
import { createGameState } from '../shared/state.js';
import { loadRoom, saveRoom } from './storage/RoomStore.js';

const rooms = new Map();

export function createRoom(roomId, { deck1Name, deck2Name, playtestMode }) {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const config = { deck1Name, deck2Name, playtestMode, seed };
  const state = createGameState({ deck1Name, deck2Name, playtestMode, seed });
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
    players: {}
  };
  rooms.set(roomId, room);
  saveRoom(room);
  return room;
}

export function getRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  const persisted = loadRoom(roomId);
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
    players: persisted.players || {}
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

  rooms.set(roomId, room);
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
