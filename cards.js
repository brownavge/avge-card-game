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
    // BRASS CHARACTERS
    VINCENT_CHEN: {
        name: 'Vincent Chen',
        type: [TYPES.BRASS],
        hp: 140,
        moves: [
            { name: 'Fanfare', cost: ['B'], damage: 20, effect: 'Not affected by weakness, resistance, or immunities.' },
            { name: 'Drain', cost: ['B', 'B', 'X'], damage: 30, effect: 'Heal one benched character for the same amount of damage you dealt this turn.' }
        ],
        retreatCost: 3
    },
    BARRON_LEE: {
        name: 'Barron Lee',
        type: [TYPES.BRASS],
        hp: 100,
        ability: {
            name: 'Get Served',
            description: 'Your opponent\'s active character cannot have more than 3 energy attached to it at once.',
            type: 'passive'
        },
        moves: [
            { name: 'Embouchure', cost: ['B'], damage: 20, effect: 'Move your energy among your characters any way you would like.' }
        ],
        retreatCost: 2
    },
    CAROLYN_ZHENG: {
        name: 'Carolyn Zheng',
        type: [TYPES.BRASS],
        hp: 60,
        ability: {
            name: 'Procrastinate',
            description: 'If this character did not attack during the previous turn, do +40 damage. Stacks.',
            type: 'passive'
        },
        moves: [
            { name: 'Blast', cost: ['B', 'B', 'B'], damage: 40 }
        ],
        retreatCost: 1
    },
    FILIP_KAMINSKI: {
        name: 'Filip Kaminski',
        type: [TYPES.BRASS],
        hp: 120,
        moves: [
            { name: 'Heart of the Cards', cost: ['B'], damage: 0, effect: 'Name a card, then draw the top card of your deck. If the two are the same, deal 60 damage.' },
            { name: 'Echoing Blast', cost: ['B', 'B', 'X'], damage: 40, effect: 'Deal 10 damage to each of your opponent\'s bench' }
        ],
        retreatCost: 2
    },
    JUAN_BURGOS: {
        name: 'Juan Burgos',
        type: [TYPES.BRASS],
        hp: 80,
        ability: {
            name: 'Baking Buff',
            description: 'While on your bench, if your active character is a Brass type, they deal +20 damage per attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Concert Pitch', cost: ['B', 'B', 'X'], damage: 20, effect: 'If you have only brass characters on your bench, this attack does 20 more damage per brass.' }
        ],
        retreatCost: 2
    },

    // CHOIR CHARACTERS
    YANWAN_ZHU: {
        name: 'Yanwan Zhu',
        type: [TYPES.CHOIR],
        hp: 100,
        ability: {
            name: 'Bass Boost',
            description: 'If this character has 2 Guitar energy attached to her, after this character attacks, you may draw one extra card.',
            type: 'passive'
        },
        moves: [
            { name: 'Full Force', cost: ['C', 'C', 'X'], damage: 30, effect: 'Your opponent\'s benched characters take 10 damage.' }
        ],
        retreatCost: 1
    },
    ROSS_WILLIAMS: {
        name: 'Ross Williams',
        type: [TYPES.CHOIR],
        hp: 110,
        ability: {
            name: 'I Am Become Ross',
            description: 'While this card is on your bench, your active character can use any of Ross\'s attacks.',
            type: 'passive'
        },
        moves: [
            { name: 'Ross Attack!', cost: ['X', 'X'], damage: 0, effect: 'If Ross is on your bench, draw two cards. If Ross is on your opponent\'s bench, do 50 damage to one of your opponent\'s characters. If Ross is on both benches, nothing happens.' }
        ],
        retreatCost: 2
    },
    HAPPY_RUTH: {
        name: 'Happy Ruth Jara',
        type: [TYPES.CHOIR],
        hp: 90,
        ability: {
            name: 'Leave Rehearsal Early',
            description: 'If this card has no cards attached to it and is on the bench, you may put it in your hand at the end of your turn.',
            type: 'passive'
        },
        moves: [
            { name: 'SATB', cost: ['C', 'X'], damage: 0, effect: 'For each of your Choir type characters in play, choose one of your opponent\'s characters and do 10 damage to it.' }
        ],
        retreatCost: 1
    },
    RYAN_DU: {
        name: 'Ryan Du',
        type: [TYPES.CHOIR],
        hp: 100,
        moves: [
            { name: 'Tabemono King', cost: ['X', 'X'], damage: 0, effect: 'All your characters heal by 30 damage. All your opponent\'s characters heal by 10 damage. Discard 1 energy from this character.' },
            { name: 'Chorus', cost: ['C', 'C'], damage: 20, effect: 'Does 10 more damage per benched character you have in play.' }
        ],
        retreatCost: 1
    },
    RACHEL_CHEN: {
        name: 'Rachel Chen',
        type: [TYPES.CHOIR],
        hp: 110,
        ability: {
            name: 'Program Production',
            description: 'Once during your turn, if Rachel is in the active slot, you may retrieve up to 2 number of concert programs or concert tickets from the discard into your hand.',
            type: 'activated'
        },
        moves: [
            { name: 'SATB', cost: ['C', 'X'], damage: 0, effect: 'For each of your Choir type characters in play, choose one of your opponent\'s characters and do 10 damage to it.' }
        ],
        retreatCost: 1
    },

    // GUITAR CHARACTERS
    OWEN_LANDRY: {
        name: 'Owen Landry',
        type: [TYPES.GUITAR],
        hp: 100,
        moves: [
            { name: 'Feedback Loop', cost: ['G', 'X'], damage: 40, effect: 'Each of your guitars take 10 damage.' },
            { name: 'Domain Expansion', cost: ['G', 'G', 'G'], damage: 0, effect: 'Discard all energy attached to this character. Does 40 damage to all your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    ANTONG_CHEN: {
        name: 'Antong Chen',
        type: [TYPES.GUITAR],
        hp: 100,
        moves: [
            { name: 'Fingerstyle', cost: ['G', 'X'], damage: 0, effect: 'You can only use this attack if this character did not use Power Chord during your last turn. Flip 8 coins and do 10 damage for each heads.' },
            { name: 'Power Chord', cost: ['G', 'G', 'G'], damage: 70, effect: 'Discard 2 Energy from this character.' }
        ],
        retreatCost: 2
    },
    EDWARD_WIBOWO: {
        name: 'Edward Wibowo',
        type: [TYPES.GUITAR],
        hp: 110,
        moves: [
            { name: 'Packet Loss', cost: ['X', 'X'], damage: 0, effect: 'Flip a coin for each energy attached to your opponent\'s active character. For each tails, discard one of those energies.' },
            { name: 'Distortion', cost: ['G', 'G', 'G'], damage: 30, effect: 'During your next turn, your plucked strings do 40 more damage.' }
        ],
        retreatCost: 2
    },
    CHRISTMAS_KIM: {
        name: 'Christmas Kim',
        type: [TYPES.GUITAR],
        hp: 100,
        moves: [
            { name: 'Strum', cost: ['G'], damage: 20 },
            { name: 'Surprise Delivery', cost: ['G', 'G'], damage: 0, effect: 'You may look at the top three cards of your deck and attach any energy you find there to one of your benched characters. Do 20 damage for each card attached in this way.' }
        ],
        retreatCost: 2
    },
    MEYA_GAO: {
        name: 'Meya Gao',
        type: [TYPES.GUITAR],
        hp: 110,
        ability: {
            name: 'I See Your Soul',
            description: 'If Meya is damaged by any character, that character and Meya both cannot attack during the next turn.',
            type: 'passive'
        },
        moves: [
            { name: 'Distortion', cost: ['G', 'G', 'G'], damage: 30, effect: 'During your next turn, your plucked strings do 40 more damage.' }
        ],
        retreatCost: 2
    },
    ROBERTO_GONZALES: {
        name: 'Roberto Gonzales',
        type: [TYPES.GUITAR],
        hp: 110,
        moves: [
            { name: 'Guitar Shredding', cost: ['G', 'G'], damage: 10, effect: 'Discard all guitar energy attached to this character. For each energy, discard 2 cards from the top of your opponent\'s deck.' },
            { name: 'Distortion', cost: ['G', 'G', 'G'], damage: 30, effect: 'During your next turn, your plucked strings do 40 more damage.' }
        ],
        retreatCost: 2
    },
    GRACE_ZHAO: {
        name: 'Grace Zhao',
        type: [TYPES.GUITAR],
        hp: 110,
        ability: {
            name: 'Royalties',
            description: 'If Grace is active, any opposing character with any AVGE patch or t-shirt takes 10 damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Feedback Loop', cost: ['G', 'X'], damage: 40, effect: 'Each of your plucked strings take 10 damage.' }
        ],
        retreatCost: 2
    },

    // PERCUSSION CHARACTERS
    HANLEI_GAO: {
        name: 'Hanlei Gao',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Stick Trick', cost: ['P', 'X'], damage: 10, effect: 'Swap with one of your Benched characters for free.' },
            { name: 'Tricky Rhythms', cost: ['P', 'P', 'X'], damage: 0, effect: 'Choose both one of your opponents benched characters and one of your own benched characters to discard all energy from. Then, choose a different one of your opponent\'s characters and do 10 damage to it for each energy discarded. (You must be able to discard at least one energy from each character to use this attack.)' }
        ],
        retreatCost: 2
    },
    CAVIN_XUE: {
        name: 'Cavin Xue',
        type: [TYPES.PERCUSSION],
        hp: 100,
        ability: {
            name: 'Wait no… I\'m not into femboys–',
            description: 'Cavin does 20 more damage for each maid in play.',
            type: 'passive'
        },
        moves: [
            { name: 'Cymbal Crash', cost: ['P'], damage: 20 }
        ],
        retreatCost: 2
    },
    GEORGE_CHUDLEY: {
        name: 'George Chudley',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Rimshot', cost: ['P', 'X'], damage: 0, effect: 'Roll a d6. If you roll a 1-4, do 60 damage.' },
            { name: 'Snowball Effect', cost: ['X', 'X', 'X'], damage: 0, effect: 'Roll a d6 until you get a 6. Your attack does 10 damage multiplied by the number of non-6 rolls you got.' }
        ],
        retreatCost: 2
    },
    PASCAL_KIM: {
        name: 'Pascal Kim',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Ragebaited', cost: ['P', 'X'], damage: 10, effect: 'When below 50% hp this attack does +20 damage. When below 20% hp, +60 damage.' },
            { name: 'Ominous Chimes', cost: ['P', 'X', 'X'], damage: 0, effect: 'Shuffle this character and all cards attached to it back into your deck. At the end of your opponent\'s next turn, their Active character takes 50 damage.' }
        ],
        retreatCost: 2
    },
    RYAN_LEE: {
        name: 'Ryan Lee',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Percussion Ensemble', cost: ['P'], damage: 0, effect: 'Search your deck for up to 2 Percussion Energies and attach all of them to any other percussionist.' },
            { name: 'Four Mallets', cost: ['P', 'X', 'X'], damage: 0, effect: 'Four individual attacks of 10 damage each.' }
        ],
        retreatCost: 2
    },
    KEVIN_YANG: {
        name: 'Kevin Yang',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Rimshot', cost: ['P', 'X'], damage: 0, effect: 'Roll a d6. If you roll a 1-4, do 60 damage.' },
            { name: 'Stickshot', cost: ['P', 'X', 'X'], damage: 0, effect: 'Roll a d6. If you roll a 1-4, roll once more. Damage is equal to (10 * the highest number you rolled)' }
        ],
        retreatCost: 2
    },
    DANIEL_YANG: {
        name: 'Daniel Yang',
        type: [TYPES.PERCUSSION],
        hp: 110,
        ability: {
            name: 'Delicate Ears',
            description: 'If there are no Brass characters in play, this character\'s attacks do 20 more damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Four Hands', cost: ['K', 'K', 'X'], damage: 30, effect: '+30 damage if you have another piano on your bench.' }
        ],
        retreatCost: 2
    },
    KEI_WATANABE: {
        name: 'Kei Watanabe',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Rudiments', cost: ['P'], damage: 10, effect: '10 damage to one of your opponent\'s characters of your choice.' },
            { name: 'Drum Kid Workshop', cost: ['P', 'P'], damage: 0, effect: 'Choose any Percussion type in play\'s attack to use as this attack. After attacking you must move all energy from this character to the character whose attack you used.' }
        ],
        retreatCost: 2
    },
    BOKAI_BI: {
        name: 'Bokai Bi',
        type: [TYPES.PERCUSSION],
        hp: 110,
        ability: {
            name: 'Algorithm',
            description: 'If your opponent plays a card that has a duplicate on your bench, they take 50 damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Rimshot', cost: ['P', 'X'], damage: 0, effect: 'Roll a d6. If you roll a 1-4, do 60 damage.' }
        ],
        retreatCost: 2
    },
    EUGENIA_AMPOFO: {
        name: 'Eugenia Ampofo',
        type: [TYPES.PERCUSSION],
        hp: 100,
        ability: {
            name: 'Fermentation',
            description: 'While active, you may attach three energy (instead of one) to one to your characters.',
            type: 'passive'
        },
        moves: [
            { name: 'Stick Trick', cost: ['P', 'X'], damage: 10, effect: 'Swap with one of your Benched characters for free.' }
        ],
        retreatCost: 2
    },
    LOANG_CHIANG: {
        name: 'Loang Chiang',
        type: [TYPES.PERCUSSION],
        hp: 110,
        moves: [
            { name: 'Stick Trick', cost: ['P', 'X'], damage: 10, effect: 'Swap with one of your Benched characters for free.' },
            { name: 'Excused Absence', cost: ['X', 'X', 'X'], damage: 0, effect: 'Heal 30 damage from each of your characters.' }
        ],
        retreatCost: 2
    },

    // PIANO CHARACTERS
    LUKE_XU: {
        name: 'Luke Xu',
        type: [TYPES.PIANO],
        hp: 110,
        ability: {
            name: 'Nullify',
            description: 'If you placed this character on your bench this turn, your opponents\' abilities have no effect during this turn.',
            type: 'activated'
        },
        moves: [
            { name: 'Damper Pedal', cost: ['K', 'K'], damage: 20, effect: 'Damage of your opponent\'s next attack is halved (rounded up)' }
        ],
        retreatCost: 2
    },
    HENRY_WANG: {
        name: 'Henry Wang',
        type: [TYPES.PIANO],
        hp: 110,
        moves: [
            { name: 'Glissando', cost: ['K'], damage: 30, effect: 'You cannot use this attack during your next turn.' },
            { name: 'Improv', cost: ['X', 'X', 'X'], damage: 0, effect: 'Discard the top 3 cards of your opponent\'s deck. 40 damage x the number of item cards discarded.' }
        ],
        retreatCost: 2
    },
    RYAN_LI: {
        name: 'Ryan Li',
        type: [TYPES.PIANO],
        hp: 100,
        ability: {
            name: 'Moe moe kyun~!',
            description: 'All maids\' attacks do 20 more damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Separate Hands', cost: ['K'], damage: 0, effect: '0 damage. During your next turn, this attack does 40 damage.' }
        ],
        retreatCost: 2
    },
    KATIE_XIANG: {
        name: 'Katie Xiang',
        type: [TYPES.PIANO],
        hp: 110,
        ability: {
            name: 'Nausicaa\'s Undying Heartbeat',
            description: 'If this character is at 40 or less health at the end of a turn, heal 20 damage from each of your characters.',
            type: 'passive'
        },
        moves: [
            { name: 'Grand Piano', cost: ['K', 'X', 'X'], damage: 60, effect: 'You may only use this attack if the stadium in play is a performance stadium.' }
        ],
        retreatCost: 2
    },
    DEMI_LU: {
        name: 'Demi Lu',
        type: [TYPES.PIANO],
        hp: 110,
        ability: {
            name: 'Steinert Warrior',
            description: 'If the stadium is Steinert, and this character is on the bench, she is immune to all effects from all attacks.',
            type: 'passive'
        },
        moves: [
            { name: 'Four Hands', cost: ['K', 'K', 'X'], damage: 30, effect: '+30 damage if you have another piano on your bench.' }
        ],
        retreatCost: 2
    },
    DAVID_MAN: {
        name: 'David Man',
        type: [TYPES.PIANO],
        hp: 100,
        ability: {
            name: 'Reverse Heist',
            description: 'While this character is in play, once per turn you may shuffle your discard pile and randomly choose 3 cards. Put all item/tool cards chosen on the top of your deck in any order. (You need at least 3 cards in your discard to do this)',
            type: 'activated'
        },
        moves: [
            { name: 'Damper Pedal', cost: ['K', 'K'], damage: 20, effect: 'Damage of your opponent\'s next attack is halved (rounded up)' }
        ],
        retreatCost: 2
    },
    JENNIE_WANG: {
        name: 'Jennie Wang',
        type: [TYPES.PIANO],
        hp: 110,
        moves: [
            { name: 'Small Ensemble Committee', cost: ['K', 'K'], damage: 0, effect: 'If a small ensemble committee member is in play, this does 10 damage to each opposing character. If at least three are in play it does 30 damage to each opposing character.' },
            { name: 'Grand Piano', cost: ['K', 'X', 'X'], damage: 60, effect: 'You may only use this attack if the stadium in play is a performance stadium.' }
        ],
        retreatCost: 2
    },
    COCO_ZENG: {
        name: 'Coco Zeng',
        type: [TYPES.PIANO],
        hp: 100,
        moves: [
            { name: 'Glissando', cost: ['K'], damage: 30, effect: 'You cannot use this attack during your next turn.' },
            { name: 'Inventory Management', cost: ['X', 'X'], damage: 0, effect: 'Flip a coin for every card in your hand. For each heads, do 10 damage to one of your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    MATTHEW_WANG: {
        name: 'Matthew Wang',
        type: [TYPES.PIANO],
        hp: 100,
        ability: {
            name: 'Pot of Greed',
            description: 'During the beginning of each of your turns, flip a coin. If heads, you may draw an extra card.',
            type: 'passive'
        },
        moves: [
            { name: 'Three Hand Technique', cost: ['K'], damage: 0, effect: 'Four individual attacks of 10 damage each' }
        ],
        retreatCost: 2
    },
    CATHY_RONG: {
        name: 'Cathy Rong',
        type: [TYPES.PIANO],
        hp: 110,
        moves: [
            { name: 'Racket Smash', cost: ['X', 'X'], damage: 10, effect: 'Discard an energy from one of your opponent\'s benched characters.' },
            { name: 'Four Hands', cost: ['K', 'K', 'X'], damage: 30, effect: '+30 damage if you have another piano on your bench.' }
        ],
        retreatCost: 2
    },
    SOPHIA_WANG: {
        name: 'Sophia Wang',
        type: [TYPES.PIANO],
        hp: 110,
        ability: {
            name: 'The Original is Always Better',
            description: 'The first time each turn you attach an energy to this character, your opponent must discard the top card of the deck.',
            type: 'passive'
        },
        moves: [
            { name: 'Damper Pedal', cost: ['K', 'K'], damage: 20, effect: 'Damage of your opponent\'s next attack is halved (rounded up)' }
        ],
        retreatCost: 2
    },

    // STRINGS CHARACTERS
    INA_MA: {
        name: 'Ina Ma',
        type: [TYPES.STRINGS],
        hp: 100,
        ability: {
            name: 'Borrow',
            description: 'Once per turn you may move one energy from another string player to this character.',
            type: 'activated'
        },
        moves: [
            { name: 'Triple Stop', cost: ['S', 'X', 'X'], damage: 0, effect: 'Flip three coins. Does 30 damage for each heads.' }
        ],
        retreatCost: 2
    },
    ANDREA_CONDORMANGO: {
        name: 'Andrea Condormango Rafael',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Foresight', cost: ['X'], damage: 0, effect: 'Look at the top three cards of your opponent\'s deck and rearrange them in any way you like.' },
            { name: 'Snap Pizz', cost: ['S', 'S', 'X'], damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
        ],
        retreatCost: 1
    },
    ASHLEY_TOBY: {
        name: 'Ashley Toby',
        type: [TYPES.STRINGS],
        hp: 90,
        ability: {
            name: 'Instagram Viral',
            description: 'If both benches are full, she does 2x as much damage',
            type: 'passive'
        },
        moves: [
            { name: 'Seal Attack', cost: ['S', 'X'], damage: 30 }
        ],
        retreatCost: 1
    },
    MICHELLE_KIM: {
        name: 'Michelle Kim',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Open Strings', cost: ['S'], damage: 10, effect: 'Draw a card. If it is an energy, attach it to this character.' },
            { name: 'VocaRock!!', cost: ['S', 'S'], damage: 20, effect: 'If Miku Otamatone is attached to this character, 50 additional damage.' }
        ],
        retreatCost: 1
    },
    MAGGIE_LI: {
        name: 'Maggie Li',
        type: [TYPES.STRINGS],
        hp: 110,
        moves: [
            { name: 'Midday Nap', cost: ['X'], damage: 0, effect: 'Heal 20 damage.' },
            { name: 'Snap Pizz', cost: ['S', 'S', 'X'], damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    GABRIEL_CHEN: {
        name: 'Gabriel Chen',
        type: [TYPES.STRINGS],
        hp: 80,
        moves: [
            { name: 'You know what it is', cost: ['X'], damage: 0, effect: 'Only usable if he has exactly 60 health. Does 70 damage to any of the opponent\'s characters.' },
            { name: 'Harmonics', cost: ['S', 'S'], damage: 0, effect: 'Flip two coins. If both of them are heads, do 80 damage. Otherwise, do nothing.' }
        ],
        retreatCost: 2
    },
    JESSICA_JUNG: {
        name: 'Jessica Jung',
        type: [TYPES.STRINGS],
        hp: 100,
        ability: {
            name: 'Cleric Spell',
            description: 'During your turn, you may choose to shuffle one card from your discard pile back into your deck.',
            type: 'activated'
        },
        moves: [
            { name: 'Vibrato', cost: ['S', 'X'], damage: 30 }
        ],
        retreatCost: 1
    },
    EMILY_WANG: {
        name: 'Emily Wang',
        type: [TYPES.STRINGS],
        hp: 100,
        ability: {
            name: 'Profit Margins',
            description: 'Right before your attack, you may discard a tool from Emily to draw 2 cards.',
            type: 'activated'
        },
        moves: [
            { name: 'Triple Stop', cost: ['S', 'X', 'X'], damage: 0, effect: 'Flip three coins. Does 30 damage for each heads.' }
        ],
        retreatCost: 1
    },
    YUELIN_HU: {
        name: 'Yuelin Hu',
        type: [TYPES.STRINGS],
        hp: 100,
        ability: {
            name: 'Musical Cat Summoned!',
            description: 'Any time you draw an AVGE birb, you may instantly discard it and deal 30 damage to your opponent\'s active character.',
            type: 'passive'
        },
        moves: [
            { name: 'Triple Stop', cost: ['S', 'X', 'X'], damage: 0, effect: 'Flip three coins. Does 30 damage for each heads.' }
        ],
        retreatCost: 1
    },
    ALICE_WANG: {
        name: 'Alice Wang',
        type: [TYPES.STRINGS],
        hp: 110,
        ability: {
            name: 'Euclidean Algorithm',
            description: 'While this character is active, if your opponent has more cards in their hand than you at the end of their next turn, they must discard cards until they have the same number.',
            type: 'passive'
        },
        moves: [
            { name: 'Vibrato', cost: ['S', 'X'], damage: 30 }
        ],
        retreatCost: 2
    },
    MASON_YU: {
        name: 'Mason Yu',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: '440 Hz', cost: ['X'], damage: 0, effect: 'Attach an energy from your hand to one of your benched characters.' },
            { name: 'Song Voting', cost: ['S', 'S', 'S'], damage: 0, effect: 'Each player places two cards from their hand face down and reveals them at the same time. If there are an even number of energy cards, do 50 damage to active character. If there are an even number of character cards, do 50 damage to one benched character. (zero is an even number)' }
        ],
        retreatCost: 2
    },
    SOPHIA_Y_WANG: {
        name: 'Sophia Y. Wang',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Gacha Gaming', cost: ['X'], damage: 0, effect: 'You may choose to draw cards, taking 20 damage for each card drawn. If you get AVGE Birb, heal all damage from this card, and you get to keep all other cards you drew. If you ever choose to stop drawing cards, you must shuffle them back into the deck. You may not knock yourself out doing this.' },
            { name: 'Snap Pizz', cost: ['S', 'S', 'X'], damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    FIONA_LI: {
        name: 'Fiona Li',
        type: [TYPES.STRINGS],
        hp: 90,
        ability: {
            name: 'Getting Dressed',
            description: 'While on your bench, your active character gains maid status.',
            type: 'passive'
        },
        moves: [
            { name: 'Vibrato', cost: ['S', 'X'], damage: 30 }
        ],
        retreatCost: 1
    },

    // WOODWINDS CHARACTERS
    WESTON_POE: {
        name: 'Weston Poe',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'Right back at you',
            description: 'If this character ever takes 50 damage or more from an attack, deal that much damage to the character that attacked this character.',
            type: 'passive'
        },
        moves: [
            { name: 'Overblow', cost: ['W', 'X'], damage: 40, effect: 'You take 10 recoil damage' }
        ],
        retreatCost: 2
    },
    KATHY_SUN: {
        name: 'Kathy Sun',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Analysis Paralysis', cost: ['X'], damage: 0, effect: 'Reveal your opponents hand and choose to shuffle one of their cards back into their deck.' },
            { name: 'Screech!', cost: ['W', 'X', 'X'], damage: 0, effect: 'Roll a d6. Damage is equal to 10 + (10 * the number on the D6)' }
        ],
        retreatCost: 1
    },
    FELIX_CHEN: {
        name: 'Felix Chen',
        type: [TYPES.WOODWINDS],
        hp: 90,
        ability: {
            name: 'Synesthesia',
            description: 'When this character is on your bench, you may treat exactly one of your Woodwinds energy as any other energy while attacking.',
            type: 'passive'
        },
        moves: [
            { name: 'Multiphonics', cost: ['W', 'W', 'W'], damage: 0, effect: 'Flip two coins. If both of them are heads, do 40 damage to each of your opponent\'s benched characters. If both of them are tails, do 80 damage to your opponent\'s active character.' }
        ],
        retreatCost: 1
    },
    DESMOND_ROPER: {
        name: 'Desmond Roper',
        type: [TYPES.WOODWINDS],
        hp: 90,
        moves: [
            { name: 'Overblow', cost: ['W', 'X'], damage: 40, effect: 'You take 10 recoil damage' },
            { name: 'Speedrun Central', cost: ['W', 'X', 'X'], damage: 20, effect: 'If this character came off the bench during this turn, 40 additional damage.' }
        ],
        retreatCost: 1
    },
    JORDAN_ROOSEVELT: {
        name: 'Jordan Roosevelt',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Trickster', cost: ['X'], damage: 0, effect: 'During your opponent\'s next turn, they do 20 more damage. During your next turn, this character does 50 more damage.' },
            { name: 'Sparkling run', cost: ['W', 'X'], damage: 20, effect: 'Heal 20 damage.' }
        ],
        retreatCost: 1
    },
    ANALISE_JIA: {
        name: 'Analise Jia',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Double Tongue', cost: ['W'], damage: 0, effect: 'Two individual attacks of 10 damage each.' },
            { name: 'Banana Bread for Everyone!', cost: ['X', 'X', 'X'], damage: 0, effect: 'Heal 30 damage from each of your characters. Discard an energy from this character' }
        ],
        retreatCost: 1
    },
    HARPER_AITKEN: {
        name: 'Harper Aitken',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Overblow', cost: ['W', 'X'], damage: 40, effect: 'You take 10 recoil damage' },
            { name: 'Wipeout', cost: ['W', 'W', 'X'], damage: 0, effect: 'Deal 60 damage to three different characters in play, one of which must be yourself.' }
        ],
        retreatCost: 2
    },
    KANA_TAKIZAWA: {
        name: 'Kana Takizawa',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'Immense Aura',
            description: 'Take 20 less damage from each attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Screech!', cost: ['W', 'X', 'X'], damage: 0, effect: 'Roll a d6. Damage is equal to 10 + (10 * the number on the D6)' }
        ],
        retreatCost: 2
    },
    MEIYI_SONG: {
        name: 'Meiyi Song',
        type: [TYPES.WOODWINDS],
        hp: 90,
        moves: [
            { name: 'Sparkling Run', cost: ['W', 'X'], damage: 20, effect: 'Heal 20 damage.' },
            { name: 'Clarinet Solo', cost: ['W', 'W'], damage: 0, effect: 'If she is the only WW character in play, this attack does 80 damage.' }
        ],
        retreatCost: 1
    },
    JAYDEN_BROWN: {
        name: 'Jayden Brown',
        type: [TYPES.WOODWINDS],
        hp: 90,
        ability: {
            name: 'Four-leaf Clover',
            description: 'The first time you flip a coin each turn, you may choose to treat it as heads.',
            type: 'passive'
        },
        moves: [
            { name: 'Screech!', cost: ['W', 'X', 'X'], damage: 0, effect: 'Roll a d6. Damage is equal to 10 + (10 * the number on the D6)' }
        ],
        retreatCost: 1
    },
    LUCA_CHEN: {
        name: 'Luca Chen',
        type: [TYPES.WOODWINDS],
        hp: 90,
        moves: [
            { name: 'Sparkling Run', cost: ['W', 'X'], damage: 20, effect: 'Heal 20 damage.' },
            { name: 'Piccolo Solo', cost: ['W', 'W'], damage: 0, effect: 'If they are the only WW character in play, this attack does 80 damage.' }
        ],
        retreatCost: 1
    },
    DANIEL_ZHU: {
        name: 'Daniel Zhu',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'Share the Pain',
            description: 'Whenever one of your other characters takes damage, you may instead inflict up to 20 of that damage onto this character. (Note that you may not knock out this character by using this ability.)',
            type: 'passive'
        },
        moves: [
            { name: 'Screech!', cost: ['W', 'X', 'X'], damage: 0, effect: 'Roll a d6. Damage is equal to 10 + (10 * the number on the D6)' }
        ],
        retreatCost: 2
    },
    RACHAEL_YUAN: {
        name: 'Rachael Yuan',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Circular Breathing', cost: ['W'], damage: 10, effect: 'During your next turn, this attack does 10 more damage. Effect stacks if used consecutively.' },
            { name: 'SN2', cost: ['W', 'W'], damage: 20, effect: 'Only works when your opponent\'s bench is not full. 20 damage, and shuffle one of your opponent\'s benched characters back into their deck.' }
        ],
        retreatCost: 1
    },
    BETTY_SOLOMON: {
        name: 'Betty Solomon',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Outreach', cost: ['W'], damage: 0, effect: 'Search through your deck for any character card, and put it on top of your deck.' },
            { name: 'Overblow', cost: ['W', 'X'], damage: 40, effect: 'You take 10 recoil damage' }
        ],
        retreatCost: 1
    },
    ANNA_BROWN: {
        name: 'Anna Brown',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'Do Not Disturb',
            description: 'If this character is on your bench, reduce any damage taken from attacks by 30 damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Overblow', cost: ['W', 'X'], damage: 40, effect: 'You take 10 recoil damage' }
        ],
        retreatCost: 2
    },
    EVELYN_WU: {
        name: 'Evelyn Wu',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Circular Breathing', cost: ['W'], damage: 10, effect: 'During your next turn, this attack does 10 more damage. Effect stacks if used consecutively.' },
            { name: 'SE lord', cost: ['W', 'W', 'W'], damage: 0, effect: 'Heal all damage from your opponent\'s bench. However much total damage healed is inflicted upon your opponent\'s active character.' }
        ],
        retreatCost: 1
    },
    SARAH_CHEN: {
        name: 'Sarah Chen',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Double Tongue', cost: ['W'], damage: 0, effect: 'Two individual attacks of 10 damage each' },
            { name: 'Artist Alley', cost: ['X', 'X', 'X'], damage: 0, effect: 'Discard any amount of concert posters from your hand and do 30 damage for each.' }
        ],
        retreatCost: 1
    },
    IZZY_CHEN: {
        name: 'Izzy Chen',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'BAI Wrangler',
            description: 'If a concert hall is in play, take 20 less damage from any attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Multiphonics', cost: ['W', 'W', 'W'], damage: 0, effect: 'Flip two coins. If both of them are heads, do 40 damage to each of your opponent\'s benched characters. If both of them are tails, do 80 damage to your opponent\'s active character.' }
        ],
        retreatCost: 2
    }
};

