import fs from 'fs';
import path from 'path';

const ROOMS_DIR = path.join(process.cwd(), 'server', 'storage', 'rooms');
const SNAPSHOT_INTERVAL = 20;

function ensureRoomsDir() {
  if (!fs.existsSync(ROOMS_DIR)) {
    fs.mkdirSync(ROOMS_DIR, { recursive: true });
  }
}

function roomPath(roomId) {
  return path.join(ROOMS_DIR, `${roomId}.json`);
}

export function loadRoom(roomId) {
  ensureRoomsDir();
  const file = roomPath(roomId);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function saveRoom(room) {
  ensureRoomsDir();
  const file = roomPath(room.id);
  const payload = {
    id: room.id,
    config: room.config,
    state: room.state,
    serverSeq: room.serverSeq,
    actionLog: room.actionLog,
    players: room.players
  };
  fs.writeFileSync(file, JSON.stringify(payload));
}

export function shouldSnapshot(room) {
  return room.serverSeq % SNAPSHOT_INTERVAL === 0;
}
