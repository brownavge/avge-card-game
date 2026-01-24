// Card Helper Functions

import { CHARACTERS, STADIUMS, TOOLS, ITEMS, SUPPORTERS, ENERGY_TYPES } from '../game/cards.js';

// Generate unique card ID
let cardIdCounter = 0;

export function generateCardId() {
    return `card_${Date.now()}_${cardIdCounter++}`;
}

// Create card instance from definition
export function createCard(cardDef, type) {
    if (!cardDef) {
        console.error('Error: cardDef is undefined for type:', type);
        throw new Error(`Card definition is undefined for type: ${type}`);
    }
    return {
        id: generateCardId(),
        ...JSON.parse(JSON.stringify(cardDef)), // Deep clone
        cardType: type,
        // For characters
        ...(type === 'character' ? {
            damage: 0,
            energy: [],
            tools: [],
            status: []
        } : {})
    };
}

// Get card definition by name
export function getCardByName(name, type = null) {
    const sources = {
        character: CHARACTERS,
        stadium: STADIUMS,
        tool: TOOLS,
        item: ITEMS,
        supporter: SUPPORTERS,
        energy: ENERGY_TYPES
    };

    if (type) {
        const source = sources[type];
        return Object.values(source).find(card => card.name === name);
    }

    // Search all if type not specified
    for (const source of Object.values(sources)) {
        const card = Object.values(source).find(c => c.name === name);
        if (card) return card;
    }

    return null;
}

// Get all cards of a specific type
export function getAllCards(type) {
    const sources = {
        character: CHARACTERS,
        stadium: STADIUMS,
        tool: TOOLS,
        item: ITEMS,
        supporter: SUPPORTERS,
        energy: ENERGY_TYPES
    };

    return Object.values(sources[type] || {});
}

// Find card in array by ID
export function findCardById(cards, cardId) {
    return cards.find(card => card.id === cardId);
}

// Remove card from array by ID
export function removeCardById(cards, cardId) {
    const index = cards.findIndex(card => card.id === cardId);
    if (index !== -1) {
        return cards.splice(index, 1)[0];
    }
    return null;
}

// Check if character has enough energy for move
export function hasEnoughEnergy(character, moveCost) {
    if (!moveCost || moveCost.length === 0) return true;

    const energyCounts = {};
    character.energy.forEach(e => {
        const type = e.energyType || 'X';
        energyCounts[type] = (energyCounts[type] || 0) + 1;
    });

    // Count total energy
    const totalEnergy = character.energy.length;

    // Count specific energy needed (non-X)
    const specificNeeded = {};
    let colorlessNeeded = 0;

    moveCost.forEach(cost => {
        if (cost === 'X') {
            colorlessNeeded++;
        } else {
            specificNeeded[cost] = (specificNeeded[cost] || 0) + 1;
        }
    });

    // Check if we have all specific energy types
    for (const [type, needed] of Object.entries(specificNeeded)) {
        if ((energyCounts[type] || 0) < needed) {
            return false;
        }
    }

    // Check if total energy is enough
    const specificTotal = Object.values(specificNeeded).reduce((sum, val) => sum + val, 0);
    return totalEnergy >= (specificTotal + colorlessNeeded);
}

// Get energy type symbol
export function getEnergySymbol(energyType) {
    const symbols = {
        'Woodwinds': 'W',
        'Percussion': 'P',
        'Piano': 'K',
        'Strings': 'S',
        'Guitar': 'G',
        'Choir': 'C',
        'Brass': 'B'
    };
    return symbols[energyType] || 'X';
}

// Check if character has a specific status
export function hasStatus(character, statusName) {
    return character.status && character.status.includes(statusName);
}

// Add status to character
export function addStatus(character, statusName) {
    if (!character.status) character.status = [];
    if (!character.status.includes(statusName)) {
        character.status.push(statusName);
    }
}

// Remove status from character
export function removeStatus(character, statusName) {
    if (!character.status) return;
    const index = character.status.indexOf(statusName);
    if (index !== -1) {
        character.status.splice(index, 1);
    }
}

// Calculate retreat cost including modifiers
export function getRetreatCost(character) {
    let cost = character.retreatCost || 0;

    // Check for Kiki's Headband (retreat -1)
    const hasHeadband = character.tools?.some(tool => tool.name === "Kiki's headband");
    if (hasHeadband) cost = Math.max(0, cost - 1);

    // Check for Conductor status (doubles retreat cost)
    if (hasStatus(character, 'Conductor')) {
        cost *= 2;
    }

    return cost;
}

// Check if move targets bench
export function moveTargetsBench(moveName) {
    const benchTargetMoves = [
        'SATB',
        'Small Ensemble committee',
        'Multiphonics',
        'Rudiments'
    ];
    return benchTargetMoves.includes(moveName);
}

// Get character type as string
export function getCharacterTypes(character) {
    if (!character.type) return [];
    return character.type;
}

// Check if character is specific type
export function isType(character, typeName) {
    return character.type && character.type.includes(typeName);
}

// Create deck from template
export function createDeckFromTemplate(templateName, gameCards) {
    // This will be implemented with the DeckManager
    // Returns array of card instances
    return [];
}

// Shuffle array (Fisher-Yates)
export function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Deep clone object
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