// Stadium Cards
const STADIUMS = {
    RILEY_HALL: {
        name: 'Riley Hall',
        type: 'stadium',
        effect: 'If this Stadium is active at the beginning of your turn, each of your characters take 10 nonlethal damage for each of your empty bench slots.',
        description: 'Attendance Policy: If this Stadium is active at the beginning of your turn, each of your characters take 10 nonlethal damage for each empty bench slot you have.'
    },
    ALUMNAE_HALL: {
        name: 'Alumnae Hall',
        type: 'stadium',
        effect: 'Upon this Stadium being played, both players discard all Music Stands. While active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.',
        description: 'Return by 4pm: Upon this Stadium being played, both players discard all Music Stands. Intense Reverb: While active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.'
    },
    MAIN_HALL: {
        name: 'Main Hall',
        type: 'stadium',
        effect: 'Each player may only play up to three Helper Cards per turn, starting the turn after this is played.',
        description: 'Small Ensemble Limit: Each player may only play up to three Helper Cards per turn, starting the turn after this is played.'
    },
    SALOMON_DECI: {
        name: 'Salomon DECI',
        type: 'stadium',
        effect: 'For every guitar, piano, or percussion attack, roll a d6. On 1–2: +10 damage. On 3–6: −10 damage.',
        description: 'Electric Acoustics: For every guitar, piano, or percussion attack, roll a d6. On 1–2: +10 damage. On 3–6: −10 damage.'
    },
    RED_ROOM: {
        name: 'Red Room',
        type: 'stadium',
        effect: 'Strings and woodwinds do −10 damage; guitars and percussion do +10 damage.',
        description: 'Amp Diff: Strings and woodwinds do −10 damage; guitars and percussion do +10 damage.'
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
        effect: 'At the start of each player\'s turn, their active character takes 10 nonlethal damage. Maids do +10 damage. Matcha heals +10 additional health.',
        description: 'Powerpoint Night: At the start of each player\'s turn, their active character takes 10 nonlethal damage. Matcha Maid Cafe: Maids do +10 damage. Matcha heals +10 additional health.'
    },
    STEINERT_PRACTICE: {
        name: 'Steinert Practice Room',
        type: 'stadium',
        effect: 'Each player may not have more than 2 benched characters. If a player has 3, they discard one (the player who played this stadium discards first). Pianos do +10 damage.',
        description: 'Practice Prison: Each player may not have more than 2 benched characters. If a player has 3, they discard one (the player who played this stadium discards first). Piano Practice: Pianos do +10 damage.'
    },
    STEINERT_BASEMENT: {
        name: 'Steinert Basement Studio',
        type: 'stadium',
        effect: 'If you have exactly two pianos on your bench, draw two cards instead of one at the start of your turn. Each attack costs 1 additional energy.',
        description: 'Duo Queue: If you have exactly two pianos on your bench, draw two cards instead of one at the start of your turn. 15 Minute Walk: Each attack costs 1 additional energy.'
    },
    FRIEDMAN: {
        name: 'Friedman Hall',
        type: 'stadium',
        effect: 'Draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck. All Choir characters do +10 damage.',
        description: 'Democratic Process: Draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck. A Capella: All Choir characters do +10 damage.'
    }
};

