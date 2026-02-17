export const TYPES = {
    WOODWINDS: 'Woodwinds',
    PERCUSSION: 'Percussion',
    PIANO: 'Piano',
    STRINGS: 'Strings',
    GUITAR: 'Guitar',
    CHOIR: 'Choir',
    BRASS: 'Brass'
};

// Type super effectiveness chain: Strings → Brass → Piano → Choir → Perc → WW → Guitar → Strings (2x damage)
export const SUPER_EFFECTIVE_CHAIN = {
    [TYPES.STRINGS]: TYPES.BRASS,
    [TYPES.BRASS]: TYPES.PIANO,
    [TYPES.PIANO]: TYPES.CHOIR,
    [TYPES.CHOIR]: TYPES.PERCUSSION,
    [TYPES.PERCUSSION]: TYPES.WOODWINDS,
    [TYPES.WOODWINDS]: TYPES.GUITAR,
    [TYPES.GUITAR]: TYPES.STRINGS
};
