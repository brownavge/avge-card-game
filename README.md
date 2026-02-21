# avge-card-game

## Run locally (single player)

This project uses ES modules. Open it with a simple local server:

- Python: `python3 -m http.server 8000`
- Then visit: http://localhost:8000

If you prefer a different server, any static file server works.

## Run locally (multiplayer)

Start the Node server (serves static files + WebSocket relay):

1) `npm install`
2) `npm run server`
3) Open http://localhost:3000 in two browser windows
4) Enable Multiplayer mode and enter the same room code on both

Notes:
- Multiplayer currently syncs by broadcasting state snapshots from the acting client.
- It is not yet server‑authoritative; use trusted clients for now.
- RNG is deterministic via shared seed to keep clients aligned.

## Structure (refactor)

- cards.js: card database module (imports shared constants)
- src/constants.js: shared type and effectiveness constants
- src/utils/energy.js: energy symbol helpers
- game.js: main game logic and UI (ES module entry)
- server/: websocket relay server
- shared/: multiplayer action/state helpers
