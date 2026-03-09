// Card Database

import { TYPES, SUPER_EFFECTIVE_CHAIN } from './src/constants.js';

// Character Cards
const CHARACTERS = {
    // BRASS CHARACTERS
    VINCENT_CHEN: {
        name: 'Vincent Chen',
        type: [TYPES.BRASS],
        hp: 130,
        moves: [
            { name: 'Fanfare', cost: 1, damage: 20, effect: 'Not affected by weakness, resistance, or immunities.' },
            { name: 'Cherry Flavored Valve Oil', cost: 3, damage: 40, effect: 'Deal 40 damage. Heal one benched character of your choice for the same amount of damage this attack actually dealt.' }
        ],
        retreatCost: 3
    },
    BARRON_LEE: {
        name: 'Barron Lee',
        type: [TYPES.BRASS],
        hp: 100,
        ability: {
            name: 'Get Served',
            description: 'While this character is in play, none of your opponent\’s characters can have more than 3 energy attached to them at once. If they do before this card is active, they must discard the excess energy from each.',
            type: 'passive'
        },
        moves: [
            { name: 'Embouchure', cost: 1, damage: 20, effect: 'Move your energy among your characters any way you would like.' }
        ],
        retreatCost: 2
    },
    CAROLYN_ZHENG: {
        name: 'Carolyn Zheng',
        type: [TYPES.BRASS],
        hp: 90,
        ability: {
            name: 'Procrastinate',
            description: 'If this character did not attack during the previous turn, do +30 damage. Does not stack.',
            type: 'passive'
        },
        moves: [
            { name: 'Blast', cost: 3, damage: 70 }
        ],
        retreatCost: 1
    },
    FILIP_KAMINSKI: {
        name: 'Filip Kaminski',
        type: [TYPES.BRASS],
        hp: 120,
        moves: [
            { name: 'Heart of the Cards', cost: 1, damage: 0, effect: 'Name a card, then draw the top card of your deck. If the two are the same, deal 60 damage.' },
            { name: 'Intense Echo', cost: 3, damage: 50, effect: 'Your opponent\'s benched characters take 10 damage.' }
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
            { name: 'Concert Pitch', cost: 3, damage: 40, effect: 'This attack does 20 more damage for each Brass character on your bench.' }
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
            description: 'At the start of each of your turns, if this character has exactly 2 energy attached to her and is in the active slot, you may draw one extra card.',
            type: 'passive'
        },
        moves: [
            { name: 'Intense Echo', cost: 3, damage: 50, effect: 'Your opponent\'s benched characters take 10 damage.' }
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
            { name: 'Ross Attack!', cost: 2, damage: 0, effect: 'If Ross is on your bench, draw two cards. If Ross is on your opponent\'s bench, do 50 damage to one of your opponent\'s characters. If Ross is on both benches, nothing happens.' }
        ],
        retreatCost: 2
    },
    HAPPY_RUTH: {
        name: 'Happy Ruth Jara',
        type: [TYPES.CHOIR],
        hp: 90,
        ability: {
            name: 'Leave Rehearsal Early',
            description: 'During your turn, if this character is on your bench and has no tools attached, you may move her to your hand, healing her fully and discarding any attached energy.',
            type: 'activated'
        },
        moves: [
            { name: 'SATB', cost: 3, damage: 0, effect: 'For each of your Choir type characters in play, choose one of your opponent\'s characters and do 20 damage to it.' }
        ],
        retreatCost: 1
    },
    RYAN_DU: {
        name: 'Ryan Du',
        type: [TYPES.CHOIR],
        hp: 100,
        moves: [
            { name: 'Chorus', cost: 2, damage: 30, effect: 'Does 10 more damage per benched character you have in play.' },
            { name: 'Tabemono King', cost: 3, damage: 0, effect: 'All your characters heal 40 damage. All your opponent\'s characters heal 10 damage. Discard 1 energy from this character.' }
        ],
        retreatCost: 1
    },
    RACHEL_CHEN: {
        name: 'Rachel Chen',
        type: [TYPES.CHOIR],
        hp: 110,
        ability: {
            name: 'Program Production',
            description: 'Once during your turn, you may retrieve one concert program or concert ticket from the discard into your hand.',
            type: 'activated'
        },
        moves: [
            { name: 'SATB', cost: 3, damage: 0, effect: 'For each of your Choir type characters in play, choose one of your opponent\'s characters and do 20 damage to it.' }
        ],
        retreatCost: 1
    },

    // GUITAR CHARACTERS
    OWEN_LANDRY: {
        name: 'Owen Landry',
        type: [TYPES.GUITAR],
        hp: 100,
        moves: [
            { name: 'Feedback Loop', cost: 2, damage: 50, effect: 'Each of your benched guitars take 10 damage.' },
            { name: 'Domain Expansion', cost: 3, damage: 0, effect: 'Discard all energy attached to this character. Does 50 damage to all your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    ANTONG_CHEN: {
        name: 'Antong Chen',
        type: [TYPES.GUITAR],
        hp: 100,
        moves: [
            { name: 'Fingerstyle', cost: 2, damage: 0, effect: 'You can only use this attack if this character did not use Power Chord during your last turn. Flip 5 coins and do 20 damage for each heads.' },
            { name: 'Power Chord', cost: 3, damage: 90, effect: 'Discard 2 Energy from this character.' }
        ],
        retreatCost: 2
    },
    EDWARD_WIBOWO: {
        name: 'Edward Wibowo',
        type: [TYPES.GUITAR],
        hp: 110,
        moves: [
            { name: 'Packet Loss', cost: 2, damage: 0, effect: 'Flip a coin for each energy attached to your opponent\'s active character. For each heads, discard one of those energies.' },
            { name: 'Distortion', cost: 3, damage: 40, effect: '40 damage. During your next turn, your guitars do 40 more damage.' }
        ],
        retreatCost: 2
    },
    CHRISTMAS_KIM: {
        name: 'Christmas Kim',
        type: [TYPES.GUITAR],
        hp: 100,
        moves: [
            { name: 'Strum', cost: 1, damage: 20 },
            { name: 'Surprise Delivery', cost: 2, damage: 0, effect: 'You may look at the top three cards of your deck. Reveal all character cards, put them in your hand, and do 10 damage for each; topdeck the rest in any order.' }
        ],
        retreatCost: 2
    },
    MEYA_GAO: {
        name: 'Meya Gao',
        type: [TYPES.GUITAR],
        hp: 120,
        ability: {
            name: 'I See Your Soul',
            description: 'If Meya is damaged by any character, that character and Meya both cannot attack during the next turn.',
            type: 'passive'
        },
        moves: [
            { name: 'Distortion', cost: 3, damage: 40, effect: '40 damage. During your next turn, your guitars do 40 more damage.' }
        ],
        retreatCost: 2
    },
    ROBERTO_GONZALES: {
        name: 'Roberto Gonzales',
        type: [TYPES.GUITAR],
        hp: 110,
        moves: [
            { name: 'Guitar Shredding', cost: 2, damage: 30, effect: 'Discard all energy attached to this character. For each energy, discard 1 card from the top of your opponent\'s deck.' },
            { name: 'Distortion', cost: 3, damage: 40, effect: '40 damage. During your next turn, your guitars do 40 more damage.' }
        ],
        retreatCost: 2
    },
    GRACE_ZHAO: {
        name: 'Grace Zhao',
        type: [TYPES.GUITAR],
        hp: 110,
        ability: {
            name: 'Royalties',
            description: 'If Grace is in play, any opposing character with any AVGE showcase sticker or t-shirt takes 10 damage at the end of your turn.',
            type: 'passive'
        },
        moves: [
            { name: 'Feedback Loop', cost: 2, damage: 50, effect: 'Each of your benched guitars take 10 damage.' }
        ],
        retreatCost: 2
    },
    BEN_CHEREK: {
        name: 'Ben Jose Cherek III',
        type: [TYPES.GUITAR],
        hp: 120,
        ability: {
            name: 'Loudmouth',
            description: 'When you play this character from your hand to your bench, you may switch him with your active character for free.',
            type: 'passive'
        },
        moves: [
            { name: 'Feedback Loop', cost: 2, damage: 50, effect: 'Each of your benched guitars take 10 damage.' }
        ],
        retreatCost: 1
    },

    // PERCUSSION CHARACTERS
    HANLEI_GAO: {
        name: 'Hanlei Gao',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Stick Trick', cost: 2, damage: 20, effect: '20 damage. You may swap with one of your Benched characters for free.' },
            { name: 'Tricky Rhythms', cost: 3, damage: 0, effect: 'Each character in play with a tool attached to it takes 50 damage.' }
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
            { name: 'Cymbal Crash', cost: 1, damage: 20 }
        ],
        retreatCost: 2
    },
    PASCAL_KIM: {
        name: 'Pascal Kim',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Ragebaited', cost: 2, damage: 20, effect: 'When 50 hp or below, this attack does 30 more damage. When 20 hp or below, 80 more damage.' },
            { name: 'Ominous Chimes', cost: 3, damage: 0, effect: 'Shuffle this character and all cards attached to it back into your deck. At the end of your opponent\'s next turn, their Active character takes 70 damage.' }
        ],
        retreatCost: 2
    },
    RYAN_LEE: {
        name: 'Ryan Lee',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Percussion Ensemble', cost: 1, damage: 0, effect: 'Attach up to two energy to one of your benched Percussion types.' },
            { name: 'Four Mallets', cost: 3, damage: 0, effect: 'Four individual attacks of 10 damage each. Draw a card.' }
        ],
        retreatCost: 2
    },
    KEVIN_YANG: {
        name: 'Kevin Yang',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Rimshot', cost: 2, damage: 0, effect: 'Roll a d6. If you roll a 1-4, do 70 damage.' },
            { name: 'Stickshot', cost: 3, damage: 0, effect: 'Roll a d6 four times. Damage is equal to (40 × the lowest number you rolled).' }
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
            { name: 'Four Hands Piano', cost: 3, damage: 50, effect: '+30 damage if you have a piano on your bench.' }
        ],
        retreatCost: 2
    },
    KEI_WATANABE: {
        name: 'Kei Watanabe',
        type: [TYPES.PERCUSSION],
        hp: 100,
        moves: [
            { name: 'Rudiments', cost: 1, damage: 10, effect: '10 damage to one of your opponent\'s characters of your choice.' },
            { name: 'Drum Kid Workshop', cost: 3, damage: 0, effect: 'Choose any Percussion type in play\'s attack to use as this attack. After attacking you must move all energy from this character to the character whose attack you used.' }
        ],
        retreatCost: 2
    },
    BOKAI_BI: {
        name: 'Bokai Bi',
        type: [TYPES.PERCUSSION],
        hp: 110,
        ability: {
            name: 'Algorithm',
            description: 'While Bokai is in play, if your opponent plays a character you already have in play, that character on your opponent\'s side takes 60 damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Rimshot', cost: 2, damage: 0, effect: 'Roll a d6. If you roll a 1-4, do 70 damage.' }
        ],
        retreatCost: 2
    },
    EUGENIA_AMPOFO: {
        name: 'Eugenia Ampofo',
        type: [TYPES.PERCUSSION],
        hp: 100,
        ability: {
            name: 'Fermentation',
            description: 'While this card is active, you may attach two energy per turn (instead of one) to one of your benched characters.',
            type: 'passive'
        },
        moves: [
            { name: 'Stick Trick', cost: 2, damage: 20, effect: '20 damage. You may swap with one of your Benched characters for free.' }
        ],
        retreatCost: 2
    },
    LOANG_CHIANG: {
        name: 'Loang Chiang',
        type: [TYPES.PERCUSSION],
        hp: 110,
        moves: [
            { name: 'Stick Trick', cost: 2, damage: 20, effect: '20 damage. You may swap with one of your Benched characters for free.' },
            { name: 'Excused Absence', cost: 3, damage: 0, effect: 'Heal 30 damage from each of your characters.' }
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
            description: 'For the rest of the turn during which you played him, your opponents\' abilities have no effect until the end of the turn.',
            type: 'activated'
        },
        moves: [
            { name: 'Damper Pedal', cost: 2, damage: 20, effect: 'Damage of your opponent\'s next attack is halved (rounded up)' }
        ],
        retreatCost: 2
    },
    HENRY_WANG: {
        name: 'Henry Wang',
        type: [TYPES.PIANO],
        hp: 110,
        moves: [
            { name: 'Glissando', cost: 1, damage: 30, effect: 'You cannot use this attack during your next turn.' },
            { name: 'Improv', cost: 3, damage: 20, effect: 'Discard the top card of your opponent\'s deck. 80 more damage if it is an item.' }
        ],
        retreatCost: 2
    },
    RYAN_LI: {
        name: 'Ryan Li',
        type: [TYPES.PIANO],
        hp: 100,
        ability: {
            name: 'Moe moe kyun~!',
            description: 'All maids\' attacks (on both sides) do 10 more damage.',
            type: 'passive'
        },
        moves: [
            { name: 'Separate Hands', cost: 1, damage: 0, effect: 'If you used this move the previous turn, 40 damage. Else, 0 damage.' }
        ],
        retreatCost: 2
    },
    KATIE_XIANG: {
        name: 'Katie Xiang',
        type: [TYPES.PIANO],
        hp: 110,
        ability: {
              name: 'Nausicaa\'s Undying Heartbeat',
              description: '(Ability) Nausicaa\'s Undying Heartbeat: If this character is at 60 or less health at the end of a turn, heal 20 damage from all of your other characters.',
              type: 'passive'
        },
        moves: [
            { name: 'Grand Piano', cost: 3, damage: 60, effect: '+20 damage if the stadium in play is a performance hall.' }
        ],
        retreatCost: 2
    },
    DEMI_LU: {
        name: 'Demi Lu',
        type: [TYPES.PIANO],
        hp: 110,
        ability: {
            name: 'Steinert Warrior',
            description: 'If the stadium is Steinert, and this character is on the bench, she is immune to all effects from all attacks. Additionally, she is not affected by 15 Minute Walk.',
            type: 'passive'
        },
        moves: [
            { name: 'Four Hands', cost: 3, damage: 50, effect: '+30 damage if you have another piano on your bench.' }
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
            { name: 'Damper Pedal', cost: 2, damage: 20, effect: 'Damage of your opponent\'s next attack is halved (rounded up)' }
        ],
        retreatCost: 2
    },
    JENNIE_WANG: {
        name: 'Jennie Wang',
        type: [TYPES.PIANO],
        hp: 110,
        moves: [
            { name: 'Small Ensemble Committee', cost: 2, damage: 0, effect: 'Committee members: Evelyn Wu, Luke Xu, David Man, Roberto Gonzales, Bokai Bi, Jennie Wang. If another committee member is in play, this does 20 damage to each opposing character. If at least two other committee members are in play, it does 40 damage to each opposing character.' },
            { name: 'Grand Piano', cost: 3, damage: 60, effect: '+20 damage if the stadium in play is a performance hall.' }
        ],
        retreatCost: 2
    },
    COCO_ZENG: {
        name: 'Coco Zeng',
        type: [TYPES.PIANO],
        hp: 100,
        moves: [
            { name: 'Glissando', cost: 1, damage: 30, effect: 'You cannot use this attack during your next turn.' },
            { name: 'Inventory Management', cost: 3, damage: 0, effect: 'Flip a coin for every card in your hand. For each heads, do 30 damage to your opponent\'s active character.' }
        ],
        retreatCost: 2
    },
    MATTHEW_WANG: {
        name: 'Matthew Wang',
        type: [TYPES.PIANO],
        hp: 100,
        ability: {
            name: 'Pot of Greed',
            description: 'While this character is in your active slot, at the beginning of each of your turns, flip a coin. If heads, you may draw an extra card.',
            type: 'passive'
        },
        moves: [
            { name: 'Three Hand Technique', cost: 3, damage: 0, effect: 'Three individual attacks of 20 damage each' }
        ],
        retreatCost: 2
    },
    CATHY_RONG: {
        name: 'Cathy Rong',
        type: [TYPES.PIANO],
        hp: 110,
        moves: [
            { name: 'Racket Smash', cost: 2, damage: 20, effect: 'Discard an energy from one of your opponent\'s benched characters.' },
            { name: 'Four Hands', cost: 3, damage: 50, effect: '+30 damage if you have another piano on your bench.' }
        ],
        retreatCost: 2
    },
    SOPHIA_S_WANG: {
        name: 'Sophia S. Wang',
        type: [TYPES.PIANO],
        hp: 110,
        ability: {
            name: 'The Original is Always Better',
            description: 'The first time each turn you attach an energy to this character, your opponent must discard the top card of the deck.',
            type: 'passive'
        },
        moves: [
            { name: 'Damper Pedal', cost: 2, damage: 20, effect: 'Damage of your opponent\'s next attack is halved (rounded up)' }
        ],
        retreatCost: 2
    },
    JOSHUA_KOU: {
        name: 'Joshua Kou',
        type: [TYPES.PIANO],
        hp: 90,
        ability: {
            name: 'Category Theory',
            description: 'If this card is the only card in your hand, you may reveal it, shuffle it into your deck, and draw 4 cards.',
            type: 'activated'
        },
        moves: [
            { name: 'Separate Hands', cost: 1, damage: 0, effect: 'If you used this move the previous turn, 40 damage. Else, 0 damage.' }
        ],
        retreatCost: 1
    },

    // STRINGS CHARACTERS
    INA_MA: {
        name: 'Ina Ma',
        type: [TYPES.STRINGS],
        hp: 100,
        ability: {
            name: 'Borrow a Bow',
            description: 'Once per turn you may move one energy to this character from another of your Strings type characters in play.',
            type: 'activated'
        },
        moves: [
            { name: 'Triple Stop', cost: 3, damage: 0, effect: 'Flip three coins. Does 40 damage for each heads.' }
        ],
        retreatCost: 2
    },
    ANDREA_CONDORMANGO: {
        name: 'Andrea C. R.',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Foresight', cost: 1, damage: 0, effect: 'Look at the top three cards of your opponent\'s deck and rearrange them in any way you like.' },
            { name: 'Snap Pizz', cost: 3, damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
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
            { name: 'Seal Attack', cost: 2, damage: 40 }
        ],
        retreatCost: 1
    },
    MICHELLE_KIM: {
        name: 'Michelle Kim',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Open Strings', cost: 1, damage: 10, effect: 'Draw a card. If it is an item, you must use it.' },
            { name: 'VocaRock!!', cost: 2, damage: 30, effect: 'If Miku Otamatone has been used this turn, 50 additional damage.' }
        ],
        retreatCost: 1
    },
    MAGGIE_LI: {
        name: 'Maggie Li',
        type: [TYPES.STRINGS],
        hp: 110,
        moves: [
            { name: 'Midday Nap', cost: 1, damage: 0, effect: 'Heal 20 damage.' },
            { name: 'Snap Pizz', cost: 3, damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    GABRIEL_CHEN: {
        name: 'Gabriel Chen',
        type: [TYPES.STRINGS],
        hp: 90,
        moves: [
            { name: 'You know what it is', cost: 1, damage: 0, effect: 'Only usable if he has exactly 60 health. Does 70 damage to any of the opponent\'s characters.' },
            { name: 'Harmonics', cost: 2, damage: 0, effect: 'Flip two coins. If both are heads, choose 3 targets to do 60 damage each, or 2 targets to do 70 damage each.' }
        ],
        retreatCost: 2
    },
    JESSICA_JUNG: {
        name: 'Jessica Jung',
        type: [TYPES.STRINGS],
        hp: 100,
        ability: {
            name: 'Cleric Spell',
            description: 'While she is in play, once during your turn, flip a coin. If heads, you may choose to shuffle one card from your discard pile back into your deck.',
            type: 'activated'
        },
        moves: [
            { name: 'Vibrato', cost: 2, damage: 40 }
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
            { name: 'Triple Stop', cost: 3, damage: 0, effect: 'Flip three coins. Does 40 damage for each heads.' }
        ],
        retreatCost: 1
    },
    YUELIN_HU: {
        name: 'Yuelin Hu',
        type: [TYPES.STRINGS],
        hp: 100,
        ability: {
            name: 'Musical Cat Summoned!',
            description: 'While this character is in play, whenever you draw an AVGE birb, you may instantly discard it and deal 40 damage to your opponent\'s active character.',
            type: 'passive'
        },
        moves: [
            { name: 'Triple Stop', cost: 3, damage: 0, effect: 'Flip three coins. Does 40 damage for each heads.' }
        ],
        retreatCost: 1
    },
    ALICE_WANG: {
        name: 'Alice Wang',
        type: [TYPES.STRINGS],
        hp: 110,
        ability: {
            name: 'Euclidean Algorithm',
            description: 'While this character is in play, if your opponent has more cards in their hand than you at the end of their next turn, they must discard cards until they have the same number.',
            type: 'passive'
        },
        moves: [
            { name: 'Vibrato', cost: 2, damage: 40 }
        ],
        retreatCost: 2
    },
    MASON_YU: {
        name: 'Mason Yu',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: '440 Hz', cost: 1, damage: 0, effect: 'Attach an energy to one of your benched characters.' },
            { name: 'Arrangement Speedrun', cost: 3, damage: 0, effect: 'If this character is currently an arranger, do 40 damage, and remove arranger status from all opposing characters. If this character is not an arranger, heal 40 damage from this character, and all your other characters are now arrangers.' }
        ],
        retreatCost: 2
    },
    SOPHIA_Y_WANG: {
        name: 'Sophia Y. Wang',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Gacha Gaming', cost: 1, damage: 0, effect: 'You may choose to draw cards, taking 20 damage for each card drawn (unaffected by any modifiers). If you get AVGE Birb, heal all damage from this card, and you get to keep all cards you drew. If you ever choose to stop drawing cards, you must shuffle them back into the deck. You may not knock yourself out doing this.' },
            { name: 'Snap Pizz', cost: 3, damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
        ],
        retreatCost: 2
    },
    FIONA_LI: {
        name: 'Fiona Li',
        type: [TYPES.STRINGS],
        hp: 90,
        ability: {
            name: 'Getting Dressed',
            description: 'While Fiona is on your bench, your active character has Maid status.',
            type: 'passive'
        },
        moves: [
            { name: 'Vibrato', cost: 2, damage: 40 }
        ],
        retreatCost: 1
    },
    MICHAEL_TU: {
        name: 'Michael Tu',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: '440 Hz', cost: 1, damage: 0, effect: 'Attach an energy to one of your benched characters.' },
            { name: 'Synchro Summon', cost: 2, damage: 0, effect: 'Reveal cards from the top of your deck until a character card is revealed. If that character is not a String type, do 30 damage, and put the character in your hand and shuffle the other cards into your deck.' }
        ],
        retreatCost: 1
    },
    IRIS_YANG: {
        name: 'Iris Yang',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Open Strings', cost: 1, damage: 10, effect: 'Draw a card. If it is an item, you must use it.' },
            { name: 'Spike', cost: 3, damage: 10, effect: 'Discard an energy from each of your opponent\'s benched characters.' }
        ],
        retreatCost: 1
    },
    JULIA_CECCARELLI: {
        name: 'Julia Ceccarelli',
        type: [TYPES.STRINGS],
        hp: 100,
        moves: [
            { name: 'Photograph', cost: 1, damage: 0, effect: 'Look at your opponent\'s hand. You may choose an Item card there and use its effects as this attack.' },
            { name: 'Snap Pizz', cost: 3, damage: 20, effect: 'Discard 2 energy from one of your opponent\'s characters.' }
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
            description: 'If this character ever takes 60 damage or more from an attack, deal that much damage to the character that attacked this character.',
            type: 'passive'
        },
        moves: [
            { name: 'Overblow', cost: 2, damage: 50, effect: 'You take 10 recoil damage' }
        ],
        retreatCost: 2
    },
    KATHY_SUN: {
        name: 'Kathy Sun',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Analysis Paralysis', cost: 1, damage: 0, effect: 'Reveal your opponents hand and choose to shuffle one of their cards back into their deck.' },
            { name: 'Hyper-Ventilation!', cost: 3, damage: 0, effect: 'Roll a d6. Damage is equal to 30 + (10 * the number on the D6)' }
        ],
        retreatCost: 1
    },
    FELIX_CHEN: {
        name: 'Felix Chen',
        type: [TYPES.WOODWINDS],
        hp: 90,
        ability: {
            name: 'Synesthesia',
            description: 'If all of your characters in play are a different type, they each take 10 less damage from any attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Multiphonics', cost: 3, damage: 0, effect: 'Flip two coins. If both are heads, do 50 damage to each of your opponent\'s benched characters. If both are tails, do 100 damage to your opponent\'s active character.' }
        ],
        retreatCost: 1
    },
    DESMOND_ROPER: {
        name: 'Desmond Roper',
        type: [TYPES.WOODWINDS],
        hp: 90,
        moves: [
            { name: 'Overblow', cost: 2, damage: 50, effect: 'You take 10 recoil damage' },
            { name: 'Speedrun Central', cost: 3, damage: 40, effect: 'If this character came off the bench during this turn, 60 additional damage.' }
        ],
        retreatCost: 1
    },
    JORDAN_ROOSEVELT: {
        name: 'Jordan Roosevelt',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Trickster', cost: 1, damage: 0, effect: 'During your opponent\'s next turn, their attacks do 20 more damage. During your next turn, this character does 60 more damage.' },
            { name: 'Sparkling run', cost: 2, damage: 30, effect: 'Heal 20 damage.' }
        ],
        retreatCost: 1
    },
    ANALISE_JIA: {
        name: 'Analise Jia',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Double Tongue', cost: 1, damage: 0, effect: 'Two individual attacks of 10 damage each.' },
            { name: 'Banana Bread for Everyone!', cost: 3, damage: 0, effect: 'Heal 30 damage from each of your characters. Discard an energy from this character' }
        ],
        retreatCost: 1
    },
    HARPER_AITKEN: {
        name: 'Harper Aitken',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Overblow', cost: 2, damage: 50, effect: 'You take 10 recoil damage' },
            { name: 'Wipeout', cost: 3, damage: 0, effect: 'Deal 80 damage to three different characters in play, one of which must be yourself.' }
        ],
        retreatCost: 2
    },
    KANA_TAKIZAWA: {
        name: 'Kana Takizawa',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'Immense Aura',
            description: 'Take 10 less damage from each attack, calculated after all modifiers.',
            type: 'passive'
        },
        moves: [
            { name: 'Hyper-Ventilation!', cost: 3, damage: 0, effect: 'Roll a d6. Damage is equal to 30 + (10 * the number on the D6)' }
        ],
        retreatCost: 2
    },
    MEIYI_SONG: {
        name: 'Meiyi Song',
        type: [TYPES.WOODWINDS],
        hp: 90,
        moves: [
            { name: 'Sparkling Run', cost: 2, damage: 30, effect: 'Heal 20 damage.' },
            { name: 'Clarinet Solo', cost: 2, damage: 70, effect: 'Only usable if there are no other WW characters in play.' }
        ],
        retreatCost: 1
    },
    JAYDEN_BROWN: {
        name: 'Jayden Brown',
        type: [TYPES.WOODWINDS],
        hp: 90,
        ability: {
            name: 'Four-leaf Clover',
            description: 'If this character is in your active slot, the first time you flip a coin each turn, you may choose to treat it as heads.',
            type: 'passive'
        },
        moves: [
            { name: 'Hyper-Ventilation!', cost: 3, damage: 0, effect: 'Roll a d6. Damage is equal to 30 + (10 * the number on the D6)' }
        ],
        retreatCost: 1
    },
    LUCA_CHEN: {
        name: 'Luca Chen',
        type: [TYPES.WOODWINDS],
        hp: 90,
        moves: [
            { name: 'Sparkling Run', cost: 2, damage: 30, effect: 'Heal 20 damage.' },
            { name: 'Piccolo Solo', cost: 2, damage: 70, effect: 'Only usable if there are no other WW characters in play.' }
        ],
        retreatCost: 1
    },
    DANIEL_ZHU: {
        name: 'Daniel Zhu',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'Share the Pain',
            description: 'Whenever one of your other characters takes damage, you may instead inflict up to 30 of that damage onto this character. (Note that you may not knock out this character by using this ability. This applies after all status effects)',
            type: 'passive'
        },
        moves: [
            { name: 'Hyper-Ventilation!', cost: 3, damage: 0, effect: 'Roll a d6. Damage is equal to 30 + (10 * the number on the D6)' }
        ],
        retreatCost: 2
    },
    RACHAEL_YUAN: {
        name: 'Rachael Yuan',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Circular Breathing', cost: 1, damage: 10, effect: 'During your next turn, this attack does 10 more damage. Effect stacks up to 50 damage if used consecutively.' },
            { name: 'E2 Reaction', cost: 2, damage: 30, effect: 'Only works when your opponent\'s bench has at least 2 members. 30 damage; you may choose one of your opponent\'s benched characters to shuffle back into their deck. (Damage does NOT save.)' }
        ],
        retreatCost: 1
    },
    BETTY_SOLOMON: {
        name: 'Betty Solomon',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Outreach', cost: 1, damage: 0, effect: 'Search through your deck for any character card, and put it on top of your deck.' },
            { name: 'Overblow', cost: 2, damage: 50, effect: 'You take 10 recoil damage' }
        ],
        retreatCost: 1
    },
    ANNA_BROWN: {
        name: 'Anna Brown',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'Do Not Disturb',
            description: 'If this character is on your bench, she takes 20 less damage from each attack.',
            type: 'passive'
        },
        moves: [
            { name: 'Overblow', cost: 2, damage: 50, effect: 'You take 10 recoil damage' }
        ],
        retreatCost: 2
    },
    EVELYN_WU: {
        name: 'Evelyn Wu',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Circular Breathing', cost: 1, damage: 10, effect: 'During your next turn, this attack does 10 more damage. Effect stacks up to 50 damage if used consecutively.' },
            { name: 'SE lord', cost: 2, damage: 0, effect: 'Heal all damage from your opponent\'s bench. However much total damage healed is inflicted upon your opponent\'s active character.' }
        ],
        retreatCost: 1
    },
    SARAH_CHEN: {
        name: 'Sarah Chen',
        type: [TYPES.WOODWINDS],
        hp: 100,
        moves: [
            { name: 'Double Tongue', cost: 1, damage: 0, effect: 'Two individual attacks of 10 damage each' },
            { name: 'Artist Alley', cost: 3, damage: 0, effect: 'Discard any amount of concert programs or concert tickets from your hand and do 40 damage to any character in play for each.' }
        ],
        retreatCost: 1
    },
    IZZY_CHEN: {
        name: 'Izzy Chen',
        type: [TYPES.WOODWINDS],
        hp: 110,
        ability: {
            name: 'BAI Wrangler',
            description: 'Once per turn, you may put a stadium from your discard pile onto the bottom of your deck.',
            type: 'activated'
        },
        moves: [
            { name: 'Multiphonics', cost: 3, damage: 0, effect: 'Flip two coins. If both are heads, do 50 damage to each of your opponent\'s benched characters. If both are tails, do 100 damage to your opponent\'s active character.' }
        ],
        retreatCost: 2
    }
};