// Tool Items (each character can hold at most one tool at a time)
const TOOLS = {
    MAID_OUTFIT: {
        name: 'Maid Outfit',
        type: 'tool',
        effect: 'Forced Recruitment: Attached character gains Maid status while holding this tool.',
        grantStatus: 'Maid'
    },
    CONDUCTOR_BATON: {
        name: 'Conductor Baton',
        type: 'tool',
        effect: 'Conducting Auditions: Grants Conductor status while attached.',
        grantStatus: 'Conductor'
    },
    KIKI_HEADBAND: {
        name: 'Kiki\'s Headband',
        type: 'tool',
        effect: 'Delivery: Switch (retreat) cost is reduced by 1 energy.',
        retreatModifier: -1
    },
    BUCKET: {
        name: 'Bucket',
        type: 'tool',
        effect: 'Anything you want to be: Attached character becomes a Percussion type.',
        addType: TYPES.PERCUSSION
    },
    AVGE_TSHIRT: {
        name: 'AVGE T-Shirt',
        type: 'tool',
        effect: 'Volunteer: Grants Goon status while attached.',
        grantStatus: 'Goon'
    },
    AVGE_STICKER: {
        name: 'AVGE Showcase Sticker',
        type: 'tool',
        effect: 'If attached character is active at the start of your turn, flip a coin. If heads, draw 1 extra card.'
    },
    MUSESCORE_SUB: {
        name: 'Musescore Subscription',
        type: 'tool',
        effect: 'Grants Arranger status while attached.',
        grantStatus: 'Arranger'
    }
};

