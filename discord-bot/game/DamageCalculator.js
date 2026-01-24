// Damage Calculator - Handles all damage calculation logic
import { TYPES, RESISTANCE_CHAIN } from './cards.js';
import { hasStatus } from '../utils/cardHelpers.js';

/**
 * Calculate final damage for an attack
 * @param {Object} attacker - The attacking character
 * @param {Object} defender - The defending character
 * @param {number} baseDamage - Base damage from the move
 * @param {Object} move - The move being used
 * @param {Object} gameState - Current game state
 * @returns {number} - Final calculated damage
 */
export function calculateDamage(attacker, defender, baseDamage, move, gameState) {
    if (!attacker || !defender || baseDamage === 0) return 0;

    let damage = baseDamage;

    // Apply attacker modifiers
    damage += getAttackerModifiers(attacker, defender, move, gameState);

    // Apply type resistance
    damage = applyTypeResistance(attacker, defender, damage);

    // Apply stadium effects
    damage += getStadiumDamageBonus(attacker, gameState);

    // Apply defender defensive abilities
    damage = applyDefenderReductions(defender, damage, attacker, gameState);

    return Math.max(0, Math.floor(damage));
}

/**
 * Get damage modifiers from attacker's abilities and status
 */
function getAttackerModifiers(attacker, defender, move, gameState) {
    let bonus = 0;
    const attackerPlayerNum = gameState.findPlayerWithCharacter(attacker);
    const defenderPlayerNum = gameState.findPlayerWithCharacter(defender);
    const attackerPlayer = gameState.players[attackerPlayerNum];
    const defenderPlayer = gameState.players[defenderPlayerNum];

    // Grace's maid synergy
    if (attacker.name === 'Grace') {
        const maidCount = [attackerPlayer.active, ...attackerPlayer.bench]
            .filter(c => c && hasStatus(c, 'Maid')).length;
        bonus += maidCount * 20;
    }

    // Loang's "Moe moe kyun~!"
    if (gameState.isCharacterInPlay('Loang', attackerPlayerNum) && hasStatus(attacker, 'Maid')) {
        bonus += 10;
    }

    // Cavin's "Wait no... I'm not into femboys"
    if (attacker.name === 'Cavin') {
        const maidCount = [attackerPlayer.active, ...attackerPlayer.bench, defenderPlayer.active, ...defenderPlayer.bench]
            .filter(c => c && hasStatus(c, 'Maid')).length;
        bonus += maidCount * 10;
    }

    // Extension Cord (Poppet): +20 damage if not in performance space
    if (hasStatus(attacker, 'Poppet') && (!gameState.stadium || !gameState.isPerformanceSpace(gameState.stadium.name))) {
        bonus += 20;
    }

    // Attack modifiers (from printed scores, etc.)
    if (gameState.attackModifiers[attackerPlayerNum]?.damageBonus) {
        bonus += gameState.attackModifiers[attackerPlayerNum].damageBonus;
    }

    return bonus;
}

/**
 * Apply type resistance chain
 */
function applyTypeResistance(attacker, defender, damage) {
    // Get primary types
    const attackerType = attacker.type[0];
    const defenderType = defender.type[0];

    // Check if defender resists attacker's type
    const resistedType = RESISTANCE_CHAIN[defenderType];

    if (resistedType === attackerType) {
        // Damage is halved (rounded up)
        return Math.ceil(damage / 2);
    }

    return damage;
}

/**
 * Get damage bonus from stadium effects
 */
