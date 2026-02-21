// Card Database

const TYPES = {
    WOODWINDS: 'Woodwinds',
    PERCUSSION: 'Percussion',
    PIANO: 'Piano',
    STRINGS: 'Strings',
    GUITAR: 'Guitar',
    CHOIR: 'Choir',
    BRASS: 'Brass'
};

// Type resistance chain: Str → piano → perc → guitar → brass → choir → ww → str
const RESISTANCE_CHAIN = {
    [TYPES.STRINGS]: TYPES.PIANO,
    [TYPES.PIANO]: TYPES.PERCUSSION,
    [TYPES.PERCUSSION]: TYPES.GUITAR,
    [TYPES.GUITAR]: TYPES.BRASS,
    [TYPES.BRASS]: TYPES.CHOIR,
    [TYPES.CHOIR]: TYPES.WOODWINDS,
    [TYPES.WOODWINDS]: TYPES.STRINGS
};

// Character Cards
const CHARACTERS = {
    EMILY: {
        name: 'Emily',
        type: [TYPES.STRINGS],
        hp: 100,
        gradYear: 2027,
        ability: {
            name: 'Profit Margins',
            description: 'Right before your attack, you may discard a tool from Emily to draw 2 cards.',
            type: 'activated'
        },
        moves: [
            { name: 'Vibrato', cost: ['S', 'X'], damage: 30 }
        ],
        retreatCost: 1
    },
    RACHEL: {
        name: 'Rachel',
        type: [TYPES.CHOIR],
        hp: 90,
        gradYear: 2026,
        ability: {
            name: 'Program Production',
            description: 'Once during your turn, if Rachel is in the active slot, you may retrieve any number of concert programs or concert tickets from the discard into your hand.',
            type: 'activated'
        },
        moves: [
            { name: 'Chorus', cost: ['C', 'C'], damage: 30, effect: 'Does 10 more damage per benched character you have in play.' },
            { name: 'SATB', cost: ['C', 'X'], damage: 0, effect: 'For each of your choir in play, choose one of your opponent\'s characters and do 20 damage to it.' }
        ],
        retreatCost: 1
    },
    SARAH: {
        name: 'Sarah',
        type: [TYPES.WOODWINDS],
        hp: 110,
        gradYear: 2027,
        moves: [
            { name: 'Multiphonics', cost: ['W', 'W', 'W'], damage: 0, effect: 'Flip two coins. If both are heads, do 50 damage to each of your opponent\'s benched characters. If both are tails, do 100 damage to your opponent\'s active character.' },
            { name: 'Circular Breathing', cost: ['W'], damage: 10, effect: 'During your next turn, this attack does 10 more damage. Effect stacks if used consecutively.' }
        ],
        retreatCost: 2
    },
    GRACE: {
        name: 'Grace',
        type: [TYPES.GUITAR],
        hp: 100,
        gradYear: 2028,
            effect: 'If this Stadium is active at the beginning of your turn, each of your characters takes 10 nonlethal damage for each empty bench slot you have.',
            description: 'Attendance Policy: If this Stadium is active at the beginning of your turn, each of your characters takes 10 nonlethal damage for each empty bench slot you have.'
            description: 'If Grace is on your bench, your guitars do +20 damage.',
            type: 'passive'
        },
        ability2: {
            effect: 'Upon this Stadium being played, both players discard all items. While active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.',
            description: 'Return by 4pm: Upon this Stadium being played, both players discard all items. Intense Reverb: While active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.'
            type: 'passive'
        },
        moves: [
            { name: 'Distortion', cost: ['G', 'G', 'G'], damage: 30, effect: 'During your next turn, your guitars do 40 more damage.' },
            effect: 'Each player may only play up to three cards per turn, starting the turn after this is played.',
            description: 'Small Ensemble Limit: Each player may only play up to three cards per turn, starting the turn after this is played.'
        retreatCost: 1
    },
    MASON: {
        name: 'Mason',
            effect: 'For every guitar, piano, choir, or percussion attack, roll a d6. On 3–6: −30 damage.',
            description: 'Electric Acoustics: For every guitar, piano, choir or percussion attack, roll a d6. On 3–6: −30 damage.'
        gradYear: 2026,
        ability: {
            name: 'Katie Synergy',
            description: 'If Katie is in play, take 10 less damage.',
            effect: 'Strings, woodwinds, and brass do −10 damage; choir, guitars, percussion, and pianos do +10 damage.',
            description: 'Amp Diff: Strings, woodwinds and brass do −10 damage; choir, guitars, percussion, pianos do +10 damage.'
        moves: [
            { name: 'Harmonics', cost: ['S', 'S'], damage: 0, effect: 'Flip two coins. If both are heads, choose 3 targets to do 60 damage each, or 2 targets to do 70 damage each.' },
            { name: 'Open Strings', cost: ['S'], damage: 10, effect: 'Draw a card. If it is an energy, attach it to this character.' }
        ],
            effect: 'If all of your benched characters share a type with your active character, your attacks take 1 less energy.',
            description: 'Sectionals: If all of your benched characters share a type with your active character, your attacks take 1 less energy.'
    KATIE: {
        name: 'Katie',
        type: [TYPES.PIANO],
        hp: 110,
            effect: 'Maids do +10 damage and have no retreat cost. Matcha heals +10 additional health.',
            description: 'Matcha Maid Cafe: Maids do +10 damage and have no retreat cost. Matcha heals +10 additional health.'
            name: 'Nausicaa\'s heartbeat',
            description: 'If this character is at exactly 10 health at the end of a turn, heal 10 damage from each of your characters.',
            type: 'passive'
        },
            effect: 'Each player may not have more than 2 benched characters. If a player has 3, they discard one (the player who played this stadium discards first). Each attack costs 1 additional energy.',
            description: 'Practice Prison: Each player may not have more than 2 benched characters. If a player has 3, they discard one (the player who played this stadium discards first). 15 Minute Walk: Each attack costs 1 additional energy.'
            description: 'If Mason is in play, take 10 less damage per attack.',
            type: 'passive'
        },
        moves: [
            effect: 'If you have exactly two character cards in play at the start of your turn, draw two cards instead of one. Each attack costs 1 additional energy.',
            description: 'Duo Queue: If you have exactly two character cards in play at the start of your turn, draw two cards instead of one. 15 Minute Walk: Each attack costs 1 additional energy.'
        ],
        retreatCost: 2
    },
    KEI: {
            effect: 'Draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck.',
            description: 'Democratic Process: Draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck.'
        hp: 100,
        gradYear: 2027,
        ability: {
            name: 'Looking for drummer',
            description: 'If Kei is on your bench, you may shuffle him back into your deck, but your turn ends.',
            type: 'activated'
        },
        moves: [
            { name: 'Arranging', cost: ['P', 'X'], damage: 0, effect: 'Discard any number of Musescore files from your hand and do 20 damage for each you discard.' },
            { name: 'Cymbal Crash', cost: ['P'], damage: 20 }
        ],
        retreatCost: 1
    },
    RYAN: {
        name: 'Ryan',
        type: [TYPES.PERCUSSION],
        hp: 120,
        gradYear: 2027,
        moves: [
            { name: 'Arrange (variant)', cost: ['P', 'X', 'X'], damage: 0, effect: 'Reveal top 4 cards. Discard all the Musescore files, and do 40 damage for each musescore file. Put the rest in your hand.' },
            { name: 'Percussion Ensemble', cost: ['P', 'P', 'X'], damage: 0, effect: 'Search your deck for 3 percussion instruments and attach all of them to any percussionist.' }
        ],
        retreatCost: 2
    },
    HENRY: {
        name: 'Henry',
        type: [TYPES.PIANO],
        hp: 100,
        gradYear: 2028,
        moves: [
            { name: 'Hands separately', cost: ['K'], damage: 0, effect: 'Does 0 damage. During your next turn, this attack does 40 damage.' },
            { name: 'Damper Pedal', cost: ['K', 'K'], damage: 20, effect: 'Damage of your opponent\'s next attack is halved (rounded up)' }
        ],
        retreatCost: 1
    },
    KANA: {
        name: 'Kana',
        type: [TYPES.WOODWINDS],
        hp: 140,
        gradYear: 2026,
        ability: {
            name: 'Immense Aura',
            description: 'Take 20 less damage from each attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Conducting', cost: ['W', 'W', 'X'], damage: 0, effect: 'For each type in play, do 20 damage.' },
            { name: 'Screech!', cost: ['W', 'X', 'X'], damage: 0, effect: 'Roll a d6. Damage is equal to 30 + (10 * the number on the D6)' }
        ],
        retreatCost: 3
    },
    GABE: {
        name: 'Gabe',
        type: [TYPES.STRINGS],
        hp: 60,
        gradYear: 2029,
        moves: [
            { name: 'You know what it is', cost: ['S', 'X'], damage: 70, effect: 'Only usable if he has exactly 60 health. Does 70 damage to one character.' },
            { name: '440 Hz', cost: ['X'], damage: 0, effect: 'Attach an energy from your hand to one of your benched characters.' }
        ],
        retreatCost: 1
    },
    ASH: {
        name: 'Ash',
        type: [TYPES.STRINGS],
        hp: 90,
        gradYear: 2028,
        ability: {
            name: 'Instagram Viral',
            description: 'If both benches are full, she does 2x as much damage',
            type: 'passive'
        },
        moves: [
            { name: 'Vibrato', cost: ['S', 'X'], damage: 30 },
            { name: 'Triple Stops', cost: ['S', 'X', 'X'], damage: 0, effect: 'Flip three coins. Does 40 damage for each heads.' }
        ],
        retreatCost: 1
    },
    ROSS: {
        name: 'Ross',
        type: [TYPES.CHOIR],
        hp: 100,
        gradYear: 2027,
        ability: {
            name: 'Projector Media',
            description: 'If on bench, you may search for a laptop and put it in your hand once a turn.',
            type: 'activated'
        },
        moves: [
            { name: 'Falsetto', cost: ['C', 'C'], damage: 30, effect: 'You may choose to use this attack without any energy, but your opponent gets to draw three cards.' },
            { name: 'Coloratura', cost: ['C', 'X', 'X'], damage: 20, effect: 'Flip a coin. If heads, this does 50 more damage.' }
        ],
        retreatCost: 1
    },
    SOPHIA: {
        name: 'Sophia',
        type: [TYPES.STRINGS],
        hp: 110,
        gradYear: 2026,
        ability: {
            name: 'Love wins',
            description: 'If Pascal is in play, take 10 less damage.',
            type: 'passive'
        },
        moves: [
            { name: '30 Emails', cost: ['S', 'X', 'X'], damage: 40, effect: 'If the stadium is ice rink, do 2x damage.' },
            { name: 'Snap Pizz', cost: ['S', 'S', 'X'], damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    CAVIN: {
        name: 'Cavin',
        type: [TYPES.PERCUSSION],
        hp: 90,
        gradYear: 2028,
        ability: {
            name: 'SCP',
            description: 'Take 2x damage from Sophia and Pascal.',
            type: 'passive'
        },
        ability2: {
            name: 'Wait no... I\'m not into femboys–',
            description: 'Deal 10 more damage for each maid in play.',
            type: 'passive'
        },
        moves: [
            { name: 'Stick Trick', cost: ['P', 'X'], damage: 10, effect: 'Swap with one of your Benched characters for free.' },
            { name: 'Rudiments', cost: ['P'], damage: 10, effect: '10 damage to one of your opponent\'s characters of your choice.' }
        ],
        retreatCost: 1
    },
    PASCAL: {
        name: 'Pascal',
        type: [TYPES.PERCUSSION],
        hp: 100,
        gradYear: 2027,
        ability: {
            name: 'Love wins',
            description: 'If Sophia is in play, take 10 less damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Ragebaited', cost: ['P', 'X', 'X'], damage: 20, effect: 'When 50 hp or below, this attack does 30 more damage. When 20 hp or below, 80 more damage.' },
            { name: 'Rimshot', cost: ['P', 'X'], damage: 0, effect: 'Roll a d6. If you roll a 1-4, do 70 damage.' }
        ],
        retreatCost: 2
    },
    LOANG: {
        name: 'Loang',
        type: [TYPES.PERCUSSION],
        hp: 80,
        gradYear: 2029,
        ability: {
            name: 'Moe moe kyun~!',
            description: 'All your maids do extra damage',
            type: 'passive'
        },
        moves: [
            { name: 'Excused Absence', cost: ['P', 'X'], damage: 0, effect: 'Heals all your other cards in play' },
            { name: 'Four Mallets', cost: ['P', 'X', 'X'], damage: 0, effect: 'Four individual attacks of 10 damage each. Draw a card.' }
        ],
        retreatCost: 1
    },
    FIONA: {
        name: 'Fiona',
        type: [TYPES.STRINGS],
        hp: 90,
        gradYear: 2027,
        ability: {
            name: 'Getting dressed',
            description: 'While Fiona is on your bench, your active character has Maid status.',
            type: 'passive'
        },
        moves: [
            { name: 'Vibrato', cost: ['S', 'X'], damage: 30 }
        ],
        retreatCost: 1
    },
    DAVID: {
        name: 'David',
        type: [TYPES.PIANO],
        hp: 100,
        gradYear: 2027,
        ability: {
            name: 'Reverse Heist',
            description: 'Once per turn, when you use an item card, you may put it back on the top of your deck.',
            type: 'activated'
        },
        moves: [
            { name: 'Simulation', cost: ['K', 'X'], damage: 0, effect: 'Shuffle your deck, and guess the number of character cards in the top 5 cards. Reveal them. If you are correct, put those cards in your hand. Otherwise, shuffle them back into your deck.' },
            { name: 'Glissando', cost: ['K'], damage: 30, effect: 'You cannot use this attack during your next turn.' }
        ],
        retreatCost: 1
    },
    EVELYN: {
        name: 'Evelyn',
        type: [TYPES.WOODWINDS],
        hp: 90,
        gradYear: 2027,
        moves: [
            { name: 'Flute Solo', cost: ['W', 'X', 'X'], damage: 30, effect: 'If she is the only WW character in play, this attack does 80 damage.' },
            { name: 'Double Tongue', cost: ['W'], damage: 0, effect: 'Two individual attacks of 10 damage each' }
        ],
        retreatCost: 1
    },
    BOKAI: {
        name: 'Bokai',
        type: [TYPES.PERCUSSION],
        hp: 110,
        gradYear: 2026,
        moves: [
            { name: 'Algorithm', cost: ['P', 'X', 'X'], damage: 0, effect: 'If any of your opponent\'s characters have a duplicate on your side, they take 50 damage each.' },
            { name: 'Ominous Chimes', cost: ['P', 'X', 'X'], damage: 0, effect: 'Shuffle this character back into your deck. At the end of your opponent\'s next turn, their Active character takes 70 damage.' }
        ],
        retreatCost: 2
    },
    JENNIE: {
        name: 'Jennie',
        type: [TYPES.PIANO],
        hp: 100,
        gradYear: 2026,
        moves: [
            { name: 'Small Ensemble committee', cost: ['K', 'X', 'X'], damage: 0, effect: 'If at least one of David, Evelyn, Bokai, and Roberto are in play, this does 10 damage to each opposing character. If they are all in play it does 50 damage to each opposing character.' },
            { name: 'Wordle', cost: ['K'], damage: 0, effect: 'Does 0 damage if resisted, 20 damage if normal effectiveness, and 50 damage if super effective' }
        ],
        retreatCost: 1
    },
    ROBERTO: {
        name: 'Roberto',
        type: [TYPES.GUITAR],
        hp: 120,
        gradYear: 2025,
        moves: [
            { name: 'Power Chord', cost: ['G', 'G', 'G'], damage: 90, effect: 'Discard 2 Energy from this character.' },
            { name: 'Fingerstyle', cost: ['G', 'X'], damage: 0, effect: 'You can only use this attack if this character did not use Turn Up, Power Chord, or Distortion during your last turn. Flip 5 coins and do 20 damage for each heads.' }
        ],
        retreatCost: 2
    },
    IZZY: {
        name: 'Izzy',
        type: [TYPES.WOODWINDS],
        hp: 90,
        gradYear: 2028,
        ability: {
            name: 'Information Advantage',
            description: 'At the beginning of each of your turns, if you have at least twice as many cards as your opponent in your hand, you may look at their hand and discard one of their cards.',
            type: 'activated'
        },
        ability2: {
            name: 'BAI wrangler',
            description: 'Once during your turn, you may discard a card from your hand. If you do, take a Stadium card and either a Character or Item card from your discard and put them into your hand.',
            type: 'activated'
        },
        moves: [
            { name: 'Sparkling Run', cost: ['W', 'X'], damage: 30, effect: 'Heal 20 damage.' },
            { name: 'Overblow', cost: ['W', 'X'], damage: 50, effect: 'You take 10 recoil damage' }
        ],
        retreatCost: 1
    },
    MARCUS: {
        name: 'Marcus',
        type: [TYPES.BRASS],
        hp: 110,
        gradYear: 2027,
        moves: [
            { name: 'Blast', cost: ['B', 'B', 'B'], damage: 70 },
            { name: 'Fanfare', cost: ['B'], damage: 20 },
            { name: 'Concert Pitch', cost: ['B', 'B'], damage: 40, effect: 'This attack does 20 more damage for each Brass character on your bench.' }
        ],
        retreatCost: 2
    },
    LILY: {
        name: 'Lily',
        type: [TYPES.BRASS],
        hp: 90,
        gradYear: 2028,
        moves: [
            { name: 'Empty Spit', cost: ['B'], damage: 0, effect: 'The next attack has a ⅔ chance of missing.' },
            { name: 'Embouchure', cost: ['B', 'X', 'X'], damage: 20, effect: 'Move your energy among your characters any way you would like.' }
        ],
        retreatCost: 1
    }
};

// Stadium Cards
const STADIUMS = {
    RED_ROOM: {
        name: 'Red Room',
        type: 'stadium',
        effect: 'Strings and woodwinds do -10 damage, while guitars and percussion do +10 damage.',
        description: 'Amp Diff: Strings and woodwinds do -10 damage, while guitars and percussion do +10 damage.'
    },
    LINDEMANN: {
        name: 'Lindemann Big Practice Room',
        type: 'stadium',
        effect: 'Woodwinds and brass do +10 damage.',
        description: 'Wind Sectionals: Woodwinds and brass do +10 damage.'
    },
    PETTERUTI: {
        name: 'Petteruti Lounge',
        type: 'stadium',
        effect: 'At the start of each player\'s turn, their active character takes 10 nonlethal damage',
        description: 'Powerpoint Night: At the start of each player\'s turn, their active character takes 10 nonlethal damage'
    },
    MATCHA_CAFE: {
        name: 'Matcha Maid Cafe',
        type: 'stadium',
        effect: 'Maids do +10 damage, and matcha heals +10 health',
        description: 'Maids do +10 damage, and matcha heals +10 health'
    },
    STEINERT: {
        name: 'Steinert Practice Room',
        type: 'stadium',
        effect: 'Each player can\'t have more than 2 Benched characters. If a player has 3 benched characters, they must discard one. The player who played this card discards first. Pianos do +10 damage.',
        description: 'Practice Prison: Each player can\'t have more than 2 Benched characters. If a player has 3 benched characters, they must discard one. The player who played this card discards first. Piano Practice: Pianos do +10 damage.'
    },
    FRIEDMAN: {
        name: 'Friedman Hall',
        type: 'stadium',
        effect: 'While this stadium is active, draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck. Choir does +10 damage.',
        description: 'Democratic Process: While this stadium is active, draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck. A capella: Choir does +10 damage.'
    },
    RILEY_HALL: {
        name: 'Riley Hall',
        type: 'stadium',
        effect: 'If this Stadium is active at the beginning of your turn, each of your characters take 10 damage for each of your empty bench slots. Strings do +10 damage.',
        description: 'Attendance Policy: If this Stadium is active at the beginning of your turn, each of your characters take 10 damage for each of your empty bench slots. String Sectionals: Strings do +10 damage.'
    },
    ALUMNAE_HALL: {
        name: 'Alumnae Hall',
        type: 'stadium',
        effect: 'Upon this Stadium being played, both players must discard all music stands. While this Stadium is active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.',
        description: 'Return by 4pm: Upon this Stadium being played, both players must discard all music stands. Intense reverb: While this Stadium is active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.'
    },
    MAIN_HALL: {
        name: 'Main Hall',
        type: 'stadium',
        effect: 'While this Stadium is active, each player may only play up to three Helper Cards per turn, beginning the turn after this is played. All attacks do +10 damage.',
        description: 'Small Ensemble Limit: While this Stadium is active, each player may only play up to three Helper Cards per turn, beginning the turn after this is played. Fan Chant: All attacks do +10 damage.'
    },
    SALOMON_DECI: {
        name: 'Salomon DECI',
        type: 'stadium',
        effect: 'For every guitarist, piano, and percussion attack, roll a d6. If 1 or 2, +10 damage; if 3 to 6, -10 damage.',
        description: 'Electric Acoustics: For every guitarist, piano, and percussion attack, roll a d6. If 1 or 2, +10 damage; if 3 to 6, -10 damage.'
    },
    STEINERT_BASEMENT: {
        name: 'Steinert Basement Studio',
        type: 'stadium',
        effect: 'If you have exactly two pianos on your bench, draw two cards instead of one at the start of your turn. If there are two or more string players in play (across both sides), strings do +10 damage.',
        description: 'Duo Queue: If you have exactly two pianos on your bench, draw two cards instead of one at the start of your turn. String Ensemble: If there are two or more string players in play (across both sides), strings do +10 damage.'
    }
};

// Tool Items
const TOOLS = {
    MAID_OUTFIT: {
        name: 'Maid outfit',
        type: 'tool',
        effect: 'While equipped, this character does not take damage from any attacks that do 10 damage to it or less and gains Maid status. Matcha heals +10 health to this character.',
        grantStatus: 'Maid'
    },
    CONDUCTOR_BATON: {
        name: 'Conductor Baton',
        type: 'tool',
        effect: 'While equipped, this character gains 30 health and Conductor status, but the retreat cost is doubled. Each music stand used gives +10 additional damage.',
        grantStatus: 'Conductor'
    },
    KIKI_HEADBAND: {
        name: 'Kiki\'s headband',
        type: 'tool',
        effect: 'Switch cost is reduced by 1 energy',
        retreatModifier: -1
    },
    BUCKET: {
        name: 'Bucket',
        type: 'tool',
        effect: 'Turns you into a Percussion type',
        addType: TYPES.PERCUSSION
    },
    AVGE_SHIRT: {
        name: 'AVGE T-shirt',
        type: 'tool',
        effect: 'While equipped, this character gains Goon status.',
        grantStatus: 'Goon'
    },
    AVGE_STICKER: {
        name: 'AVGE showcase sticker',
        type: 'tool',
        effect: 'If the player attached to this is active at the beginning of your turn, draw 1 extra card.'
    },
    MUSESCORE_SUB: {
        name: 'Musescore subscription',
        type: 'tool',
        effect: 'While equipped, this character gains Arranger status. Whenever this character is damaged, you may retrieve an item card from your discard pile.',
        grantStatus: 'Arranger'
    },
    EXTENSION_CORD: {
        name: 'Extension Cord',
        type: 'tool',
        effect: 'While equipped, this character gains Poppet status. Pop-Up: Does 20 extra damage if not in a performance space.',
        grantStatus: 'Poppet'
    }
};

// Non-Tool Items
const ITEMS = {
    OTAMATONE: {
        name: 'Otamatone',
        type: 'item',
        subtype: 'special_energy',
        effect: 'During this turn only, your active character has one more typeless energy attached to it.'
    },
    MIKU_OTAMATONE: {
        name: 'Miku otamatone',
        type: 'item',
        subtype: 'special_energy',
        effect: 'Only takes effect in concert halls. During this turn only, your active character has two more typeless energy attached to it.'
    },
    MATCHA_LATTE: {
        name: 'Matcha Latte',
        type: 'item',
        effect: 'All benched players heal 10 health.'
    },
    STRAWBERRY_MATCHA: {
        name: 'Strawberry Matcha Latte',
        type: 'item',
        effect: 'All benched players heal 20 health. Cannot be used in a performance space.'
    },
    PRINTED_SCORE: {
        name: 'Printed score',
        type: 'item',
        effect: 'Active character does 10 more damage this turn'
    },
    ANNOTATED_SCORE: {
        name: 'Annotated score',
        type: 'item',
        effect: 'Active character does 20 more damage this turn. Discard 1 energy from your active character.'
    },
    MUSESCORE_FILE: {
        name: 'Musescore file',
        type: 'item',
        effect: 'Your opponent reveals three cards in their hand. Choose to discard one.'
    },
    CORRUPTED_FILE: {
        name: 'Corrupted file',
        type: 'item',
        effect: 'You can only play this if you have an arranger in play. Your opponent shuffles their hand into their deck and draws three cards.'
    },
    CAST_RESERVE: {
        name: 'Cast reserve',
        type: 'item',
        effect: 'Flip a coin. If heads, choose one of your opponent\'s Benched characters for them to shuffle into their deck. If tails, your opponent chooses one of their Benched characters to shuffle into their deck.'
    },
    FOLDING_STAND: {
        name: 'Folding stand',
        type: 'item',
        subtype: 'music_stand',
        effect: 'The first damage done to your active character next turn is ignored'
    },
    BUO_STAND: {
        name: 'BUO stand',
        type: 'item',
        subtype: 'music_stand',
        effect: 'All attacks next turn are resisted by your character.'
    },
    ICE_SKATES: {
        name: 'Ice skates',
        type: 'item',
        effect: 'Switch your active character with one of your benched characters.'
    },
    CONCERT_PROGRAM: {
        name: 'Concert program',
        type: 'item',
        effect: 'Look at the top 5 cards of your deck.'
    },
    CONCERT_ROSTER: {
        name: 'Concert roster',
        type: 'item',
        subtype: 'roster',
        effect: 'Search for any specific character. You may play it to your Bench.'
    },
    REHEARSAL_ROSTER: {
        name: 'Dress rehearsal roster',
        type: 'item',
        effect: 'Look at top 3 cards, choose 1 and discard the other two'
    },
    CONCERT_TICKET: {
        name: 'Concert ticket',
        type: 'item',
        effect: 'Draw cards until you have 4 cards in hand'
    },
    BAI_EMAIL: {
        name: 'BAI Email',
        type: 'item',
        effect: 'Discard any stadium in play. Your opponent cannot play a new stadium on their next turn.'
    },
    AVGE_BIRB: {
        name: 'AVGE Birb',
        type: 'item',
        effect: 'Remove all your opponent\'s tool cards. During your next turn, your active character takes 20 more damage from all damaging attacks.'
    },
    CAMERA: {
        name: 'Camera',
        type: 'item',
        effect: 'Retrieve a supporter card from the discard pile into your hand'
    },
    VIDEO_CAMERA: {
        name: 'Video Camera',
        type: 'item',
        effect: 'Retrieve 2 energy from the discard pile into your hand.'
    },
    RAFFLE_TICKET: {
        name: 'Raffle Ticket',
        type: 'item',
        effect: 'Draw a card. If it is an AVGE Birb, you may heal all damage from one character of choice.'
    }
};

// Supporter Cards
const SUPPORTERS = {
    JOHANN: {
        name: 'Johann',
        type: 'supporter',
        effect: 'Choose up to one Supporter, one Item, and one Stadium card from your discard pile and put it in your hand.'
    },
    RICHARD: {
        name: 'Richard',
        type: 'supporter',
        effect: 'One-man Ensemble: Put up to 3 character cards from your discard pile into your hand. Your turn ends.'
    },
    MICHELLE: {
        name: 'Michelle',
        type: 'supporter',
        effect: 'Discord Announcement: Move up to 2 energy to any character using any combination of energy from your hand or from other characters'
    },
    WILL: {
        name: 'Will',
        type: 'supporter',
        effect: 'Arrangement: Shuffle all Helper Cards from your discard pile into your deck.'
    },
    LUCAS: {
        name: 'Lucas',
        type: 'supporter',
        effect: 'Small Ensemble: Search for any number of characters of different types in your deck that do not share a type with any of your active or benched characters, and put them on your bench.'
    },
    ANGEL: {
        name: 'Angel',
        type: 'supporter',
        effect: 'Head Goon: Give your currently active pokemon goon status.'
    },
    LIO: {
        name: 'Lio',
        type: 'supporter',
        effect: 'New Canvas: Shuffle your hand into your deck, then draw 6 cards.'
    },
    EMMA: {
        name: 'Emma',
        type: 'supporter',
        effect: 'Toxic Sabotage: Switch your opponent\'s active character with one of their benched characters of your choice.'
    },
    VICTORIA: {
        name: 'Victoria Chen',
        type: 'supporter',
        effect: 'Section Leader: Choose a type, search for up to 2 characters of that type in your deck, and put them all on your bench.'
    }
};

// Energy Cards
const ENERGY_TYPES = {
    WOODWINDS: { name: 'Woodwinds Energy', type: 'energy', energyType: TYPES.WOODWINDS },
    PERCUSSION: { name: 'Percussion Energy', type: 'energy', energyType: TYPES.PERCUSSION },
    PIANO: { name: 'Piano Energy', type: 'energy', energyType: TYPES.PIANO },
    STRINGS: { name: 'Strings Energy', type: 'energy', energyType: TYPES.STRINGS },
    GUITAR: { name: 'Guitar Energy', type: 'energy', energyType: TYPES.GUITAR },
    CHOIR: { name: 'Choir Energy', type: 'energy', energyType: TYPES.CHOIR },
    BRASS: { name: 'Brass Energy', type: 'energy', energyType: TYPES.BRASS }
};

// ES6 Module Exports
export {
    TYPES,
    RESISTANCE_CHAIN,
    CHARACTERS,
    STADIUMS,
    TOOLS,
    ITEMS,
    SUPPORTERS,
    ENERGY_TYPES
};