// Statuses
// Maid: immune to small attacks (<=10 damage), +10 healing from each matcha
// Conductor: This character gains 30 health, but the retreat cost is doubled. Each music stand used gives +10 additional damage
// Goon: -20 damage per attack, Every time this character is attacked, reflects 20 damage
// Arranger: Whenever damaged, you may retrieve an item card from your discard pile. When knocked out, you may search your discard pile for one musescore file and put it in your hand.

// Non-Tool Items
const ITEMS = {
    OTAMATONE: {
        name: 'Otamatone',
        type: 'item',
        subtype: 'special_energy',
        effect: 'During this turn only, your active character has one additional typeless energy attached.'
    },
    MIKU_OTAMATONE: {
        name: 'Miku Otamatone',
        type: 'item',
        subtype: 'special_energy',
        effect: 'Only works in concert halls. During this turn only, your active character has two additional typeless energy attached.'
    },
    MATCHA_LATTE: {
        name: 'Matcha Latte',
        type: 'item',
        effect: 'All your characters heal 10 health.'
    },
    STRAWBERRY_MATCHA: {
        name: 'Strawberry Matcha Latte',
        type: 'item',
        effect: 'One character of your choice heals 20 health.'
    },
    PRINTED_SCORE: {
        name: 'Printed Score',
        type: 'item',
        subtype: 'sheet_music',
        effect: 'Active character does +10 damage this turn'
    },
    ANNOTATED_SCORE: {
        name: 'Annotated Score',
        type: 'item',
        subtype: 'sheet_music',
        effect: 'Active character does +20 damage this turn. Discard 1 energy from the active character.'
    },
    MUSESCORE_FILE: {
        name: 'Standard Musescore File',
        type: 'item',
        subtype: 'musescore',
        effect: 'Opponent reveals 3 cards from hand; choose one to discard.'
    },
    CORRUPTED_FILE: {
        name: 'Corrupted File',
        type: 'item',
        subtype: 'musescore',
        effect: 'You can only play this if you have an Arranger in play. Opponent shuffles their hand into deck and draws 3 cards.'
    },
    CAST_RESERVE: {
        name: 'Cast Reserve',
        type: 'item',
        effect: 'Flip a coin. Heads: opponent shuffles a benched character into deck. Tails: opponent chooses one to shuffle.'
    },
    FOLDING_STAND: {
        name: 'Folding Stand',
        type: 'item',
        subtype: 'music_stand',
        effect: 'Shuffle up to three energy cards from your discard pile into your deck.'
    },
    BUO_STAND: {
        name: 'BUO Stand',
        type: 'item',
        subtype: 'music_stand',
        effect: 'Put one energy on top of your deck and one on the bottom.'
    },
    ICE_SKATES: {
        name: 'Ice Skates',
        type: 'item',
        effect: 'Switch your active character with one of your benched characters.'
    },
    CONCERT_PROGRAM: {
        name: 'Concert Program',
        type: 'item',
        effect: 'Look at the top 5 cards of your deck.'
    },
    CONCERT_ROSTER: {
        name: 'Concert Roster',
        type: 'item',
        subtype: 'roster',
        effect: 'Search your deck for a specific character and place it onto your bench.'
    },
    REHEARSAL_ROSTER: {
        name: 'Dress Rehearsal Roster',
        type: 'item',
        subtype: 'roster',
        effect: 'Look at top 3 cards of your deck. Keep one and discard the other two.'
    },
    CONCERT_TICKET: {
        name: 'Concert Ticket',
        type: 'item',
        effect: 'Draw cards until you have 4 cards in hand.'
    },
    BAI_EMAIL: {
        name: 'BAI Email',
        type: 'item',
        effect: 'Discard any stadium in play. Your opponent cannot play a new stadium on their next turn.'
    },
    AVGE_BIRB: {
        name: 'AVGE Birb',
        type: 'item',
        effect: 'Remove all opponent tool cards. During your next turn, your active character takes +20 damage from attacks.'
    },
    CAMERA: {
        name: 'Camera',
        type: 'item',
        effect: 'Retrieve one Supporter card from your discard pile into your hand.'
    },
    VIDEO_CAMERA: {
        name: 'Video Camera',
        type: 'item',
        effect: 'Retrieve two energy cards from your discard pile into your hand.'
    },
    RAFFLE_TICKET: {
        name: 'Raffle Ticket',
        type: 'item',
        effect: 'Draw a card. If it is an AVGE Birb, heal all damage from one character.'
    }
};

