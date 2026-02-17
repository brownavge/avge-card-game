# avge-card-game

## Run locally

This project now uses ES modules. Open it with a simple local server:

- Python: `python3 -m http.server 8000`
- Then visit: http://localhost:8000

If you prefer a different server, any static file server works.

## Structure (refactor)

- cards.js: card database module (imports shared constants)
- src/constants.js: shared type and effectiveness constants
- src/utils/energy.js: energy symbol helpers
- game.js: main game logic and UI (ES module entry)