// Stadium Cards
const STADIUMS = {
    RILEY_HALL: {
        name: 'Riley Hall',
        type: 'stadium',
        isConcertHall: true,
        effect: 'If this Stadium is active at the beginning of your turn, each of your characters takes 10 nonlethal damage for each empty bench slot you have.',
        description: 'Venue Type: Concert Hall. Attendance Policy: If this Stadium is active at the beginning of your turn, each of your characters takes 10 nonlethal damage for each empty bench slot you have.'
    },
    ALUMNAE_HALL: {
        name: 'Alumnae Hall',
        type: 'stadium',
        isConcertHall: true,
        effect: 'Upon this Stadium being played, both players discard all items. While active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.',
        description: 'Venue Type: Concert Hall. Return by 4pm: Upon this Stadium being played, both players discard all items. Intense Reverb: While active, whenever a player draws a card, all their active and benched characters take 10 nonlethal damage.'
    },
    MAIN_HALL: {
        name: 'Main Hall',
        type: 'stadium',
        isConcertHall: true,
        effect: 'Each player may only play up to three cards per turn, starting the turn after this is played. May not be played on the first turn.',
        description: 'Venue Type: Concert Hall. Small Ensemble Limit: Each player may only play up to three cards per turn, starting the turn after this is played. May not be played on the first turn.'
    },
    SALOMON_DECI: {
        name: 'Salomon DECI',
        type: 'stadium',
        isConcertHall: true,
        effect: 'For every guitar, piano, choir, or percussion attack, roll a d6. On 3–6: −30 damage.',
        description: 'Venue Type: Concert Hall. Electric Acoustics: For every guitar, piano, choir or percussion attack, roll a d6. On 3–6: −30 damage.'
    },
    RED_ROOM: {
        name: 'Red Room',
        type: 'stadium',
        isConcertHall: false,
        effect: 'Strings, woodwinds, and brass do −10 damage; choir, guitars, percussion, and pianos do +10 damage.',
        description: 'Venue Type: Not a Concert Hall. Amp Diff: Strings, woodwinds and brass do −10 damage; choir, guitars, percussion, pianos do +10 damage.'
    },
    LINDEMANN: {
        name: 'Lindemann Big Practice Room',
        type: 'stadium',
        isConcertHall: false,
        effect: 'If all of your benched characters share a type with your active character, your attacks take 1 less energy.',
        description: 'Venue Type: Not a Concert Hall. Sectionals: If all of your benched characters share a type with your active character, your attacks take 1 less energy.'
    },
    PETTERUTI: {
        name: 'Petteruti Lounge',
        type: 'stadium',
        isConcertHall: false,
        effect: 'Maids do +10 damage and have no retreat cost. Matcha heals +10 additional health.',
        description: 'Venue Type: Not a Concert Hall. Matcha Maid Cafe: Maids do +10 damage and have no retreat cost. Matcha heals +10 additional health.'
    },
    STEINERT_PRACTICE: {
        name: 'Steinert Practice Room',
        type: 'stadium',
        isConcertHall: false,
        effect: 'Each player may not have more than 2 benched characters. If a player has 3, they discard one (the player who played this stadium discards first). Each attack costs 1 additional energy.',
        description: 'Venue Type: Not a Concert Hall. Practice Prison: Each player may not have more than 2 benched characters. If a player has 3, they discard one (the player who played this stadium discards first). 15 Minute Walk: Each attack costs 1 additional energy.'
    },
    STEINERT_BASEMENT: {
        name: 'Steinert Basement Studio',
        type: 'stadium',
        isConcertHall: false,
        effect: 'If you have exactly two character cards in play at the start of your turn, draw two cards instead of one. Each attack costs 1 additional energy.',
        description: 'Venue Type: Not a Concert Hall. Duo Queue: If you have exactly two character cards in play at the start of your turn, draw two cards instead of one. 15 Minute Walk: Each attack costs 1 additional energy.'
    },
    FRIEDMAN: {
        name: 'Friedman Hall',
        type: 'stadium',
        isConcertHall: false,
        effect: 'Draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck.',
        description: 'Venue Type: Not a Concert Hall. Democratic Process: Draw two cards per turn. Your opponent chooses one for you to keep; shuffle the other back into your deck.'
    }
};

