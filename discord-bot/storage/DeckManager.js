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
        'toolbox': buildToolbox,
        'woodwinds-swarm': buildWoodwindsSwarm,
        'brass-fortress': buildBrassFortress,
        'guitar-perc-rush': buildGuitarPercRush,
        'piano-choir-control': buildPianoChoirControl,
        'hybrid-strings': buildHybridStrings,
        'rainbow-ensemble': buildRainbowEnsemble,
        'boss-battle': buildBossBattle
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
        createCard(CHARACTERS.EMILY_WANG, 'character'),
        createCard(CHARACTERS.SOPHIA_WANG, 'character'),
        createCard(CHARACTERS.ASHLEY_TOBY, 'character'),
        createCard(CHARACTERS.FIONA_LI, 'character'),
        ...Array(10).fill(null).map(() => createCard(ENERGY_TYPES.STRINGS, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.CONCERT_PROGRAM, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.KIKI_HEADBAND, 'tool'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(SUPPORTERS.MICHELLE, 'supporter'),
        createCard(STADIUMS.RILEY_HALL, 'stadium'),
        createCard(STADIUMS.RILEY_HALL, 'stadium'),
        createCard(STADIUMS.RILEY_HALL, 'stadium')
    ];
}

function buildGuitarRock() {
    return [
        createCard(CHARACTERS.ROBERTO_GONZALES, 'character'),
        createCard(CHARACTERS.GRACE_ZHAO, 'character'),
        createCard(CHARACTERS.HANLEI_GAO, 'character'),
        createCard(CHARACTERS.MEYA_GAO, 'character'),
        ...Array(10).fill(null).map(() => createCard(ENERGY_TYPES.GUITAR, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.MIKU_OTAMATONE, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(ITEMS.ANNOTATED_SCORE, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.AVGE_TSHIRT, 'tool'),
        createCard(SUPPORTERS.ANGEL, 'supporter'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(STADIUMS.RED_ROOM, 'stadium'),
        createCard(STADIUMS.RED_ROOM, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildPianoControl() {
    return [
        createCard(CHARACTERS.KATIE_XIANG, 'character'),
        createCard(CHARACTERS.DAVID_MAN, 'character'),
        createCard(CHARACTERS.JENNIE_WANG, 'character'),
        createCard(CHARACTERS.HENRY_WANG, 'character'),
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
        createCard(STADIUMS.STEINERT_PRACTICE, 'stadium')
    ];
}

function buildPercussionMidrange() {
    return [
        createCard(CHARACTERS.BOKAI_BI, 'character'),
        createCard(CHARACTERS.PASCAL_KIM, 'character'),
        createCard(CHARACTERS.CAVIN_XUE, 'character'),
        createCard(CHARACTERS.LOANG_CHIANG, 'character'),
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
        createCard(CHARACTERS.RACHEL_CHEN, 'character'),
        createCard(CHARACTERS.ROSS_WILLIAMS, 'character'),
        createCard(CHARACTERS.EVELYN_WU, 'character'),
        createCard(CHARACTERS.IZZY_CHEN, 'character'),
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
        createCard(CHARACTERS.KEI_WATANABE, 'character'),
        createCard(CHARACTERS.FILIP_KAMINSKI, 'character'),
        createCard(CHARACTERS.JUAN_BURGOS, 'character'),
        createCard(CHARACTERS.VINCENT_CHEN, 'character'),
        ...Array(9).fill(null).map(() => createCard(ENERGY_TYPES.BRASS, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.MIKU_OTAMATONE, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(ITEMS.BAI_EMAIL, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(TOOLS.CONDUCTOR_BATON, 'tool'),
        createCard(TOOLS.KIKI_HEADBAND, 'tool'),
        createCard(SUPPORTERS.LUCAS, 'supporter'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(STADIUMS.LINDEMANN, 'stadium'),
        createCard(STADIUMS.LINDEMANN, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildToolbox() {
    return [
        createCard(CHARACTERS.KATIE_XIANG, 'character'),
        createCard(CHARACTERS.GRACE_ZHAO, 'character'),
        createCard(CHARACTERS.BOKAI_BI, 'character'),
        createCard(CHARACTERS.ROSS_WILLIAMS, 'character'),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.PIANO, 'energy')),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.GUITAR, 'energy')),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.CHOIR, 'energy')),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.CONCERT_ROSTER, 'item'),
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

function buildWoodwindsSwarm() {
    return [
        createCard(CHARACTERS.FELIX_CHEN, 'character'),
        createCard(CHARACTERS.JAYDEN_BROWN, 'character'),
        createCard(CHARACTERS.KANA_TAKIZAWA, 'character'),
        createCard(CHARACTERS.ANNA_BROWN, 'character'),
        createCard(CHARACTERS.DESMOND_ROPER, 'character'),
        ...Array(12).fill(null).map(() => createCard(ENERGY_TYPES.WOODWINDS, 'energy')),
        createCard(ITEMS.MATCHA_LATTE, 'item'),
        createCard(ITEMS.STRAWBERRY_MATCHA, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.CONCERT_PROGRAM, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.AVGE_STICKER, 'tool'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(SUPPORTERS.JOHANN, 'supporter'),
        createCard(STADIUMS.ALUMNAE_HALL, 'stadium'),
        createCard(STADIUMS.FRIEDMAN, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildBrassFortress() {
    return [
        createCard(CHARACTERS.BARRON_LEE, 'character'),
        createCard(CHARACTERS.JUAN_BURGOS, 'character'),
        createCard(CHARACTERS.VINCENT_CHEN, 'character'),
        createCard(CHARACTERS.CAROLYN_ZHENG, 'character'),
        ...Array(10).fill(null).map(() => createCard(ENERGY_TYPES.BRASS, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        createCard(ITEMS.MATCHA_LATTE, 'item'),
        createCard(ITEMS.STRAWBERRY_MATCHA, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.BAI_EMAIL, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(TOOLS.CONDUCTOR_BATON, 'tool'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(SUPPORTERS.MICHELLE, 'supporter'),
        createCard(SUPPORTERS.RICHARD, 'supporter'),
        createCard(STADIUMS.LINDEMANN, 'stadium'),
        createCard(STADIUMS.LINDEMANN, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildGuitarPercRush() {
    return [
        createCard(CHARACTERS.OWEN_LANDRY, 'character'),
        createCard(CHARACTERS.CAVIN_XUE, 'character'),
        createCard(CHARACTERS.RYAN_LEE, 'character'),
        createCard(CHARACTERS.GEORGE_CHUDLEY, 'character'),
        ...Array(6).fill(null).map(() => createCard(ENERGY_TYPES.GUITAR, 'energy')),
        ...Array(6).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.MIKU_OTAMATONE, 'item'),
        createCard(ITEMS.PRINTED_SCORE, 'item'),
        createCard(ITEMS.ANNOTATED_SCORE, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.BUCKET, 'tool'),
        createCard(SUPPORTERS.ANGEL, 'supporter'),
        createCard(SUPPORTERS.EMMA, 'supporter'),
        createCard(STADIUMS.RED_ROOM, 'stadium'),
        createCard(STADIUMS.RED_ROOM, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildPianoChoirControl() {
    return [
        createCard(CHARACTERS.KATIE_XIANG, 'character'),
        createCard(CHARACTERS.LUKE_XU, 'character'),
        createCard(CHARACTERS.RACHEL_CHEN, 'character'),
        createCard(CHARACTERS.ROSS_WILLIAMS, 'character'),
        ...Array(6).fill(null).map(() => createCard(ENERGY_TYPES.PIANO, 'energy')),
        ...Array(6).fill(null).map(() => createCard(ENERGY_TYPES.CHOIR, 'energy')),
        createCard(ITEMS.MATCHA_LATTE, 'item'),
        createCard(ITEMS.STRAWBERRY_MATCHA, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.CONCERT_PROGRAM, 'item'),
        createCard(ITEMS.CAMERA, 'item'),
        createCard(TOOLS.CONDUCTOR_BATON, 'tool'),
        createCard(TOOLS.MUSESCORE_SUB, 'tool'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(SUPPORTERS.VICTORIA, 'supporter'),
        createCard(STADIUMS.FRIEDMAN, 'stadium'),
        createCard(STADIUMS.STEINERT_PRACTICE, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildHybridStrings() {
    return [
        createCard(CHARACTERS.INA_MA, 'character'),
        createCard(CHARACTERS.EMILY_WANG, 'character'),
        createCard(CHARACTERS.ALICE_WANG, 'character'),
        createCard(CHARACTERS.WESTON_POE, 'character'),
        ...Array(8).fill(null).map(() => createCard(ENERGY_TYPES.STRINGS, 'energy')),
        ...Array(4).fill(null).map(() => createCard(ENERGY_TYPES.WOODWINDS, 'energy')),
        createCard(ITEMS.OTAMATONE, 'item'),
        createCard(ITEMS.MIKU_OTAMATONE, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(TOOLS.KIKI_HEADBAND, 'tool'),
        createCard(SUPPORTERS.LIO, 'supporter'),
        createCard(SUPPORTERS.MICHELLE, 'supporter'),
        createCard(STADIUMS.RILEY_HALL, 'stadium'),
        createCard(STADIUMS.RILEY_HALL, 'stadium'),
        createCard(STADIUMS.ALUMNAE_HALL, 'stadium')
    ];
}

function buildRainbowEnsemble() {
    return [
        createCard(CHARACTERS.BARRON_LEE, 'character'),
        createCard(CHARACTERS.ROSS_WILLIAMS, 'character'),
        createCard(CHARACTERS.OWEN_LANDRY, 'character'),
        createCard(CHARACTERS.CAVIN_XUE, 'character'),
        createCard(CHARACTERS.LUKE_XU, 'character'),
        createCard(CHARACTERS.EMILY_WANG, 'character'),
        createCard(CHARACTERS.FELIX_CHEN, 'character'),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.BRASS, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.CHOIR, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.GUITAR, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.PIANO, 'energy')),
        ...Array(1).fill(null).map(() => createCard(ENERGY_TYPES.STRINGS, 'energy')),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.ICE_SKATES, 'item'),
        createCard(ITEMS.BAI_EMAIL, 'item'),
        createCard(TOOLS.BUCKET, 'tool'),
        createCard(SUPPORTERS.LUCAS, 'supporter'),
        createCard(SUPPORTERS.VICTORIA, 'supporter'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
    ];
}

function buildBossBattle() {
    return [
        createCard(CHARACTERS.VINCENT_CHEN, 'character'),
        createCard(CHARACTERS.ROSS_WILLIAMS, 'character'),
        createCard(CHARACTERS.EDWARD_WIBOWO, 'character'),
        createCard(CHARACTERS.KEI_WATANABE, 'character'),
        createCard(CHARACTERS.RYAN_LI, 'character'),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.BRASS, 'energy')),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.CHOIR, 'energy')),
        ...Array(3).fill(null).map(() => createCard(ENERGY_TYPES.GUITAR, 'energy')),
        ...Array(2).fill(null).map(() => createCard(ENERGY_TYPES.PERCUSSION, 'energy')),
        createCard(ITEMS.MATCHA_LATTE, 'item'),
        createCard(ITEMS.STRAWBERRY_MATCHA, 'item'),
        createCard(ITEMS.CONCERT_TICKET, 'item'),
        createCard(ITEMS.VIDEO_CAMERA, 'item'),
        createCard(ITEMS.CAMERA, 'item'),
        createCard(TOOLS.CONDUCTOR_BATON, 'tool'),
        createCard(TOOLS.MAID_OUTFIT, 'tool'),
        createCard(SUPPORTERS.JOHANN, 'supporter'),
        createCard(SUPPORTERS.RICHARD, 'supporter'),
        createCard(STADIUMS.LINDEMANN, 'stadium'),
        createCard(STADIUMS.MAIN_HALL, 'stadium')
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
