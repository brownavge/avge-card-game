// Discord Bot Constants

// Card Type Emojis
export const EMOJI = {
    CHARACTER: '🎭',
    ENERGY: '⚡',
    ITEM: '🎁',
    TOOL: '🔧',
    SUPPORTER: '👤',
    STADIUM: '🎪',

    // Energy Types
    WOODWINDS: '🎺',
    PERCUSSION: '🥁',
    PIANO: '🎹',
    STRINGS: '🎻',
    GUITAR: '🎸',
    CHOIR: '🎤',
    BRASS: '📯',
    TYPELESS: '💫',

    // Status
    MAID: '👗',
    GOON: '😎',
    CONDUCTOR: '🎼',
    ARRANGER: '📝',
    POPPET: '🔌',

    // Game States
    HP: '❤️',
    KO: '💀',
    ACTIVE: '⭐',
    BENCH: '📋',
    DECK: '📚',
    HAND: '✋',
    DISCARD: '🗑️',

    // Actions
    ATTACK: '⚔️',
    DEFEND: '🛡️',
    RETREAT: '🏃',
    HEAL: '💚',
    DAMAGE: '💥',

    // UI
    CHECK: '✅',
    CROSS: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    HOURGLASS: '⏳',
    TROPHY: '🏆'
};

// Discord Embed Colors
export const COLORS = {
    PRIMARY: 0x764BA2,        // Purple (brand color)
    SUCCESS: 0x4CAF50,        // Green
    ERROR: 0xD32F2F,          // Red
    WARNING: 0xFFA726,        // Orange
    INFO: 0x2196F3,           // Blue
    NEUTRAL: 0x9E9E9E,        // Gray

    // Player Turn Colors
    YOUR_TURN: 0x4CAF50,      // Green
    OPPONENT_TURN: 0x2196F3,  // Blue
    ATTACK_PHASE: 0xD32F2F,   // Red
    GAME_OVER: 0x9C27B0,      // Deep Purple

    // Card Types
    CHARACTER_COLOR: 0xFF6B6B,
    ENERGY_COLOR: 0x95E1D3,
    ITEM_COLOR: 0x4ECDC4,
    SUPPORTER_COLOR: 0xC44569,
    STADIUM_COLOR: 0xFFE66D
};

// Game Configuration
export const CONFIG = {
    DECK_SIZE: 30,
    MAX_BENCH_SLOTS: 3,
    MAX_KO_COUNT: 3,
    MAX_HAND_SIZE: 10,  // Soft limit for display

    CHALLENGE_TIMEOUT: 5 * 60 * 1000,  // 5 minutes
    TURN_TIMEOUT: 10 * 60 * 1000,      // 10 minutes (optional)

    MAX_HELPER_CARDS_DEFAULT: 999,
    MAX_HELPER_CARDS_MAIN_HALL: 3,

    INTERACTION_TIMEOUT: 15 * 60 * 1000  // 15 minutes (Discord limit)
};

// Performance Spaces (Concert Halls)
export const PERFORMANCE_SPACES = [
    'Main Hall',
    'Alumnae Hall',
    'Riley Hall',
    'Salomon DECI'
];

// Card Type Mapping
export const CARD_TYPES = {
    CHARACTER: 'character',
    ENERGY: 'energy',
    ITEM: 'item',
    TOOL: 'tool',
    SUPPORTER: 'supporter',
    STADIUM: 'stadium'
};

// Phase Names
export const PHASES = {
    SETUP: 'setup',
    MAIN: 'main',
    ATTACK: 'attack',
    GAMEOVER: 'gameover'
};

// Action Types for Button Custom IDs
export const ACTIONS = {
    PLAY_CARD: 'play_card',
    USE_ABILITY: 'use_ability',
    RETREAT: 'retreat',
    BEGIN_ATTACK: 'begin_attack',
    ATTACK: 'attack',
    END_TURN: 'end_turn',
    FORFEIT: 'forfeit',

    SELECT_CARD: 'select_card',
    SELECT_TARGET: 'select_target',
    SELECT_BENCH_SLOT: 'select_bench_slot',
    SELECT_MOVE: 'select_move',
    SELECT_ENERGY: 'select_energy',
    SELECT_CHARACTER_TARGET: 'select_char_target',

    DECK_BUILDER_ADD: 'deck_add',
    DECK_BUILDER_REMOVE: 'deck_remove',
    DECK_BUILDER_SAVE: 'deck_save',
    DECK_BUILDER_CANCEL: 'deck_cancel',
    DECK_BUILDER_FILTER: 'deck_filter',

    SPECTATE_LEAVE: 'spectate_leave'
};

// Helper function to create custom_id
export function createCustomId(action, ...params) {
    return [action, ...params].join(':');
}

// Helper function to parse custom_id
export function parseCustomId(customId) {
    const parts = customId.split(':');
    return {
        action: parts[0],
        params: parts.slice(1)
    };
}

// HP Bar Visualization
export function createHPBar(current, max, length = 10) {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

// Format energy cost for display
export function formatEnergyCost(cost) {
    if (!cost || cost.length === 0) return 'No cost';

    const energyEmojis = {
        'W': EMOJI.WOODWINDS,
        'P': EMOJI.PERCUSSION,
        'K': EMOJI.PIANO,
        'S': EMOJI.STRINGS,
        'G': EMOJI.GUITAR,
        'C': EMOJI.CHOIR,
        'B': EMOJI.BRASS,
        'X': EMOJI.TYPELESS
    };

    return cost.map(c => energyEmojis[c] || c).join(' ');
}

// Format card name with emoji
export function formatCardName(card) {
    const typeEmoji = {
        'character': EMOJI.CHARACTER,
        'energy': EMOJI.ENERGY,
        'item': EMOJI.ITEM,
        'tool': EMOJI.TOOL,
        'supporter': EMOJI.SUPPORTER,
        'stadium': EMOJI.STADIUM
    };

    return `${typeEmoji[card.type] || ''} ${card.name}`;
}

// Truncate text for Discord limits
export function truncate(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Pre-built Deck Names
export const PREBUILT_DECKS = {
    'strings-aggro': 'String Section',
    'guitar-rock': 'Electric Ensemble',
    'piano-control': 'Piano Trio',
    'percussion-midrange': 'Rhythm Section',
    'choir-support': 'A Cappella',
    'brass-tempo': 'Brass Band',
    'toolbox': 'Mixed Ensemble'
};