export { TYPES, SUPER_EFFECTIVE_CHAIN, CHARACTERS, ITEMS, TOOLS, SUPPORTERS, STADIUMS };

// Tool Items (each character can hold at most one tool at a time)
const TOOLS = {
    MAID_OUTFIT: {
        name: 'Maid Outfit',
        type: 'tool',
        effect: 'Forced Recruitment: Attached character gains Maid status while holding this tool.',
        grantStatus: 'Maid'
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
        effect: 'Anything you want to be: Attached character becomes only a Percussion type.',
        monoType: TYPES.PERCUSSION
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
// Maid: This character is immune to all attacks of 10 base damage or less (before debuffs).
// Conductor: This character gains 30 health, but the retreat cost is doubled. Each music stand used gives +10 additional damage
// Goon: This character gains 20 health, and each music stand used grants this character +10 damage, but their retreat cost is doubled.
// Arranger: Whenever damaged, you may shuffle an item card from your discard pile into your deck. When knocked out, you may search your discard pile for one musescore file and put it in your hand.

// Non-Tool Items
const ITEMS = {
    OTAMATONE: {
        name: 'Otamatone',
        type: 'item',
        subtype: 'special_energy',
        effect: 'Wildcard: During this turn only, your active character has one additional energy attached. Cannot be played on the first turn.'
    },
    MIKU_OTAMATONE: {
        name: 'Miku Otamatone',
        type: 'item',
        subtype: 'special_energy',
        effect: 'Only has an effect in concert halls. During this turn only, your active character has two additional energy attached. Cannot be played on the first turn.'
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
        effect: 'Opponent reveals their entire hand. Choose one to discard. Cannot be played on the first turn.'
    },
    ANNOTATED_SCORE: {
        name: 'Annotated Score',
        type: 'item',
        subtype: 'sheet_music',
        effect: 'Opponent reveals their entire hand. Choose up to two cards to shuffle back into their deck. Cannot be played on the first turn.'
    },
    MUSESCORE_FILE: {
        name: 'Standard Musescore File',
        type: 'item',
        subtype: 'musescore',
        effect: 'You can only play this if your active character is an Arranger. Draw two cards from the top of your deck.'
    },
    CORRUPTED_FILE: {
        name: 'Corrupted Musescore File',
        type: 'item',
        subtype: 'musescore',
        effect: 'You can only play this if your active character is an Arranger. Draw two cards from the bottom of your deck.'
    },
    CAST_RESERVE: {
        name: 'Cast Reserve',
        type: 'item',
        effect: 'Search for three unique items from your deck and reveal them. Your opponent chooses two to discard. Put one of the others in your hand.'
    },
    FOLDING_STAND: {
        name: 'Folding Stand',
        type: 'item',
        effect: 'On their first attack, your active character does +10 damage this turn.'
    },
    BUO_STAND: {
        name: 'BUO Stand',
        type: 'item',
        effect: 'On their first attack, your active character does +20 damage this turn. Discard 1 energy from the active character.'
    },
    ICE_SKATES: {
        name: 'Ice Skates',
        type: 'item',
        effect: 'Switch your active character with one of your benched characters.'
    },
    CONCERT_PROGRAM: {
        name: 'Concert Program',
        type: 'item',
        effect: 'Look at the top 5 cards of your deck. You may choose one character you find there and place it onto your bench. Shuffle your deck afterwards.'
    },
    CONCERT_ROSTER: {
        name: 'Concert Roster',
        type: 'item',
        subtype: 'roster',
        effect: 'Flip a coin. If heads, search your deck for a specific character and place it onto your bench. Shuffle your deck afterwards.'
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
        effect: 'Draw cards until you have 3 cards in hand.'
    },
    BAI_EMAIL: {
        name: 'BAI Email',
        type: 'item',
        effect: 'Discard any stadium in play. Then, search for a Stadium and put it in your hand. Neither player can play a stadium until the beginning of your next turn.'
    },
    AVGE_BIRB: {
        name: 'AVGE Birb',
        type: 'item',
        effect: 'Remove all tool cards and status effects from your opponent\'s active and benched characters. During your next turn, your active character takes +40 damage from attacks.'
    },
    CAMERA: {
        name: 'Camera',
        type: 'item',
        effect: 'Shuffle one Supporter card from your discard pile into your deck.'
    },
    VIDEO_CAMERA: {
        name: 'Video Camera',
        type: 'item',
        effect: 'Put an item card from your discard pile onto the top of your deck.'
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
        effect: 'Break it Down: If both players have at least as many cards in their discard pile as their deck, both players shuffle both their discard pile and their deck, and switch them.'
    },
    MICHELLE: {
        name: 'Michelle',
        type: 'supporter',
        effect: 'Discord Announcement: Opponent discards down to 1 card in hand. Cannot be played on the first turn.'
    },
    WILL: {
        name: 'Will',
        type: 'supporter',
        effect: 'Arrangement: Shuffle all items from your discard pile into your deck.'
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
        effect: 'Toxic Sabotage: Switch your opponent\'s active character with a benched character of your choice. That active character may not retreat during the next turn.'
    },
    VICTORIA: {
        name: 'Victoria Chen',
        type: 'supporter',
        effect: 'Section Leader: Choose a type, search for as many characters of that type in your deck as you\'d like, and put them all on your bench.'
    }
};
