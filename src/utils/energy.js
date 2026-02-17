import { TYPES } from '../constants.js';

export function getCostSymbol(energyType) {
    const symbolMap = {
        [TYPES.WOODWINDS]: 'W',
        [TYPES.PERCUSSION]: 'P',
        [TYPES.PIANO]: 'K',
        [TYPES.STRINGS]: 'S',
        [TYPES.GUITAR]: 'G', // G for Guitar
        [TYPES.CHOIR]: 'C',
        [TYPES.BRASS]: 'B'
    };
    return symbolMap[energyType] || '?';
}

export function getTypeFromSymbol(symbol) {
    const typeMap = {
        'W': TYPES.WOODWINDS,
        'P': TYPES.PERCUSSION,
        'K': TYPES.PIANO,
        'S': TYPES.STRINGS,
        'G': TYPES.GUITAR, // G for Guitar
        'C': TYPES.CHOIR,
        'B': TYPES.BRASS
    };
    return typeMap[symbol];
}
