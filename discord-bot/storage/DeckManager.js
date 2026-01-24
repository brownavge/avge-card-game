// Deck Manager - Handles deck templates and custom decks
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CHARACTERS, ITEMS, TOOLS, SUPPORTERS, STADIUMS, TYPES, ENERGY_TYPES } from '../game/cards.js';
import { createCard } from '../utils/cardHelpers.js';
import { CONFIG, PREBUILT_DECKS } from '../utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DECKS_DIR = path.join(__dirname, 'decks');

// Ensure decks directory exists
await fs.mkdir(DECKS_DIR, { recursive: true });

/**
 * Get all available prebuilt deck templates
 */
export function getPrebuiltDecks() {
    return Object.keys(PREBUILT_DECKS).map(key => ({
        id: key,
        name: PREBUILT_DECKS[key]
    }));
}

/**
 * Build a deck from a template name
 */
export function buildDeck(templateName) {
    const templates = {
        'strings-aggro': buildStringsAggro,
        'guitar-rock': buildGuitarRock,
        'piano-control': buildPianoControl,
        'percussion-midrange': buildPercussionMidrange,
        'choir-support': buildChoirSupport,
        'brass-tempo': buildBrassTempo,
        'toolbox': buildToolbox
    };

    const builder = templates[templateName];
    if (!builder) {
        throw new Error(`Unknown deck template: ${templateName}`);
    }

    return builder();
}

// ======================
// PREBUILT DECK BUILDERS
// ======================

