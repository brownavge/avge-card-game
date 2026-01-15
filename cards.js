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
            { name: 'Vocal warmups', cost: ['C'], damage: 0, effect: 'Attach an energy from your hand to this character.' },
            { name: 'SATB', cost: ['C', 'X'], damage: 0, effect: 'For each of your choir in play, choose one of your opponent\'s characters and do 10 damage to it.' }
        ],
        retreatCost: 1
    },
    SARAH: {
        name: 'Sarah',
        type: [TYPES.WOODWINDS],
        hp: 110,
        gradYear: 2027,
        moves: [
            { name: 'Artist Alley', cost: ['W', 'X', 'X'], damage: 0, effect: 'Discard any amount of concert posters from your hand and do 30 damage for each.' },
            { name: 'Circular Breathing', cost: ['W'], damage: 10, effect: 'During your next turn, this attack does 10 more damage. Effect stacks if used consecutively.' }
        ],
        retreatCost: 2
    },
    GRACE: {
        name: 'Grace',
        type: [TYPES.GUITAR],
        hp: 100,
        gradYear: 2028,
        ability: {
            name: 'Amplify',
            description: 'If Grace is on your bench, your guitars do +20 damage.',
            type: 'passive'
        },
        ability2: {
            name: 'Royalties',
            description: 'If Grace is active, any opposing character with any AVGE patch or t-shirt takes 20 damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Turn Up!', cost: ['G'], damage: 0, effect: 'During your next turn, your guitars do 30 more damage.' },
            { name: 'Feedback Loop', cost: ['G', 'X'], damage: 40, effect: 'Each of your guitars take 10 damage.' }
        ],
        retreatCost: 1
    },
    MASON: {
        name: 'Mason',
        type: [TYPES.STRINGS],
        hp: 80,
        gradYear: 2026,
        ability: {
            name: 'Katie Synergy',
            description: 'If Katie is in play, take 10 less damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Song voting', cost: ['S', 'X'], damage: 0, effect: '10 damage x number of unique members in play. Do 40 damage to myself.' },
            { name: 'Diabolical arrangement', cost: ['S', 'S', 'X', 'X'], damage: 0, effect: 'All your opponents are 10 health. This character is knocked out.' }
        ],
        retreatCost: 1
    },
    KATIE: {
        name: 'Katie',
        type: [TYPES.PIANO],
        hp: 110,
        gradYear: 2026,
        ability: {
            name: 'Nausicaa\'s heartbeat',
            description: 'If this character is at exactly 10 health at the end of a turn, heal 10 damage from each of your characters.',
            type: 'passive'
        },
        ability2: {
            name: 'Mason Synergy',
            description: 'If Mason is in play, take 10 less damage per attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Arrangement procrastination', cost: ['K', 'X'], damage: 0, effect: 'Switch with one benched character. At the end of your next turn, reveal your hand and do 10 damage for each musescore file there.' },
            { name: 'Three Hand Technique', cost: ['K', 'X'], damage: 30, effect: 'Three individual attacks of 10 damage each' }
        ],
        retreatCost: 2
    },
    KEI: {
        name: 'Kei',
        type: [TYPES.PERCUSSION],
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
            { name: 'Personal use', cost: ['K'], damage: 0, effect: 'Retrieve a camera from the discard pile' },
            { name: 'Improv', cost: ['K', 'X', 'X'], damage: 0, effect: 'Discard the top 3 cards of your opponent\'s deck. 40 damage x the number of item cards discarded.' }
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
            { name: 'Circular Breathing', cost: ['W'], damage: 10, effect: 'During your next turn, this attack does 10 more damage. Effect stacks if used consecutively.' }
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
            { name: 'Triple Stops', cost: ['S', 'X', 'X'], damage: 0, effect: 'Flip three coins. Does 30 damage for each heads.' }
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
            { name: 'Vocal Performance', cost: ['C', 'X'], damage: 30 }
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
            { name: 'Vibrato', cost: ['S', 'X'], damage: 30 }
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
            { name: 'Drum Solo', cost: ['P', 'X'], damage: 30 }
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
            { name: 'Ragebaited', cost: ['P', 'X', 'X'], damage: 40, effect: 'When below 50% hp this attack does +20 damage. When below 20% hp, double damage.' }
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
            { name: 'Excused Absence', cost: ['P', 'X'], damage: 0, effect: 'Heals all your other cards in play' }
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
            description: 'While on your bench, your active character gains maid status.',
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
            { name: 'Piano Solo', cost: ['K', 'X'], damage: 30 }
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
            { name: 'Melody', cost: ['W'], damage: 20 }
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
            { name: 'Touhou Ensemble', cost: ['P', 'X'], damage: 30, effect: 'Does 30 more damage if there is a Fumo plush in your discard pile. Shuffle it back into your deck.' }
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
            { name: 'Piano Performance', cost: ['K', 'X'], damage: 30 }
        ],
        retreatCost: 1
    },
    ROBERTO: {
        name: 'Roberto',
        type: [TYPES.GUITAR],
        hp: 120,
        gradYear: 2025,
        moves: [
            { name: 'Guitar Shredding', cost: ['G', 'G', 'X', 'X'], damage: 100, effect: 'Must discard all guitar energy attached.' },
            { name: 'Power Chord', cost: ['G', 'X'], damage: 40 }
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
            description: 'If a concert hall is in play, take 20 less damage from any attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Melody', cost: ['W'], damage: 20 },
            { name: 'Wind Performance', cost: ['W', 'X'], damage: 30 }
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
        effect: 'Each player can\'t have more than 2 Benched characters. Pianos do +10 damage.',
        description: 'Practice Prison: Each player can\'t have more than 2 Benched pokemon. Piano Practice: Pianos do +10 damage.'
    },
    FRIEDMAN: {
        name: 'Friedman Hall',
        type: 'stadium',
        effect: 'Draw two cards per turn. Opponent chooses one to keep. Choir does +10 damage.',
        description: 'Democratic Process: Draw two cards per turn. Your opponent chooses one for you to keep. A capella: Choir does +10 damage.'
    },
    RILEY_HALL: {
        name: 'Riley Hall',
        type: 'stadium',
        effect: 'If this Stadium is active at the beginning of your turn, each of your characters take 20 damage for each of your empty bench slots. Strings do +10 damage.',
        description: 'Attendance Policy: If this Stadium is active at the beginning of your turn, each of your characters take 20 damage for each of your empty bench slots. String Sectionals: Strings do +10 damage.'
    },
    ALUMNAE_HALL: {
        name: 'Alumnae Hall',
        type: 'stadium',
        effect: 'Upon this Stadium being played, both players must discard all music stands. While this Stadium is active, whenever a player uses an Item or Supporter, all their active and benched characters take 10 nonlethal damage.',
        description: 'Return by 4pm: Upon this Stadium being played, both players must discard all music stands. Intense reverb: While this Stadium is active, whenever a player uses an Item or Supporter, all their active and benched characters take 10 nonlethal damage.'
    },
    MAIN_HALL: {
        name: 'Main Hall',
        type: 'stadium',
        effect: 'While this Stadium is active, each player may only play up to three Helper Cards per turn, including the turn this is played. All attacks do +10 damage.',
        description: 'Small Ensemble Limit: While this Stadium is active, each player may only play up to three Helper Cards per turn. Fan Chant: All attacks do +10 damage.'
    },
    SALOMON_DECI: {
        name: 'Salomon DECI',
        type: 'stadium',
        effect: 'Roll a 6-sided die. The damage done by each guitarist, piano, and drummer attack is changed by (n - 4) * 10, with a minimum of 0.',
        description: 'Electric Acoustics: Roll a 6-sided die. The damage done by each guitarist, piano, and drummer attack is changed by (n - 4) * 10, with a minimum of 0.'
    },
    STEINERT_BASEMENT: {
        name: 'Steinert Basement Studio',
        type: 'stadium',
        effect: 'If you have exactly two pianos on your bench, draw 2 cards at the start of your turn. If there are two or more string players in play (across both sides), all attacks do +10 damage.',
        description: 'Duo Queue: If you have exactly two pianos on your bench, draw 2 cards at the start of your turn. String Ensemble: If there are two or more string players in play, all attacks do +10 damage.'
    }
};