function getStadiumDamageBonus(attacker, gameState) {
    if (!gameState.stadium) return 0;

    let bonus = 0;
    const stadiumName = gameState.stadium.name;
    const attackerType = attacker.type[0];

    // Type-specific stadium bonuses
    const stadiumBonuses = {
        'Red Room': {
            [TYPES.GUITAR]: 10,
            [TYPES.PERCUSSION]: 10,
            [TYPES.STRINGS]: -10,
            [TYPES.WOODWINDS]: -10
        },
        'Lindemann Big Practice Room': {
            [TYPES.WOODWINDS]: 10,
            [TYPES.BRASS]: 10
        },
        'Matcha Maid Cafe': {},
        'Steinert Practice Room': {
            [TYPES.PIANO]: 10
        },
        'Friedman Hall': {
            [TYPES.CHOIR]: 10
        },
        'Riley Hall': {
            [TYPES.STRINGS]: 10
        },
        'Main Hall': {}, // All types get +10
        'Steinert Basement Studio': {
            [TYPES.STRINGS]: 10 // Only if 2+ strings in play (checked elsewhere)
        }
    };

    // Check type-specific bonus
    if (stadiumBonuses[stadiumName] && stadiumBonuses[stadiumName][attackerType]) {
        bonus += stadiumBonuses[stadiumName][attackerType];
    }

    // Main Hall: all attacks +10
    if (stadiumName === 'Main Hall') {
        bonus += 10;
    }

    // Matcha Maid Cafe: Maids +10
    if (stadiumName === 'Matcha Maid Cafe' && hasStatus(attacker, 'Maid')) {
        bonus += 10;
    }

    // Salomon DECI: Random modifier for Guitar/Piano/Percussion
    if (stadiumName === 'Salomon DECI') {
        if ([TYPES.GUITAR, TYPES.PIANO, TYPES.PERCUSSION].includes(attackerType)) {
            const roll = Math.floor(Math.random() * 6) + 1;
            if (roll <= 2) {
                bonus += 10;
            } else {
                bonus -= 10;
            }
        }
    }

    return bonus;
}

/**
 * Apply defender's damage reduction abilities
 */
function applyDefenderReductions(defender, damage, attacker, gameState) {
    let finalDamage = damage;
    const defenderPlayerNum = gameState.findPlayerWithCharacter(defender);

    // Goon status: -20 damage
    if (hasStatus(defender, 'Goon')) {
        finalDamage -= 20;
    }

    // Maid status: immune to <=10 damage
    if (hasStatus(defender, 'Maid') && finalDamage <= 10) {
        return 0;
    }

    // Kana's Immense Aura
    if (defender.name === 'Kana') {
        finalDamage -= 20;
    }

    // Katie + Mason synergy
    if (defender.name === 'Katie' && gameState.isCharacterInPlay('Mason', defenderPlayerNum)) {
        finalDamage -= 10;
    }
    if (defender.name === 'Mason' && gameState.isCharacterInPlay('Katie', defenderPlayerNum)) {
        finalDamage -= 10;
    }

    // Sophia + Pascal synergy
    if (defender.name === 'Sophia' && gameState.isCharacterInPlay('Pascal', defenderPlayerNum)) {
        finalDamage -= 10;
    }
    if (defender.name === 'Pascal' && gameState.isCharacterInPlay('Sophia', defenderPlayerNum)) {
        finalDamage -= 10;
    }

    // Cavin's SCP: 2x damage from Sophia and Pascal
    if (defender.name === 'Cavin' && (attacker.name === 'Sophia' || attacker.name === 'Pascal')) {
        finalDamage *= 2;
    }

    // Izzy's BAI wrangler
    if (defender.name === 'Izzy' && gameState.stadium && gameState.isPerformanceSpace(gameState.stadium.name)) {
        finalDamage -= 20;
    }

    return Math.max(0, finalDamage);
}

/**
 * Check if an attack is resisted
 */
export function isResisted(attacker, defender) {
    const attackerType = attacker.type[0];
    const defenderType = defender.type[0];
    const resistedType = RESISTANCE_CHAIN[defenderType];
    return resistedType === attackerType;
}

/**
 * Check if an attack is super effective
 */
export function isSuperEffective(attacker, defender) {
    const attackerType = attacker.type[0];
    const defenderType = defender.type[0];
    const resistedType = RESISTANCE_CHAIN[attackerType];
    return resistedType === defenderType;
}