function buildStringsAggro() {
    return [
        createCard(CHARACTERS.EMILY, 'character'),
        createCard(CHARACTERS.SOPHIA, 'character'),
        createCard(CHARACTERS.ASH, 'character'),
        createCard(CHARACTERS.FIONA, 'character'),
        ...Array(10).fill(null).map(() => createCard(ENERGY_TYPES.STRINGS, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.CONCERT_PROGRAM, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.EXTENSION_CORD, 'tool'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(SUPPORTERS.MICHELLE, 'supporter'),
        createCard(STADIUMS.RILEY_HALL, 'stadium'),
        createCard(STADIUMS.RILEY_HALL, 'stadium'),
        createCard(STADIUMS.RILEY_HALL, 'stadium')
    ];
}

function buildGuitarRock() {
    return [
        createCard(CHARACTERS.ROBERTO, 'character'),
        createCard(CHARACTERS.GRACE, 'character'),
        createCard(CHARACTERS.RYAN, 'character'),
        createCard(CHARACTERS.ASH, 'character'),
        ...Array(10).fill(null).map(() => createCard(ENERGY_TYPES.GUITAR, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.MIKU_OTAMATONE, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(ITEMS.ANNOTATED_SCORE, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.AVGE_SHIRT, 'tool'),
        createCard(SUPPORTERS.ANGEL, 'supporter'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(STADIUMS.RED_ROOM, 'stadium'),
        createCard(STADIUMS.RED_ROOM, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildPianoControl() {
    return [
        createCard(CHARACTERS.KATIE, 'character'),
        createCard(CHARACTERS.DAVID, 'character'),
        createCard(CHARACTERS.JENNIE, 'character'),
        createCard(CHARACTERS.HENRY, 'character'),
        ...Array(8).fill(null).map(() => createCard(ENERGY_TYPES.PIANO, 'energy')),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.WOODWINDS, 'energy')),
        createCard(ITEMS.MATCHA_LATTE, 'item'),
        createCard(ITEMS.STRAWBERRY_MATCHA, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(ITEMS.CAMERA, 'item'),
        createCard(TOOLS.CONDUCTOR_BATON, 'tool'),
        createCard(TOOLS.MUSESCORE_SUB, 'tool'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(SUPPORTERS.VICTORIA, 'supporter'),
        createCard(STADIUMS.STEINERT_BASEMENT, 'stadium'),
        createCard(STADIUMS.STEINERT_BASEMENT, 'stadium'),
        createCard(STADIUMS.STEINERT, 'stadium')
    ];
}

function buildPercussionMidrange() {
    return [
        createCard(CHARACTERS.BOKAI, 'character'),
        createCard(CHARACTERS.PASCAL, 'character'),
        createCard(CHARACTERS.CAVIN, 'character'),
        createCard(CHARACTERS.LOANG, 'character'),
        ...Array(9).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.BRASS, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.CONCERT_PROGRAM, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.BAI_EMAIL, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(TOOLS.BUCKET, 'tool'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(SUPPORTERS.MICHELLE, 'supporter'),
        createCard(SUPPORTERS.ANGEL, 'supporter'),
        createCard(STADIUMS.MAIN_HALL, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium'),
        createCard(STADIUMS.RED_ROOM, 'stadium')
    ];
}

function buildChoirSupport() {
    return [
        createCard(CHARACTERS.RACHEL, 'character'),
        createCard(CHARACTERS.ROSS, 'character'),
        createCard(CHARACTERS.EVELYN, 'character'),
        createCard(CHARACTERS.IZZY, 'character'),
        ...Array(9).fill(null).map(() => createCard(ENERGY_TYPES.CHOIR, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.WOODWINDS, 'energy')),
        createCard(ITEMS.MATCHA_LATTE, 'item'),
        createCard(ITEMS.STRAWBERRY_MATCHA, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.CAMERA, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.KIKI_HEADBAND, 'tool'),
        createCard(SUPPORTERS.ANGEL, 'supporter'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(STADIUMS.FRIEDMAN, 'stadium'),
        createCard(STADIUMS.FRIEDMAN, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildBrassTempo() {
    return [
        createCard(CHARACTERS.KEI, 'character'),
        createCard(CHARACTERS.RYAN, 'character'),
        createCard(CHARACTERS.MARCUS, 'character'),
        createCard(CHARACTERS.LILY, 'character'),
        ...Array(9).fill(null).map(() => createCard(ENERGY_TYPES.BRASS, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.MIKU_OTAMATONE, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(ITEMS.BAI_EMAIL, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(TOOLS.CONDUCTOR_BATON, 'tool'),
        createCard(TOOLS.EXTENSION_CORD, 'tool'),
        createCard(SUPPORTERS.LUCAS, 'supporter'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(STADIUMS.LINDEMANN, 'stadium'),
        createCard(STADIUMS.LINDEMANN, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildToolbox() {
    return [
        createCard(CHARACTERS.KATIE, 'character'),
        createCard(CHARACTERS.GRACE, 'character'),
        createCard(CHARACTERS.BOKAI, 'character'),
        createCard(CHARACTERS.ROSS, 'character'),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.PIANO, 'energy')),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.GUITAR, 'energy')),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.CHOIR, 'energy')),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.SE_ROSTER, 'item'),
        createCard(ITEMS.CONCERT_PROGRAM, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(ITEMS.BAI_EMAIL, 'item'),
        createCard(TOOLS.KIKI_HEADBAND, 'tool'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(SUPPORTERS.LUCAS, 'supporter'),
        createCard(SUPPORTERS.VICTORIA, 'supporter'),
        createCard(STADIUMS.MAIN_HALL, 'stadium'),
        createCard(STADIUMS.SALOMON_DECI, 'stadium')
    ];
}

// ======================
// CUSTOM DECK MANAGEMENT
// ======================

/**
 * Save a custom deck for a user
 */
export async function saveCustomDeck(userId, deckName, cards) {
    // Validate deck
    if (cards.length !== CONFIG.DECK_SIZE) {
        throw new Error(`Deck must have exactly ${CONFIG.DECK_SIZE} cards`);
    }

    const characterCount = cards.filter(c => c.cardType === 'character').length;
    if (characterCount === 0) {
        throw new Error('Deck must have at least one character');
    }

    // Load user's decks
    const userDecks = await loadUserDecks(userId);

    // Add or update deck
    userDecks[deckName] = cards;

    // Save to file
    const filePath = path.join(DECKS_DIR, `${userId}.json`);
    await fs.writeFile(filePath, JSON.stringify(userDecks, null, 2), 'utf8');

    return true;
}

/**
 * Load all custom decks for a user
 */
export async function loadUserDecks(userId) {
    const filePath = path.join(DECKS_DIR, `${userId}.json`);

    try {
        const json = await fs.readFile(filePath, 'utf8');
        return JSON.parse(json);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // No decks yet
        }
        throw error;
    }
}

/**
 * Load a specific custom deck
 */
export async function loadCustomDeck(userId, deckName) {
    const userDecks = await loadUserDecks(userId);
    return userDecks[deckName] || null;
}

/**
 * Delete a custom deck
 */
export async function deleteCustomDeck(userId, deckName) {
    const userDecks = await loadUserDecks(userId);

    if (!userDecks[deckName]) {
        return false;
    }

    delete userDecks[deckName];

    const filePath = path.join(DECKS_DIR, `${userId}.json`);
    await fs.writeFile(filePath, JSON.stringify(userDecks, null, 2), 'utf8');

    return true;
}

/**
 * List all deck names for a user (prebuilt + custom)
 */
export async function listUserDecks(userId) {
    const prebuilt = getPrebuiltDecks();
    const custom = await loadUserDecks(userId);

    return {
        prebuilt,
        custom: Object.keys(custom).map(name => ({ id: name, name, custom: true }))
    };
}
