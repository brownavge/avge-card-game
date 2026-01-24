// Game Validator - Validates all game actions
import { hasEnoughEnergy, hasStatus } from '../utils/cardHelpers.js';
import { CONFIG } from '../utils/constants.js';

/**
 * Validate if a player can play a card
 */
export function canPlayCard(gameState, playerNum, cardId) {
    // Check if it's the player's turn
    if (gameState.currentPlayer !== playerNum) {
        return { valid: false, reason: "It's not your turn!" };
    }

    // Check if game is over
    if (gameState.phase === 'gameover') {
        return { valid: false, reason: 'Game is over!' };
    }

    // Check if in main phase
    if (gameState.phase !== 'main') {
        return { valid: false, reason: 'Can only play cards during main phase!' };
    }

    const player = gameState.players[playerNum];
    const card = player.hand.find(c => c.id === cardId);

    if (!card) {
        return { valid: false, reason: 'Card not in hand!' };
    }

    // Card type specific validation
    switch (card.cardType) {
        case 'character':
            return canPlayCharacter(gameState, playerNum, card);

        case 'energy':
            return canPlayEnergy(gameState, playerNum);

        case 'item':
        case 'supporter':
            return canPlayHelper(gameState, playerNum, card);

        case 'tool':
            return canPlayTool(gameState, playerNum, card);

        case 'stadium':
            return { valid: true };

        default:
            return { valid: false, reason: 'Unknown card type!' };
    }
}

/**
 * Check if player can play a character card
 */
function canPlayCharacter(gameState, playerNum, card) {
    const player = gameState.players[playerNum];

    // Check if active slot is empty
    if (!player.active) {
        return { valid: true, target: 'active' };
    }

    // Check if there's space on bench
    const emptyBenchSlot = player.bench.findIndex(slot => slot === null);
    if (emptyBenchSlot === -1) {
        return { valid: false, reason: 'Bench is full!' };
    }

    return { valid: true, target: 'bench' };
}

/**
 * Check if player can play energy
 */
function canPlayEnergy(gameState, playerNum) {
    // Check if energy already played this turn
    if (gameState.energyPlayedThisTurn) {
        return { valid: false, reason: 'Already played energy this turn!' };
    }

    const player = gameState.players[playerNum];

    // Check if there are any characters in play
    const hasCharacters = player.active || player.bench.some(c => c !== null);
    if (!hasCharacters) {
        return { valid: false, reason: 'No characters in play to attach energy to!' };
    }

    return { valid: true };
}

/**
 * Check if player can play helper card (item/supporter)
 */
function canPlayHelper(gameState, playerNum, card) {
    // Check Main Hall stadium limit (3 helper cards per turn)
    if (gameState.stadium && gameState.stadium.name === 'Main Hall') {
        if (gameState.helperCardsPlayedThisTurn >= CONFIG.MAX_HELPER_CARDS_MAIN_HALL) {
            return { valid: false, reason: 'Main Hall: Max 3 helper cards per turn!' };
        }
    }

    // Supporter-specific check
    if (card.cardType === 'supporter') {
        if (gameState.supporterPlayedThisTurn) {
            return { valid: false, reason: 'Already played a supporter this turn!' };
        }
    }

    return { valid: true };
}

/**
 * Check if player can play a tool card
 */
function canPlayTool(gameState, playerNum, card) {
    const player = gameState.players[playerNum];

    // Must have characters to attach tools to
    const hasCharacters = player.active || player.bench.some(c => c !== null);
    if (!hasCharacters) {
        return { valid: false, reason: 'No characters in play!' };
    }

    return { valid: true };
}

/**
 * Validate if a character can attack
 */
export function canAttack(gameState, playerNum) {
    if (gameState.currentPlayer !== playerNum) {
        return { valid: false, reason: "Not your turn!" };
    }

    if (gameState.phase !== 'attack') {
        return { valid: false, reason: 'Not in attack phase!' };
    }

    // Player 1 cannot attack on first turn
    if (gameState.isFirstTurn && playerNum === 1) {
        return { valid: false, reason: 'Player 1 cannot attack on first turn!' };
    }

    if (gameState.attackedThisTurn) {
        return { valid: false, reason: 'Already attacked this turn!' };
    }

    const player = gameState.players[playerNum];

    if (!player.active) {
        return { valid: false, reason: 'No active character!' };
    }

    return { valid: true };
}

