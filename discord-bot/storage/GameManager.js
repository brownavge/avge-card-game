// Game Manager - Handles game persistence
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameState } from '../game/GameState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAMES_DIR = path.join(__dirname, 'games');

// Ensure games directory exists
await fs.mkdir(GAMES_DIR, { recursive: true });

/**
 * Create and save a new game
 */
export async function createGame(player1Id, player2Id, deck1, deck2) {
    const game = new GameState(player1Id, player2Id, deck1, deck2);
    await saveGame(game);
    return game;
}

/**
 * Save game state to JSON file
 */
export async function saveGame(gameState) {
    const filePath = path.join(GAMES_DIR, `${gameState.gameId}.json`);
    const json = JSON.stringify(gameState.toJSON(), null, 2);
    await fs.writeFile(filePath, json, 'utf8');
    return gameState.gameId;
}

/**
 * Load game state from JSON file
 */
export async function loadGame(gameId) {
    const filePath = path.join(GAMES_DIR, `${gameId}.json`);

    try {
        const json = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(json);
        return GameState.fromJSON(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // Game not found
        }
        throw error;
    }
}

/**
 * Delete a game file
 */
export async function deleteGame(gameId) {
    const filePath = path.join(GAMES_DIR, `${gameId}.json`);

    try {
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false; // Already deleted
        }
        throw error;
    }
}

/**
 * Get all active games for a user
 */
export async function getActiveGames(userId) {
    const files = await fs.readdir(GAMES_DIR);
    const games = [];

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const gameId = file.replace('.json', '');
        const game = await loadGame(gameId);

        if (game && (game.player1Id === userId || game.player2Id === userId)) {
            games.push({
                gameId: game.gameId,
                player1Id: game.player1Id,
                player2Id: game.player2Id,
                turn: game.turn,
                phase: game.phase,
                currentPlayer: game.currentPlayer
            });
        }
    }

    return games;
}

/**
 * Get all active games (for spectator mode)
 */
export async function getAllActiveGames() {
    const files = await fs.readdir(GAMES_DIR);
    const games = [];

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const gameId = file.replace('.json', '');
        const game = await loadGame(gameId);

        if (game && game.phase !== 'gameover') {
            games.push({
                gameId: game.gameId,
                player1Id: game.player1Id,
                player2Id: game.player2Id,
                turn: game.turn,
                phase: game.phase
            });
        }
    }

    return games;
}

/**
 * Check if user is in an active game
 */
export async function isUserInGame(userId) {
    const games = await getActiveGames(userId);
    return games.length > 0;
}

/**
 * Clean up finished games older than 24 hours
 */
export async function cleanupOldGames() {
    const files = await fs.readdir(GAMES_DIR);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const gameId = file.replace('.json', '');
        const game = await loadGame(gameId);

        if (game && game.phase === 'gameover') {
            // Extract timestamp from gameId (format: player1_player2_timestamp)
            const parts = gameId.split('_');
            const timestamp = parseInt(parts[parts.length - 1]);

            if (timestamp < oneDayAgo) {
                await deleteGame(gameId);
                cleaned++;
            }
        }
    }

    return cleaned;
}