// Supporter Cards (can only play one per turn)
const SUPPORTERS = {
    JOHANN: {
        name: 'Johann',
        type: 'supporter',
        effect: 'Choose up to one Supporter, one Item, and one Stadium card from your discard pile and put them into your hand.'
    },
    RICHARD: {
        name: 'Richard',
        type: 'supporter',
        effect: 'One-Man Ensemble: Put up to three character cards from your discard pile into your hand. Your turn ends.'
    },
    MICHELLE: {
        name: 'Michelle',
        type: 'supporter',
        effect: 'Discord Announcement: Move up to two energy to any characters using energy from hand or board.'
    },
    WILL: {
        name: 'Will',
        type: 'supporter',
        effect: 'Arrangement: Shuffle all items, tools, and supporters from your discard pile into your deck.'
    },
    LUCAS: {
        name: 'Lucas',
        type: 'supporter',
        effect: 'Small Ensemble: Search for up to two characters of different types that share no types with your board and bench them.'
    },
    ANGEL: {
        name: 'Angel',
        type: 'supporter',
        effect: 'Head Goon: Give all characters Goon status.'
    },
    LIO: {
        name: 'Lio',
        type: 'supporter',
        effect: 'New Canvas: Shuffle your hand into your deck, then draw six cards.'
    },
    EMMA: {
        name: 'Emma',
        type: 'supporter',
        effect: 'Toxic Sabotage: Switch your opponent\'s active character with a benched character of your choice.'
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