/**
 * Validate if a character can use a specific move
 */
export function canUseMove(gameState, character, moveIndex) {
    if (!character) {
        return { valid: false, reason: 'No character!' };
    }

    if (!character.moves || !character.moves[moveIndex]) {
        return { valid: false, reason: 'Invalid move!' };
    }

    const move = character.moves[moveIndex];

    // Check energy requirements
    if (move.cost && move.cost.length > 0) {
        if (!hasEnoughEnergy(character, move.cost)) {
            return { valid: false, reason: 'Not enough energy!' };
        }
    }

    // Move-specific restrictions
    // Katie's Grand Piano: only in performance spaces
    if (move.name === 'Grand Piano') {
        if (!gameState.stadium || !gameState.isPerformanceSpace(gameState.stadium.name)) {
            return { valid: false, reason: 'Can only use in performance spaces!' };
        }
    }

    return { valid: true };
}

/**
 * Validate if a character can retreat
 */
export function canRetreat(gameState, playerNum) {
    if (gameState.currentPlayer !== playerNum) {
        return { valid: false, reason: "Not your turn!" };
    }

    if (gameState.phase !== 'main') {
        return { valid: false, reason: 'Can only retreat during main phase!' };
    }

    const player = gameState.players[playerNum];

    if (!player.active) {
        return { valid: false, reason: 'No active character!' };
    }

    // Must have bench character to switch with
    const hasBench = player.bench.some(c => c !== null);
    if (!hasBench) {
        return { valid: false, reason: 'No benched characters!' };
    }

    // Check if character has enough energy for retreat cost
    const retreatCost = player.active.retreatCost || 0;
    const attachedEnergy = (player.active.energy || []).length;

    if (attachedEnergy < retreatCost) {
        return { valid: false, reason: `Need ${retreatCost} energy to retreat!` };
    }

    return { valid: true };
}

/**
 * Validate if a target is valid for an attack
 */
export function isValidTarget(gameState, move, targetId) {
    if (!move) {
        return { valid: false, reason: 'No move specified!' };
    }

    // Check if move targets bench
    const benchTargetMoves = [
        'SATB',
        'Small Ensemble committee',
        'Multiphonics',
        'Rudiments'
    ];

    if (benchTargetMoves.includes(move.name)) {
        // These moves target bench characters
        // Validation handled in move execution
        return { valid: true };
    }

    // Default: targets opponent's active
    const opponentNum = gameState.currentPlayer === 1 ? 2 : 1;
    const opponent = gameState.players[opponentNum];

    if (!opponent.active) {
        return { valid: false, reason: 'Opponent has no active character!' };
    }

    return { valid: true };
}

/**
 * Validate deck composition
 */
export function isValidDeck(cards) {
    // Must be exactly 30 cards
    if (cards.length !== CONFIG.DECK_SIZE) {
        return { valid: false, reason: `Deck must have exactly ${CONFIG.DECK_SIZE} cards!` };
    }

    // Must have at least one character
    const characterCount = cards.filter(c => c.cardType === 'character').length;
    if (characterCount === 0) {
        return { valid: false, reason: 'Deck must have at least one character!' };
    }

    return { valid: true };
}

/**
 * Validate if player can begin attack phase
 */
export function canBeginAttackPhase(gameState, playerNum) {
    if (gameState.currentPlayer !== playerNum) {
        return { valid: false, reason: "Not your turn!" };
    }

    if (gameState.phase === 'attack') {
        return { valid: false, reason: 'Already in attack phase!' };
    }

    if (gameState.phase !== 'main') {
        return { valid: false, reason: 'Can only start attack from main phase!' };
    }

    // Player 1 cannot attack on first turn
    if (gameState.isFirstTurn && playerNum === 1) {
        return { valid: false, reason: 'Player 1 cannot attack on first turn!' };
    }

    const player = gameState.players[playerNum];
    if (!player.active) {
        return { valid: false, reason: 'No active character!' };
    }

    return { valid: true };
}