// Tool Items
const TOOLS = {
    MAID_OUTFIT: {
        name: 'Maid outfit',
        type: 'tool',
        effect: 'While equipped, this character does not take damage from any attacks that do 20 damage to it or less and gains Maid status. For each active or benched maid, at the start of each turn a player can look at the top 2 cards of their deck, play up to one matcha, and shuffle the rest back in.',
        grantStatus: 'Maid'
    },
    CONDUCTOR_BATON: {
        name: 'Conductor Baton',
        type: 'tool',
        effect: 'While equipped, this character gains 30 health and Conductor status, but the retreat cost is doubled.',
        grantStatus: 'Conductor'
    },
    KIKI_HEADBAND: {
        name: 'Kiki\'s headband',
        type: 'tool',
        effect: 'Free or cheaper switches',
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
        effect: 'Look at the top card of your opponent\'s deck, you may discard it'
    },
    ANNOTATED_SCORE: {
        name: 'Annotated score',
        type: 'item',
        effect: 'Look at the top 2 cards of your opponent\'s deck; for each, choose to put it on the top or bottom'
    },
    MUSESCORE_FILE: {
        name: 'Musescore file',
        type: 'item',
        effect: 'Your opponent reveals three cards in their hand. Choose to discard one.'
    },
    CORRUPTED_FILE: {
        name: 'Corrupted file',
        type: 'item',
        effect: 'Flip a coin. If tails, you must also discard a card from your hand. Your opponent reveals three cards in their hand. Choose to discard one.'
    },
    CAST_RESERVE: {
        name: 'Cast reserve',
        type: 'item',
        effect: 'Flip a coin. If heads, choose one of your opponent\'s Benched characters for them to shuffle into their deck. If tails, your opponent chooses one of their Benched characters to shuffle into their deck.'
    },
    FOLDING_STAND: {
        name: 'Folding stand',
        type: 'item',
        effect: 'Active character does 10 more damage this turn'
    },
    BUO_STAND: {
        name: 'BUO stand',
        type: 'item',
        effect: 'Active character does 20 more damage this turn. Discard 1 energy from your active character.'
    },
    ICE_SKATES: {
        name: 'Ice skates',
        type: 'item',
        effect: 'Switch your opponent\'s active characters with one of their benched characters.'
    },
    CONCERT_PROGRAM: {
        name: 'Concert program',
        type: 'item',
        effect: 'Look at the top 5 cards of your deck.'
    },
    SE_ROSTER: {
        name: 'SE concert roster',
        type: 'item',
        effect: 'Search for (low health player?). You may play it to your Bench.'
    },
    REHEARSAL_ROSTER: {
        name: 'Dress rehearsal roster',
        type: 'item',
        effect: 'Look at top 3 cards, choose 1 and discard the other two'
    },
    CONCERT_TICKET: {
        name: 'Concert ticket',
        type: 'item',
        effect: 'Draw to 4 cards in hand'
    },
    BAI_EMAIL: {
        name: 'BAI Email',
        type: 'item',
        effect: 'Discard any stadium in play.'
    },
    AVGE_BIRB: {
        name: 'AVGE Birb',
        type: 'item',
        effect: 'Remove all your opponent\'s tool cards. During your next turn, your active character takes 30 more damage from all attacks that do damage.'
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
        effect: 'One-man Ensemble: Put all character cards from your discard pile into your hand. Your turn ends.'
    },
    MICHELLE: {
        name: 'Michelle',
        type: 'supporter',
        effect: 'Logistics: Shuffle all cards from your discard pile into your deck. Your turn ends.'
    },
    WILL: {
        name: 'Will',
        type: 'supporter',
        effect: 'Arrangement: Shuffle all items from your discard pile into your deck.'
    },
    LUCAS: {
        name: 'Lucas',
        type: 'supporter',
        effect: 'Small Ensemble: Your bench must be empty to play this card. Search for any three characters of different types in your deck, and put them all on your bench.'
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
        effect: 'Toxic Sabotage: Switch your opponent\'s active character with one of their benched characters'
    },
    VICTORIA: {
        name: 'Victoria Chen',
        type: 'supporter',
        effect: 'Section Leader: Choose a type, search for up to 3 characters of that type in your deck, and put them all on your bench.'
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
