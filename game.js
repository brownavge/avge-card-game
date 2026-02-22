import { TYPES, SUPER_EFFECTIVE_CHAIN, CHARACTERS, ITEMS, TOOLS, SUPPORTERS, STADIUMS } from './cards.js';
import { getCostSymbol, getTypeFromSymbol } from './src/utils/energy.js';

// Game State Management

function createRng(seed) {
    let t = seed >>> 0;
    return function rng() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function getRandom() {
    if (game && Number.isFinite(game.randomState)) {
        game.randomState = (game.randomState + 0x6D2B79F5) >>> 0;
        let r = Math.imul(game.randomState ^ (game.randomState >>> 15), 1 | game.randomState);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    }
    return Math.random();
}

function randInt(max) {
    return Math.floor(getRandom() * max);
}

function abilitiesDisabledFor(playerNum) {
    return (game.abilitiesDisabledThisTurn === playerNum) || (game.nextTurnEffects[playerNum] && game.nextTurnEffects[playerNum].abilitiesDisabled);
}

class GameState {
    constructor() {
        this.currentPlayer = 1;
        this.phase = 'setup'; // setup, main, attack
        this.turn = 1;
        this.isFirstTurn = true; // Track if it's player 1's first turn
        this.energyAttachedThisTurn = 0; // Track how many energy attached (Eugenia allows 2 to one benched character)
        this.energyAttachedToActiveThisTurn = false;
        this.energyAttachedBenchTargetId = null;
        this.supporterPlayedThisTurn = false;
        this.attackedThisTurn = false;
        this.cardsPlayedThisTurn = 0; // For Main Hall stadium
        this.mainHallActivatedTurn = null;
        this.borrowABowUsedThisTurn = false;
        this.pendingAttackEndTurn = false;
        this.pendingAttackAttackerId = null;
        this.blockAttackEnd = false;

        this.players = {
            1: this.createPlayerState(),
            2: this.createPlayerState()
        };

        this.stadium = null;
        this.selectedCard = null;
        this.attackModifiers = { 1: {}, 2: {} }; // Temporary attack modifiers and effects
        this.nextTurnEffects = { 1: {}, 2: {} }; // Effects for next turn
        this.gameLog = [];
        this.playtestMode = false;
        this.lastAttackSource = null;
    }

    createPlayerState() {
        return {
            deck: [],
            hand: [],
            discard: [],
            active: null,
            bench: [null, null, null],
            koCount: 0
        };
    }

    isPerformanceSpace(stadiumName) {
        // Concert halls are: Main Hall, Alumnae Hall, Riley Hall, and Salomon DECI
        const performanceSpaces = ['Main Hall', 'Alumnae Hall', 'Riley Hall', 'Salomon DECI'];
        return performanceSpaces.includes(stadiumName);
    }

    switchPlayer() {
        // Clear next turn effects for current player BEFORE switching (they've had their turn to use them)
        const previousPlayer = this.currentPlayer;
        
        // Reset turn draw flag
        this.turnDrawSkipped = false;

        // Apply end-of-turn effects before switching
        this.applyEndOfTurnEffects();

        // Clear next turn effects for the player who just finished their turn
        const preservedTricksterSelfBonus = this.nextTurnEffects[previousPlayer].tricksterSelfBonus;
        const preservedAvgeBirbPenalty = this.nextTurnEffects[previousPlayer].avgebBirbPenalty;
        const preservedDistortionBonus = this.nextTurnEffects[previousPlayer].distortionBonus;
        const preservedCannotAttack = this.nextTurnEffects[previousPlayer].cannotAttack;
        this.nextTurnEffects[previousPlayer] = {};
        if (preservedTricksterSelfBonus) {
            this.nextTurnEffects[previousPlayer].tricksterSelfBonus = preservedTricksterSelfBonus;
        }
        if (preservedAvgeBirbPenalty) {
            this.nextTurnEffects[previousPlayer].avgebBirbPenalty = preservedAvgeBirbPenalty;
        }
        if (preservedDistortionBonus) {
            this.nextTurnEffects[previousPlayer].distortionBonus = preservedDistortionBonus;
        }
        if (preservedCannotAttack) {
            this.nextTurnEffects[previousPlayer].cannotAttack = preservedCannotAttack;
        }

        // After player 1's first turn, set isFirstTurn to false
        if (this.currentPlayer === 1 && this.isFirstTurn) {
            this.isFirstTurn = false;
        }

        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.energyAttachedThisTurn = 0;
        this.energyAttachedToActiveThisTurn = false;
        this.energyAttachedBenchTargetId = null;
        this.supporterPlayedThisTurn = false;
        this.attackedThisTurn = false;
        this.cardsPlayedThisTurn = 0;
        this.borrowABowUsedThisTurn = false;
        this.abilitiesDisabledThisTurn = null;
        this.abilitiesDisabledThisTurn = null;
        this.firstEnergyAttached = false; // Reset for Sophia S. Wang
        this.turn++;
        this.phase = 'main';
        this.log(`═════════════════════════════════════`, 'turn-change');
        this.log(`Turn ${this.turn}: Player ${this.currentPlayer}'s turn begins`, 'turn-change');
        this.log(`═════════════════════════════════════`, 'turn-change');

        if (this.stadium && this.stadium.name === 'Main Hall' && this.mainHallActivatedTurn !== null && this.turn > this.mainHallActivatedTurn) {
            const remaining = Math.max(0, 3 - this.cardsPlayedThisTurn);
            this.log(`Main Hall: ${remaining} card play${remaining === 1 ? '' : 's'} remaining this turn`, 'info');
        }

        // Clear attack modifiers from previous player's turn
        this.attackModifiers[previousPlayer] = {};

        // Clear wasJustBenched flags and other per-turn character flags
        const currentPlayerObj = this.players[this.currentPlayer];
        [currentPlayerObj.active, ...currentPlayerObj.bench].filter(c => c).forEach(char => {
            char.wasJustBenched = false;
            char.cameOffBenchThisTurn = false;
            char.sophiaTriggeredThisTurn = false; // Reset Sophia S. Wang's trigger
            char.usedPowerChordLastTurn = char.usedPowerChord || false; // Track for Fingerstyle
            char.usedPowerChord = false; // Reset Power Chord flag
            char.usedClericSpellThisTurn = false;
            char.usedBAIWranglerThisTurn = false;
            char.usedMusicalCatSummonedThisTurn = false;
            char.usedProgramProductionThisTurn = false;
        });

        this.applyStartOfTurnEffects();

        // Check if current player has any characters in play
        this.checkNoCharactersLoss(this.currentPlayer);
    }

    applyEndOfTurnEffects() {
        const player = this.players[this.currentPlayer];
        const opponentNum = this.currentPlayer === 1 ? 2 : 1;
        const opponent = this.players[opponentNum];

        // Ominous Chimes delayed damage (end of affected player's turn)
        if (game.nextTurnEffects[this.currentPlayer].ominousChimesDamage) {
            const targetId = game.nextTurnEffects[this.currentPlayer].ominousChimesTarget;
            const target = [player.active, ...player.bench].find(c => c && c.id === targetId);

            if (target) {
                this.dealDamage(target, game.nextTurnEffects[this.currentPlayer].ominousChimesDamage);
                this.log(`Ominous Chimes: ${target.name} takes ${game.nextTurnEffects[this.currentPlayer].ominousChimesDamage} delayed damage!`, 'damage');
            }
            game.nextTurnEffects[this.currentPlayer].ominousChimesDamage = 0;
        }

        // Katie Xiang's Nausicaa's Undying Heartbeat - At ≤50 HP, heal 20 from all
        if (!abilitiesDisabledFor(this.currentPlayer)) {
            let katieHeartbeatTriggered = false;
            [player.active, ...player.bench].filter(c => c).forEach(char => {
                if (!katieHeartbeatTriggered && char.name === 'Katie Xiang' && (char.hp - (char.damage || 0)) <= 50) {
                    katieHeartbeatTriggered = true;
                    // Heal 20 damage from all your characters
                    [player.active, ...player.bench].filter(c => c).forEach(healChar => {
                        if (healChar.damage && healChar.damage > 0) {
                            const healAmount = Math.min(20, healChar.damage);
                            healChar.damage -= healAmount;
                            this.log(`Nausicaa's Undying Heartbeat: ${healChar.name} healed ${healAmount} damage`, 'heal');
                        }
                    });
                }
            });
        }

        // (Handled at start of turn)

        // (Handled above)

        // Trickster opponent bonus lasts only for this turn
        if (this.nextTurnEffects[this.currentPlayer].tricksterOpponentBonus) {
            this.nextTurnEffects[this.currentPlayer].tricksterOpponentBonus = 0;
        }

        // Clear Trickster self bonus after the turn ends
        [player.active, ...player.bench].filter(c => c).forEach(char => {
            if (char.tricksterBonusThisTurn) {
                char.tricksterBonusThisTurn = 0;
            }
        });

        // Alice Wang discard handled in endTurn to ensure modal triggers on end turn
    }

    beginAttackPhase() {
        // Player 1 cannot attack on their first turn (like Pokémon TCG)
        if (this.isFirstTurn && this.currentPlayer === 1) {
            alert('Player 1 cannot attack on their first turn!');
            this.log('Cannot attack: Player 1 cannot attack on their first turn', 'warning');
            return;
        }

        // Check for Meya Gao's I See Your Soul - cannot attack
        if (game.nextTurnEffects[this.currentPlayer].cannotAttack) {
            alert('Cannot attack this turn due to Meya Gao\'s I See Your Soul!');
            this.log('Cannot attack: Meya Gao\'s I See Your Soul is active', 'warning');
            game.nextTurnEffects[this.currentPlayer].cannotAttack = false;
            return;
        }

        // Check for Luke Xu's Nullify - opponent abilities disabled
        const opponentNum = this.currentPlayer === 1 ? 2 : 1;
        if (abilitiesDisabledFor(this.currentPlayer)) {
            this.log('Luke Xu\'s Nullify: Opponent abilities are disabled this turn!', 'info');
        }

        const player = this.players[this.currentPlayer];
        if (player.active) {
            showAttackMenu(player.active.id);
        } else {
            alert('No active character to attack with.');
        }
    }

    applyPassiveStatuses() {
        // Apply Fiona's "Getting dressed" - while on bench, active gains maid status
        [1, 2].forEach(playerNum => {
            const player = this.players[playerNum];
            const hasFionaOnBench = !abilitiesDisabledFor(playerNum) && player.bench.some(char => char && char.name === 'Fiona Li');

            const activeChar = player.active;
            if (hasFionaOnBench && activeChar) {
                if (!activeChar.status) activeChar.status = [];
                if (!activeChar.status.includes('Maid')) {
                    activeChar.status.push('Maid');
                }
            }

            const allChars = [];
            if (activeChar) allChars.push(activeChar);
            player.bench.forEach(char => {
                if (char) allChars.push(char);
            });

            allChars.forEach(char => {
                if (!char.status || !char.status.includes('Maid')) return;
                const hasMaidTool = char.attachedTools?.some(t => t.grantStatus === 'Maid');
                const shouldHaveFromFiona = hasFionaOnBench && char === activeChar;
                if (!hasMaidTool && !shouldHaveFromFiona) {
                    char.status = char.status.filter(s => s !== 'Maid');
                }
            });
        });
    }

    applyStartOfTurnEffects() {
        const player = this.players[this.currentPlayer];

        // Apply passive statuses
        this.applyPassiveStatuses();
        const opponentNum = this.currentPlayer === 1 ? 2 : 1;
        const opponent = this.players[opponentNum];

        // Reset Four-leaf Clover flag at start of turn
        game.usedFourLeafClover = false;

        // Matthew Wang's Pot of Greed - flip coin at turn start, heads = may draw
        if (!abilitiesDisabledFor(this.currentPlayer) && player.active && player.active.name === 'Matthew Wang') {
            const coin = flipCoin();
            game.log(`Matthew Wang's Pot of Greed: Flipped ${coin ? 'heads' : 'tails'}`);
            if (coin) {
                const shouldDraw = confirm('Matthew Wang\'s Pot of Greed: Heads! Draw an extra card?');
                if (shouldDraw) {
                    this.drawCards(this.currentPlayer, 1);
                    game.log('Matthew Wang\'s Pot of Greed: Drew 1 card!');
                } else {
                    game.log('Matthew Wang\'s Pot of Greed: Chose not to draw');
                }
            }
        }

        // Yanwan Zhu's Bass Boost - At start of turn, if active with exactly 2 energy, draw 1
        if (!abilitiesDisabledFor(this.currentPlayer) && player.active && player.active.name === 'Yanwan Zhu') {
            const energyCount = player.active.attachedEnergy ? player.active.attachedEnergy.length : 0;
            if (energyCount === 2) {
                this.drawCards(this.currentPlayer, 1);
                this.log('Yanwan Zhu\'s Bass Boost: Drew 1 card!');
            }
        }

        // Trickster self-bonus (applies on your next turn)
        if (game.nextTurnEffects[this.currentPlayer].tricksterSelfBonus) {
            const { attackerId, bonus } = game.nextTurnEffects[this.currentPlayer].tricksterSelfBonus;
            const targetChar = player.active && player.active.id === attackerId ? player.active :
                player.bench.find(c => c && c.id === attackerId);

            if (targetChar) {
                targetChar.tricksterBonusThisTurn = bonus;
                game.log(`Trickster: ${targetChar.name} will do +${bonus} damage this turn`, 'info');
            }

            delete game.nextTurnEffects[this.currentPlayer].tricksterSelfBonus;
        }

        // Expire Circular Breathing bonus if it wasn't used on the intended turn
        [player.active, ...player.bench].filter(c => c).forEach(char => {
            if (char.circularBreathingBonus && char.circularBreathingBonusTurn && game.turn > char.circularBreathingBonusTurn) {
                char.circularBreathingBonus = 0;
                char.circularBreathingBonusTurn = null;
            }
        });

        // Arrangement procrastination delayed damage
        if (game.nextTurnEffects[this.currentPlayer].arrangementProcrastination) {
            const opponentNum = this.currentPlayer === 1 ? 2 : 1;
            const opponent = this.players[opponentNum];
            const musescoreCount = player.hand.filter(c => c && (c.subtype === 'musescore' || c.name === 'Musescore file' || c.name === 'Standard Musescore File' || c.name === 'Corrupted File')).length;

            if (opponent.active && musescoreCount > 0) {
                const damage = musescoreCount * 10;
                const finalDamage = calculateDamage(player.active, opponent.active, damage, { name: 'Arrangement procrastination' });
                this.dealDamage(opponent.active, finalDamage);
                this.log(`Arrangement procrastination: ${musescoreCount} musescore files for ${finalDamage} damage!`, 'damage');
            } else {
                this.log('Arrangement procrastination: No musescore files found', 'info');
            }

            game.nextTurnEffects[this.currentPlayer].arrangementProcrastination = false;
        }

        // Stadium effects at start of turn
        if (this.stadium) {
            if (this.stadium.name === 'Friedman Hall') {
                // Draw two cards, opponent chooses one to keep
                if (player.deck.length >= 2) {
                    const drawn = [player.deck.shift(), player.deck.shift()];
                    game.tempSelections = game.tempSelections || {};
                    game.tempSelections.friedmanCards = drawn;
                    game.tempSelections.friedmanPlayer = this.currentPlayer;
                    showFriedmanHallChoice(drawn);
                } else if (player.deck.length === 1) {
                    this.drawCards(this.currentPlayer, 1);
                    this.log('Friedman Hall: Drew 1 card (only 1 left in deck)');
                }
            } else if (this.stadium.name === 'Riley Hall') {
                // Take 10 nonlethal damage per empty bench slot
                const emptyBenchSlots = player.bench.filter(slot => !slot).length;
                if (emptyBenchSlots > 0) {
                    const allChars = [player.active, ...player.bench].filter(c => c);
                    allChars.forEach(char => {
                        const totalDamage = 10 * emptyBenchSlots;
                        const currentHP = char.hp - (char.damage || 0);
                        if (currentHP > totalDamage) {
                            this.dealDamage(char, totalDamage);
                            this.log(`Riley Hall: ${char.name} takes ${totalDamage} nonlethal damage (${emptyBenchSlots} empty bench slots)`, 'damage');
                        } else if (currentHP > 1) {
                            this.dealDamage(char, currentHP - 1);
                            this.log(`Riley Hall: ${char.name} takes ${currentHP - 1} nonlethal damage (${emptyBenchSlots} empty bench slots)`, 'damage');
                        }
                    });
                }
            } else if (this.stadium.name === 'Steinert Basement Studio') {
                // If you have exactly two characters in play, draw 2 cards
                const charactersInPlay = [player.active, ...player.bench].filter(c => c).length;
                if (charactersInPlay === 2) {
                    this.drawCards(this.currentPlayer, 2);
                    this.log('Steinert Basement Studio (Duo Queue): Drew 2 cards', 'info');
                    this.turnDrawSkipped = true; // Skip regular draw
                }
            } else if (this.stadium.name === 'Steinert Practice Room') {
                const opponentNum = this.currentPlayer === 1 ? 2 : 1;
                queueSteinertPracticeDiscards([this.currentPlayer, opponentNum]);
            }
        }

        // AVGE Sticker effect
        if (player.active && player.active.attachedTools) {
            player.active.attachedTools.forEach(tool => {
                if (tool.name === 'AVGE showcase sticker') {
                    this.drawCards(this.currentPlayer, 1);
                    this.log('AVGE showcase sticker: Drew 1 extra card');
                }
            });
        }

        // Grace Zhao's Royalties ability
        if (!abilitiesDisabledFor(opponentNum) && opponent.active && opponent.active.name === 'Grace Zhao') {
            const affectedChars = [player.active, ...player.bench].filter(c => c && c.attachedTools && c.attachedTools.some(tool =>
                tool.name === 'AVGE T-Shirt' || tool.name === 'AVGE T-shirt' || tool.name === 'AVGE Showcase Sticker' || tool.name === 'AVGE showcase sticker'
            ));
            affectedChars.forEach(char => {
                this.dealDamage(char, 10);
                this.log(`Grace Zhao's Royalties: ${char.name} takes 10 damage!`);
            });
        }
    }

    dealDamage(characterCard, amount, source = null, options = {}) {
        if (!characterCard) return;

        if (!source && this.lastAttackSource && this.lastAttackSource.id !== characterCard.id) {
            source = this.lastAttackSource;
        }

        // Apply defensive abilities and status effects
        let finalDamage = amount;

        const isAttackDamage = source && this.lastAttackSource && source.id === this.lastAttackSource.id && characterCard.id !== source.id;
        let playerNum = this.findPlayerWithCharacter(characterCard);
        let playerObj = this.players[playerNum];
        const canApplyAbilities = !abilitiesDisabledFor(playerNum);

        if (isAttackDamage) {
            if (game.nextTurnEffects[game.currentPlayer].tricksterOpponentBonus) {
                finalDamage += game.nextTurnEffects[game.currentPlayer].tricksterOpponentBonus;
                game.log(`Trickster: +${game.nextTurnEffects[game.currentPlayer].tricksterOpponentBonus} damage this turn`);
            }
            if (source.tricksterBonusThisTurn) {
                finalDamage += source.tricksterBonusThisTurn;
                game.log(`Trickster: ${source.name} gains +${source.tricksterBonusThisTurn} damage`);
            }
        }

        // Maid status: immune to attacks of 10 base damage or less (before debuffs)
        const baseDamage = typeof options.baseDamage === 'number' ? options.baseDamage : (typeof game.lastAttackBaseDamage === 'number' ? game.lastAttackBaseDamage : null);
        const isAttack = typeof options.isAttack === 'boolean' ? options.isAttack : isAttackDamage;
        if (!options.ignoreImmunities && isAttack && characterCard.status && characterCard.status.includes('Maid') && baseDamage !== null && baseDamage <= 10) {
            this.log(`${characterCard.name} is protected by Maid status!`, 'info');
            return;
        }

        if (isAttackDamage && canApplyAbilities) {
            // Character-specific abilities
            if (characterCard.name === 'Kana Takizawa' && canApplyAbilities) {
                finalDamage -= 10; // Immense Aura
                this.log('Kana\'s Immense Aura reduces damage by 10');
            }

            // Check for synergy abilities (Katie/Mason, Sophia/Pascal)
            const player = this.findPlayerWithCharacter(characterCard);
            // Removed Katie/Mason and Sophia/Pascal synergies (no longer on card text)

            // Demi Lu's Steinert Warrior - Immune on bench if Steinert stadium
            if (!options.ignoreImmunities && characterCard.name === 'Demi Lu' && playerObj && playerObj.bench.includes(characterCard)) {
                if (this.stadium && (this.stadium.name === 'Steinert Practice Room' || this.stadium.name === 'Steinert Basement Studio')) {
                    finalDamage = 0;
                    this.log('Demi Lu\'s Steinert Warrior: Immune on bench in Steinert stadium!');
                }
            }
        }

        finalDamage = Math.max(0, finalDamage);

        if (finalDamage > 0 && finalDamage % 10 !== 0) {
            finalDamage = Math.ceil(finalDamage / 10) * 10;
        }

        // Weston Poe's Right back at you - Reflect 60+ damage
        if (canApplyAbilities && characterCard.name === 'Weston Poe' && finalDamage >= 60 && source) {
            // Reflect damage to the attacker (source of the damage)
            this.dealDamage(source, finalDamage, null); // Pass null as source to avoid infinite recursion
            this.log(`Weston Poe's Right back at you: Reflected ${finalDamage} damage back to ${source.name}!`, 'damage');
            // Weston still takes the damage (don't set finalDamage to 0)
        }

        // Daniel Zhu's Share the Pain - choose up to 30 (in multiples of 10) to redirect, cannot KO Daniel
        const danielZhu = playerObj && playerObj.bench.find(c => c && c.name === 'Daniel Zhu');
        if (canApplyAbilities && danielZhu && characterCard.id !== danielZhu.id && finalDamage > 0) {
            const danielCurrentHP = danielZhu.hp - (danielZhu.damage || 0);
            const maxSafeRedirect = Math.min(30, finalDamage, danielCurrentHP - 1);
            if (maxSafeRedirect >= 10) {
                const rawChoice = prompt(`Daniel Zhu's Share the Pain: Redirect how much damage to Daniel? (0-${maxSafeRedirect}, multiples of 10)`);
                let chosenRedirect = Number(rawChoice);
                if (!Number.isFinite(chosenRedirect)) chosenRedirect = 0;
                chosenRedirect = Math.max(0, Math.min(maxSafeRedirect, chosenRedirect));
                chosenRedirect = Math.floor(chosenRedirect / 10) * 10;

                if (chosenRedirect > 0) {
                    this.dealDamage(danielZhu, chosenRedirect, null);
                    finalDamage -= chosenRedirect;
                    this.log(`Daniel Zhu's Share the Pain: Redirected ${chosenRedirect} damage from ${characterCard.name} to Daniel Zhu!`);
                }
            }
        }

        // Meya Gao's I See Your Soul - Both can't attack next turn if damaged
        if (canApplyAbilities && characterCard.name === 'Meya Gao' && finalDamage > 0) {
            const opponentNum = playerNum === 1 ? 2 : 1;
            game.nextTurnEffects[playerNum].cannotAttack = true;
            game.nextTurnEffects[opponentNum].cannotAttack = true;
            this.log('Meya Gao\'s I See Your Soul: Both players cannot attack next turn!');
        }

        characterCard.damage = (characterCard.damage || 0) + finalDamage;

        // Arranger status: may shuffle an item from discard into deck when damaged
        if (characterCard.status && characterCard.status.includes('Arranger') && finalDamage > 0) {
            const ownerPlayerNum = this.findPlayerWithCharacter(characterCard);
            if (ownerPlayerNum) {
                const ownerPlayer = this.players[ownerPlayerNum];
                const itemsInDiscard = ownerPlayer.discard.filter(c => c.cardType === 'item');
                if (itemsInDiscard.length > 0) {
                    this.log(`${characterCard.name} may shuffle an item from discard into their deck (Arranger status)`);
                    if (!game.tempSelections) game.tempSelections = {};
                    if (source && game.lastAttackSource && source.id === game.lastAttackSource.id) {
                        game.pendingAttackEndTurn = true;
                        game.pendingAttackAttackerId = source.id;
                        game.blockAttackEnd = true;
                    }
                    game.tempSelections.discardDestination = 'deck';
                    game.tempSelections.discardShuffle = true;
                    showDiscardSelectionModal(ownerPlayer, itemsInDiscard, 'item', 1, () => {
                        delete game.tempSelections.discardDestination;
                        delete game.tempSelections.discardShuffle;
                    });
                } else {
                    this.log('No item cards in discard', 'info');
                }
            }
        }

        // Check if knocked out
        if (characterCard.damage >= characterCard.hp) {
            this.knockOut(characterCard);
        }

        this.render();
    }

    knockOut(characterCard) {
        const playerNum = this.findPlayerWithCharacter(characterCard);
        const player = this.players[playerNum];

        this.log(`${characterCard.name} was knocked out!`);

        // Arranger status: Search discard for Musescore file when knocked out
        if (characterCard.status && characterCard.status.includes('Arranger')) {
            const musescoreFiles = player.discard.filter(c =>
                c.name === 'Standard Musescore File' || c.name === 'Corrupted Musescore File'
            );
            if (musescoreFiles.length > 0) {
                this.log(`Arranger status: ${characterCard.name} can retrieve a Musescore file!`, 'info');
                // Show modal to select Musescore file (if function exists)
                if (typeof showMusescoreRetrievalModal === 'function') {
                    showMusescoreRetrievalModal(player, musescoreFiles);
                }
            }
        }

        // Move to discard
            // Discard attached tools
            if (characterCard.attachedTools && characterCard.attachedTools.length > 0) {
                characterCard.attachedTools.forEach(tool => {
                    player.discard.push(tool);
                    this.log(`Discarded ${tool.name} from ${characterCard.name}`, 'info');
                });
                characterCard.attachedTools = [];
            }

            player.discard.push(characterCard);

        // Remove from active or bench
        if (player.active === characterCard) {
            player.active = null;
        } else {
            const benchIndex = player.bench.indexOf(characterCard);
            if (benchIndex !== -1) {
                player.bench[benchIndex] = null;
            }
        }

        // Increment opponent's KO count
        const opponent = this.currentPlayer === playerNum ? (playerNum === 1 ? 2 : 1) : this.currentPlayer;
        this.players[opponent].koCount++;

        // Check win condition
        if (this.players[opponent].koCount >= 3) {
            this.endGame(opponent);
            return;
        }

        // Check if player has no characters left in play
        this.checkNoCharactersLoss(playerNum);

        this.render();
    }

    endGame(winner) {
        alert(`Player ${winner} wins!`);
        this.phase = 'gameover';
        this.render();
    }

    checkNoCharactersLoss(playerNum) {
        // Don't check on turn 1 or 2 - both players need a chance to set up
        if (this.turn <= 2) {
            return;
        }

        const player = this.players[playerNum];
        const hasCharacters = player.active || player.bench.some(char => char !== null);

        if (!hasCharacters) {
            this.log(`Player ${playerNum} loses: no characters in play!`, 'error');
            const winner = playerNum === 1 ? 2 : 1;
            this.endGame(winner);
        }
    }

    findPlayerWithCharacter(characterCard) {
        for (let p = 1; p <= 2; p++) {
            const player = this.players[p];
            if (player.active === characterCard) return p;
            if (player.bench.includes(characterCard)) return p;
        }
        return null;
    }

    isCharacterInPlay(characterName, playerNum) {
        const player = this.players[playerNum];
        const names = Array.isArray(characterName) ? characterName : [characterName];
        if (player.active && names.includes(player.active.name)) return true;
        return player.bench.some(char => char && names.includes(char.name));
    }

    drawCards(playerNum, count) {
        const player = this.players[playerNum];
        for (let i = 0; i < count; i++) {
            if (player.deck.length === 0) {
                this.log(`Player ${playerNum} has no cards left to draw!`, 'warning');
                // Deck-out loss condition
                const winner = playerNum === 1 ? 2 : 1;
                this.log(`Player ${playerNum} loses: deck is empty!`, 'error');
                this.endGame(winner);
                return;
            }
            const card = player.deck.shift();
            player.hand.push(card);

            // Alumnae Hall: Whenever a player draws a card, all their characters take 10 nonlethal damage
            if (this.stadium && this.stadium.name === 'Alumnae Hall') {
                const allChars = [player.active, ...player.bench].filter(c => c);
                allChars.forEach(char => {
                    const currentHP = char.hp - (char.damage || 0);
                    if (currentHP > 10) {
                        this.dealDamage(char, 10);
                        this.log(`Alumnae Hall: ${char.name} takes 10 nonlethal damage`, 'damage');
                    } else if (currentHP > 1) {
                        this.dealDamage(char, currentHP - 1);
                        this.log(`Alumnae Hall: ${char.name} takes ${currentHP - 1} nonlethal damage`, 'damage');
                    }
                });
            }

            // Yuelin Hu's Musical Cat Summoned - Draw AVGE Birb → discard and deal 40 to opponent active
            if (!abilitiesDisabledFor(playerNum) && card.name === 'AVGE Birb' && [player.active, ...player.bench].some(c => c && c.name === 'Yuelin Hu')) {
                this.log('Yuelin Hu\'s Musical Cat Summoned: Drew AVGE Birb!');
                const useAbility = confirm('Yuelin Hu: Discard AVGE Birb to deal 40 damage to opponent active?');
                if (useAbility) {
                    player.discard.push(card);
                    player.hand = player.hand.filter(c => c.id !== card.id);
                    const opponentNum = playerNum === 1 ? 2 : 1;
                    const opponent = this.players[opponentNum];
                    if (opponent.active) {
                        this.dealDamage(opponent.active, 40);
                        this.log('Yuelin Hu\'s Musical Cat Summoned: Dealt 40 damage to opponent active!', 'damage');
                    }
                }
            }

        }
        this.render();
    }

    shuffleDeck(playerNum) {
        const player = this.players[playerNum];
        for (let i = player.deck.length - 1; i > 0; i--) {
            const j = randInt(i + 1);
            [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
        }
    }

    log(message, type = 'info') {
        console.log(message);
        this.gameLog.push({ message, type, timestamp: Date.now() });
        // Keep only last 20 messages
        if (this.gameLog.length > 20) {
            this.gameLog.shift();
        }
        this.updateLogDisplay();
    }

    updateLogDisplay() {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;

        logContent.innerHTML = '';
        this.gameLog.forEach(entry => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${entry.type}`;
            logEntry.textContent = entry.message;
            logContent.appendChild(logEntry);
        });

        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;
    }

    render() {
        updateUI();
    }
}

// Global game state
let game = new GameState();

const multiplayer = {
    enabled: false,
    socket: null,
    roomId: null,
    seed: null,
    config: null,
    isApplyingRemote: false,
    playerNumber: null,
    sessionToken: null,
    clientSeq: 0,
    serverSeq: 0,
    pingInterval: null
};

function canCurrentClientAct() {
    if (!multiplayer.enabled) return true;
    if (!multiplayer.playerNumber) return false;
    if (multiplayer.playerNumber === game.currentPlayer) return true;
    const songVoting = game.tempSelections && game.tempSelections.songVoting;
    if (songVoting && songVoting.pendingForPlayer === multiplayer.playerNumber) {
        return true;
    }
    return false;
}

function connectMultiplayer({ roomId, deck1Name, deck2Name, playtestMode }) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}`);
    multiplayer.socket = socket;
    multiplayer.enabled = true;
    multiplayer.roomId = roomId;
    multiplayer.sessionToken = localStorage.getItem(`cardgame_session_${roomId}`) || null;
    if (multiplayer.pingInterval) {
        clearInterval(multiplayer.pingInterval);
    }

    socket.addEventListener('open', () => {
        if (multiplayer.sessionToken) {
            socket.send(JSON.stringify({
                type: 'RESUME',
                roomId,
                sessionToken: multiplayer.sessionToken
            }));
        } else {
            socket.send(JSON.stringify({
                type: 'JOIN',
                roomId,
                deck1Name,
                deck2Name,
                playtestMode
            }));
        }
    });

    multiplayer.pingInterval = setInterval(() => {
        if (multiplayer.socket && multiplayer.socket.readyState === WebSocket.OPEN) {
            multiplayer.socket.send(JSON.stringify({ type: 'PING', time: Date.now() }));
        }
    }, 15000);

    socket.addEventListener('message', (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (error) {
            return;
        }

        if (msg.type === 'ROOM_JOINED') {
            multiplayer.seed = msg.seed;
            multiplayer.config = msg.config;
            multiplayer.playerNumber = msg.playerNumber;
            if (msg.sessionToken) {
                multiplayer.sessionToken = msg.sessionToken;
                localStorage.setItem(`cardgame_session_${roomId}`, msg.sessionToken);
            }
            setupEventListeners();
            if (multiplayer.playerNumber === 1) {
                initGame(
                    msg.config.deck1Name,
                    msg.config.deck2Name,
                    msg.config.playtestMode,
                    msg.seed
                );
                sendMultiplayerAction('STATE_SNAPSHOT', []);
            }
            return;
        }

        if (msg.type === 'FULL_STATE') {
            multiplayer.serverSeq = msg.serverSeq || 0;
            applyStateSnapshot(msg.state);
            return;
        }

        if (msg.type === 'STATE_UPDATE') {
            multiplayer.serverSeq = msg.serverSeq || multiplayer.serverSeq;
            applyStateSnapshot(msg.state);
            return;
        }

        if (msg.type === 'ACTION_BROADCAST') {
            multiplayer.serverSeq = msg.serverSeq || multiplayer.serverSeq;
            const incoming = msg.action;
            if (incoming && incoming.type === 'CALL' && incoming.payload) {
                const { name, args } = incoming.payload;
                if (name && typeof window[name] === 'function') {
                    const wasApplying = multiplayer.isApplyingRemote;
                    multiplayer.isApplyingRemote = true;
                    try {
                        window[name](...(Array.isArray(args) ? args : []));
                    } finally {
                        multiplayer.isApplyingRemote = wasApplying;
                    }
                }
            }
            return;
        }

        if (msg.type === 'ACTION_REJECTED') {
            game.log(`Action rejected: ${msg.reason || 'Unknown reason'}`, 'warning');
            return;
        }
    });

    socket.addEventListener('close', () => {
        if (multiplayer.pingInterval) {
            clearInterval(multiplayer.pingInterval);
            multiplayer.pingInterval = null;
        }
    });
}

function sendMultiplayerAction(fn, args) {
    if (!multiplayer.enabled || !multiplayer.socket || multiplayer.isApplyingRemote) return;
    if (multiplayer.socket.readyState !== WebSocket.OPEN) return;
    const snapshot = getStateSnapshot();
    multiplayer.clientSeq += 1;
    multiplayer.socket.send(JSON.stringify({
        type: 'ACTION',
        roomId: multiplayer.roomId,
        clientSeq: multiplayer.clientSeq,
        action: {
            type: 'CALL',
            payload: {
                name: fn,
                args,
                state: snapshot
            },
            playerNumber: multiplayer.playerNumber
        }
    }));
}

function getStateSnapshot() {
    return JSON.parse(JSON.stringify(game));
}

function applyStateSnapshot(snapshot) {
    if (!snapshot) return;
    const wasApplying = multiplayer.isApplyingRemote;
    multiplayer.isApplyingRemote = true;
    const restored = new GameState();
    Object.assign(restored, snapshot);
    game = restored;
    setupEventListeners();
    updateUI();

    multiplayer.isApplyingRemote = wasApplying;

    const sv = game.tempSelections && game.tempSelections.songVoting;
    if (sv && multiplayer.enabled && multiplayer.playerNumber) {
        const needsSelection = sv.selections[multiplayer.playerNumber]?.length !== 2;
        if (needsSelection) {
            showSongVotingSelectionModal(multiplayer.playerNumber);
        }
    }
}

// Initialize game
function initGame(deck1Name = 'strings-aggro', deck2Name = 'piano-control', playtestMode = false, seed = null) {
    // Reset game state completely
    game = new GameState();
    game.playtestMode = !!playtestMode;
    const resolvedSeed = Number.isFinite(seed) ? seed : Date.now();
    game.randomSeed = resolvedSeed;
    game.randomState = resolvedSeed >>> 0;

    // Create sample decks for testing
    createSampleDecks(deck1Name, deck2Name);

    // Guarantee each player starts with at least one musician in hand
    ensureStartingMusician(1);
    ensureStartingMusician(2);

    // Draw starting hands (including the guaranteed musician)
    game.drawCards(1, 4); // Draw 4 more to make 5 total
    game.drawCards(2, 4);

    game.phase = 'main';
    updateUI();
    setupEventListeners();

    if (game.playtestMode) {
        game.log('Playtest mode enabled: you can add any card to hand and play outside normal phase limits.', 'info');
    }
}

function ensureStartingMusician(playerNum) {
    const player = game.players[playerNum];

    // Find first character card in deck
    const musicianIndex = player.deck.findIndex(card => card.cardType === 'character');

    if (musicianIndex !== -1) {
        // Move the musician to hand
        const musician = player.deck.splice(musicianIndex, 1)[0];
        player.hand.push(musician);
        game.log(`Player ${playerNum} starts with ${musician.name}`);
    } else {
        game.log(`Player ${playerNum} has no character cards in deck`, 'warning');
    }
}

// Deck configurations
const DECK_TEMPLATES = {
    'strings-aggro': {
        name: 'String Section',
        description: 'Emily, Sophia, Ashley, Fiona with Riley Hall. Fast string attacks.',
        build: () => [
            createCharacterCard(CHARACTERS.EMILY_WANG),
            createCharacterCard(CHARACTERS.SOPHIA_Y_WANG),
            createCharacterCard(CHARACTERS.ASHLEY_TOBY),
            createCharacterCard(CHARACTERS.FIONA_LI),
            createItemCard(ITEMS.OTAMATONE),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.PRINTED_SCORE),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.AVGE_BIRB),
            createToolCard(TOOLS.MAID_OUTFIT),
            createToolCard(TOOLS.KIKI_HEADBAND),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
            ...Array(3).fill(null).map(() => createStadiumCard(STADIUMS.RILEY_HALL))
        ]
    },
    'piano-control': {
        name: 'Piano Trio',
        description: 'Katie, David, Jennie, Henry with Steinert Basement. Piano control.',
        build: () => [
            createCharacterCard(CHARACTERS.KATIE_XIANG),
            createCharacterCard(CHARACTERS.DAVID_MAN),
            createCharacterCard(CHARACTERS.JENNIE_WANG),
            createCharacterCard(CHARACTERS.HENRY_WANG),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.PRINTED_SCORE),
            createItemCard(ITEMS.ANNOTATED_SCORE),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.CAMERA),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createToolCard(TOOLS.MUSESCORE_SUB),
            createToolCard(TOOLS.KIKI_HEADBAND),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
            ...Array(3).fill(null).map(() => createStadiumCard(STADIUMS.STEINERT_BASEMENT))
        ]
    },
    'percussion-midrange': {
        name: 'Rhythm Section',
        description: 'Bokai, Pascal, Cavin, Loang with Main Hall. Balanced percussion.',
        build: () => [
            createCharacterCard(CHARACTERS.BOKAI_BI),
            createCharacterCard(CHARACTERS.PASCAL_KIM),
            createCharacterCard(CHARACTERS.CAVIN_XUE),
            createCharacterCard(CHARACTERS.LOANG_CHIANG),
            createItemCard(ITEMS.OTAMATONE),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.BAI_EMAIL),
            createItemCard(ITEMS.MUSESCORE_FILE),
            createItemCard(ITEMS.RAFFLE_TICKET),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.PRINTED_SCORE),
            createToolCard(TOOLS.BUCKET),
            createToolCard(TOOLS.MAID_OUTFIT),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.MICHELLE)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.MAIN_HALL))
        ]
    },
    'choir-support': {
        name: 'A Cappella',
        description: 'Rachel, Ross, Evelyn, Izzy with Friedman Hall. Choir healing.',
        build: () => [
            createCharacterCard(CHARACTERS.RACHEL_CHEN),
            createCharacterCard(CHARACTERS.ROSS_WILLIAMS),
            createCharacterCard(CHARACTERS.EVELYN_WU),
            createCharacterCard(CHARACTERS.IZZY_CHEN),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.RAFFLE_TICKET),
            createItemCard(ITEMS.AVGE_BIRB),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.CAMERA),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createToolCard(TOOLS.MAID_OUTFIT),
            createToolCard(TOOLS.KIKI_HEADBAND),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.ANGEL)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.FRIEDMAN))
        ]
    },
    'brass-tempo': {
        name: 'Brass Band',
        description: 'Kei, Filip, Juan, Vincent with Lindemann. High-powered brass.',
        build: () => [
            createCharacterCard(CHARACTERS.KEI_WATANABE),
            createCharacterCard(CHARACTERS.FILIP_KAMINSKI),
            createCharacterCard(CHARACTERS.JUAN_BURGOS),
            createCharacterCard(CHARACTERS.VINCENT_CHEN),
            createItemCard(ITEMS.MIKU_OTAMATONE),
            createItemCard(ITEMS.OTAMATONE),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.BAI_EMAIL),
            createItemCard(ITEMS.PRINTED_SCORE),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.CORRUPTED_FILE),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createToolCard(TOOLS.AVGE_TSHIRT),
            createToolCard(TOOLS.KIKI_HEADBAND),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.WILL)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.LINDEMANN))
        ]
    },
    'guitar-rock': {
        name: 'Electric Ensemble',
        description: 'Grace, Roberto, Hanlei, Meya with Salomon DECI. RNG damage.',
        build: () => [
            createCharacterCard(CHARACTERS.GRACE_ZHAO),
            createCharacterCard(CHARACTERS.ROBERTO_GONZALES),
            createCharacterCard(CHARACTERS.HANLEI_GAO),
            createCharacterCard(CHARACTERS.MEYA_GAO),
            createItemCard(ITEMS.OTAMATONE),
            createItemCard(ITEMS.MIKU_OTAMATONE),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.AVGE_BIRB),
            createItemCard(ITEMS.ANNOTATED_SCORE),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createItemCard(ITEMS.PRINTED_SCORE),
            createItemCard(ITEMS.CAMERA),
            createToolCard(TOOLS.MAID_OUTFIT),
            createToolCard(TOOLS.KIKI_HEADBAND),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.SALOMON_DECI))
        ]
    },
    'toolbox': {
        name: 'Mixed Ensemble',
        description: 'Katie, Grace, Bokai, Ross with Alumnae. Versatile tools.',
        build: () => [
            createCharacterCard(CHARACTERS.KATIE_XIANG),
            createCharacterCard(CHARACTERS.GRACE_ZHAO),
            createCharacterCard(CHARACTERS.BOKAI_BI),
            createCharacterCard(CHARACTERS.ROSS_WILLIAMS),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.BAI_EMAIL),
            createItemCard(ITEMS.CAMERA),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.RAFFLE_TICKET),
            createItemCard(ITEMS.OTAMATONE),
            createToolCard(TOOLS.KIKI_HEADBAND),
            createToolCard(TOOLS.MAID_OUTFIT),
            createToolCard(TOOLS.AVGE_STICKER),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.EMMA)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.ALUMNAE_HALL))
        ]
    },
    'woodwinds-swarm': {
        name: 'Woodwind Orchestra',
        description: 'Felix, Jayden, Kana, Anna, Desmond with healing and utility.',
        build: () => [
            createCharacterCard(CHARACTERS.FELIX_CHEN),
            createCharacterCard(CHARACTERS.JAYDEN_BROWN),
            createCharacterCard(CHARACTERS.KANA_TAKIZAWA),
            createCharacterCard(CHARACTERS.ANNA_BROWN),
            createCharacterCard(CHARACTERS.DESMOND_ROPER),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.CAMERA),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createToolCard(TOOLS.MAID_OUTFIT),
            createToolCard(TOOLS.AVGE_STICKER),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.ALUMNAE_HALL)),
            createStadiumCard(STADIUMS.FRIEDMAN)
        ]
    },
    'brass-fortress': {
        name: 'Brass Fortress',
        description: 'Barron, Juan, Vincent, Carolyn. Defensive brass with energy limits.',
        build: () => [
            createCharacterCard(CHARACTERS.BARRON_LEE),
            createCharacterCard(CHARACTERS.JUAN_BURGOS),
            createCharacterCard(CHARACTERS.VINCENT_CHEN),
            createCharacterCard(CHARACTERS.CAROLYN_ZHENG),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.BAI_EMAIL),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.PRINTED_SCORE),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createToolCard(TOOLS.AVGE_STICKER),
            createToolCard(TOOLS.MAID_OUTFIT),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.MICHELLE)),
            ...Array(3).fill(null).map(() => createStadiumCard(STADIUMS.LINDEMANN))
        ]
    },
    'guitar-perc-rush': {
        name: 'Rock & Roll',
        description: 'Owen, Cavin, Ryan Lee, Kevin. Fast aggressive Guitar-Percussion.',
        build: () => [
            createCharacterCard(CHARACTERS.OWEN_LANDRY),
            createCharacterCard(CHARACTERS.CAVIN_XUE),
            createCharacterCard(CHARACTERS.RYAN_LEE),
            createCharacterCard(CHARACTERS.KEVIN_YANG),
            createItemCard(ITEMS.OTAMATONE),
            createItemCard(ITEMS.MIKU_OTAMATONE),
            createItemCard(ITEMS.PRINTED_SCORE),
            createItemCard(ITEMS.ANNOTATED_SCORE),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.AVGE_BIRB),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createToolCard(TOOLS.MAID_OUTFIT),
            createToolCard(TOOLS.BUCKET),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.ANGEL)),
            ...Array(3).fill(null).map(() => createStadiumCard(STADIUMS.RED_ROOM))
        ]
    },
    'piano-choir-control': {
        name: 'Symphony Control',
        description: 'Katie, Luke, Rachel, Ross. Piano-Choir control with abilities.',
        build: () => [
            createCharacterCard(CHARACTERS.KATIE_XIANG),
            createCharacterCard(CHARACTERS.LUKE_XU),
            createCharacterCard(CHARACTERS.RACHEL_CHEN),
            createCharacterCard(CHARACTERS.ROSS_WILLIAMS),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.CAMERA),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.REHEARSAL_ROSTER),
            createItemCard(ITEMS.AVGE_BIRB),
            createToolCard(TOOLS.BUCKET),
            createToolCard(TOOLS.MUSESCORE_SUB),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
            createStadiumCard(STADIUMS.FRIEDMAN),
            createStadiumCard(STADIUMS.STEINERT_PRACTICE),
            createStadiumCard(STADIUMS.MAIN_HALL)
        ]
    },
    'hybrid-strings': {
        name: 'Chamber Ensemble',
        description: 'Ina, Emily, Alice, Weston. Strings-Woodwinds utility.',
        build: () => [
            createCharacterCard(CHARACTERS.INA_MA),
            createCharacterCard(CHARACTERS.EMILY_WANG),
            createCharacterCard(CHARACTERS.ALICE_WANG),
            createCharacterCard(CHARACTERS.WESTON_POE),
            createItemCard(ITEMS.OTAMATONE),
            createItemCard(ITEMS.MIKU_OTAMATONE),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.AVGE_BIRB),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createToolCard(TOOLS.MAID_OUTFIT),
            createToolCard(TOOLS.KIKI_HEADBAND),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
            ...Array(3).fill(null).map(() => createStadiumCard(STADIUMS.RILEY_HALL))
        ]
    },
    'rainbow-ensemble': {
        name: 'Grand Orchestra',
        description: 'All 7 types. Barron, Ross, Owen, Cavin, Luke, Emily, Felix.',
        build: () => [
            createCharacterCard(CHARACTERS.BARRON_LEE),
            createCharacterCard(CHARACTERS.ROSS_WILLIAMS),
            createCharacterCard(CHARACTERS.OWEN_LANDRY),
            createCharacterCard(CHARACTERS.CAVIN_XUE),
            createCharacterCard(CHARACTERS.LUKE_XU),
            createCharacterCard(CHARACTERS.EMILY_WANG),
            createCharacterCard(CHARACTERS.FELIX_CHEN),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.BAI_EMAIL),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.OTAMATONE),
            createToolCard(TOOLS.BUCKET),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LUCAS)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.MAIN_HALL)),
            createStadiumCard(STADIUMS.ALUMNAE_HALL)
        ]
    },
    'boss-battle': {
        name: 'All-Stars',
        description: 'Vincent, Ross, Edward, Kei, Ryan Li. High HP tanky characters.',
        build: () => [
            createCharacterCard(CHARACTERS.VINCENT_CHEN),
            createCharacterCard(CHARACTERS.ROSS_WILLIAMS),
            createCharacterCard(CHARACTERS.EDWARD_WIBOWO),
            createCharacterCard(CHARACTERS.KEI_WATANABE),
            createCharacterCard(CHARACTERS.RYAN_LI),
            createItemCard(ITEMS.MATCHA_LATTE),
            createItemCard(ITEMS.STRAWBERRY_MATCHA),
            createItemCard(ITEMS.CONCERT_TICKET),
            createItemCard(ITEMS.CAMERA),
            createItemCard(ITEMS.CONCERT_ROSTER),
            createItemCard(ITEMS.CONCERT_PROGRAM),
            createItemCard(ITEMS.ICE_SKATES),
            createItemCard(ITEMS.AVGE_BIRB),
            createItemCard(ITEMS.RAFFLE_TICKET),
            createToolCard(TOOLS.AVGE_TSHIRT),
            createToolCard(TOOLS.MAID_OUTFIT),
            ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.RICHARD)),
            ...Array(2).fill(null).map(() => createStadiumCard(STADIUMS.LINDEMANN))
        ]
    }
};

function createSampleDecks(deck1Name, deck2Name) {
    // Create decks based on templates or custom decks
    game.players[1].deck = buildDeckFromName(deck1Name);
    game.players[2].deck = buildDeckFromName(deck2Name);

    game.shuffleDeck(1);
    game.shuffleDeck(2);
}

function buildDeckFromName(deckName) {
    // Check if it's a custom deck
    if (deckName.startsWith('custom:')) {
        const customDeckName = deckName.substring(7); // Remove 'custom:' prefix
        const customDecks = JSON.parse(localStorage.getItem('customDecks') || '{}');
        const customDeck = customDecks[customDeckName];

        if (!customDeck) {
            console.error('Custom deck not found:', customDeckName);
            return DECK_TEMPLATES['strings-aggro'].build(); // Fallback
        }

        console.log('Loading custom deck:', customDeckName, 'with', customDeck.length, 'cards');

        // Convert saved deck data to game cards
        const cards = customDeck.map(card => {
            // Support both old 'type' property and new 'cardCategory' property for backwards compatibility
            const category = card.cardCategory || card.type;

            console.log('Processing card:', card.name, 'Category:', category);

            switch(category) {
                case 'character':
                    // Look up the original character data to ensure we have the correct type property
                    const originalChar = Object.values(CHARACTERS).find(c => c.name === card.name);
                    if (!originalChar) {
                        console.error('Character not found:', card.name);
                        return null;
                    }
                    return createCharacterCard(originalChar);
                case 'energy':
                    // Energy cards no longer exist - skip
                    console.log('Skipping energy card (no longer used):', card.name);
                    return null;
                case 'item':
                    // Look up original item data
                    const originalItem = Object.values(ITEMS).find(i => i.name === card.name);
                    if (!originalItem) {
                        console.error('Item not found:', card.name);
                        return null;
                    }
                    return createItemCard(originalItem);
                case 'tool':
                    // Look up original tool data
                    const originalTool = Object.values(TOOLS).find(t => t.name === card.name);
                    if (!originalTool) {
                        console.error('Tool not found:', card.name);
                        return null;
                    }
                    return createToolCard(originalTool);
                case 'supporter':
                    // Look up original supporter data
                    const originalSupporter = Object.values(SUPPORTERS).find(s => s.name === card.name);
                    if (!originalSupporter) {
                        console.error('Supporter not found:', card.name);
                        return null;
                    }
                    return createSupporterCard(originalSupporter);
                case 'stadium':
                    // Look up original stadium data
                    const originalStadium = Object.values(STADIUMS).find(s => s.name === card.name);
                    if (!originalStadium) {
                        console.error('Stadium not found:', card.name);
                        return null;
                    }
                    return createStadiumCard(originalStadium);
                default:
                    console.error('Unknown card category:', category, 'for card:', card.name, 'Full card:', card);
                    return null;
            }
        }).filter(c => c !== null);

        console.log('Built deck with', cards.length, 'cards');
        return cards;
    } else {
        // Use template deck
        const template = DECK_TEMPLATES[deckName];
        if (!template) {
            console.error('Invalid deck name:', deckName);
            return DECK_TEMPLATES['strings-aggro'].build(); // Fallback
        }
        return template.build();
    }
}

function createCharacterCard(characterData) {
    return {
        ...characterData,
        cardType: 'character',
        damage: 0,
        attachedEnergy: [],
        attachedTools: [],
        status: [],
        id: generateCardId()
    };
}

// Energy cards removed - energy is now attached for free each turn

function createItemCard(itemData) {
    return {
        ...itemData,
        cardType: 'item',
        id: generateCardId()
    };
}

function createToolCard(toolData) {
    return {
        ...toolData,
        cardType: 'tool',
        id: generateCardId()
    };
}

function createSupporterCard(supporterData) {
    return {
        ...supporterData,
        cardType: 'supporter',
        id: generateCardId()
    };
}

function createStadiumCard(stadiumData) {
    return {
        ...stadiumData,
        cardType: 'stadium',
        id: generateCardId()
    };
}

let cardIdCounter = 0;
function generateCardId() {
    return `card_${cardIdCounter++}`;
}

// UI Rendering
function updateUI() {
    game.applyPassiveStatuses();

    // Update deck and discard counts
    document.getElementById('p1-deck-count').textContent = game.players[1].deck.length;
    document.getElementById('p1-hand-count').textContent = game.players[1].hand.length;
    document.getElementById('p1-discard-count').textContent = game.players[1].discard.length;
    document.getElementById('p1-ko-count').textContent = game.players[1].koCount;

    document.getElementById('p2-deck-count').textContent = game.players[2].deck.length;
    document.getElementById('p2-hand-count').textContent = game.players[2].hand.length;
    document.getElementById('p2-discard-count').textContent = game.players[2].discard.length;
    document.getElementById('p2-ko-count').textContent = game.players[2].koCount;

    // Update pile displays
    document.getElementById('p1-deck-pile').textContent = game.players[1].deck.length;
    document.getElementById('p1-discard-pile').textContent = game.players[1].discard.length;
    document.getElementById('p2-deck-pile').textContent = game.players[2].deck.length;
    document.getElementById('p2-discard-pile').textContent = game.players[2].discard.length;

    // Update turn info
    document.getElementById('current-turn').textContent = `Player ${game.currentPlayer}'s Turn`;
    const phaseInfo = document.getElementById('phase-info');
    if (phaseInfo) {
        phaseInfo.textContent = game.phase === 'gameover' ? 'Game Over' : '';
        phaseInfo.style.display = 'none';
    }

    // Show energy attached count (normal is 1, Eugenia allows 3)
    const player = game.players[game.currentPlayer];
    const maxEnergy = (player.active && player.active.name === 'Eugenia Ampofo' && !abilitiesDisabledFor(game.currentPlayer)) ? 2 : 1;
    document.getElementById('energy-status').textContent = `${game.energyAttachedThisTurn}/${maxEnergy}`;

    document.getElementById('supporter-status').textContent = game.supporterPlayedThisTurn ? 'Yes' : 'No';
    const attackedStatus = document.getElementById('attacked-status');
    if (attackedStatus) {
        attackedStatus.textContent = game.attackedThisTurn ? 'Yes' : 'No';
    }

    const attackedRow = document.getElementById('attacked-played');
    if (attackedRow) {
        attackedRow.style.display = 'none';
    }

    // Update button visibility based on phase
    const beginAttackBtn = document.getElementById('begin-attack-btn');
    const endTurnBtn = document.getElementById('end-turn-btn');

    if (beginAttackBtn) {
        beginAttackBtn.style.display = 'none';
    }
    if (endTurnBtn) {
        endTurnBtn.style.display = 'inline-block';
    }

    // Render active and bench for both players
    renderCharacterSlot(game.players[1].active, document.querySelector('.active-slot[data-player="1"]'));
    renderCharacterSlot(game.players[2].active, document.querySelector('.active-slot[data-player="2"]'));

    for (let i = 0; i < 3; i++) {
        renderCharacterSlot(game.players[1].bench[i], document.querySelector(`.bench-slot[data-player="1"][data-slot="${i}"]`));
        renderCharacterSlot(game.players[2].bench[i], document.querySelector(`.bench-slot[data-player="2"][data-slot="${i}"]`));
    }

    // Render stadium
    const stadiumSlot = document.getElementById('stadium-card');
    if (game.stadium) {
        stadiumSlot.innerHTML = renderCard(game.stadium);
        stadiumSlot.classList.add('occupied');
        // Add click handler to stadium
        const cardDiv = stadiumSlot.querySelector('.card');
        if (cardDiv) {
            cardDiv.onclick = () => selectCard(game.stadium);
        }
    } else {
        stadiumSlot.innerHTML = '<div class="empty-slot-text">No Stadium</div>';
        stadiumSlot.classList.remove('occupied');
    }

    // Render current player's hand
    renderHand();

    updatePlaytestUI();
}

function renderCharacterSlot(characterCard, slotElement) {
    if (characterCard) {
        slotElement.innerHTML = renderCard(characterCard);
        slotElement.classList.add('occupied');
        
        const cardDiv = slotElement.querySelector('.card');
        if (cardDiv) {
            cardDiv.onclick = () => selectCard(characterCard);
        }

        const slotPlayer = slotElement.getAttribute('data-player');
        if (game.playtestMode && slotPlayer && parseInt(slotPlayer) === game.currentPlayer) {
            const removeButton = document.createElement('button');
            removeButton.className = 'playtest-remove-card';
            removeButton.type = 'button';
            removeButton.innerHTML = '&times;';
            removeButton.onclick = (event) => {
                event.stopPropagation();
                removeInPlayCard(characterCard.id);
            };
            slotElement.appendChild(removeButton);
        }
    } else {
        slotElement.innerHTML = '<div class="empty-slot-text">Empty</div>';
        slotElement.classList.remove('occupied');
    }
}

function renderHand() {
    const handElement = document.getElementById('hand-cards');
    const handOwner = (multiplayer.enabled && multiplayer.playerNumber)
        ? multiplayer.playerNumber
        : game.currentPlayer;
    const currentPlayer = game.players[handOwner];

    handElement.innerHTML = '';
    currentPlayer.hand.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.innerHTML = renderCard(card);
        cardElement.classList.add('hand-card-wrapper');
        cardElement.onclick = () => selectCard(card);

        if (game.playtestMode) {
            const removeButton = document.createElement('button');
            removeButton.className = 'playtest-remove-card';
            removeButton.type = 'button';
            removeButton.innerHTML = '&times;';
            removeButton.onclick = (event) => {
                event.stopPropagation();
                removeHandCard(card.id);
            };
            cardElement.appendChild(removeButton);
        }

        handElement.appendChild(cardElement);
    });
}

function removeHandCard(cardId) {
    if (!game.playtestMode) return;
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);
    if (!card) return;

    player.hand = player.hand.filter(c => c.id !== cardId);
    game.log(`Playtest: Removed ${card.name} from hand`, 'info');
    updateUI();
}

function removeInPlayCard(cardId) {
    if (!game.playtestMode) return;
    const player = game.players[game.currentPlayer];
    let removedCard = null;

    if (player.active && player.active.id === cardId) {
        removedCard = player.active;
        player.active = null;
    } else {
        const benchIndex = player.bench.findIndex(c => c && c.id === cardId);
        if (benchIndex !== -1) {
            removedCard = player.bench[benchIndex];
            player.bench[benchIndex] = null;
        }
    }

    if (!removedCard) return;

    player.discard.push(removedCard);
    game.log(`Playtest: Removed ${removedCard.name} from play`, 'info');
    updateUI();
}

function updatePlaytestUI() {
    const controls = document.getElementById('playtest-controls');
    if (!controls) return;
    if (game.playtestMode) {
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
    }
}

function renderCard(card) {
    if (!card) return '';

    let html = `<div class="card ${card.cardType}" data-card-id="${card.id}">`;

    if (card.cardType === 'character') {
        html += `
            <div class="card-header">
                <span class="card-name">${card.name}</span>
                <span class="card-hp">HP: ${card.hp}</span>
            </div>
            <div class="card-type">
                ${card.type.map(t => `<span class="type-icon type-${t.toLowerCase().replace(' ', '-')}">${getCostSymbol(t)}</span>`).join('')}
            </div>
        `;

        if (card.damage > 0) {
            html += `<div class="card-damage-counter">${card.damage}</div>`;
        }

        if (card.status && card.status.length > 0) {
            html += `<div class="card-status">${card.status.join(', ')}</div>`;
        }

        if (card.attachedEnergy && card.attachedEnergy.length > 0) {
            html += `<div class="card-energy-attached" style="display: flex; gap: 2px; flex-wrap: wrap; margin-top: 3px;">`;
            card.attachedEnergy.forEach(energy => {
                if (energy.generic) {
                    // Generic energy - show with a lightning bolt symbol
                    html += `<span class="energy-icon generic-energy" style="background: linear-gradient(135deg, #FFD700, #FFA500); color: white; padding: 2px 4px; border-radius: 3px; font-size: 10px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">⚡</span>`;
                } else {
                    // Typed energy (old system, might still exist)
                    const typeInitial = getCostSymbol(energy.energyType);
                    html += `<span class="energy-icon type-${energy.energyType.toLowerCase().replace(' ', '-')}">${typeInitial}</span>`;
                }
            });
            html += `</div>`;
        }

        // Show attached tools
        if (card.attachedTools && card.attachedTools.length > 0) {
            html += `<div class="card-tools-attached" style="margin-top: 3px; font-size: 8px; padding: 2px; background: rgba(255,215,0,0.2); border-radius: 3px;">`;
            html += `<div style="font-weight: bold; margin-bottom: 1px;">Tools:</div>`;
            card.attachedTools.forEach(tool => {
                html += `<div style="margin: 1px 0;">🔧 ${tool.name}</div>`;
            });
            html += `</div>`;
        }

        if (card.moves && card.moves.length > 0) {
            html += `<div class="card-moves">`;
            card.moves.forEach(move => {
                const costStr = move.cost ? (Array.isArray(move.cost) ? move.cost.join('') : move.cost.toString()) : '';
                html += `<div class="move"><span class="move-cost">${costStr}</span> ${move.name}</div>`;
            });
            html += `</div>`;
        }
    } else if (card.cardType === 'energy') {
        html += `
            <div class="card-header">
                <span class="card-name">${card.name}</span>
            </div>
            <div class="card-type">
                <span class="type-icon type-${card.energyType.toLowerCase().replace(' ', '-')}">${getCostSymbol(card.energyType)}</span>
            </div>
        `;
    } else if (card.cardType === 'item' || card.cardType === 'tool') {
        html += `
            <div class="card-header">
                <span class="card-name">${card.name}</span>
            </div>
            <div class="card-effect" style="font-size: 9px; margin-top: 5px;">${card.effect || ''}</div>
        `;
    } else if (card.cardType === 'supporter') {
        html += `
            <div class="card-header">
                <span class="card-name">${card.name}</span>
            </div>
            <div class="card-effect" style="font-size: 9px; margin-top: 5px;">${card.effect || ''}</div>
        `;
    } else if (card.cardType === 'stadium') {
        html += `
            <div class="card-header">
                <span class="card-name">${card.name}</span>
            </div>
            <div class="card-effect" style="font-size: 9px; margin-top: 5px;">${card.description || ''}</div>
        `;
    }

    html += '</div>';
    return html;
}

// Event Handlers
function selectCard(card) {
    if (!canCurrentClientAct()) {
        game.log('Not your turn.', 'warning');
        return;
    }
    if (game.selectedCard === card) {
        game.selectedCard = null;
    } else {
        game.selectedCard = card;
    }

    // Show available actions based on card type
    showCardActions(card);
}

function showCardActions(card) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const player = game.players[game.currentPlayer];
    const canPlayAnytime = game.playtestMode || game.phase === 'main';

    let html = `<h2>${card.name}</h2>`;

    // Show character details
    if (card.cardType === 'character') {
        html += `<div style="margin-bottom: 10px;">`;
        html += `<p><strong>HP:</strong> ${card.hp}</p>`;
        html += `<p><strong>Type:</strong> ${card.type.join(', ')}</p>`;
        html += `<p><strong>Retreat Cost:</strong> ${card.retreatCost || 0}</p>`;

        // Show abilities
        if (card.ability) {
            html += `<div style="margin-top: 8px; padding: 8px; background: #f0f0ff; border-radius: 5px;">`;
            html += `<p><strong>Ability: ${card.ability.name}</strong></p>`;
            html += `<p style="font-size: 12px;">${card.ability.description}</p>`;
            html += `</div>`;
        }
        if (card.ability2) {
            html += `<div style="margin-top: 8px; padding: 8px; background: #f0f0ff; border-radius: 5px;">`;
            html += `<p><strong>Ability: ${card.ability2.name}</strong></p>`;
            html += `<p style="font-size: 12px;">${card.ability2.description}</p>`;
            html += `</div>`;
        }

        // Show attached tools
        if (card.attachedTools && card.attachedTools.length > 0) {
            html += `<div style="margin-top: 8px; padding: 8px; background: rgba(255,215,0,0.15); border-radius: 5px; border: 2px solid #FFD700;">`;
            html += `<p><strong>🔧 Attached Tools:</strong></p>`;
            card.attachedTools.forEach(tool => {
                html += `<div style="margin: 5px 0; padding: 5px; background: white; border-radius: 3px;">`;
                html += `<p><strong>${tool.name}</strong></p>`;
                html += `<p style="font-size: 11px; color: #666;">${tool.effect}</p>`;
                html += `</div>`;
            });
            html += `</div>`;
        }

        // Show attached energy
        if (card.attachedEnergy && card.attachedEnergy.length > 0) {
            html += `<div style="margin-top: 8px;">`;
            html += `<p><strong>⚡ Attached Energy:</strong> ${card.attachedEnergy.length}</p>`;
            html += `</div>`;
        }

        // Show moves/attacks
        if (card.moves && card.moves.length > 0) {
            html += `<div style="margin-top: 8px;"><strong>Moves:</strong></div>`;
            card.moves.forEach(move => {
                html += `<div style="margin: 5px 0; padding: 5px; background: #fff3e0; border-radius: 3px;">`;
                html += `<p><strong>${move.name}</strong> [${move.cost || 0} energy] - ${move.damage || 0} damage</p>`;
                if (move.effect) {
                    html += `<p style="font-size: 11px; color: #666;">${move.effect}</p>`;
                }
                html += `</div>`;
            });
        }
        html += `</div>`;
    } else {
        // For non-character cards, show effect/description
        html += `<p>${card.effect || card.description || ''}</p>`;
    }

    html += `<div class="action-buttons">`;

    if (card.cardType === 'character') {
        // Check if can play to bench or active (only during main phase)
        if (canPlayAnytime) {
            if (!player.active) {
                html += `<button class="action-btn" onclick="playCharacterToActive('${card.id}')">Play to Active</button>`;
            } else {
                const emptyBenchSlot = player.bench.indexOf(null);
                if (emptyBenchSlot !== -1) {
                    html += `<button class="action-btn" onclick="playCharacterToBench('${card.id}', ${emptyBenchSlot})">Play to Bench</button>`;
                }
            }
        } else {
            html += `<p style="color: red;">Can only play characters during Main Phase</p>`;
        }

        // Hand-activated abilities (Category Theory)
        if (player.hand.includes(card) && card.ability && card.ability.name === 'Category Theory') {
            const canUseCategoryTheory = canPlayAnytime && !abilitiesDisabledFor(game.currentPlayer) && player.hand.length === 1 && player.hand[0].id === card.id;
            const categoryDisabled = canUseCategoryTheory ? '' : 'disabled';
            html += `<button class="action-btn" ${categoryDisabled} onclick="useCategoryTheoryFromHand('${card.id}')">Use Category Theory</button>`;
        }

        // If character is in play, show other actions
        if (player.active === card) {
            const cannotAttackFirstTurn = game.isFirstTurn && game.currentPlayer === 1;
            const cannotAttackEffect = game.nextTurnEffects[game.currentPlayer].cannotAttack;
            const attackDisabled = (game.attackedThisTurn || cannotAttackFirstTurn || cannotAttackEffect) ? 'disabled' : '';
            const attackLabel = game.attackedThisTurn
                ? ' (Already Used)'
                : (cannotAttackFirstTurn ? ' (P1 First Turn)' : (cannotAttackEffect ? ' (Cannot Attack)' : ''));
            html += `<button class="action-btn" ${attackDisabled} onclick="showAttackMenu('${card.id}')">Attack${attackLabel}</button>`;
            html += `<button class="action-btn" onclick="showRetreatMenu('${card.id}')">Retreat</button>`;

            // Show attach energy button (only during main phase)
            if (game.phase === 'main') {
                const maxEnergy = (player.active && player.active.name === 'Eugenia Ampofo' && !abilitiesDisabledFor(game.currentPlayer)) ? 2 : 1;
                const energyDisabled = (game.energyAttachedThisTurn >= maxEnergy) ? 'disabled' : '';
                const energyLabel = (game.energyAttachedThisTurn >= maxEnergy) ? ' (Max Reached)' : ` (${game.energyAttachedThisTurn}/${maxEnergy})`;
                html += `<button class="action-btn" ${energyDisabled} onclick="attachEnergy('active')">⚡ Attach Energy${energyLabel}</button>`;
            }

            // Show activated abilities for active character
            if (card.ability && card.ability.type === 'activated') {
                if (abilitiesDisabledFor(game.currentPlayer)) {
                    html += `<p style="color: red;">Abilities disabled this turn</p>`;
                } else {
                    html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability')">Use ${card.ability.name}</button>`;
                }
            }
            if (card.ability2 && card.ability2.type === 'activated') {
                if (abilitiesDisabledFor(game.currentPlayer)) {
                    html += `<p style="color: red;">Abilities disabled this turn</p>`;
                } else {
                    html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability2')">Use ${card.ability2.name}</button>`;
                }
            }
        }
        if (player.bench.includes(card)) {
            const benchIndex = player.bench.indexOf(card);
            html += `<button class="action-btn" onclick="switchToActive('${card.id}')">Switch to Active</button>`;

            // Show attach energy button for bench (only during main phase)
            if (game.phase === 'main') {
                const maxEnergy = (player.active && player.active.name === 'Eugenia Ampofo' && !abilitiesDisabledFor(game.currentPlayer)) ? 2 : 1;
                const energyDisabled = (game.energyAttachedThisTurn >= maxEnergy) ? 'disabled' : '';
                const energyLabel = (game.energyAttachedThisTurn >= maxEnergy) ? ' (Max Reached)' : ` (${game.energyAttachedThisTurn}/${maxEnergy})`;
                html += `<button class="action-btn" ${energyDisabled} onclick="attachEnergy(${benchIndex})">⚡ Attach Energy${energyLabel}</button>`;
            }

            // Show bench-activated abilities
            if (card.ability && card.ability.type === 'activated') {
                if (abilitiesDisabledFor(game.currentPlayer)) {
                    html += `<p style="color: red;">Abilities disabled this turn</p>`;
                } else {
                    html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability')">Use ${card.ability.name}</button>`;
                }
            }
            if (card.ability2 && card.ability2.type === 'activated') {
                if (abilitiesDisabledFor(game.currentPlayer)) {
                    html += `<p style="color: red;">Abilities disabled this turn</p>`;
                } else {
                    html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability2')">Use ${card.ability2.name}</button>`;
                }
            }
        }
    } else if (card.cardType === 'energy') {
        // Energy cards no longer exist - energy is attached for free via button
        html += `<p style="color: gray;">Energy cards are no longer used.</p>`;
    } else if (card.cardType === 'item' || card.cardType === 'tool') {
        if (canPlayAnytime) {
            html += `<button class="action-btn" onclick="playItem('${card.id}')">Play Item</button>`;
        } else {
            html += `<p style="color: red;">Can only play items during Main Phase</p>`;
        }
    } else if (card.cardType === 'supporter') {
        if (canPlayAnytime) {
            if (!game.supporterPlayedThisTurn || game.playtestMode) {
                html += `<button class="action-btn" onclick="playSupporter('${card.id}')">Play Supporter</button>`;
            } else {
                html += `<p style="color: red;">Already played a Supporter this turn</p>`;
            }
        } else {
            html += `<p style="color: red;">Can only play supporters during Main Phase</p>`;
        }
    } else if (card.cardType === 'stadium') {
        if (game.nextTurnEffects[game.currentPlayer].cannotPlayStadium) {
            html += `<p style="color: red;">Cannot play stadiums this turn (BAI Email)</p>`;
        } else if (canPlayAnytime) {
            html += `<button class="action-btn" onclick="playStadium('${card.id}')">Play Stadium</button>`;
        } else {
            html += `<p style="color: red;">Can only play stadiums during Main Phase</p>`;
        }
    }

    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

const PLAYTEST_CARD_SOURCES = {
    character: CHARACTERS,
    item: ITEMS,
    tool: TOOLS,
    supporter: SUPPORTERS,
    stadium: STADIUMS
};

let playtestCurrentType = 'character';
let playtestSearchTerm = '';

function openPlaytestCardLibrary() {
    if (!game.playtestMode) return;
    playtestCurrentType = 'character';
    playtestSearchTerm = '';
    renderPlaytestCardLibrary();
    const modal = document.getElementById('playtest-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function setPlaytestCardType(type) {
    playtestCurrentType = type;
    renderPlaytestCardLibrary();
}

function updatePlaytestCardSearch(value) {
    playtestSearchTerm = value || '';
    filterPlaytestLibrary();
}

function renderPlaytestCardLibrary() {
    const content = document.getElementById('playtest-content');
    if (!content) return;

    const types = ['character', 'item', 'tool', 'supporter', 'stadium'];
    const source = PLAYTEST_CARD_SOURCES[playtestCurrentType] || {};
    const entries = Object.entries(source).filter(([key, card]) => {
        return true;
    });

    let html = `<h2>Playtest Card Library</h2>`;
    html += `<div class="deck-builder-cards">`;
    html += `<div class="card-type-tabs">`;
    types.forEach(type => {
        const active = type === playtestCurrentType ? 'active' : '';
        html += `<button class="tab-btn ${active}" onclick="setPlaytestCardType('${type}')">${type.toUpperCase()}</button>`;
    });
    html += `</div>`;
    html += `<div class="card-search-container">`;
    html += `<input id="playtest-card-search" type="text" placeholder="Search cards..." value="${playtestSearchTerm.replace(/"/g, '&quot;')}" oninput="updatePlaytestCardSearch(this.value)">`;
    html += `</div>`;
    html += `<div class="card-pool">`;

    if (entries.length === 0) {
        html += `<div style="padding: 10px; color: #666;">No cards match your search.</div>`;
    } else {
        entries.forEach(([key, card]) => {
            const searchable = `${card.name} ${card.effect || ''} ${card.description || ''}`.toLowerCase().replace(/"/g, '&quot;');
            html += `<div class="pool-card ${playtestCurrentType}" data-search="${searchable}">`;
            html += `<div class="pool-card-header">`;
            html += `<div class="pool-card-name">${card.name}</div>`;
            html += `<div class="pool-card-type">${playtestCurrentType.toUpperCase()}</div>`;
            html += `</div>`;

            if (card.effect || card.description) {
                html += `<div class="pool-card-effect">${card.effect || card.description || ''}</div>`;
            }

            if (playtestCurrentType === 'character' && card.hp) {
                html += `<div class="pool-card-effect">HP: ${card.hp}</div>`;
            }

            html += `<button class="pool-card-add" onclick="addPlaytestCard('${playtestCurrentType}', '${key}')">+ Add to Hand</button>`;
            html += `</div>`;
        });
    }

    html += `</div>`;
    html += `</div>`;

    content.innerHTML = html;
    filterPlaytestLibrary();

    focusPlaytestSearch();
}

function focusPlaytestSearch() {
    const searchInput = document.getElementById('playtest-card-search');
    if (!searchInput) return;
    setTimeout(() => {
        searchInput.focus();
        const length = searchInput.value.length;
        searchInput.selectionStart = length;
        searchInput.selectionEnd = length;
    }, 0);
}

function filterPlaytestLibrary() {
    const content = document.getElementById('playtest-content');
    if (!content) return;
    const lowerSearch = (playtestSearchTerm || '').toLowerCase();
    const cards = content.querySelectorAll('.pool-card');

    if (!lowerSearch) {
        cards.forEach(card => {
            card.style.display = '';
        });
        return;
    }

    cards.forEach(card => {
        const haystack = card.getAttribute('data-search') || '';
        card.style.display = haystack.includes(lowerSearch) ? '' : 'none';
    });
}

function addPlaytestCard(type, key) {
    if (!game.playtestMode) return;
    const source = PLAYTEST_CARD_SOURCES[type];
    if (!source || !source[key]) return;

    const cardData = source[key];
    let newCard = null;

    switch (type) {
        case 'character':
            newCard = createCharacterCard(cardData);
            break;
        case 'item':
            newCard = createItemCard(cardData);
            break;
        case 'tool':
            newCard = createToolCard(cardData);
            break;
        case 'supporter':
            newCard = createSupporterCard(cardData);
            break;
        case 'stadium':
            newCard = createStadiumCard(cardData);
            break;
        default:
            return;
    }

    const player = game.players[game.currentPlayer];
    player.hand.push(newCard);
    game.log(`Playtest: Added ${newCard.name} to hand`, 'info');

    updateUI();
    renderPlaytestCardLibrary();
}

function playCharacterToActive(cardId) {
    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const card = player.hand.find(c => c.id === cardId);

    if (!canPlayCardThisTurn()) {
        game.log('Main Hall: Cannot play more than 3 cards per turn', 'info');
        return;
    }

    if (card && !player.active) {
        game.cardsPlayedThisTurn++;
        logMainHallRemaining();
        player.active = card;
        player.hand = player.hand.filter(c => c.id !== cardId);
        game.log(`${card.name} played to Active`);
        game.applyPassiveStatuses();

        // Bokai Bi's Algorithm - If opponent has this character, deal 60 damage
        const hasBokaiInPlay = [opponent.active, ...opponent.bench].some(c => c && (c.name === 'Bokai Bi' || c.name === 'Bokai'));
        const oppHasThisChar = [opponent.active, ...opponent.bench].some(c => c && c.name === card.name);
        if (!abilitiesDisabledFor(opponentNum) && hasBokaiInPlay && oppHasThisChar) {
            game.dealDamage(card, 60);
            game.log(`Bokai Bi's Algorithm: ${card.name} takes 60 damage for being a duplicate!`, 'damage');
        }

        // Barron Lee's Get Served - enforce energy cap on opponent
        if (!abilitiesDisabledFor(game.currentPlayer) && card.name === 'Barron Lee') {
            enforceBarronGetServed(opponentNum);
        }

        closeModal('action-modal');
        updateUI();
    }
}

function playCharacterToBench(cardId, slotIndex) {
    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const card = player.hand.find(c => c.id === cardId);

    if (!canAddToBench(player)) {
        game.log('Steinert Practice Room: Bench limit is 2', 'info');
        return;
    }

    if (!canPlayCardThisTurn()) {
        game.log('Main Hall: Cannot play more than 3 cards per turn', 'info');
        return;
    }

    if (card && player.bench[slotIndex] === null) {
        game.cardsPlayedThisTurn++;
        logMainHallRemaining();
        player.bench[slotIndex] = card;
        player.hand = player.hand.filter(c => c.id !== cardId);
        game.log(`${card.name} played to Bench`);

        // Mark character as just benched (for Luke Xu's Nullify and other abilities)
        card.wasJustBenched = true;

        // Bokai Bi's Algorithm - If opponent has this character, deal 60 damage
        const hasBokaiInPlay = [opponent.active, ...opponent.bench].some(c => c && (c.name === 'Bokai Bi' || c.name === 'Bokai'));
        const oppHasThisChar = [opponent.active, ...opponent.bench].some(c => c && c.name === card.name);
        if (!abilitiesDisabledFor(opponentNum) && hasBokaiInPlay && oppHasThisChar) {
            game.dealDamage(card, 60);
            game.log(`Bokai Bi's Algorithm: ${card.name} takes 60 damage for being a duplicate!`, 'damage');
        }

        // Barron Lee's Get Served - enforce energy cap on opponent
        if (!abilitiesDisabledFor(game.currentPlayer) && card.name === 'Barron Lee') {
            enforceBarronGetServed(opponentNum);
        }

        // Ben Jose Cherek III's Loudmouth - Free switch when first played
        if (!abilitiesDisabledFor(game.currentPlayer) && (card.name === 'Ben Jose Cherek III' || card.name === 'Ben Cherek') && player.active) {
            const shouldSwitch = confirm(`Loudmouth: Switch ${card.name} with your active character ${player.active.name} for free?`);
            if (shouldSwitch) {
                const benchIndex = player.bench.indexOf(card);
                const temp = player.active;
                player.active = card;
                card.cameOffBenchThisTurn = true;
                player.bench[benchIndex] = temp;
                game.log(`Loudmouth: ${card.name} switched with ${temp.name} for free!`);
                game.applyPassiveStatuses();
            }
        }

        if (game.stadium && game.stadium.name === 'Steinert Practice Room') {
            queueSteinertPracticeDiscards([game.currentPlayer]);
        }

        closeModal('action-modal');
        updateUI();
    }
}

function canPlayCardThisTurn() {
    if (!game.stadium || game.stadium.name !== 'Main Hall') return true;
    if (game.mainHallActivatedTurn === null) return true;
    if (game.turn <= game.mainHallActivatedTurn) return true;
    return game.cardsPlayedThisTurn < 3;
}

function canAddToBench(player) {
    if (!game.stadium || game.stadium.name !== 'Steinert Practice Room') return true;
    const benchCount = player.bench.filter(c => c).length;
    return benchCount < 2;
}

function logMainHallRemaining() {
    if (!game.stadium || game.stadium.name !== 'Main Hall') return;
    if (game.mainHallActivatedTurn === null) return;
    if (game.turn <= game.mainHallActivatedTurn) return;
    const remaining = Math.max(0, 3 - game.cardsPlayedThisTurn);
    game.log(`Main Hall: ${remaining} card play${remaining === 1 ? '' : 's'} remaining this turn`, 'info');
}

// New energy system: attach generic energy counters for free
function attachEnergy(target) {
    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    let targetChar;
    if (target === 'active') {
        targetChar = player.active;
    } else if (typeof target === 'number') {
        targetChar = player.bench[target];
    }

    if (!targetChar) {
        alert('Invalid target for energy attachment!');
        return;
    }

    // Check if we've already attached max energy this turn
    const fermentationActive = player.active && player.active.name === 'Eugenia Ampofo' && !abilitiesDisabledFor(game.currentPlayer);
    if (fermentationActive) {
        if (targetChar === player.active) {
            if (game.energyAttachedThisTurn >= 1) {
                alert('Fermentation: You may only attach 1 energy to your active this turn.');
                return;
            }
        } else {
            if (game.energyAttachedToActiveThisTurn) {
                alert('Fermentation: You already attached energy to your active this turn.');
                return;
            }
            if (game.energyAttachedBenchTargetId && game.energyAttachedBenchTargetId !== targetChar.id) {
                alert('Fermentation: You may only attach to one benched character this turn.');
                return;
            }
            if (game.energyAttachedThisTurn >= 2) {
                alert('Fermentation: You may only attach 2 energy to one benched character this turn.');
                return;
            }
        }
    } else {
        if (!game.playtestMode && game.energyAttachedThisTurn >= 1) {
            alert(`You've already attached ${game.energyAttachedThisTurn} energy this turn!`);
            return;
        }
    }

    // Check for Barron Lee's Get Served - Opponent cannot exceed 3 energy
    const barronOnOppSide = !abilitiesDisabledFor(opponentNum) && [opponent.active, ...opponent.bench].some(c => c && c.name === 'Barron Lee');
    if (barronOnOppSide && targetChar.attachedEnergy.length >= 3) {
        game.log('Barron Lee\'s Get Served: Opponent cannot have more than 3 energy on a character!', 'warning');
        alert('Barron Lee\'s Get Served prevents attaching more than 3 energy to a character.');
        return;
    }

    // Add generic energy counter (just a simple object)
    targetChar.attachedEnergy.push({ generic: true });
    game.energyAttachedThisTurn++;
    if (fermentationActive) {
        if (targetChar === player.active) {
            game.energyAttachedToActiveThisTurn = true;
        } else {
            game.energyAttachedBenchTargetId = targetChar.id;
        }
    }
    game.log(`Attached energy to ${targetChar.name} (${targetChar.attachedEnergy.length} total)`);

    if (barronOnOppSide) {
        enforceBarronGetServed(game.currentPlayer);
    }

    // Sophia S. Wang's Original is Better - first energy attach each turn → opponent discards
    if (!abilitiesDisabledFor(game.currentPlayer) && game.energyAttachedThisTurn === 1 && targetChar.name === 'Sophia S. Wang' && opponent.deck.length > 0) {
        const discarded = opponent.deck.shift();
        opponent.discard.push(discarded);
        game.log(`Sophia S. Wang's Original is Better: Opponent discarded top card of deck!`);
    }

    closeModal('card-modal');
    updateUI();
}

function playItem(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (!card) return;

    if (!canPlayCardThisTurn()) {
        game.log('Main Hall: Cannot play more than 3 cards per turn', 'info');
        return;
    }

    game.cardsPlayedThisTurn++;
    logMainHallRemaining();
    logMainHallRemaining();
    logMainHallRemaining();

    // Check if this is a tool card (needs attachment)
    const isToolCard = card.cardType === 'tool';

    // Implement specific item effects - returns true if we should wait for modal
    const waitForModal = executeItemEffect(card);

    // If we need to wait for modal input, don't discard yet
    if (waitForModal) {
        return;
    }

    // Don't discard tool cards yet - they'll be discarded after attachment
    if (!isToolCard) {
        player.hand = player.hand.filter(c => c.id !== cardId);
        player.discard.push(card);

        closeModal('action-modal');
        updateUI();
    }
    // For tool cards, the modal stays open for attachment selection
}

function executeItemEffect(card) {
    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    game.log(`Played ${card.name}`, 'info');

    switch(card.name) {
        // Tool items - these attach to characters
        case 'Maid Outfit':
        case "Kiki's Headband":
        case 'Bucket':
        case 'AVGE T-Shirt':
        case 'AVGE Showcase Sticker':
        case 'Musescore Subscription':
            showToolAttachmentModal(card);
            return true; // Wait for modal, will discard after attachment

        // Healing items
        case 'Matcha Latte':
            // Heals ALL your characters (active + bench) by 10 (+10 for Maids)
            [player.active, ...player.bench].filter(c => c).forEach(char => {
                let healAmount = 10;
                // Maid status bonus: +10 healing
                if (char.status && char.status.includes('Maid')) {
                    healAmount += 10;
                }
                // Petteruti Lounge/Matcha Maid Cafe bonus: +10 healing
                if (game.stadium && game.stadium.name === 'Petteruti Lounge') {
                    healAmount += 10;
                }
                char.damage = Math.max(0, (char.damage || 0) - healAmount);
                game.log(`${char.name} healed ${healAmount} HP`, 'heal');
            });
            break;

        case 'Strawberry Matcha Latte':
            // Heals ONE character of your choice by 20
            showHealSelectionModal(player, 20);
            return true; // Wait for modal

        // Special energy items
        case 'Otamatone':
            if (!game.attackModifiers[game.currentPlayer].otamatoneBonus) {
                game.attackModifiers[game.currentPlayer].otamatoneBonus = 0;
            }
            game.attackModifiers[game.currentPlayer].otamatoneBonus += 1;
            game.log('Active character has +1 typeless energy this turn', 'info');
            break;

        case 'Miku Otamatone':
            // Only in concert halls
            if (!game.attackModifiers[game.currentPlayer].mikuOtamatoneUsed) {
                game.attackModifiers[game.currentPlayer].mikuOtamatoneUsed = true;
            }
            if (!game.stadium || !game.isPerformanceSpace(game.stadium.name)) {
                game.log('Miku Otamatone used outside a concert hall (no energy bonus).', 'info');
                break;
            }
            if (!game.attackModifiers[game.currentPlayer].otamatoneBonus) {
                game.attackModifiers[game.currentPlayer].otamatoneBonus = 0;
            }
            game.attackModifiers[game.currentPlayer].otamatoneBonus += 2;
            game.log('Active character has +2 typeless energy this turn', 'info');
            break;

        // Deck manipulation
        case 'Concert Program':
            showTopCards(player, 5);
            break;

        case 'Dress Rehearsal Roster':
            showDeckSelection(player, 3, 1);
            return true; // Wait for modal, will discard after selection

        case 'Printed Score':
            // Opponent reveals their entire hand
            if (opponent.hand.length > 0) {
                const handNames = opponent.hand.map(c => c.name).join(', ');
                alert(`Opponent's hand (${opponent.hand.length} cards): ${handNames}`);
                game.log(`Printed Score: Opponent revealed entire hand: ${handNames}`, 'info');
            } else {
                game.log('Printed Score: Opponent has no cards in hand', 'info');
            }
            break;

        case 'Annotated Score':
            // Opponent reveals 2 cards from hand; choose one to discard
            if (opponent.hand.length >= 2) {
                showHandRevealModal(opponent, 2, true); // true = discard one
                return true; // Wait for modal
            } else if (opponent.hand.length === 1) {
                // Only 1 card, force discard it
                const discarded = opponent.hand.pop();
                opponent.discard.push(discarded);
                game.log(`Annotated Score: Opponent discarded ${discarded.name}`, 'info');
            } else {
                game.log('Annotated Score: Opponent has no cards to discard', 'info');
            }
            break;

        // Hand disruption
        case 'Musescore file':
            if (opponent.hand.length >= 3) {
                showHandRevealModal(opponent, 3, false);
                return true; // Wait for modal
            } else {
                alert(`Opponent has only ${opponent.hand.length} cards in hand`);
            }
            break;

        case 'Corrupted File':
            // Check if you have an Arranger in play
            const hasArranger = [player.active, ...player.bench]
                .filter(c => c)
                .some(c => c.status && c.status.includes('Arranger'));

            if (!hasArranger) {
                game.log('Cannot use Corrupted File without an Arranger in play!', 'error');
                return false;
            }

            // Opponent shuffles their hand into deck and draws 3 cards
            const handSize = opponent.hand.length;
            opponent.hand.forEach(card => opponent.deck.push(card));
            opponent.hand = [];
            game.shuffleDeck(opponentNum);
            game.drawCards(opponentNum, 3);
            game.log(`Opponent shuffled ${handSize} cards into deck and drew 3 new cards`, 'info');
            break;

        // Board manipulation
        case 'Cast reserve':
            const castCoinFlip = flipCoin();
            const opponentBench = opponent.bench.filter(c => c);
            if (opponentBench.length > 0) {
                if (castCoinFlip) {
                    game.log('Coin flip: Heads - You choose', 'info');
                    showBenchShuffleModal(opponent, true);
                    return;
                } else {
                    game.log('Coin flip: Tails - Opponent chooses', 'info');
                    showBenchShuffleModal(opponent, false);
                    return;
                }
            } else {
                game.log('Opponent has no benched characters', 'info');
            }
            break;

        case 'Ice Skates':
            // Switch YOUR active character with one of YOUR benched characters
            if (player.active && player.bench.some(c => c)) {
                showPlayerSwitchModal(player);
                return true; // Wait for modal
            } else {
                game.log('Cannot switch (no bench)', 'info');
            }
            break;

        // Energy manipulation
        case 'Folding Stand':
            // Shuffle up to 3 energy cards from discard pile into deck
            showFoldingStandModal(player);
            return true; // Wait for modal

        case 'BUO Stand':
            // Put one energy on top of deck and one on bottom
            showBUOStandModal(player);
            return true; // Wait for modal

        // Draw items
        case 'Concert Ticket':
            // Account for the fact that this card is still in hand when calculating
            // After this item is discarded, we want player to have 4 cards total
            const cardsToDraw = Math.max(0, 4 - (player.hand.length - 1));
            game.drawCards(game.currentPlayer, cardsToDraw);
            game.log(`Drew ${cardsToDraw} cards to reach 4 in hand`, 'info');
            break;

        case 'Raffle Ticket':
            if (player.deck.length > 0) {
                const drawnCard = player.deck.shift();
                player.hand.push(drawnCard);
                game.log(`Drew ${drawnCard.name}`, 'info');

                if (drawnCard.name === 'AVGE Birb') {
                    game.log('Drew AVGE Birb! May heal all damage from one character', 'info');
                    showFullHealModal(player);
                    return true; // Wait for modal
                }
            }
            break;

        case 'Standard Musescore File':
            // Can only play if active character is an Arranger
            if (player.active && player.active.status && player.active.status.includes('Arranger')) {
                // Draw 2 cards from top of deck
                const drawCount = Math.min(2, player.deck.length);
                for (let i = 0; i < drawCount; i++) {
                    const card = player.deck.shift();
                    player.hand.push(card);
                }
                game.log(`Standard Musescore File: Drew ${drawCount} cards from top of deck`, 'info');
            } else {
                alert('Can only play this if your active character has Arranger status!');
                return false; // Don't discard the card
            }
            break;

        case 'Corrupted Musescore File':
            // Can only play if active character is an Arranger
            if (player.active && player.active.status && player.active.status.includes('Arranger')) {
                // Draw 2 cards from bottom of deck
                const drawCount = Math.min(2, player.deck.length);
                for (let i = 0; i < drawCount; i++) {
                    const card = player.deck.pop(); // Pop from end instead of shift from start
                    player.hand.push(card);
                }
                game.log(`Corrupted Musescore File: Drew ${drawCount} cards from bottom of deck`, 'info');
            } else {
                alert('Can only play this if your active character has Arranger status!');
                return false; // Don't discard the card
            }
            break;

        case 'Cast Reserve':
            // Flip a coin. Heads: you choose opponent's bench to shuffle. Tails: opponent chooses their bench to shuffle.
            const castReserveBench = opponent.bench.filter(c => c);
            if (castReserveBench.length === 0) {
                game.log('Cast Reserve: Opponent has no benched characters', 'info');
                break;
            }

            const castReserveCoin = flipCoin() ? 'Heads' : 'Tails';
            game.log(`Cast Reserve: Flipped ${castReserveCoin}!`, 'info');

            if (castReserveCoin === 'Heads') {
                // You choose
                game.log('Cast Reserve: You choose which of opponent\'s benched characters to shuffle into deck', 'info');
                const targetName = prompt(`Choose opponent's benched character to shuffle into deck:\n${castReserveBench.map(c => c.name).join(', ')}`);
                const target = castReserveBench.find(c => c.name === targetName);
                if (target) {
                    const benchIndex = opponent.bench.indexOf(target);
                    opponent.deck.push(target);
                    opponent.bench[benchIndex] = null;
                    game.shuffleDeck(opponentNum);
                    game.log(`Cast Reserve: Shuffled ${target.name} into opponent's deck`, 'info');
                }
            } else {
                // Opponent chooses which benched character to shuffle
                game.log('Cast Reserve: Opponent chooses which benched character to shuffle into deck', 'info');
                const targetName = prompt(`Opponent chooses which benched character to shuffle into deck:\n${castReserveBench.map(c => c.name).join(', ')}`);
                const target = castReserveBench.find(c => c.name === targetName);
                if (target) {
                    const benchIndex = opponent.bench.indexOf(target);
                    opponent.deck.push(target);
                    opponent.bench[benchIndex] = null;
                    game.shuffleDeck(opponentNum);
                    game.log(`Cast Reserve: Opponent shuffled ${target.name} into their deck`, 'info');
                }
            }
            break;

        // Search items
        case 'Concert Roster':
            // Search deck for a specific character and place it onto your bench
            showConcertRosterModal(player);
            return true; // Wait for modal

        // Stadium removal
        case 'BAI Email':
            if (game.stadium) {
                player.discard.push(game.stadium);
                game.log(`Discarded stadium: ${game.stadium.name}`, 'info');
                game.stadium = null;
            } else {
                game.log('No stadium in play', 'info');
            }
            // Opponent cannot play stadium next turn
            const opponentNum = game.currentPlayer === 1 ? 2 : 1;
            game.nextTurnEffects[opponentNum].cannotPlayStadium = true;
            game.log('BAI Email: Opponent cannot play stadiums on their next turn', 'info');
            break;

        // Tool removal
        case 'AVGE Birb':
            let toolsRemoved = 0;
            [opponent.active, ...opponent.bench].filter(c => c).forEach(char => {
                if (char.attachedTools && char.attachedTools.length > 0) {
                    toolsRemoved += char.attachedTools.length;
                    char.attachedTools.forEach(tool => {
                        removeToolEffects(char, tool);
                        opponent.discard.push(tool);
                        game.log(`Removed ${tool.name} from ${char.name}`, 'info');
                    });
                    char.attachedTools = [];
                }
            });

            if (toolsRemoved > 0) {
                game.log(`Removed ${toolsRemoved} tool(s)`, 'info');
            }

            // Next turn penalty - active takes +20 damage from attacks
            if (!game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty) {
                game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty = 0;
            }
            game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty = 20;
            game.log('Next turn: Active takes +20 damage from attacks', 'info');
            break;

        // Discard retrieval
        case 'Camera':
            // Shuffle up to 2 supporters from discard into deck
            const supportersInDiscard = player.discard.filter(c => c.cardType === 'supporter');
            if (supportersInDiscard.length === 0) {
                game.log('Camera: No supporters in discard pile', 'info');
            } else if (supportersInDiscard.length === 1) {
                // Only 1 supporter, shuffle it
                const supporter = supportersInDiscard[0];
                player.deck.push(supporter);
                player.discard = player.discard.filter(c => c.id !== supporter.id);
                game.shuffleDeck(game.currentPlayer);
                game.log(`Camera: Shuffled ${supporter.name} into deck`, 'info');
            } else {
                // 2+ supporters, let player choose up to 2
                showCameraModal(player, supportersInDiscard);
                return true; // Wait for modal
            }
            break;

        case 'Video Camera':
            selectMultipleFromDiscard(player, 'energy', 2, () => {
                // After selection, discard the Video Camera
                const videoCameraCard = player.hand.find(c => c.name === 'Video Camera');
                if (videoCameraCard) {
                    player.hand = player.hand.filter(c => c.id !== videoCameraCard.id);
                    player.discard.push(videoCameraCard);
                }
                updateUI();
            });
            return true; // Wait for modal

        default:
            game.log(`${card.name} effect not yet implemented`, 'info');
    }

    return false; // Don't wait for modal
}

function showTopCards(player, count) {
    const topCards = player.deck.slice(0, Math.min(count, player.deck.length));
    alert(`Top ${count} cards: ${topCards.map(c => c.name).join(', ')}`);
    game.log(`Looked at top ${count} cards`, 'info');
}

function showDeckSelection(player, viewCount, selectCount) {
    const topCards = player.deck.slice(0, Math.min(viewCount, player.deck.length));

    if (topCards.length === 0) {
        alert('No cards to view!');
        return;
    }

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Dress Rehearsal Roster</h2>`;
    html += `<p>Choose ${selectCount} card to keep, the rest will be discarded:</p>`;
    html += `<div class="target-selection">`;

    topCards.forEach(card => {
        html += `<div class="target-option" onclick="selectDeckCard('${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectDeckCard(cardId) {
    const player = game.players[game.currentPlayer];
    const topCards = player.deck.slice(0, 3);
    const selected = topCards.find(c => c.id === cardId);

    if (selected) {
        // Remove the top cards from the deck
        player.deck.splice(0, topCards.length);

        // Keep selected, discard rest
        player.hand.push(selected);
        topCards.filter(c => c.id !== selected.id).forEach(card => {
            player.discard.push(card);
        });
    }

    // Discard the Dress Rehearsal Roster card
    const rosterCard = player.hand.find(c => c.name === 'Dress Rehearsal Roster');
    if (rosterCard) {
        player.hand = player.hand.filter(c => c.id !== rosterCard.id);
        player.discard.push(rosterCard);
    }

    closeModal('action-modal');
    updateUI();
}


function selectFromDiscard(player, cardType, callback) {
    const eligibleCards = player.discard.filter(c => c.cardType === cardType);
    if (eligibleCards.length === 0) {
        game.log(`No ${cardType} cards in discard`, 'info');
        if (callback) callback();
        return;
    }

    // Show selection modal
    showDiscardSelectionModal(player, eligibleCards, cardType, 1, callback);
}

function selectMultipleFromDiscard(player, cardType, count, callback) {
    const eligibleCards = player.discard.filter(c => c.cardType === cardType);
    if (eligibleCards.length === 0) {
        game.log(`No ${cardType} cards in discard`, 'info');
        if (callback) callback();
        return;
    }

    // Show selection modal for multiple cards
    showDiscardSelectionModal(player, eligibleCards, cardType, Math.min(count, eligibleCards.length), callback);
}

// Show discard pile contents (read-only view)
function showDiscardPileModal(playerNum) {
    const player = game.players[playerNum];
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const playerLabel = playerNum === game.currentPlayer ? 'Your' : "Opponent's";

    let html = `<h2>${playerLabel} Discard Pile (${player.discard.length} cards)</h2>`;
    
    if (player.discard.length === 0) {
        html += `<p>The discard pile is empty.</p>`;
    } else {
        html += `<div class="discard-pile-view" style="max-height: 400px; overflow-y: auto;">`;
        
        // Group cards by type for better organization
        const cardsByType = {
            character: [],
            item: [],
            tool: [],
            supporter: [],
            stadium: [],
            energy: []
        };

        player.discard.forEach(card => {
            if (card && card.name) {
                const type = card.cardType || 'other';
                if (cardsByType[type]) {
                    cardsByType[type].push(card);
                } else {
                    cardsByType[type] = [card];
                }
            }
        });

        // Display cards by type
        Object.keys(cardsByType).forEach(type => {
            if (cardsByType[type].length > 0) {
                html += `<h3 style="margin-top: 10px; text-transform: capitalize;">${type}s (${cardsByType[type].length})</h3>`;
                html += `<div style="margin-left: 10px;">`;
                cardsByType[type].forEach(card => {
                    html += `<div style="padding: 5px; border-bottom: 1px solid #ccc;">${card.name}</div>`;
                });
                html += `</div>`;
            }
        });

        html += `</div>`;
    }

    html += `<button class="action-btn" onclick="closeModal('action-modal')">Close</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

// Modal for selecting cards from discard pile
function showDiscardSelectionModal(player, cards, cardType, maxSelect, callback) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.discardSelected = [];
    game.tempSelections.discardCallback = callback;
    game.tempSelections.discardPlayer = player;

    let html = `<h2>Select from Discard Pile</h2>`;
    html += `<p>Select up to ${maxSelect} ${cardType} card(s)</p>`;
    html += `<div id="discard-selection">`;

    cards.forEach(card => {
        html += `<div class="target-option" id="discard-card-${card.id}" onclick="toggleDiscardCard('${card.id}', ${maxSelect})">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="confirmDiscardSelection()">Confirm Selection</button>`;
    html += `<button class="action-btn" onclick="cancelDiscardSelection()">Skip</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showMusescoreRetrievalModal(player, musescoreFiles) {
    showDiscardSelectionModal(player, musescoreFiles, 'musescore', 1);
}

// Photograph: select an item from opponent hand to copy
function showPhotographSelectionModal(itemCards, opponentNum) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.photographItems = itemCards.map(c => c.id);
    game.tempSelections.photographSelected = null;
    game.tempSelections.photographOpponentNum = opponentNum;

    let html = `<h2>Photograph</h2>`;
    html += `<p>Select an item from your opponent's hand to copy</p>`;
    html += `<div id="photograph-selection">`;

    itemCards.forEach(card => {
        html += `<div class="target-option" id="photograph-card-${card.id}" onclick="selectPhotographItem('${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="confirmPhotographSelection()">Confirm</button>`;
    html += `<button class="action-btn" onclick="cancelPhotographSelection()">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectPhotographItem(cardId) {
    if (!game.tempSelections) return;
    const previous = game.tempSelections.photographSelected;
    if (previous) {
        const prevEl = document.getElementById(`photograph-card-${previous}`);
        if (prevEl) prevEl.classList.remove('selected');
    }

    game.tempSelections.photographSelected = cardId;
    const element = document.getElementById(`photograph-card-${cardId}`);
    if (element) element.classList.add('selected');
}

function confirmPhotographSelection() {
    const player = game.players[game.currentPlayer];
    if (!game.tempSelections || !game.tempSelections.photographSelected) {
        game.log('Photograph: No item selected', 'info');
        return;
    }

    const opponentNum = game.tempSelections.photographOpponentNum;
    const opponent = game.players[opponentNum];
    const chosenItem = opponent.hand.find(c => c.id === game.tempSelections.photographSelected);

    if (!chosenItem) {
        game.log('Photograph: Selected item no longer in opponent hand', 'warning');
        closeModal('action-modal');
        return;
    }

    game.log(`Photograph: Copying ${chosenItem.name} effect`, 'info');
    const tempItem = { ...chosenItem, id: generateCardId() };
    player.hand.push(tempItem);
    game.tempSelections.photographTempItemId = tempItem.id;

    const waitForModal = executeItemEffect(tempItem);
    if (!waitForModal) {
        player.hand = player.hand.filter(c => c.id !== tempItem.id);
        delete game.tempSelections.photographTempItemId;
        closeModal('action-modal');
        updateUI();
    }
}

function cancelPhotographSelection() {
    closeModal('action-modal');
}

function showSurpriseDeliveryModal(player, target, topThree, attacker, move) {
    if (!game.tempSelections) game.tempSelections = {};

    const characterCards = topThree.filter(c => c.cardType === 'character');
    const remainingCards = topThree.filter(c => c.cardType !== 'character');

    if (characterCards.length > 0) {
        characterCards.forEach(card => player.hand.push(card));
    }

    game.tempSelections.surpriseDeliveryRemaining = remainingCards;
    game.tempSelections.surpriseDeliveryOrder = [];
    game.tempSelections.surpriseDeliveryTargetId = target ? target.id : null;
    game.tempSelections.surpriseDeliveryAttackerId = attacker ? attacker.id : null;
    game.tempSelections.surpriseDeliveryMoveName = move ? move.name : 'Surprise Delivery';
    game.tempSelections.surpriseDeliveryCharacterCount = characterCards.length;

    if (remainingCards.length === 0) {
        confirmSurpriseDelivery();
        return;
    }

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Surprise Delivery</h2>`;
    html += `<p>Revealed: ${topThree.map(c => c.name).join(', ')}</p>`;
    html += `<p>Characters to hand: ${characterCards.length}</p>`;
    html += `<p>Select order to place remaining cards on top of your deck:</p>`;
    html += `<div class="target-selection" id="surprise-delivery-remaining">`;
    remainingCards.forEach(card => {
        html += `<div class="target-option" onclick="selectSurpriseDeliveryCard('${card.id}')">${card.name}</div>`;
    });
    html += `</div>`;
    html += `<div style="margin-top: 8px;"><strong>Top Order:</strong></div>`;
    html += `<div id="surprise-delivery-order" class="target-selection"></div>`;
    html += `<button class="action-btn" onclick="confirmSurpriseDelivery()">Confirm</button>`;
    html += `<button class="action-btn" onclick="cancelSurpriseDelivery()">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectSurpriseDeliveryCard(cardId) {
    if (!game.tempSelections) return;
    const remaining = game.tempSelections.surpriseDeliveryRemaining || [];
    const order = game.tempSelections.surpriseDeliveryOrder || [];
    const cardIndex = remaining.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const [card] = remaining.splice(cardIndex, 1);
    order.push(card);
    game.tempSelections.surpriseDeliveryRemaining = remaining;
    game.tempSelections.surpriseDeliveryOrder = order;

    const remainingEl = document.getElementById('surprise-delivery-remaining');
    if (remainingEl) {
        remainingEl.innerHTML = remaining.map(c => `<div class="target-option" onclick="selectSurpriseDeliveryCard('${c.id}')">${c.name}</div>`).join('');
    }
    const orderEl = document.getElementById('surprise-delivery-order');
    if (orderEl) {
        orderEl.innerHTML = order.map(c => `<div class="target-option selected">${c.name}</div>`).join('');
    }
}

function confirmSurpriseDelivery() {
    if (!game.tempSelections) return;
    const player = game.players[game.currentPlayer];
    const remaining = game.tempSelections.surpriseDeliveryRemaining || [];
    const order = game.tempSelections.surpriseDeliveryOrder || [];
    const orderedCards = [...order, ...remaining];

    for (let i = orderedCards.length - 1; i >= 0; i--) {
        player.deck.unshift(orderedCards[i]);
    }

    const charCount = game.tempSelections.surpriseDeliveryCharacterCount || 0;
    if (charCount > 0) {
        const opponentNum = game.currentPlayer === 1 ? 2 : 1;
        const opponent = game.players[opponentNum];
        const targetId = game.tempSelections.surpriseDeliveryTargetId;
        const target = targetId ? ([opponent.active, ...opponent.bench].find(c => c && c.id === targetId)) : opponent.active;
        if (target) {
            const baseDamage = charCount * 10;
            const attacker = [player.active, ...player.bench].find(c => c && c.id === game.tempSelections.surpriseDeliveryAttackerId) || player.active;
            const move = attacker && attacker.moves ? attacker.moves.find(m => m.name === game.tempSelections.surpriseDeliveryMoveName) : { name: 'Surprise Delivery' };
            const finalDamage = calculateDamage(attacker, target, baseDamage, move);
            game.dealDamage(target, finalDamage, attacker);
            game.log(`Surprise Delivery: ${charCount} characters for ${finalDamage} damage!`, 'damage');
        }
    }

    closeModal('action-modal');
    game.tempSelections = {};
    updateUI();
}

function cancelSurpriseDelivery() {
    if (!game.tempSelections) {
        closeModal('action-modal');
        return;
    }
    const player = game.players[game.currentPlayer];
    const remaining = game.tempSelections.surpriseDeliveryRemaining || [];
    const order = game.tempSelections.surpriseDeliveryOrder || [];
    const orderedCards = [...order, ...remaining];
    for (let i = orderedCards.length - 1; i >= 0; i--) {
        player.deck.unshift(orderedCards[i]);
    }
    closeModal('action-modal');
    game.tempSelections = {};
    updateUI();
}

function toggleDiscardCard(cardId, maxSelect) {
    const element = document.getElementById(`discard-card-${cardId}`);

    if (!game.tempSelections.discardSelected) game.tempSelections.discardSelected = [];

    const index = game.tempSelections.discardSelected.indexOf(cardId);
    if (index > -1) {
        // Deselect
        game.tempSelections.discardSelected.splice(index, 1);
        element.classList.remove('selected');
    } else {
        // Select (if under limit)
        if (game.tempSelections.discardSelected.length < maxSelect) {
            game.tempSelections.discardSelected.push(cardId);
            element.classList.add('selected');
        } else {
            game.log(`Maximum ${maxSelect} card(s) can be selected`, 'info');
        }
    }
}

function confirmDiscardSelection() {
    const player = game.tempSelections.discardPlayer || game.players[game.currentPlayer];
    const destination = game.tempSelections.discardDestination || 'hand';
    const shouldShuffle = !!game.tempSelections.discardShuffle;

    if (game.tempSelections.discardSelected && game.tempSelections.discardSelected.length > 0) {
        game.tempSelections.discardSelected.forEach(cardId => {
            const card = player.discard.find(c => c.id === cardId);
            if (card) {
                player.discard = player.discard.filter(c => c.id !== cardId);
                if (destination === 'deck') {
                    player.deck.push(card);
                    if (shouldShuffle) {
                        game.shuffleDeck(game.currentPlayer);
                    }
                    game.log(`Shuffled ${card.name} into deck`, 'info');
                } else {
                    player.hand.push(card);
                    game.log(`Retrieved ${card.name} from discard`, 'info');
                }
            }
        });
    }

    const callback = game.tempSelections.discardCallback;
    delete game.tempSelections.discardSelected;
    delete game.tempSelections.discardCallback;
    delete game.tempSelections.discardPlayer;
    delete game.tempSelections.discardDestination;
    delete game.tempSelections.discardShuffle;
    game.blockAttackEnd = false;

    closeModal('action-modal');
    updateUI();

    if (callback) callback();
}

function cancelDiscardSelection() {
    const callback = game.tempSelections.discardCallback;
    delete game.tempSelections.discardSelected;
    delete game.tempSelections.discardCallback;
    delete game.tempSelections.discardPlayer;
    game.blockAttackEnd = false;

    closeModal('action-modal');
    updateUI();

    if (callback) callback();
}

// Tool attachment modal
function showToolAttachmentModal(toolCard) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const player = game.players[game.currentPlayer];

    let html = `<h2>Attach ${toolCard.name}</h2>`;
    html += `<p>${toolCard.effect}</p>`;
    html += `<div class="target-selection">`;

    if (player.active) {
        html += `<div class="target-option" onclick="attachTool('${toolCard.id}', 'active')">
            ${player.active.name} (Active)
        </div>`;
    }

    player.bench.forEach((char, idx) => {
        if (char) {
            html += `<div class="target-option" onclick="attachTool('${toolCard.id}', ${idx})">
                ${char.name} (Bench ${idx + 1})
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function attachTool(toolId, target) {
    const player = game.players[game.currentPlayer];
    const toolCard = player.hand.find(c => c.id === toolId);

    if (!toolCard) return;

    const character = target === 'active' ? player.active : player.bench[target];
    if (!character) return;

    if (!character.attachedTools) character.attachedTools = [];
    character.attachedTools.push(toolCard);

    // Apply tool effects
    if (toolCard.grantStatus) {
        if (!character.status) character.status = [];
        if (!character.status.includes(toolCard.grantStatus)) {
            character.status.push(toolCard.grantStatus);
        }
        if (toolCard.grantStatus === 'Goon') {
            character.goonBonusHp = (character.goonBonusHp || 0) + 20;
            character.hp += 20;
        }
    }

    if (toolCard.addType) {
        if (!character.type.includes(toolCard.addType)) {
            character.type.push(toolCard.addType);
        }
    }
    player.hand = player.hand.filter(c => c.id !== toolId);
    game.log(`Attached ${toolCard.name} to ${character.name}`, 'info');

    closeModal('action-modal');
    updateUI();
}

// Helper function to remove tool effects when a tool is removed
function removeToolEffects(character, tool) {
    if (!character || !tool) return;

    // Remove status granted by tool
    if (tool.grantStatus && character.status) {
        character.status = character.status.filter(s => s !== tool.grantStatus);
    }

    if (tool.grantStatus === 'Goon') {
        character.goonBonusHp = Math.max(0, (character.goonBonusHp || 0) - 20);
        character.hp = Math.max(1, character.hp - 20);
        if (character.goonBonusHp === 0) {
            delete character.goonMusicStandBonus;
        }
        if (character.damage != null && character.damage >= character.hp) {
            game.knockOut(character);
        }
    }

    // Remove type added by tool
    if (tool.addType && character.type) {
        character.type = character.type.filter(t => t !== tool.addType);
    }
}

// Hand reveal modal for disruption cards
function showHandRevealModal(opponent, count, playerChooses) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const revealedCards = opponent.hand.slice(0, count);

    let html = `<h2>Opponent's Hand (${count} cards)</h2>`;
    html += `<p>Choose one to discard</p>`;
    html += `<div class="target-selection">`;

    revealedCards.forEach(card => {
        html += `<div class="target-option" onclick="discardOpponentCard('${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function discardOpponentCard(cardId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const card = opponent.hand.find(c => c.id === cardId);

    if (card) {
        opponent.discard.push(card);
        opponent.hand = opponent.hand.filter(c => c.id !== cardId);
        game.log(`Opponent discarded ${card.name}`, 'info');
    }

    // Discard the Musescore file, Fake email, or Annotated Score card
    const player = game.players[game.currentPlayer];
    const disruptionCard = player.hand.find(c => c.name === 'Musescore file' || c.name === 'Fake email' || c.name === 'Annotated Score');
    if (disruptionCard) {
        player.hand = player.hand.filter(c => c.id !== disruptionCard.id);
        player.discard.push(disruptionCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Show modal for opponent to choose which cards to discard from their own hand
function showOpponentDiscardChoice(opponentNum, discardCount, callback) {
    const opponent = game.players[opponentNum];
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.opponentDiscardCards = [];
    game.tempSelections.opponentDiscardCount = discardCount;
    game.tempSelections.opponentNum = opponentNum;
    game.tempSelections.opponentDiscardCallback = callback;

    let html = `<h2>Choose ${discardCount} card${discardCount > 1 ? 's' : ''} to discard</h2>`;
    html += `<p>Selected: <span id="opponent-discard-count">0</span> / ${discardCount}</p>`;
    html += `<div class="target-selection">`;

    opponent.hand.forEach(card => {
        html += `<div class="target-option" id="opp-discard-${card.id}" onclick="toggleOpponentDiscardCard('${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="confirmOpponentDiscard()">Confirm Discard</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleOpponentDiscardCard(cardId) {
    if (!game.tempSelections) return;

    const selectedCards = game.tempSelections.opponentDiscardCards;
    const maxCount = game.tempSelections.opponentDiscardCount;
    const cardElement = document.getElementById(`opp-discard-${cardId}`);

    if (selectedCards.includes(cardId)) {
        // Deselect
        game.tempSelections.opponentDiscardCards = selectedCards.filter(id => id !== cardId);
        cardElement.classList.remove('selected');
    } else {
        // Select if under limit
        if (selectedCards.length < maxCount) {
            game.tempSelections.opponentDiscardCards.push(cardId);
            cardElement.classList.add('selected');
        } else {
            alert(`You can only select ${maxCount} card${maxCount > 1 ? 's' : ''}.`);
        }
    }

    // Update counter
    const counter = document.getElementById('opponent-discard-count');
    if (counter) {
        counter.textContent = game.tempSelections.opponentDiscardCards.length;
    }
}

function confirmOpponentDiscard() {
    if (!game.tempSelections) return;

    const selectedCardIds = game.tempSelections.opponentDiscardCards;
    const requiredCount = game.tempSelections.opponentDiscardCount;
    const opponentNum = game.tempSelections.opponentNum;
    const opponent = game.players[opponentNum];

    if (selectedCardIds.length !== requiredCount) {
        alert(`Please select exactly ${requiredCount} card${requiredCount > 1 ? 's' : ''} to discard.`);
        return;
    }

    // Discard selected cards
    selectedCardIds.forEach(cardId => {
        const card = opponent.hand.find(c => c.id === cardId);
        if (card) {
            opponent.discard.push(card);
            opponent.hand = opponent.hand.filter(c => c.id !== cardId);
        }
    });

    game.log(`Opponent discarded ${selectedCardIds.length} card${selectedCardIds.length > 1 ? 's' : ''}`, 'info');

    // Discard the Michelle supporter card
    const player = game.players[game.currentPlayer];
    const michelleCard = player.hand.find(c => c.name === 'Michelle');
    if (michelleCard) {
        player.hand = player.hand.filter(c => c.id !== michelleCard.id);
        player.discard.push(michelleCard);
    }

    // Call callback if provided
    if (game.tempSelections.opponentDiscardCallback) {
        game.tempSelections.opponentDiscardCallback();
    }

    const shouldEndTurn = game.tempSelections.pendingEndTurn;

    // Clean up
    game.tempSelections = {};

    closeModal('action-modal');
    updateUI();

    if (shouldEndTurn) {
        endTurn();
    }
}

// Annotated score modal
function showAnnotatedScoreModal(opponent) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const topTwo = opponent.deck.slice(0, 2);

    // Initialize tracking for annotated score
    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.annotatedCards = topTwo.map(c => ({ card: c, position: null }));
    game.tempSelections.annotatedOpponent = opponentNum;
    game.tempSelections.annotatedCurrentCard = 0;

    showAnnotatedCardChoice();
}

function showAnnotatedCardChoice() {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const currentIndex = game.tempSelections.annotatedCurrentCard;
    const cards = game.tempSelections.annotatedCards;

    if (currentIndex >= cards.length) {
        // Done choosing - now rearrange the deck
        applyAnnotatedScoreChoices();
        return;
    }

    const card = cards[currentIndex].card;

    let html = `<h2>Annotated Score</h2>`;
    html += `<p>Card ${currentIndex + 1} of ${cards.length}: <strong>${card.name}</strong> (${card.cardType})</p>`;
    html += `<p>Choose where to place this card:</p>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="placeAnnotatedCard('top')">Place on Top of Deck</button>`;
    html += `<button class="action-btn" onclick="placeAnnotatedCard('bottom')">Place on Bottom of Deck</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function placeAnnotatedCard(position) {
    const currentIndex = game.tempSelections.annotatedCurrentCard;
    game.tempSelections.annotatedCards[currentIndex].position = position;

    const card = game.tempSelections.annotatedCards[currentIndex].card;
    game.log(`Annotated Score: Placing ${card.name} on ${position} of deck`, 'info');

    // Move to next card
    game.tempSelections.annotatedCurrentCard++;
    showAnnotatedCardChoice();
}

function applyAnnotatedScoreChoices() {
    const opponentNum = game.tempSelections.annotatedOpponent;
    const opponent = game.players[opponentNum];
    const choices = game.tempSelections.annotatedCards;

    // Remove the top 2 cards from deck
    opponent.deck.splice(0, 2);

    // Separate cards by their chosen position
    const topCards = choices.filter(c => c.position === 'top').map(c => c.card);
    const bottomCards = choices.filter(c => c.position === 'bottom').map(c => c.card);

    // Add top cards to the beginning of deck
    opponent.deck.unshift(...topCards);

    // Add bottom cards to the end of deck
    opponent.deck.push(...bottomCards);

    game.log(`Annotated Score: Rearranged opponent's deck`, 'info');

    // Clean up
    delete game.tempSelections.annotatedCards;
    delete game.tempSelections.annotatedOpponent;
    delete game.tempSelections.annotatedCurrentCard;

    // Discard the item card
    const player = game.players[game.currentPlayer];
    const itemCard = player.hand.find(c => c.name === 'Annotated score');
    if (itemCard) {
        player.hand = player.hand.filter(c => c.id !== itemCard.id);
        player.discard.push(itemCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Bench shuffle modal
function showBenchShuffleModal(opponent, playerChooses) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Cast Reserve - ${playerChooses ? 'Choose' : 'Opponent Chooses'}</h2>`;
    html += `<p>Select benched character to shuffle into deck</p>`;
    html += `<div class="target-selection">`;

    opponent.bench.forEach((char, idx) => {
        if (char) {
            html += `<div class="target-option" onclick="shuffleBenchIntoDeck(${game.currentPlayer === 1 ? 2 : 1}, ${idx})">
                ${char.name}
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function shuffleBenchIntoDeck(playerNum, benchIndex) {
    const player = game.players[playerNum];
    const char = player.bench[benchIndex];

    if (char) {
        player.bench[benchIndex] = null;
        player.deck.push(char);
        game.shuffleDeck(playerNum);
        game.log(`${char.name} shuffled into deck`, 'info');
    }

    closeModal('action-modal');
    updateUI();
}

// Opponent switch modal
function showOpponentSwitchModal(opponent) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Ice Skates - Switch Opponent's Active</h2>`;
    html += `<p>Select benched character to switch with active</p>`;
    html += `<div class="target-selection">`;

    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    opponent.bench.forEach((char, idx) => {
        if (char) {
            html += `<div class="target-option" onclick="forceOpponentSwitch(${opponentNum}, ${idx})">
                ${char.name}
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function forceOpponentSwitch(opponentNum, benchIndex) {
    const opponent = game.players[opponentNum];
    const benchChar = opponent.bench[benchIndex];
    const active = opponent.active;

    if (benchChar && active) {
        opponent.bench[benchIndex] = active;
        opponent.active = benchChar;
        game.log(`Opponent's ${benchChar.name} switched to active`, 'info');
    }

    // Discard the Ice Skates card
    const player = game.players[game.currentPlayer];
    const iceSkatesCard = player.hand.find(c => c.name === 'Ice skates');
    if (iceSkatesCard) {
        player.hand = player.hand.filter(c => c.id !== iceSkatesCard.id);
        player.discard.push(iceSkatesCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Friedman Hall: Opponent chooses which card to keep
function showFriedmanHallChoice(cards) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Friedman Hall - Democratic Process</h2>`;
    html += `<p>Choose which card your opponent keeps:</p>`;
    html += `<div class="target-selection">`;

    cards.forEach((card, idx) => {
        html += `<div class="target-option" onclick="chooseFriedmanCard(${idx})">
            ${card.name} (${card.cardType})
        </div>`;
    });

    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function queueSteinertPracticeDiscards(playerOrder) {
    if (!game.tempSelections) game.tempSelections = {};
    const queue = playerOrder.filter(playerNum => {
        const player = game.players[playerNum];
        return player && player.bench.filter(c => c).length > 2;
    });
    if (queue.length === 0) return;
    game.tempSelections.steinertPracticeQueue = queue;
    showSteinertPracticeDiscardModal(queue[0]);
}

function showSteinertPracticeDiscardModal(playerNum) {
    const player = game.players[playerNum];
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Steinert Practice Room</h2>`;
    html += `<p>Player ${playerNum}: Choose a benched character to discard (max 2 bench)</p>`;
    html += `<div class="target-selection">`;

    player.bench.forEach((char, idx) => {
        if (char) {
            html += `<div class="target-option" onclick="executeSteinertPracticeDiscard(${playerNum}, ${idx})">
                ${char.name}
            </div>`;
        }
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeSteinertPracticeDiscard(playerNum, benchIndex) {
    const player = game.players[playerNum];
    const char = player.bench[benchIndex];
    if (char) {
        player.bench[benchIndex] = null;
        player.discard.push(char);
        game.log(`Steinert Practice Room: Player ${playerNum} discarded ${char.name} from bench`, 'info');
    }

    if (game.tempSelections && game.tempSelections.steinertPracticeQueue) {
        game.tempSelections.steinertPracticeQueue.shift();
        const nextPlayer = game.tempSelections.steinertPracticeQueue[0];
        if (nextPlayer) {
            showSteinertPracticeDiscardModal(nextPlayer);
            return;
        }
        delete game.tempSelections.steinertPracticeQueue;
    }

    closeModal('action-modal');
    updateUI();
}

function chooseFriedmanCard(cardIndex) {
    const cards = game.tempSelections.friedmanCards;
    const playerNum = game.tempSelections.friedmanPlayer;
    const player = game.players[playerNum];

    // Keep the chosen card, shuffle the other back into deck
    const keptCard = cards[cardIndex];
    const discardedCard = cards[1 - cardIndex];

    player.hand.push(keptCard);
    player.deck.push(discardedCard);
    game.shuffleDeck(playerNum);

    game.log(`Friedman Hall: Drew ${keptCard.name}, shuffled ${discardedCard.name} back into deck`);

    delete game.tempSelections.friedmanCards;
    delete game.tempSelections.friedmanPlayer;

    closeModal('action-modal');
    updateUI();
}

// Full heal modal for Raffle Ticket
function showFullHealModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>AVGE Birb - Full Heal</h2>`;
    html += `<p>Choose a character to heal all damage</p>`;
    html += `<div class="target-selection">`;

    if (player.active) {
        html += `<div class="target-option" onclick="fullHealCharacter('active')">
            ${player.active.name} (${player.active.damage || 0} damage)
        </div>`;
    }

    player.bench.forEach((char, idx) => {
        if (char) {
            html += `<div class="target-option" onclick="fullHealCharacter(${idx})">
                ${char.name} (${char.damage || 0} damage)
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Skip Heal</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function fullHealCharacter(target) {
    const player = game.players[game.currentPlayer];
    const character = target === 'active' ? player.active : player.bench[target];

    if (character && character.damage > 0) {
        character.damage = 0;
        game.log(`${character.name} fully healed!`, 'heal');
    }

    // Discard the Raffle Ticket card
    const raffleCard = player.hand.find(c => c.name === 'Raffle ticket');
    if (raffleCard) {
        player.hand = player.hand.filter(c => c.id !== raffleCard.id);
        player.discard.push(raffleCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Camera: Choose up to 2 supporters from discard to shuffle into deck
function showCameraModal(player, supporters) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    if (!game.tempSelections.cameraSelections) game.tempSelections.cameraSelections = [];

    let html = `<h2>Camera</h2>`;
    html += `<p>Choose up to 2 supporters to shuffle into deck (${game.tempSelections.cameraSelections.length}/2 selected)</p>`;
    html += `<div class="target-selection">`;

    supporters.forEach((supporter, idx) => {
        const isSelected = game.tempSelections.cameraSelections.includes(supporter.id);
        const selectedClass = isSelected ? 'selected' : '';
        html += `<div class="target-option ${selectedClass}" onclick="toggleCameraSelection('${supporter.id}')">
            ${supporter.name} ${isSelected ? '✓' : ''}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="confirmCameraSelection()">Confirm</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleCameraSelection(supporterId) {
    if (!game.tempSelections.cameraSelections) game.tempSelections.cameraSelections = [];

    const index = game.tempSelections.cameraSelections.indexOf(supporterId);
    if (index !== -1) {
        // Deselect
        game.tempSelections.cameraSelections.splice(index, 1);
    } else if (game.tempSelections.cameraSelections.length < 2) {
        // Select (max 2)
        game.tempSelections.cameraSelections.push(supporterId);
    }

    // Refresh modal
    const player = game.players[game.currentPlayer];
    const supporters = player.discard.filter(c => c.cardType === 'supporter');
    showCameraModal(player, supporters);
}

function confirmCameraSelection() {
    const player = game.players[game.currentPlayer];

    if (game.tempSelections.cameraSelections && game.tempSelections.cameraSelections.length > 0) {
        game.tempSelections.cameraSelections.forEach(supporterId => {
            const supporter = player.discard.find(c => c.id === supporterId);
            if (supporter) {
                player.deck.push(supporter);
                player.discard = player.discard.filter(c => c.id !== supporterId);
            }
        });
        game.shuffleDeck(game.currentPlayer);
        game.log(`Camera: Shuffled ${game.tempSelections.cameraSelections.length} supporter(s) into deck`, 'info');
    }

    // Clean up
    game.tempSelections.cameraSelections = [];

    // Discard Camera card
    const cameraCard = player.hand.find(c => c.name === 'Camera');
    if (cameraCard) {
        player.hand = player.hand.filter(c => c.id !== cameraCard.id);
        player.discard.push(cameraCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Character search modal
function showCharacterSearchModal(player, searchType) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let eligibleCharacters = player.deck.filter(c => c.cardType === 'character');

    if (searchType === 'low-hp') {
        eligibleCharacters = eligibleCharacters.filter(c => c.hp <= 100);
    }

    let html = `<h2>Search Deck for Character</h2>`;
    html += `<div class="target-selection">`;

    eligibleCharacters.forEach(char => {
        html += `<div class="target-option" onclick="selectSearchedCharacter('${char.id}')">
            ${char.name} (HP: ${char.hp})
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectSearchedCharacter(charId) {
    const player = game.players[game.currentPlayer];
    const char = player.deck.find(c => c.id === charId);

    if (char) {
        if (!canAddToBench(player)) {
            game.log('Steinert Practice Room: Bench limit is 2', 'info');
        } else {
        // Check if there's an empty bench slot
        const emptyBenchSlot = player.bench.indexOf(null);
        if (emptyBenchSlot !== -1) {
            player.bench[emptyBenchSlot] = char;
            player.deck = player.deck.filter(c => c.id !== charId);
            game.log(`Played ${char.name} to bench from deck`, 'info');
        } else {
            game.log('No empty bench slots', 'info');
        }
        }
    }

    // Discard the SE concert roster card
    const rosterCard = player.hand.find(c => c.name === 'SE concert roster');
    if (rosterCard) {
        player.hand = player.hand.filter(c => c.id !== rosterCard.id);
        player.discard.push(rosterCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Strawberry Matcha Latte: Heal selection modal
function showHealSelectionModal(player, healAmount) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Strawberry Matcha Latte</h2>`;
    html += `<p>Choose a character to heal ${healAmount} HP</p>`;
    html += `<div class="target-selection">`;

    if (player.active) {
        html += `<div class="target-option" onclick="healSelectedCharacter('active', ${healAmount})">
            ${player.active.name} (${player.active.damage || 0} damage)
        </div>`;
    }

    player.bench.forEach((char, idx) => {
        if (char) {
            html += `<div class="target-option" onclick="healSelectedCharacter(${idx}, ${healAmount})">
                ${char.name} (${char.damage || 0} damage)
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function healSelectedCharacter(target, healAmount) {
    const player = game.players[game.currentPlayer];
    const character = target === 'active' ? player.active : player.bench[target];

    if (character) {
        let finalHealAmount = healAmount;
        // Maid status bonus: +10 healing
        if (character.status && character.status.includes('Maid')) {
            finalHealAmount += 10;
        }
        // Petteruti Lounge/Matcha Maid Cafe bonus: +10 healing
        if (game.stadium && game.stadium.name === 'Petteruti Lounge') {
            finalHealAmount += 10;
        }
        character.damage = Math.max(0, (character.damage || 0) - finalHealAmount);
        game.log(`${character.name} healed ${finalHealAmount} HP`, 'heal');
    }

    // Discard the Strawberry Matcha Latte card
    const matchaCard = player.hand.find(c => c.name === 'Strawberry Matcha Latte');
    if (matchaCard) {
        player.hand = player.hand.filter(c => c.id !== matchaCard.id);
        player.discard.push(matchaCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Folding Stand: Energy shuffle modal
function showFoldingStandModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const energyCards = player.discard.filter(c => c.cardType === 'energy');
    if (energyCards.length === 0) {
        alert('No energy cards in discard pile!');
        closeModal('action-modal');
        return;
    }

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.foldingStandSelected = [];

    let html = `<h2>Folding Stand</h2>`;
    html += `<p>Select up to 3 energy cards to shuffle into your deck</p>`;
    html += `<div id="folding-stand-selection">`;

    energyCards.forEach(card => {
        html += `<div class="target-option" id="folding-${card.id}" onclick="toggleFoldingStandCard('${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="confirmFoldingStand()">Confirm Selection</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

// BUO Stand: Energy placement modal
function showBUOStandModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.buoStandTop = null;
    game.tempSelections.buoStandBottom = null;
    game.tempSelections.buoStandStage = 'top'; // 'top' or 'bottom'

    let html = `<h2>BUO Stand</h2>`;
    html += `<p id="buo-instruction">Select one energy from hand to put on TOP of deck</p>`;
    html += `<div id="buo-stand-selection">`;

    player.hand.filter(c => c.cardType === 'energy').forEach(card => {
        html += `<div class="target-option" onclick="selectBUOStandCard('${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleFoldingStandCard(cardId) {
    if (!game.tempSelections || !game.tempSelections.foldingStandSelected) return;
    const index = game.tempSelections.foldingStandSelected.indexOf(cardId);
    const element = document.getElementById(`folding-${cardId}`);

    if (index === -1 && game.tempSelections.foldingStandSelected.length < 3) {
        game.tempSelections.foldingStandSelected.push(cardId);
        if (element) element.classList.add('selected');
    } else if (index !== -1) {
        game.tempSelections.foldingStandSelected.splice(index, 1);
        if (element) element.classList.remove('selected');
    } else {
        alert('You can only select up to 3 cards.');
    }
}

function confirmFoldingStand() {
    const player = game.players[game.currentPlayer];
    const selected = game.tempSelections?.foldingStandSelected || [];

    selected.forEach(cardId => {
        const card = player.discard.find(c => c.id === cardId);
        if (card) {
            player.deck.push(card);
            player.discard = player.discard.filter(c => c.id !== cardId);
        }
    });

    game.shuffleDeck(game.currentPlayer);

    const foldingStand = player.hand.find(c => c.name === 'Folding Stand');
    if (foldingStand) {
        player.hand = player.hand.filter(c => c.id !== foldingStand.id);
        player.discard.push(foldingStand);
    }

    applyMusicStandUse(game.currentPlayer);

    closeModal('action-modal');
    updateUI();
}

function selectBUOStandCard(cardId) {
    const player = game.players[game.currentPlayer];

    if (game.tempSelections.buoStandStage === 'top') {
        game.tempSelections.buoStandTop = cardId;
        game.tempSelections.buoStandStage = 'bottom';

        // Update modal for bottom selection
        const instruction = document.getElementById('buo-instruction');
        instruction.textContent = 'Select one energy from hand to put on BOTTOM of deck';

        const selection = document.getElementById('buo-stand-selection');
        let html = '';
        player.hand.filter(c => c.cardType === 'energy' && c.id !== cardId).forEach(card => {
            html += `<div class="target-option" onclick="selectBUOStandCard('${card.id}')">
                ${card.name}
            </div>`;
        });
        selection.innerHTML = html;
    } else {
        // Bottom card selected, execute the effect
        game.tempSelections.buoStandBottom = cardId;

        const topCard = player.hand.find(c => c.id === game.tempSelections.buoStandTop);
        const bottomCard = player.hand.find(c => c.id === game.tempSelections.buoStandBottom);

        if (topCard && bottomCard) {
            player.hand = player.hand.filter(c => c.id !== topCard.id && c.id !== bottomCard.id);
            player.deck.unshift(topCard); // Add to top
            player.deck.push(bottomCard); // Add to bottom
            game.log(`Put ${topCard.name} on top and ${bottomCard.name} on bottom of deck`, 'info');
        }

        // Discard BUO Stand
        const buoStand = player.hand.find(c => c.name === 'BUO Stand');
        if (buoStand) {
            player.hand = player.hand.filter(c => c.id !== buoStand.id);
            player.discard.push(buoStand);
        }

        applyMusicStandUse(game.currentPlayer);

        closeModal('action-modal');
        updateUI();
    }
}

function applyMusicStandUse(playerNum) {
    const player = game.players[playerNum];
    const goonChars = [player.active, ...player.bench].filter(c => c && c.status && c.status.includes('Goon'));
    if (goonChars.length === 0) return;
    goonChars.forEach(char => {
        char.goonMusicStandBonus = (char.goonMusicStandBonus || 0) + 10;
        game.log(`Goon status: ${char.name} gains +10 damage from music stand`, 'info');
    });
}

// Ice Skates: Player switch modal
function showPlayerSwitchModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Ice Skates</h2>`;
    html += `<p>Select a benched character to switch with your active</p>`;
    html += `<div class="target-selection">`;

    player.bench.forEach((char, idx) => {
        if (char) {
            html += `<div class="target-option" onclick="switchWithBench(${idx})">
                ${char.name}
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function switchWithBench(benchIndex) {
    const player = game.players[game.currentPlayer];

    if (player.active && player.bench[benchIndex]) {
        const temp = player.active;
        player.active = player.bench[benchIndex];
        player.bench[benchIndex] = temp;
        game.log(`Switched ${player.active.name} into active slot`, 'info');
    }

    // Discard Ice Skates
    const iceSkates = player.hand.find(c => c.name === 'Ice Skates');
    if (iceSkates) {
        player.hand = player.hand.filter(c => c.id !== iceSkates.id);
        player.discard.push(iceSkates);
    }

    closeModal('action-modal');
    updateUI();
}

// Concert Roster: Character search and bench modal
function showConcertRosterModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const characters = player.deck.filter(c => c.cardType === 'character');
    if (characters.length === 0) {
        game.log('No characters in deck', 'info');
        const rosterCard = player.hand.find(c => c.name === 'Concert Roster');
        if (rosterCard) {
            player.hand = player.hand.filter(c => c.id !== rosterCard.id);
            player.discard.push(rosterCard);
        }
        updateUI();
        return;
    }

    let html = `<h2>Concert Roster</h2>`;
    html += `<p>Search for a character to place on your bench</p>`;
    html += `<div class="target-selection">`;

    characters.forEach(char => {
        html += `<div class="target-option" onclick="selectConcertRosterCharacter('${char.id}')">
            ${char.name} (${char.type.join('/')}) - ${char.hp} HP
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectConcertRosterCharacter(charId) {
    const player = game.players[game.currentPlayer];
    const char = player.deck.find(c => c.id === charId);

    if (char) {
        if (!canAddToBench(player)) {
            game.log('Steinert Practice Room: Bench limit is 2', 'info');
        } else {
        const emptyBenchSlot = player.bench.indexOf(null);
        if (emptyBenchSlot !== -1) {
            player.bench[emptyBenchSlot] = char;
            player.deck = player.deck.filter(c => c.id !== charId);
            game.log(`Placed ${char.name} on bench from deck`, 'info');
        } else {
            game.log('No empty bench slots', 'error');
        }
        }
    }

    // Discard Concert Roster
    const rosterCard = player.hand.find(c => c.name === 'Concert Roster');
    if (rosterCard) {
        player.hand = player.hand.filter(c => c.id !== rosterCard.id);
        player.discard.push(rosterCard);
    }

    closeModal('action-modal');
    updateUI();
}

// Victoria Chen: Type selection modal
function showVictoriaTypeSelectionModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    // Get available types in deck
    const allChars = player.deck.filter(c => c.cardType === 'character');
    const availableTypes = [...new Set(allChars.flatMap(c => c.type))];

    let html = `<h2>Victoria Chen - Section Leader</h2>`;
    html += `<p>Choose a type to search for up to 3 characters</p>`;
    html += `<div class="target-selection">`;

    availableTypes.forEach(type => {
        const count = allChars.filter(c => c.type.includes(type)).length;
        html += `<div class="target-option" onclick="selectVictoriaType('${type}')">
            ${type} (${count} available)
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectVictoriaType(chosenType) {
    const player = game.players[game.currentPlayer];

    // Get all characters of chosen type
    const matchingChars = player.deck.filter(c =>
        c.cardType === 'character' && c.type.includes(chosenType)
    );

    if (matchingChars.length === 0) {
        game.log(`No ${chosenType} characters found in deck`, 'info');
        closeModal('action-modal');
        updateUI();
        return;
    }

    // Show character selection modal (up to 3)
    showVictoriaCharacterSelectionModal(player, matchingChars, chosenType);
}

function showVictoriaCharacterSelectionModal(player, characters, type) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    // Store selected characters
    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.victoriaSelected = [];
    game.tempSelections.victoriaPlayer = player;

    let html = `<h2>Victoria Chen - Select Characters</h2>`;
    html += `<p>Select up to 3 ${type} characters to place on bench</p>`;
    html += `<div id="victoria-selection">`;

    characters.forEach(char => {
        html += `<div class="target-option" id="victoria-char-${char.id}" onclick="toggleVictoriaCharacter('${char.id}')">
            ${char.name} (HP: ${char.hp})
        </div>`;
    });

    html += `</div>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="confirmVictoriaSelection()">Confirm Selection</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleVictoriaCharacter(charId) {
    const element = document.getElementById(`victoria-char-${charId}`);

    if (!game.tempSelections.victoriaSelected) game.tempSelections.victoriaSelected = [];

    const index = game.tempSelections.victoriaSelected.indexOf(charId);
    if (index > -1) {
        // Deselect
        game.tempSelections.victoriaSelected.splice(index, 1);
        element.classList.remove('selected');
    } else {
        // Select (if under limit)
        if (game.tempSelections.victoriaSelected.length < 3) {
            game.tempSelections.victoriaSelected.push(charId);
            element.classList.add('selected');
        } else {
            game.log('Maximum 3 characters can be selected', 'info');
        }
    }
}

function confirmVictoriaSelection() {
    const player = game.players[game.currentPlayer];

    if (!game.tempSelections.victoriaSelected || game.tempSelections.victoriaSelected.length === 0) {
        game.log('No characters selected', 'info');
        closeModal('action-modal');
        updateUI();
        return;
    }

    // Place selected characters on bench
    game.tempSelections.victoriaSelected.forEach(charId => {
        const char = player.deck.find(c => c.id === charId);
        if (char) {
            if (!canAddToBench(player)) {
                game.log('Steinert Practice Room: Bench limit is 2', 'info');
                return;
            }
            const emptySlot = player.bench.findIndex(slot => slot === null);
            if (emptySlot !== -1) {
                player.bench[emptySlot] = char;
                player.deck = player.deck.filter(c => c.id !== charId);
                game.log(`Placed ${char.name} on bench`, 'info');
            } else {
                game.log('No more empty bench slots', 'info');
            }
        }
    });

    game.shuffleDeck(game.currentPlayer);
    game.log(`Victoria Chen: Selected ${game.tempSelections.victoriaSelected.length} characters`, 'info');

    // Clean up
    delete game.tempSelections.victoriaSelected;

    // Discard the Victoria Chen supporter card
    const victoriaCard = player.hand.find(c => c.name === 'Victoria Chen');
    if (victoriaCard) {
        player.hand = player.hand.filter(c => c.id !== victoriaCard.id);
        player.discard.push(victoriaCard);
    }
    game.supporterPlayedThisTurn = true;

    closeModal('action-modal');
    updateUI();
}

// Lucas: Small Ensemble - Select up to 2 characters of different types
function showLucasSelectionModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    // Get types currently on board (active + bench)
    const boardTypes = new Set();
    if (player.active) {
        player.active.type.forEach(t => boardTypes.add(t));
    }
    player.bench.forEach(char => {
        if (char) {
            char.type.forEach(t => boardTypes.add(t));
        }
    });

    // Find eligible characters (no shared types with board)
    const eligibleChars = player.deck.filter(c => {
        if (c.cardType !== 'character') return false;
        // Check if this character shares any type with board
        return !c.type.some(t => boardTypes.has(t));
    });

    if (eligibleChars.length === 0) {
        game.log('No eligible characters in deck (all share types with board)', 'info');
        const lucasCard = player.hand.find(c => c.name === 'Lucas');
        if (lucasCard) {
            player.hand = player.hand.filter(c => c.id !== lucasCard.id);
            player.discard.push(lucasCard);
        }
        game.supporterPlayedThisTurn = true;
        updateUI();
        return;
    }

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.lucasSelected = [];

    let html = `<h2>Lucas - Small Ensemble</h2>`;
    html += `<p>Choose up to 2 characters of different types (${game.tempSelections.lucasSelected.length}/2 selected)</p>`;
    html += `<div class="target-selection">`;

    eligibleChars.forEach(char => {
        html += `<div class="target-option" id="lucas-char-${char.id}" onclick="toggleLucasCharacter('${char.id}')">
            ${char.name} (${char.type.join('/')}) - HP: ${char.hp}
        </div>`;
    });

    html += `</div>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="confirmLucasSelection()">Confirm Selection</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleLucasCharacter(charId) {
    const player = game.players[game.currentPlayer];
    const char = player.deck.find(c => c.id === charId);
    const element = document.getElementById(`lucas-char-${charId}`);

    if (!game.tempSelections.lucasSelected) game.tempSelections.lucasSelected = [];
can
    const index = game.tempSelections.lucasSelected.findIndex(id => id === charId);
    if (index > -1) {
        // Deselect
        game.tempSelections.lucasSelected.splice(index, 1);
        element.classList.remove('selected');
    } else {
        // Check if we can select (max 2, and must be different type)
        if (game.tempSelections.lucasSelected.length >= 2) {
            game.log('Maximum 2 characters can be selected', 'info');
            return;
        }

        // Check if this type is already selected
        const selectedTypes = new Set();
        game.tempSelections.lucasSelected.forEach(id => {
            const selectedChar = player.deck.find(c => c.id === id);
            if (selectedChar) {
                selectedChar.type.forEach(t => selectedTypes.add(t));
            }
        });

        const sharesType = char.type.some(t => selectedTypes.has(t));
        if (sharesType) {
            game.log('Selected characters must be of different types', 'info');
            return;
        }

        // Select
        game.tempSelections.lucasSelected.push(charId);
        element.classList.add('selected');
    }

    // Refresh modal
    showLucasSelectionModal(player);
}

function confirmLucasSelection() {
    const player = game.players[game.currentPlayer];

    if (!game.tempSelections.lucasSelected || game.tempSelections.lucasSelected.length === 0) {
        game.log('No characters selected', 'info');
    } else {
        // Place selected characters on bench
        game.tempSelections.lucasSelected.forEach(charId => {
            const char = player.deck.find(c => c.id === charId);
            if (char) {
                if (!canAddToBench(player)) {
                    game.log('Steinert Practice Room: Bench limit is 2', 'info');
                    return;
                }
                const emptyBenchSlot = player.bench.indexOf(null);
                if (emptyBenchSlot !== -1) {
                    player.bench[emptyBenchSlot] = char;
                    player.deck = player.deck.filter(c => c.id !== charId);
                    game.log(`Lucas: Placed ${char.name} on bench`, 'info');
                } else {
                    game.log('No empty bench slots', 'error');
                }
            }
        });
    }

    delete game.tempSelections.lucasSelected;

    // Discard the Lucas supporter card
    const lucasCard = player.hand.find(c => c.name === 'Lucas');
    if (lucasCard) {
        player.hand = player.hand.filter(c => c.id !== lucasCard.id);
        player.discard.push(lucasCard);
    }
    game.supporterPlayedThisTurn = true;

    closeModal('action-modal');
    updateUI();
}

// Energy selection from hand modal (for Vocal warmups, 440 Hz, etc.)
function showHandEnergySelectionModal(player, targetChar, energyCards) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.energyPlayer = player;

    let html = `<h2>Select Energy to Attach</h2>`;
    html += `<p>Choose an energy card from your hand to attach to ${targetChar.name}</p>`;
    html += `<div class="target-selection">`;

    energyCards.forEach(energy => {
        html += `<div class="target-option" onclick="attachEnergyFromHand('${energy.id}', '${targetChar.id}')">
            ${energy.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function enforceBarronGetServed(affectedPlayerNum) {
    const affectedPlayer = game.players[affectedPlayerNum];

    [affectedPlayer.active, ...affectedPlayer.bench].filter(c => c).forEach(char => {
        if (char.attachedEnergy && char.attachedEnergy.length > 3) {
            const excess = char.attachedEnergy.length - 3;
            for (let i = 0; i < excess; i++) {
                const discardedEnergy = char.attachedEnergy.pop();
                affectedPlayer.discard.push(discardedEnergy);
            }
            game.log(`Barron Lee's Get Served: Discarded ${excess} energy from ${char.name}`, 'info');
        }
    });
}

function attachEnergyFromHand(energyId, targetId) {
    const player = game.players[game.currentPlayer];
    const energy = player.hand.find(c => c.id === energyId);
    const target = [player.active, ...player.bench].find(c => c && c.id === targetId);

    if (energy && target) {
        if (!target.attachedEnergy) target.attachedEnergy = [];
        target.attachedEnergy.push(energy);
        player.hand = player.hand.filter(c => c.id !== energyId);
        game.log(`Attached ${energy.name} to ${target.name}`, 'info');
    }

    closeModal('action-modal');
    updateUI();
}

// 440 Hz: Select energy from hand and benched character to attach to
function show440HzSelectionModal(player, energyCards, benchedChars) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.hz440Energy = null;
    game.tempSelections.hz440Target = null;
    game.tempSelections.hz440Player = player;

    let html = `<h2>440 Hz - Select Target</h2>`;
    html += `<p>Select a benched character to attach 1 energy.</p>`;
    html += `<div id="hz440-target-selection">`;

    benchedChars.forEach(char => {
        html += `<div class="target-option" id="hz440-target-${char.id}" onclick="select440HzTarget('${char.id}')">
            ${char.name} (HP: ${char.hp - (char.damage || 0)}/${char.hp})
        </div>`;
    });

    html += `</div>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="confirm440HzSelection()">Confirm</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function select440HzEnergy(energyId) {
    // No-op (energy cards removed)
    game.tempSelections.hz440Energy = energyId;
}

function select440HzTarget(targetId) {
    // Deselect previous
    if (game.tempSelections.hz440Target) {
        const prevElement = document.getElementById(`hz440-target-${game.tempSelections.hz440Target}`);
        if (prevElement) prevElement.classList.remove('selected');
    }

    game.tempSelections.hz440Target = targetId;
    const element = document.getElementById(`hz440-target-${targetId}`);
    if (element) element.classList.add('selected');
}

function confirm440HzSelection() {
    const player = game.players[game.currentPlayer];
    const target = player.bench.find(c => c && c.id === game.tempSelections.hz440Target);

    if (!target) {
        game.log('Must select a benched character');
        return;
    }

    if (!target.attachedEnergy) target.attachedEnergy = [];
    target.attachedEnergy.push({ generic: true });
    game.log(`440 Hz: Attached 1 energy to ${target.name}`, 'info');

    delete game.tempSelections.hz440Energy;
    delete game.tempSelections.hz440Target;

    closeModal('action-modal');
    updateUI();
}

// Arrangement procrastination: Switch active with benched character
function showArrangementProcrastinationModal(player, benchChars) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.apPlayer = player;

    let html = `<h2>Arrangement Procrastination</h2>`;
    html += `<p>Switch your active character with a benched character</p>`;
    html += `<div class="target-selection">`;

    benchChars.forEach(char => {
        html += `<div class="target-option" onclick="switchArrangementProcrastination('${char.id}')">
            ${char.name} (HP: ${char.hp - (char.damage || 0)}/${char.hp})
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function switchArrangementProcrastination(benchCharId) {
    const player = game.players[game.currentPlayer];
    const benchIndex = player.bench.findIndex(c => c && c.id === benchCharId);

    if (benchIndex !== -1 && player.active) {
        const temp = player.active;
        player.active = player.bench[benchIndex];
        player.bench[benchIndex] = temp;
        game.log(`Switched ${player.active.name} to active position`, 'info');
    }

    closeModal('action-modal');
    updateUI();
}

// Percussion Ensemble: Attach up to 3 percussion energy to percussionists
function showPercussionEnsembleModal(player, energyCards, percussionists) {
    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.peEnergies = energyCards.map(e => e.id);
    game.tempSelections.peIndex = 0;
    game.tempSelections.pePlayer = player;

    showPercussionEnsembleEnergyAttachment(percussionists);
}

function showPercussionEnsembleEnergyAttachment(percussionists) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (game.tempSelections.peIndex >= game.tempSelections.peEnergies.length) {
        // Done attaching all energies
        game.log(`Percussion Ensemble: Attached ${game.tempSelections.peEnergies.length} energy cards`);
        delete game.tempSelections.peEnergies;
        delete game.tempSelections.peIndex;
        delete game.tempSelections.pePlayer;
        closeModal('action-modal');
        game.shuffleDeck(game.currentPlayer);
        updateUI();
        return;
    }

    let html = `<h2>Percussion Ensemble</h2>`;
    html += `<p>Energy ${game.tempSelections.peIndex + 1} of ${game.tempSelections.peEnergies.length}: Select percussionist</p>`;
    html += `<div class="target-selection">`;

    percussionists.forEach(char => {
        html += `<div class="target-option" onclick="attachPercussionEnsembleEnergy('${char.id}')">
            ${char.name} (HP: ${char.hp - (char.damage || 0)}/${char.hp})
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="skipPercussionEnsemble()">Skip Remaining</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function attachPercussionEnsembleEnergy(targetId) {
    const player = game.players[game.currentPlayer];
    const energyId = game.tempSelections.peEnergies[game.tempSelections.peIndex];
    const energy = player.deck.find(c => c.id === energyId);
    const target = [player.active, ...player.bench].find(c => c && c.id === targetId);

    if (energy && target) {
        if (!target.attachedEnergy) target.attachedEnergy = [];
        target.attachedEnergy.push(energy);
        player.deck = player.deck.filter(c => c.id !== energyId);
        game.log(`Attached ${energy.name} to ${target.name}`, 'info');
    }

    game.tempSelections.peIndex++;

    // Get updated percussionist list
    const percussionists = [player.active, ...player.bench].filter(c =>
        c && c.type.includes(TYPES.PERCUSSION)
    );

    showPercussionEnsembleEnergyAttachment(percussionists);
}

function skipPercussionEnsemble() {
    game.log('Percussion Ensemble: Skipped remaining energy attachments');
    delete game.tempSelections.peEnergies;
    delete game.tempSelections.peIndex;
    delete game.tempSelections.pePlayer;
    closeModal('action-modal');
    game.shuffleDeck(game.currentPlayer);
    updateUI();
}

// SATB: Target selection for each choir character
function showSATBTargetSelection(opponent) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const allOpponentChars = [opponent.active, ...opponent.bench].filter(c => c);

    if (allOpponentChars.length === 0) {
        game.log('No opponent characters to target', 'info');
        closeModal('action-modal');
        updateUI();
        return;
    }

    let html = `<h2>SATB - Choose Target</h2>`;
    html += `<p>Hits remaining: ${game.tempSelections.satbHitsRemaining}</p>`;
    html += `<p>Choose an opponent's character to deal 20 damage</p>`;
    html += `<div class="target-selection">`;

    allOpponentChars.forEach(char => {
        const isActive = char === opponent.active;
        html += `<div class="target-option" onclick="selectSATBTarget('${char.id}')">
            ${char.name}${isActive ? ' (Active)' : ' (Bench)'} - HP: ${char.hp - (char.damage || 0)}/${char.hp}
        </div>`;
    });

    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectSATBTarget(targetId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    // Find the target
    const target = [opponent.active, ...opponent.bench].find(c => c && c.id === targetId);

    if (target) {
        game.dealDamage(target, 20);
        game.log(`SATB hit ${target.name} for 20 damage`, 'damage');

        game.tempSelections.satbHitsRemaining--;

        if (game.tempSelections.satbHitsRemaining > 0) {
            // Show selection again for next hit
            showSATBTargetSelection(opponent);
        } else {
            // Done with all hits
            delete game.tempSelections.satbHitsRemaining;
            delete game.tempSelections.satbAttacker;
            closeModal('action-modal');
            updateUI();
        }
    }
}

// You know what it is: Select any opponent character for 70 damage
function showYouKnowWhatItIsTargetSelection(opponent, attacker) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const allOpponentChars = [opponent.active, ...opponent.bench].filter(c => c);

    let html = `<h2>You know what it is</h2>`;
    html += `<p>Choose any opponent character to deal 70 damage:</p>`;
    html += `<div class="target-selection">`;

    allOpponentChars.forEach(char => {
        const currentHp = char.hp - (char.damage || 0);
        html += `<div class="target-option" onclick="selectYouKnowWhatItIsTarget('${char.id}', '${attacker.id}')">
            ${char.name} - ${currentHp}/${char.hp} HP
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectYouKnowWhatItIsTarget(targetId, attackerId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const player = game.players[game.currentPlayer];

    const target = [opponent.active, ...opponent.bench].find(c => c && c.id === targetId);
    const attacker = [player.active, ...player.bench].find(c => c && c.id === attackerId);

    if (target && attacker) {
        const move = { name: 'You know what it is', damage: 70 };
        const damage = calculateDamage(attacker, target, 70, move);
        game.dealDamage(target, damage);
        game.log(`You know what it is: ${damage} damage to ${target.name}!`, 'damage');
    }

    closeModal('action-modal');
    updateUI();
}

function playSupporter(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (!card || (game.supporterPlayedThisTurn && !game.playtestMode)) return;

    if (!canPlayCardThisTurn()) {
        game.log('Main Hall: Cannot play more than 3 cards per turn', 'info');
        return;
    }

    game.cardsPlayedThisTurn++;

    // Implement specific supporter effects - returns true if we should wait for modal
    const waitForModal = executeSupporterEffect(card);

    // If we need to wait for modal input, don't discard yet
    if (waitForModal) {
        return;
    }

    player.hand = player.hand.filter(c => c.id !== cardId);
    player.discard.push(card);
    if (!game.playtestMode) {
        game.supporterPlayedThisTurn = true;
    }

    closeModal('action-modal');
    updateUI();
}

function executeSupporterEffect(card) {
    const player = game.players[game.currentPlayer];
    const opponent = game.players[game.currentPlayer === 1 ? 2 : 1];

    game.log(`Played supporter: ${card.name}`, 'info');

    switch(card.name) {
        case 'Johann':
            // Retrieve one of each type from discard - chain selections
            selectFromDiscard(player, 'supporter', () => {
                selectFromDiscard(player, 'item', () => {
                    selectFromDiscard(player, 'stadium', () => {
                        // All selections done, discard Johann
                        const johannCard = player.hand.find(c => c.name === 'Johann');
                        if (johannCard) {
                            player.hand = player.hand.filter(c => c.id !== johannCard.id);
                            player.discard.push(johannCard);
                        }
                        game.supporterPlayedThisTurn = true;
                        updateUI();
                    });
                });
            });
            return true; // Wait for modal

        case 'Richard':
            // Put all character cards from discard to hand, end turn
            const characters = player.discard.filter(c => c.cardType === 'character');
            characters.forEach(char => {
                player.hand.push(char);
                player.discard = player.discard.filter(c => c.id !== char.id);
            });
            game.log(`Retrieved ${characters.length} characters from discard. Turn ends.`, 'info');
            // Turn will end after this
            setTimeout(() => {
                game.switchPlayer();
                game.drawCards(game.currentPlayer, 1);
                updateUI();
            }, 1000);
            break;

        case 'Michelle':
            // Discord Announcement: Opponent discards down to 2 cards in hand
            if (opponent.hand.length > 2) {
                const discardCount = opponent.hand.length - 2;
                const opponentNum = game.currentPlayer === 1 ? 2 : 1;
                showOpponentDiscardChoice(opponentNum, discardCount);
                return true; // Wait for modal
            } else {
                game.log(`Michelle's Discord Announcement: Opponent already has 2 or fewer cards in hand`, 'info');
            }
            break;

        case 'Will':
            // Shuffle items from discard into deck
            const items = player.discard.filter(c => c.cardType === 'item' || c.cardType === 'tool');
            items.forEach(item => {
                player.deck.push(item);
                player.discard = player.discard.filter(c => c.id !== item.id);
            });
            game.shuffleDeck(game.currentPlayer);
            game.log(`Shuffled ${items.length} items from discard into deck`, 'info');
            break;

        case 'Lucas':
            // Small Ensemble: Search for up to 2 characters of different types that share no types with board
            showLucasSelectionModal(player);
            return true; // Wait for modal

        case 'Angel':
            // Give all characters Goon status
            const allCharsForGoon = [player.active, ...player.bench].filter(c => c);
            allCharsForGoon.forEach(char => {
                if (!char.status) char.status = [];
                if (!char.status.includes('Goon')) {
                    char.status.push('Goon');
                    game.log(`${char.name} gained Goon status`, 'info');
                }
            });
            break;

        case 'Lio':
            // Shuffle hand into deck, draw 6
            const handCount = player.hand.length;
            player.deck.push(...player.hand);
            player.hand = [];
            game.shuffleDeck(game.currentPlayer);
            game.drawCards(game.currentPlayer, 6);
            game.log(`Shuffled ${handCount} cards into deck, drew 6 cards`, 'info');
            break;

        case 'Emma':
            // Switch opponent's active with one of their benched characters
            if (opponent.bench.some(slot => slot !== null)) {
                const benchedChars = opponent.bench.filter(c => c);
                const targetName = prompt(`Choose which of opponent's benched characters to switch with their active:\n${benchedChars.map(c => c.name).join(', ')}`);
                const target = benchedChars.find(c => c.name === targetName);
                if (target) {
                    const benchIndex = opponent.bench.indexOf(target);
                    const temp = opponent.active;
                    opponent.active = opponent.bench[benchIndex];
                    opponent.bench[benchIndex] = temp;
                    game.log(`Emma: Switched opponent's ${opponent.active.name} to active`, 'info');
                }
            } else {
                game.log('Emma: Opponent has no benched characters', 'info');
            }
            break;

        case 'Victoria Chen':
            // Search for up to 3 characters of chosen type
            showVictoriaTypeSelectionModal(player);
            return true; // Wait for modal

        default:
            game.log(`${card.name} effect not yet implemented`, 'info');
    }

    return false; // Don't wait for modal
}

function playStadium(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (!card) return;

    // Check if BAI Email prevents playing stadiums this turn
    if (game.nextTurnEffects[game.currentPlayer].cannotPlayStadium) {
        alert('Cannot play stadiums this turn (BAI Email effect)');
        game.log('Cannot play stadiums this turn (BAI Email effect)', 'error');
        return;
    }

    if (!canPlayCardThisTurn()) {
        game.log('Main Hall: Cannot play more than 3 cards per turn', 'info');
        return;
    }

    game.cardsPlayedThisTurn++;

    // Discard old stadium if exists
    if (game.stadium) {
        player.discard.push(game.stadium);
    }

    game.stadium = card;
    game.mainHallActivatedTurn = card.name === 'Main Hall' ? game.turn : null;
    player.hand = player.hand.filter(c => c.id !== cardId);
    game.log(`Played stadium: ${card.name}`);

    // Alumnae Hall: Both players discard all items when played
    if (card.name === 'Alumnae Hall') {
        [1, 2].forEach(playerNum => {
            const p = game.players[playerNum];
            const itemsInHand = p.hand.filter(c => c.cardType === 'item');
            if (itemsInHand.length > 0) {
                itemsInHand.forEach(item => p.discard.push(item));
                p.hand = p.hand.filter(c => c.cardType !== 'item');
                game.log(`Player ${playerNum}: Discarded ${itemsInHand.length} item(s) from hand`, 'info');
            }
        });
    }

    if (card.name === 'Steinert Practice Room') {
        const opponentNum = game.currentPlayer === 1 ? 2 : 1;
        queueSteinertPracticeDiscards([game.currentPlayer, opponentNum]);
    }

    if (!(game.tempSelections && game.tempSelections.steinertPracticeQueue && game.tempSelections.steinertPracticeQueue.length > 0)) {
        closeModal('action-modal');
        updateUI();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');

    if (modalId === 'action-modal' && game.tempSelections && game.tempSelections.photographTempItemId) {
        const player = game.players[game.currentPlayer];
        player.hand = player.hand.filter(c => c.id !== game.tempSelections.photographTempItemId);
        delete game.tempSelections.photographTempItemId;
        delete game.tempSelections.photographSelected;
        delete game.tempSelections.photographItems;
        delete game.tempSelections.photographOpponentNum;
    }

    if (modalId === 'action-modal' && game.tempSelections && game.tempSelections.foresightPending) {
        const cards = game.tempSelections.foresightOriginal;
        const opponent = game.tempSelections.foresightOpponent;
        if (cards && opponent) {
            opponent.deck.unshift(...cards);
        }
        delete game.tempSelections.foresightCards;
        delete game.tempSelections.foresightOriginal;
        delete game.tempSelections.foresightOpponent;
        delete game.tempSelections.foresightPending;
    }

    if (modalId === 'action-modal' && game.tempSelections && game.tempSelections.drumKidWorkshopPendingTransfer) {
        const { sourceId, attackerId } = game.tempSelections.drumKidWorkshopPendingTransfer;
        const allChars = [
            ...game.players[1].active ? [game.players[1].active] : [],
            ...game.players[1].bench.filter(c => c),
            ...game.players[2].active ? [game.players[2].active] : [],
            ...game.players[2].bench.filter(c => c)
        ];

        const source = allChars.find(c => c.id === sourceId);
        const attacker = allChars.find(c => c.id === attackerId);

        if (source && attacker && attacker.attachedEnergy && attacker.attachedEnergy.length > 0) {
            const energyToTransfer = [...attacker.attachedEnergy];
            attacker.attachedEnergy = [];
            if (!source.attachedEnergy) source.attachedEnergy = [];
            source.attachedEnergy.push(...energyToTransfer);
            game.log(`Drum Kid Workshop: Transferred ${energyToTransfer.length} energy to ${source.name}`, 'info');
        }

        delete game.tempSelections.drumKidWorkshopPendingTransfer;
        updateUI();
    }

    if (modalId === 'action-modal') {
        game.lastAttackSource = null;
    }

    if (modalId === 'action-modal' && game.tempSelections && game.tempSelections.pendingEndTurn && game.tempSelections.opponentDiscardCount) {
        game.tempSelections.pendingEndTurn = false;
        game.tempSelections = {};
        endTurn();
    }

    if (modalId === 'action-modal' && game.pendingAttackEndTurn) {
        game.pendingAttackEndTurn = false;
        if (game.pendingAttackAttackerId) {
            const player = game.players[game.currentPlayer];
            const attacker = [player.active, ...player.bench].find(c => c && c.id === game.pendingAttackAttackerId);
            if (attacker) {
                attacker.lastAttackTurn = game.turn;
            }
            game.pendingAttackAttackerId = null;
        }
        endTurn();
    }
}

// Attack System
function showAttackMenu(cardId) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;

    if (!attacker || attacker.id !== cardId) {
        alert('This character must be active to attack!');
        return;
    }

    // Player 1 cannot attack on their first turn (like Pokémon TCG)
    if (game.isFirstTurn && game.currentPlayer === 1) {
        alert('Player 1 cannot attack on their first turn!');
        game.log('Cannot attack: Player 1 cannot attack on their first turn', 'warning');
        closeModal('action-modal');
        return;
    }

    // Check for Meya Gao's I See Your Soul - cannot attack
    if (game.nextTurnEffects[game.currentPlayer].cannotAttack) {
        alert('Cannot attack this turn due to Meya Gao\'s I See Your Soul!');
        game.log('Cannot attack: Meya Gao\'s I See Your Soul is active', 'warning');
        game.nextTurnEffects[game.currentPlayer].cannotAttack = false;
        closeModal('action-modal');
        return;
    }

    // Check for Luke Xu's Nullify - opponent abilities disabled
    if (abilitiesDisabledFor(game.currentPlayer)) {
        game.log('Luke Xu\'s Nullify: Opponent abilities are disabled this turn!', 'info');
    }

    if (game.attackedThisTurn) {
        alert('You have already attacked this turn!');
        closeModal('action-modal');
        return;
    }

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>${attacker.name} - Select Move</h2>`;
    html += `<div class="action-buttons">`;

    // Show available moves
    let allMoves = attacker.moves ? [...attacker.moves] : [];

    // Ross Williams' I Am Become Ross - Active can use Ross's moves from bench
    const rossOnBench = player.bench.find(c => c && c.name === 'Ross Williams');
    if (!abilitiesDisabledFor(game.currentPlayer) && rossOnBench && rossOnBench.moves) {
        html += `<p style="color: #4CAF50; font-style: italic;">+ Ross's moves available (I Am Become Ross)</p>`;
        rossOnBench.moves.forEach(move => {
            allMoves.push({...move, isRossMove: true});
        });
    }

    if (allMoves.length > 0) {
        allMoves.forEach((move, idx) => {
            const canUse = canUseMove(attacker, move);
            const disabled = canUse ? '' : 'disabled';
            const rossLabel = move.isRossMove ? ' (Ross)' : '';
            const energyCost = getMoveEnergyCost(move);
            const costStr = energyCost > 0 ? energyCost.toString() : '0';
            html += `<button class="action-btn" ${disabled} onclick="selectMove('${cardId}', ${idx})">${move.name}${rossLabel} [${costStr}] - ${move.damage || 0} dmg</button>`;
        });
    } else {
        html += `<p>No moves available</p>`;
    }

    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function getEffectiveRetreatCost(character) {
    let cost = character.retreatCost || 0;

    // Kiki's Headband: -1 retreat cost
    if (character.attachedTools && character.attachedTools.some(t => t.name === "Kiki's Headband")) {
        cost = Math.max(0, cost - 1);
    }

    // Conductor status: double retreat cost
    if (character.status && character.status.includes('Conductor')) {
        cost *= 2;
    }

    // Goon status: double retreat cost
    if (character.status && character.status.includes('Goon')) {
        cost *= 2;
    }

    // Petteruti Lounge: Maids have no retreat cost
    if (game.stadium && game.stadium.name === 'Petteruti Lounge' && character.status && character.status.includes('Maid')) {
        cost = 0;
    }

    return cost;
}

function canUseMove(character, move) {
    // Move cost is now just a number representing total energy needed
    const requiredEnergy = getMoveEnergyCost(move);
    if (requiredEnergy === 0) return true;

    // Glissando lockout: cannot use on your next turn
    if (move.name === 'Glissando' && character.cantUseGlissandoTurn) {
        if (game.turn === character.cantUseGlissandoTurn) {
            return false;
        }
        if (game.turn > character.cantUseGlissandoTurn) {
            character.cantUseGlissandoTurn = null;
        }
    }

    // Count attached energy
    const attachedEnergy = character.attachedEnergy ? character.attachedEnergy.length : 0;

    // Add Otamatone bonus energy
    let bonusEnergy = 0;
    if (game.attackModifiers[game.currentPlayer].otamatoneBonus) {
        bonusEnergy = game.attackModifiers[game.currentPlayer].otamatoneBonus;
    }

    // Check if we have enough total energy (including bonus)
    const totalEnergy = attachedEnergy + bonusEnergy;
    return totalEnergy >= requiredEnergy;
}

function getMoveEnergyCost(move) {
    const baseCost = Array.isArray(move.cost) ? move.cost.length : (move.cost || 0);
    let extraCost = (game.stadium && (game.stadium.name === 'Steinert Basement Studio' || game.stadium.name === 'Steinert Practice Room')) ? 1 : 0;
    const currentPlayer = game.players[game.currentPlayer];
    const active = currentPlayer && currentPlayer.active;
    if (active && active.name === 'Demi Lu') {
        extraCost = 0;
    }
    let cost = baseCost + extraCost;

    if (game.stadium && game.stadium.name === 'Lindemann Big Practice Room') {
        const benchChars = currentPlayer.bench.filter(c => c);
        if (active) {
            const allMatch = benchChars.every(char => char.type.some(t => active.type.includes(t)));
            if (allMatch) {
                cost = Math.max(0, cost - 1);
            }
        }
    }

    return cost;
}

function selectMove(cardId, moveIndex) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;

    // Build combined move list (including Ross's moves if applicable)
    let allMoves = attacker.moves ? [...attacker.moves] : [];
    const rossOnBench = player.bench.find(c => c && c.name === 'Ross Williams');
    if (!abilitiesDisabledFor(game.currentPlayer) && rossOnBench && rossOnBench.moves) {
        rossOnBench.moves.forEach(move => {
            allMoves.push({...move, isRossMove: true});
        });
    }

    const move = allMoves[moveIndex];

    // Validate energy cost
    if (!canUseMove(attacker, move)) {
        if (move.name === 'Glissando' && attacker.cantUseGlissandoTurn === game.turn) {
            alert('Glissando cannot be used this turn.');
        } else {
            const requiredEnergy = getMoveEnergyCost(move);
            alert(`Not enough energy! This move requires ${requiredEnergy} energy (you have ${attacker.attachedEnergy.length})`);
        }
        closeModal('action-modal');
        return;
    }

    closeModal('action-modal');

    // Check if this move needs target selection
    // Moves that don't need targets: self-buffs, team effects, etc.
    const noTargetMoves = [
        'Turn Up!',
        'Vocal warmups',
        'Percussion Ensemble',
        'Personal use',
        'Arrangement procrastination',
        'Artist Alley',
        'Snap Pizz'
    ];

    if (noTargetMoves.includes(move.name)) {
        // Execute attack without target (pass null for target)
        executeAttack(attacker.id, move.name, null);
    } else {
        // Show target selection for moves that need it
        showTargetSelection(attacker, move);
    }
}

function showTargetSelection(attacker, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    // Check if this move can target bench (like Pokemon TCG, only certain movecans can)
    const benchTargetingMoves = ['Small Ensemble Committee', 'Jennie spread attack', 'Rudiments', 'You know what it is'];
    const canTargetBench = benchTargetingMoves.includes(move.name);

    let html = `<h2>Select Target for ${move.name}</h2>`;
    html += `<div class="target-selection">`;

    const targets = [];

    // Add opponent's active as target
    if (opponent.active) {
        targets.push({
            id: opponent.active.id,
            label: `${opponent.active.name} (Active) - ${opponent.active.hp - (opponent.active.damage || 0)}/${opponent.active.hp} HP`
        });
    }

    // Only add benched characters if move explicitly allows it
    if (canTargetBench) {
        opponent.bench.forEach((benchChar, idx) => {
            if (benchChar) {
                targets.push({
                    id: benchChar.id,
                    label: `${benchChar.name} (Bench ${idx + 1}) - ${benchChar.hp - (benchChar.damage || 0)}/${benchChar.hp} HP`
                });
            }
        });
    }

    const encodedMoveName = encodeURIComponent(move.name);
    targets.forEach((target) => {
        html += `<button class="target-option action-btn" data-target-id="${target.id}" data-attacker-id="${attacker.id}" data-move-name="${encodedMoveName}" onclick="handleTargetSelection(this)" style="color: #000;">${target.label}</button>`;
    });

    html += `</div>`;
    html += `<button class="action-the btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function handleTargetSelection(button) {
    if (!button) return;
    const targetId = button.getAttribute('data-target-id');
    const attackerId = button.getAttribute('data-attacker-id');
    const moveName = decodeURIComponent(button.getAttribute('data-move-name') || '');
    executeAttack(attackerId, moveName, targetId);
}

function executeAttack(attackerId, moveName, targetId) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;

    if (!game.playtestMode && game.attackedThisTurn) {
        game.log('You have already attacked this turn!', 'warning');
        closeModal('action-modal');
        updateUI();
        return;
    }
    
    // Build combined move list (including Ross's moves if applicable)
    let move = attacker.moves ? attacker.moves.find(m => m.name === moveName) : null;
    
    // Check Ross's moves if not found in attacker's moves
    if (!move) {
        const rossOnBench = player.bench.find(c => c && c.name === 'Ross Williams');
        if (!abilitiesDisabledFor(game.currentPlayer) && rossOnBench && rossOnBench.moves) {
            move = rossOnBench.moves.find(m => m.name === moveName);
        }
    }

    if (!move) {
        console.error(`Move "${moveName}" not found for ${attacker.name}`);
        closeModal('action-modal');
        return;
    }

    // Find target (if targetId provided)
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    let target = null;

    if (targetId) {
        target = opponent.active && opponent.active.id === targetId ? opponent.active : null;
        if (!target) {
            target = opponent.bench.find(char => char && char.id === targetId);
        }

        if (!target) {
            alert('Target not found!');
            return;
        }
    } else {
        // Default target to opponent's active character if not specified
        target = opponent.active;
    }

    // Mark that an attack has been used this turn
    if (!game.playtestMode) {
        game.attackedThisTurn = true;
    }
    game.lastAttackSource = attacker;

    // Execute specific attack effects by move name
    const waitForModal = performMoveEffect(attacker, target, move);
    if (waitForModal) {
        game.pendingAttackEndTurn = true;
        game.pendingAttackAttackerId = attacker.id;
        return;
    }
    if (game.blockAttackEnd) {
        game.blockAttackEnd = false;
        return;
    }
    attacker.lastAttackTurn = game.turn;
    closeModal('action-modal');
    updateUI();
    endTurn();
}

// Helper function for standard damage attacks
function executeDamageAttack(attacker, target, move) {
    let baseDamage = move.damage || 0;

    // Apply Circular Breathing bonus
    if (move.name === 'Circular Breathing') {
        if (attacker.circularBreathingBonus && attacker.circularBreathingBonusTurn === game.turn) {
            baseDamage += attacker.circularBreathingBonus;
            game.log(`Circular Breathing bonus: +${attacker.circularBreathingBonus} damage`);
            attacker.circularBreathingBonus = 0;
            attacker.circularBreathingBonusTurn = null;
        } else if (attacker.circularBreathingBonus && attacker.circularBreathingBonusTurn && game.turn > attacker.circularBreathingBonusTurn) {
            attacker.circularBreathingBonus = 0;
            attacker.circularBreathingBonusTurn = null;
        }
    }

    const finalDamage = calculateDamage(attacker, target, baseDamage, move);
    game.dealDamage(target, finalDamage, attacker, { isAttack: true, baseDamage });
    game.log(`${attacker.name} used ${move.name} on ${target.name} for ${finalDamage} damage!`, 'damage');
}

function calculateDamage(attacker, defender, baseDamage, move) {
    game.lastAttackBaseDamage = baseDamage;
    let damage = baseDamage;
    const attackerPlayerNum = game.findPlayerWithCharacter(attacker);
    const defenderPlayerNum = game.findPlayerWithCharacter(defender);
    const attackerAbilitiesAllowed = !abilitiesDisabledFor(attackerPlayerNum);
    const defenderAbilitiesAllowed = !abilitiesDisabledFor(defenderPlayerNum);

    // Apply type super effectiveness (2x damage)
    attacker.type.forEach(attackerType => {
        if (SUPER_EFFECTIVE_CHAIN[attackerType] && defender.type.includes(SUPER_EFFECTIVE_CHAIN[attackerType])) {
            damage = Math.floor(damage * 2);
            game.log(`It's super effective! ${attackerType} is strong against ${SUPER_EFFECTIVE_CHAIN[attackerType]}!`);
        }
    });

    // Apply stadium effects
    if (game.stadium) {
        if (game.stadium.name === 'Red Room') {
            if (attacker.type.includes(TYPES.STRINGS) || attacker.type.includes(TYPES.WOODWINDS) || attacker.type.includes(TYPES.BRASS)) {
                damage -= 10;
            }
            if (attacker.type.includes(TYPES.CHOIR) || attacker.type.includes(TYPES.GUITAR) || attacker.type.includes(TYPES.PERCUSSION) || attacker.type.includes(TYPES.PIANO)) {
                damage += 10;
            }
        } else if (game.stadium.name === 'Petteruti Lounge') {
            if (attacker.status && attacker.status.includes('Maid')) {
                damage += 10;
            }
        } else if (game.stadium.name === 'Salomon DECI') {
            // Roll a die and modify damage for Guitar, Piano, Percussion
            if (attacker.type.includes(TYPES.GUITAR) ||
                attacker.type.includes(TYPES.PIANO) ||
                attacker.type.includes(TYPES.CHOIR) ||
                attacker.type.includes(TYPES.PERCUSSION)) {

                const roll = randInt(6) + 1;
                game.log(`Salomon DECI: Rolled ${roll}`, 'info');
                if (roll >= 3) {
                    damage = Math.max(0, damage - 30);
                    game.log('Salomon DECI: -30 damage modifier');
                }
            }
        }
    }

    // Apply character abilities
    const currentPlayer = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    // Grace's Amplify (bench ability)
    const hasGraceOnBench = currentPlayer.bench.some(char => char && char.name === 'Grace Zhao');
    if (attackerAbilitiesAllowed && hasGraceOnBench && attacker.type.includes(TYPES.GUITAR)) {
        damage += 20;
        game.log('Grace\'s Amplify: +20 damage');
    }

    // Turn Up! bonus for guitars
    if (game.nextTurnEffects[game.currentPlayer].turnUpBonus && attacker.type.includes(TYPES.GUITAR)) {
        damage += game.nextTurnEffects[game.currentPlayer].turnUpBonus;
        game.log(`Turn Up! bonus: +${game.nextTurnEffects[game.currentPlayer].turnUpBonus} damage`);
    }

    // Ashley Toby's Instagram Viral
    if (attackerAbilitiesAllowed && (attacker.name === 'Ashley Toby' || attacker.name === 'Ash')) {
        const bothBenchesFull = currentPlayer.bench.every(slot => slot !== null) &&
                                 opponent.bench.every(slot => slot !== null);
        if (bothBenchesFull) {
            damage *= 2;
            game.log('Ashley Toby\'s Instagram Viral: 2x damage!');
        }
    }

    // Cavin's "Wait no... I'm not into femboys–" - +20 damage per maid in play
    if (attackerAbilitiesAllowed && attacker.name === 'Cavin Xue') {
        const allChars = [currentPlayer.active, ...currentPlayer.bench, opponent.active, ...opponent.bench].filter(c => c);
        const maidCount = allChars.filter(char => char.status && char.status.includes('Maid')).length;
        if (maidCount > 0) {
            damage += 20 * maidCount;
            game.log(`Cavin ability: +${20 * maidCount} damage (${maidCount} maids in play)`);
        }
    }

    // Ryan Li's "Moe moe kyun~!" - All maids do +10 damage (both sides)
    const hasRyanLi = [1, 2].some(playerNum => {
        if (abilitiesDisabledFor(playerNum)) return false;
        const player = game.players[playerNum];
        return [player.active, ...player.bench].some(char => char && char.name === 'Ryan Li');
    });
    if (hasRyanLi && attacker.status && attacker.status.includes('Maid')) {
        damage += 10;
        game.log('Ryan Li ability: +10 damage (maid bonus)');
    }

    // Juan Burgos's "Baking Buff" - While on bench, brass active does +20 damage
    const hasJuanOnBench = currentPlayer.bench.some(char => char && char.name === 'Juan Burgos');
    if (attackerAbilitiesAllowed && hasJuanOnBench && currentPlayer.active && currentPlayer.active === attacker && attacker.type.includes(TYPES.BRASS)) {
        damage += 20;
        game.log('Juan Burgos bench ability: +20 damage to brass');
    }

    // Daniel Yang's "Delicate Ears" - If no brass in play, +20 damage
    if (attackerAbilitiesAllowed && attacker.name === 'Daniel Yang') {
        const allChars = [
            game.players[1].active, ...game.players[1].bench,
            game.players[2].active, ...game.players[2].bench
        ].filter(c => c);
        const hasBrass = allChars.some(char => char.type.includes(TYPES.BRASS));
        if (!hasBrass) {
            damage += 20;
            game.log('Daniel Yang ability: +20 damage (no brass in play)');
        }
    }

    // Carolyn Zheng's "Procrastinate" - +30 damage if didn't attack last turn (no stacking)
    if (attackerAbilitiesAllowed && attacker.name === 'Carolyn Zheng') {
        if (attacker.lastAttackTurn == null || attacker.lastAttackTurn < game.turn - 2) {
            damage += 30;
            game.log('Carolyn Zheng Procrastinate: +30 damage');
        }
    }

    // Poppet status (Extension Cord): +20 damage if NOT in a performance space
    if (attacker.status && attacker.status.includes('Poppet')) {
        if (!game.stadium || !game.isPerformanceSpace(game.stadium.name)) {
            damage += 20;
            game.log('Poppet Pop-Up: +20 damage (not in performance space)');
        }
    }

    // Goon status: +10 damage per music stand used
    if (attacker.status && attacker.status.includes('Goon')) {
        const goonBonus = attacker.goonMusicStandBonus || 0;
        if (goonBonus > 0) {
            damage += goonBonus;
            game.log(`Goon status: +${goonBonus} damage from music stands`);
        }
    }

    // Grace's Royalties (if Grace is active and opponent has AVGE items)
    if (attacker.name === 'Grace Zhao' && currentPlayer.active === attacker) {
        const opponentActive = opponent.active;
        if (opponentActive && opponentActive.attachedTools) {
            const hasAVGEItem = opponentActive.attachedTools.some(tool =>
                tool.name === 'AVGE T-shirt' || tool.name === 'AVGE showcase sticker'
            );
            if (hasAVGEItem) {
                // This damage is applied separately in dealDamage, not here
            }
        }
    }

    // Apply item bonuses from this turn
    if (game.attackModifiers[game.currentPlayer].damageBonus) {
        damage += game.attackModifiers[game.currentPlayer].damageBonus;
        game.log(`Item bonus: +${game.attackModifiers[game.currentPlayer].damageBonus} damage`);
    }

    
    // Ross Williams's I Am Become Ross - Active can use Ross's attacks from bench
    const rossOnBench = currentPlayer.bench.find(c => c && c.name === 'Ross Williams');
    if (rossOnBench && currentPlayer.active && move && move.name) {
        // This is handled in the attack selection UI - Ross's moves are added to active's move list
    }

    // Distortion bonus - applies to plucked string attacks (guitar and strings types)
    if (game.nextTurnEffects[game.currentPlayer].distortionBonus) {
        const isGuitar = attacker.type && attacker.type.includes(TYPES.GUITAR);
        if (isGuitar) {
            damage += game.nextTurnEffects[game.currentPlayer].distortionBonus;
            game.log(`Distortion bonus: +${game.nextTurnEffects[game.currentPlayer].distortionBonus} damage`);
            game.nextTurnEffects[game.currentPlayer].distortionBonus = 0;
        }
    }

    // Separate Hands delayed damage handled in the move logic

        // Anna Brown's Do Not Disturb - On bench, Anna takes 20 less damage
        if (defenderAbilitiesAllowed) {
            const defenderPlayer = game.findPlayerWithCharacter(defender);
            const defenderPlayerObj = game.players[defenderPlayer];
            if (defender && defender.name === 'Anna Brown' && defenderPlayerObj && defenderPlayerObj.bench.includes(defender)) {
                damage = Math.max(0, damage - 20);
                game.log('Anna Brown\'s Do Not Disturb: -20 damage while benched');
            }
        }

    // Damper Pedal effect
    if (game.nextTurnEffects[game.currentPlayer].damperPedal) {
        damage = Math.floor(damage / 2);
        game.log('Damper Pedal: Attack halved!');
        game.nextTurnEffects[game.currentPlayer].damperPedal = false;
    }

    // Felix Chen's Synesthesia - If all characters in play are different types, -10 damage
    const defenderSide = game.players[defenderPlayerNum];
    const felixInPlay = [defenderSide.active, ...defenderSide.bench].some(c => c && c.name === 'Felix Chen');

    // AVGE Birb penalty - defender takes +20 damage
    if (game.nextTurnEffects[defenderPlayerNum] && game.nextTurnEffects[defenderPlayerNum].avgebBirbPenalty) {
        if (defender === game.players[defenderPlayerNum].active) {
            damage += game.nextTurnEffects[defenderPlayerNum].avgebBirbPenalty;
            game.log(`AVGE Birb penalty: +${game.nextTurnEffects[defenderPlayerNum].avgebBirbPenalty} damage`);
            game.nextTurnEffects[defenderPlayerNum].avgebBirbPenalty = 0;
        }
    }

    // Bokai Bi's Algorithm - Opponent plays duplicate → 50 damage (handled elsewhere)
    // This is checked when opponents play characters, not in damage calculation

    if (felixInPlay && defenderAbilitiesAllowed) {
        // Check if all characters in play are of different types
        const charsInPlay = [defenderSide.active, ...defenderSide.bench].filter(c => c);

        // All different types means each character has no type overlap with any other character
        const allDifferentTypes = charsInPlay.every(char1 => {
            return !charsInPlay.some(char2 =>
                char1.id !== char2.id && char1.type.some(t => char2.type.includes(t))
            );
        });

        if (allDifferentTypes && charsInPlay.length >= 1) {
            damage = Math.max(0, damage - 10);
            game.log('Felix Chen\'s Synesthesia: All characters are different types, -10 damage!');
        }
    }

    return Math.max(0, damage);
}

// Retreat and Switch
function showRetreatMenu(cardId) {
    const player = game.players[game.currentPlayer];
    const active = player.active;

    if (!active || active.id !== cardId) return;

    const retreatCost = getEffectiveRetreatCost(active);
    const energyCount = active.attachedEnergy ? active.attachedEnergy.length : 0;

    if (energyCount < retreatCost) {
        alert(`Need ${retreatCost} energy to retreat, but only have ${energyCount}`);
        return;
    }

    // Show bench selection
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Retreat ${active.name}</h2>`;
    html += `<p>Select a benched character to switch with (Cost: ${retreatCost} energy)</p>`;
    html += `<div class="target-selection">`;

    player.bench.forEach((benchChar, idx) => {
        if (benchChar) {
            html += `<div class="target-option" onclick="retreat('${cardId}', ${idx}, ${retreatCost})">
                ${benchChar.name} - ${benchChar.hp - (benchChar.damage || 0)}/${benchChar.hp} HP
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function retreat(activeCardId, benchSlotIndex, cost) {
    const player = game.players[game.currentPlayer];
    const active = player.active;

    if (!active || active.id !== activeCardId) return;

    // Discard energy for retreat cost
    for (let i = 0; i < cost && active.attachedEnergy.length > 0; i++) {
        const discardedEnergy = active.attachedEnergy.pop();
        player.discard.push(discardedEnergy);
    }

    // Swap active with bench
    const benchChar = player.bench[benchSlotIndex];
    player.bench[benchSlotIndex] = active;
    player.active = benchChar;
    if (benchChar) {
        benchChar.cameOffBenchThisTurn = true;
    }

    game.log(`${active.name} retreated, ${benchChar.name} is now active`);

    game.applyPassiveStatuses();

    closeModal('action-modal');
    updateUI();
}

function switchToActive(cardId) {
    const player = game.players[game.currentPlayer];
    const benchIndex = player.bench.findIndex(char => char && char.id === cardId);

    if (benchIndex === -1) return;

    if (!player.active) {
        // No active, just move to active (free when no active)
        player.active = player.bench[benchIndex];
        player.bench[benchIndex] = null;
        if (player.active) {
            player.active.cameOffBenchThisTurn = true;
        }
        game.log(`${player.active.name} moved to active`, 'info');
        game.applyPassiveStatuses();
    } else {
        // Manual switch requires retreat cost from active pokemon
        const active = player.active;
        const retreatCost = getEffectiveRetreatCost(active);
        const energyCount = active.attachedEnergy ? active.attachedEnergy.length : 0;

        if (energyCount < retreatCost) {
            alert(`Need to pay ${retreatCost} energy retreat cost from active ${active.name}, but only have ${energyCount}. Use Retreat button instead.`);
            closeModal('action-modal');
            return;
        }

        // Show confirmation and energy discard
        showSwitchConfirmation(cardId, benchIndex, retreatCost);
        return;
    }

    closeModal('action-modal');
    updateUI();
}

function showSwitchConfirmation(cardId, benchIndex, retreatCost) {
    const player = game.players[game.currentPlayer];
    const active = player.active;
    const benchChar = player.bench[benchIndex];

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Switch ${benchChar.name} to Active?</h2>`;
    html += `<p>This will cost ${retreatCost} energy from ${active.name}</p>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="confirmSwitch('${cardId}', ${benchIndex}, ${retreatCost})">Confirm Switch</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function confirmSwitch(cardId, benchIndex, retreatCost) {
    const player = game.players[game.currentPlayer];
    const active = player.active;

    // Discard energy for retreat cost
    for (let i = 0; i < retreatCost && active.attachedEnergy.length > 0; i++) {
        const discardedEnergy = active.attachedEnergy.pop();
        player.discard.push(discardedEnergy);
    }

    // Swap active with bench
    const benchChar = player.bench[benchIndex];
    player.bench[benchIndex] = active;
    player.active = benchChar;
    if (benchChar) {
        benchChar.cameOffBenchThisTurn = true;
    }

    game.log(`${active.name} switched to bench, ${benchChar.name} is now active (paid ${retreatCost} energy)`, 'info');

    game.applyPassiveStatuses();

    closeModal('action-modal');
    updateUI();
}

function showStickTrickSwapModal(player, benchChars) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Stick Trick: Select Swap</h2>`;
    html += `<p>Select a benched character to swap with:</p>`;
    html += `<div class="target-selection">`;

    benchChars.forEach(char => {
        html += `<div class="target-option" onclick="executeStickTrickSwap('${char.id}')">
            ${char.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeStickTrickSwap(benchCharId) {
    const player = game.players[game.currentPlayer];
    const benchIndex = player.bench.findIndex(char => char && char.id === benchCharId);

    if (benchIndex === -1 || !player.active) return;

    const active = player.active;
    const benchChar = player.bench[benchIndex];
    player.bench[benchIndex] = active;
    player.active = benchChar;

    game.log(`Stick Trick: ${benchChar.name} is now active`, 'info');

    game.applyPassiveStatuses();

    closeModal('action-modal');
    updateUI();
}

// Activated Abilities
function useActivatedAbility(cardId, abilitySlot) {
    const player = game.players[game.currentPlayer];
    const card = player.active && player.active.id === cardId ? player.active :
                  player.bench.find(c => c && c.id === cardId);

    if (!card) return;

    const ability = card[abilitySlot];
    if (!ability || ability.type !== 'activated') return;

    if (abilitiesDisabledFor(game.currentPlayer)) {
        alert('Abilities are disabled this turn.');
        game.log('Abilities are disabled this turn (Nullify).', 'warning');
        return;
    }

    game.log(`${card.name} uses ${ability.name}!`, 'info');

    // Implement specific activated abilities
    switch (ability.name) {
        case 'Nullify': {
            // Luke Xu: If benched this turn, opponent abilities have no effect during their next turn
            if (!card.wasJustBenched) {
                alert('Nullify can only be used if Luke Xu was benched this turn.');
                break;
            }

            const opponentNum = game.currentPlayer === 1 ? 2 : 1;
            game.abilitiesDisabledThisTurn = opponentNum;
            game.log('Nullify: Opponent abilities disabled for the rest of this turn!', 'info');
            closeModal('action-modal');
            updateUI();
            break;
        }
        case 'Leave Rehearsal Early':
            // Happy Ruth: Bench only, no tools attached
            if (!player.bench.includes(card)) {
                alert('Happy Ruth must be on the bench to use this ability.');
                break;
            }
            if (card.attachedTools && card.attachedTools.length > 0) {
                alert('Happy Ruth cannot have tools attached to use this ability.');
                break;
            }

            // Discard attached energy
            if (card.attachedEnergy && card.attachedEnergy.length > 0) {
                card.attachedEnergy.forEach(energy => player.discard.push(energy));
                card.attachedEnergy = [];
            }

            // Heal fully
            card.damage = 0;

            // Move to hand
            const benchIndex = player.bench.indexOf(card);
            if (benchIndex !== -1) {
                player.bench[benchIndex] = null;
            }
            player.hand.push(card);

            game.log('Happy Ruth\'s Leave Rehearsal Early: Returned to hand, healed, and discarded attached energy', 'info');
            closeModal('action-modal');
            updateUI();
            break;

        case 'Profit Margins':
            // Emily: Discard a tool to draw 2 cards
            if (player.active !== card) {
                alert('Emily must be active to use Profit Margins!');
                break;
            }
            if (game.phase !== 'attack' || game.attackedThisTurn) {
                alert('Profit Margins can only be used right before your attack!');
                break;
            }
            if (card.attachedTools && card.attachedTools.length > 0) {
                // Show tool selection modal
                showToolSelectionForDiscard(card);
            } else {
                alert('No tools attached to Emily!');
            }
            break;

        case 'Program Production':
            // Rachel: Retrieve concert programs/tickets from discard
            if (player.active === card) {
                if (card.usedProgramProductionThisTurn) {
                    alert('Program Production can only be used once per turn!');
                    closeModal('action-modal');
                    break;
                }
                const programsAndTickets = player.discard.filter(c =>
                    c.name === 'Concert Program' || c.name === 'Concert Ticket'
                );
                if (programsAndTickets.length > 0) {
                    showProgramProductionModal(player, programsAndTickets);
                } else {
                    alert('No Concert Programs or Tickets in discard pile!');
                }
            } else {
                alert('Rachel must be in the active slot to use this ability!');
            }
            break;

        case 'Looking for drummer':
            // Kei: Shuffle back into deck, turn ends
            if (player.bench.includes(card)) {
                const benchIndex = player.bench.indexOf(card);
                player.bench[benchIndex] = null;
                player.deck.push(card);
                game.shuffleDeck(game.currentPlayer);
                game.log('Kei shuffled back into deck, turn ends');
                closeModal('action-modal');
                game.switchPlayer();
                updateUI();
            } else {
                alert('Kei must be on the bench to use this ability!');
            }
            break;

        case 'Projector Media':
            // Ross: Search for a laptop and put it in hand
            if (player.bench.includes(card)) {
                const laptop = player.deck.find(c => c.name === 'Laptop');
                if (laptop) {
                    player.hand.push(laptop);
                    player.deck = player.deck.filter(c => c.id !== laptop.id);
                    game.log('Ross found a Laptop!');
                    game.shuffleDeck(game.currentPlayer);
                    closeModal('action-modal');
                    updateUI();
                } else {
                    alert('No Laptop in deck!');
                    closeModal('action-modal');
                }
            } else {
                alert('Ross must be on the bench to use this ability!');
                closeModal('action-modal');
            }
            break;

        case 'Reverse Heist':
            // David Man: Shuffle discard, randomly choose 3, put items/tools on top of deck
            if (player.discard.length < 3) {
                alert('Need at least 3 cards in discard pile!');
                closeModal('action-modal');
                break;
            }

            // Shuffle discard
            const shuffledDiscard = [...player.discard];
            for (let i = shuffledDiscard.length - 1; i > 0; i--) {
                const j = randInt(i + 1);
                [shuffledDiscard[i], shuffledDiscard[j]] = [shuffledDiscard[j], shuffledDiscard[i]];
            }
            // Pick random 3
            const randomThree = shuffledDiscard.slice(0, 3);
            // Remove these 3 from discard
            randomThree.forEach(card => {
                const idx = player.discard.indexOf(card);
                if (idx > -1) player.discard.splice(idx, 1);
            });
            // Filter for items/tools
            const itemsAndTools = randomThree.filter(c => c.cardType === 'item' || c.cardType === 'tool');
            // Non-items/tools return to discard
            const nonItems = randomThree.filter(c => c.cardType !== 'item' && c.cardType !== 'tool');
            if (nonItems.length > 0) {
                player.discard.push(...nonItems);
            }

            if (itemsAndTools.length > 0) {
                // Put items/tools on top of deck in order
                player.deck.unshift(...itemsAndTools);
                game.log(`Reverse Heist: Found ${itemsAndTools.length} items/tools and placed on top!`);
            } else {
                game.log(`Reverse Heist: Drew ${randomThree.map(c => c.name).join(', ')} - no items/tools!`);
            }
            closeModal('action-modal');
            break;

        case 'Category Theory':
            // Joshua Kou: If this is the only card in your hand, reveal it, shuffle into deck, draw 4
            if (player.hand.length !== 1 || player.hand[0].id !== card.id) {
                alert('Category Theory can only be used if this is the only card in your hand!');
                closeModal('action-modal');
                break;
            }

            game.log(`Category Theory: Revealing ${card.name}`);
            player.hand = [];
            player.deck.push(card);
            game.shuffleDeck(game.currentPlayer);
            game.drawCards(game.currentPlayer, 4);
            game.log('Category Theory: Shuffled into deck and drew 4 cards!');
            closeModal('action-modal');
            updateUI();
            break;

        case 'BAI Wrangler':
            // Izzy: Once per turn, move a stadium from discard to bottom of deck
            if (card.usedBAIWranglerThisTurn) {
                alert('BAI Wrangler can only be used once per turn!');
                closeModal('action-modal');
                break;
            }
            if (!player.discard.some(c => c.cardType === 'stadium')) {
                alert('No Stadium cards in discard pile!');
                closeModal('action-modal');
                break;
            }
            game.tempSelections = game.tempSelections || {};
            game.tempSelections.baiWranglerCardId = card.id;
            showBAIWranglerBottomModal(player);
            break;

        case 'Information Advantage':
            // Izzy: At start of turn, if you have 2x cards, look at opponent hand and discard one
            const opponentNum = game.currentPlayer === 1 ? 2 : 1;
            const opponent = game.players[opponentNum];

            if (player.hand.length >= opponent.hand.length * 2) {
                showHandRevealModal(opponent, opponent.hand.length, false);
            } else {
                alert(`Need at least ${opponent.hand.length * 2} cards (opponent has ${opponent.hand.length})`);
                closeModal('action-modal');
            }
            break;

        case 'Cleric Spell':
            // Jessica Jung: Shuffle one discard back to deck
            if (card.usedClericSpellThisTurn) {
                alert('Cleric Spell can only be used once per turn!');
                closeModal('action-modal');
                break;
            }
            if (!flipCoin()) {
                card.usedClericSpellThisTurn = true;
                game.log('Cleric Spell: Tails - no effect');
                closeModal('action-modal');
                break;
            }
            if (player.discard.length > 0) {
                game.tempSelections = game.tempSelections || {};
                game.tempSelections.clericSpellCardId = card.id;
                showClericSpellModal(player);
            } else {
                alert('No cards in discard pile!');
                closeModal('action-modal');
            }
            break;

        case 'Borrow a Bow':
            // Ina Ma: Move energy from another string (passive implementation in move, this is activated version)
            if (game.borrowABowUsedThisTurn) {
                alert('Borrow a Bow can only be used once per turn!');
                closeModal('action-modal');
                break;
            }
            const stringCharsForBorrow = [player.active, ...player.bench].filter(c =>
                c && c.type.includes(TYPES.STRINGS) && c.id !== card.id && c.attachedEnergy && c.attachedEnergy.length > 0
            );
            if (stringCharsForBorrow.length > 0) {
                showBorrowSelection(player, stringCharsForBorrow, card, true);
            } else {
                alert('No other strings with energy to borrow from!');
                closeModal('action-modal');
            }
            break;

        default:
            game.log(`${ability.name} effect not yet implemented`);
            closeModal('action-modal');
            break;
    }
}

function useCategoryTheoryFromHand(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (!card) return;

    if (abilitiesDisabledFor(game.currentPlayer)) {
        alert('Abilities are disabled this turn.');
        game.log('Abilities are disabled this turn (Nullify).', 'warning');
        return;
    }

    if (player.hand.length !== 1 || player.hand[0].id !== card.id) {
        alert('Category Theory can only be used if this is the only card in your hand!');
        closeModal('action-modal');
        return;
    }

    game.log(`Category Theory: Revealing ${card.name}`);
    player.hand = [];
    player.deck.push(card);
    game.shuffleDeck(game.currentPlayer);
    game.drawCards(game.currentPlayer, 4);
    game.log('Category Theory: Shuffled into deck and drew 4 cards!');
    closeModal('action-modal');
    updateUI();
}

function showClericSpellModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    // Filter out any undefined or invalid cards from discard pile
    const validCards = player.discard.filter(card => card && card.name);

    if (validCards.length === 0) {
        alert('No valid cards in discard pile!');
        closeModal('action-modal');
        return;
    }

    let html = `<h2>Cleric Spell: Shuffle Card Back</h2>`;
    html += `<p>Select card from discard pile to shuffle back into deck:</p>`;
    html += `<div class="target-selection">`;

    validCards.forEach((card, idx) => {
        // Find the actual index in the discard pile
        const actualIdx = player.discard.indexOf(card);
        html += `<div class="target-option" onclick="executeClericSpell(${actualIdx})">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeClericSpell(cardIdx) {
    const player = game.players[game.currentPlayer];

    if (player.discard[cardIdx] && player.discard[cardIdx].name) {
        const card = player.discard.splice(cardIdx, 1)[0];
        player.deck.push(card);
        game.shuffleDeck(game.currentPlayer);
        game.log(`Cleric Spell: Shuffled ${card.name} back into deck`);

        const clericId = game.tempSelections && game.tempSelections.clericSpellCardId;
        if (clericId) {
            const cleric = [player.active, ...player.bench].find(c => c && c.id === clericId);
            if (cleric) {
                cleric.usedClericSpellThisTurn = true;
            }
        }
    }

    if (game.tempSelections) {
        delete game.tempSelections.clericSpellCardId;
    }

    closeModal('action-modal');
    updateUI();
}

function showProgramProductionModal(player, cards) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Program Production</h2>`;
    html += `<p>Select one Concert Program or Ticket to retrieve:</p>`;
    html += `<div class="target-selection">`;

    cards.forEach(card => {
        const actualIdx = player.discard.indexOf(card);
        html += `<div class="target-option" onclick="executeProgramProduction(${actualIdx})">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeProgramProduction(cardIdx) {
    const player = game.players[game.currentPlayer];
    const card = player.discard[cardIdx];
    if (!card) return;

    player.discard.splice(cardIdx, 1);
    player.hand.push(card);
    game.log(`Program Production: Retrieved ${card.name} from discard`);

    const rachel = player.active && player.active.name === 'Rachel Chen' ? player.active : null;
    if (rachel) {
        rachel.usedProgramProductionThisTurn = true;
    }

    closeModal('action-modal');
    updateUI();
}

function showBAIWranglerBottomModal(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const stadiums = player.discard.filter(c => c.cardType === 'stadium');
    let html = `<h2>BAI Wrangler</h2>`;
    html += `<p>Select a Stadium card to put on the bottom of your deck:</p>`;
    html += `<div class="target-selection">`;

    stadiums.forEach(card => {
        const actualIdx = player.discard.indexOf(card);
        html += `<div class="target-option" onclick="executeBAIWranglerBottom(${actualIdx})">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeBAIWranglerBottom(cardIdx) {
    const player = game.players[game.currentPlayer];
    const card = player.discard[cardIdx];
    if (!card) return;

    player.discard.splice(cardIdx, 1);
    player.deck.push(card);
    game.log(`BAI Wrangler: Placed ${card.name} on the bottom of the deck`);

    const abilityCardId = game.tempSelections && game.tempSelections.baiWranglerCardId;
    if (abilityCardId) {
        const abilityCard = [player.active, ...player.bench].find(c => c && c.id === abilityCardId);
        if (abilityCard) {
            abilityCard.usedBAIWranglerThisTurn = true;
        }
    }

    if (game.tempSelections) {
        delete game.tempSelections.baiWranglerCardId;
    }
    closeModal('action-modal');
    updateUI();
}


function showToolSelectionForDiscard(card) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Profit Margins - Select Tool to Discard</h2>`;
    html += `<p>Discard a tool from ${card.name} to draw 2 cards</p>`;
    html += `<div class="action-buttons">`;

    card.attachedTools.forEach((tool, idx) => {
        html += `<button class="action-btn" onclick="discardToolForProfitMargins('${card.id}', ${idx})">${tool.name}</button>`;
    });

    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function discardToolForProfitMargins(cardId, toolIndex) {
    const player = game.players[game.currentPlayer];
    const card = player.active && player.active.id === cardId ? player.active :
                  player.bench.find(c => c && c.id === cardId);

    if (!card || !card.attachedTools || !card.attachedTools[toolIndex]) return;

    const tool = card.attachedTools[toolIndex];
    removeToolEffects(card, tool);
    card.attachedTools.splice(toolIndex, 1);
    player.discard.push(tool);

    game.log(`Discarded ${tool.name}, drawing 2 cards`);
    game.drawCards(game.currentPlayer, 2);

    closeModal('action-modal');
    updateUI();
}

function setupEventListeners() {
    if (eventListenersInitialized) return;
    eventListenersInitialized = true;
    setupKeyboardShortcuts();

    // End turn button
    document.getElementById('end-turn-btn').addEventListener('click', () => {
        endTurn();
    });

    // Begin attack phase button (legacy UI)
    const beginAttackBtn = document.getElementById('begin-attack-btn');
    if (beginAttackBtn) {
        beginAttackBtn.addEventListener('click', () => {
            game.beginAttackPhase();
        });
    }

    const playtestAddButton = document.getElementById('playtest-add-card-btn');
    if (playtestAddButton) {
        playtestAddButton.addEventListener('click', () => {
            openPlaytestCardLibrary();
        });
    }

    // Discard pile click handlers
    document.querySelectorAll('.discard-pile').forEach(pile => {
        pile.addEventListener('click', () => {
            const playerNum = parseInt(pile.getAttribute('data-player'));
            showDiscardPileModal(playerNum);
        });
    });

    // Close modals
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

let eventListenersInitialized = false;

function endTurn() {
    if (!canCurrentClientAct()) return;

    const currentPlayerNum = game.currentPlayer;
    const currentPlayerObj = game.players[currentPlayerNum];
    const opponentNum = currentPlayerNum === 1 ? 2 : 1;
    const opponentObj = game.players[opponentNum];

    // Alice Wang's Euclidean Algorithm - while Alice is active, opponent discards to equalize hand size at end of their turn
    const aliceInPlay = [opponentObj.active, ...opponentObj.bench].some(c => c && c.name === 'Alice Wang');
    if (aliceInPlay) {
        if (currentPlayerObj.hand.length > opponentObj.hand.length) {
            const discardCount = currentPlayerObj.hand.length - opponentObj.hand.length;
            if (discardCount > 0) {
                game.tempSelections = game.tempSelections || {};
                game.tempSelections.pendingEndTurn = true;
                showOpponentDiscardChoice(currentPlayerNum, discardCount, () => {
                    game.log(`Alice Wang's Euclidean Algorithm: Player ${currentPlayerNum} discarded ${discardCount} cards to equalize hand sizes`);
                });
                return;
            }
        }
    }

    game.switchPlayer();

    // Don't auto-draw if Friedman Hall is active (it handles its own draw) or if draw was skipped
    if ((!game.stadium || game.stadium.name !== 'Friedman Hall') && !game.turnDrawSkipped) {
        game.drawCards(game.currentPlayer, 1);
    }

    updateUI();
    sendMultiplayerAction('STATE_SNAPSHOT', []);
}

let hotkeysInitialized = false;

function setupKeyboardShortcuts() {
    if (hotkeysInitialized) return;
    hotkeysInitialized = true;

    document.addEventListener('keydown', (event) => {
        if (event.repeat) return;

        const key = event.key.toLowerCase();

        if (key === 'escape') {
            closeTopModal();
            return;
        }

        if (!canCurrentClientAct()) {
            return;
        }

        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

        if (handleModalOptionHotkey(key)) {
            return;
        }

        switch (key) {
            case 'escape':
                closeTopModal();
                break;
            case 'p':
                playSelectedCardHotkey();
                break;
            case 'e':
                attachEnergyHotkey();
                break;
            case '1':
                useMoveHotkey(0);
                break;
            case '2':
                useMoveHotkey(1);
                break;
            case '3':
                useMoveHotkey(2);
                break;
            case '4':
                useMoveHotkey(3);
                break;
            case 'a':
                attackHotkey();
                break;
            case 'r':
                retreatHotkey();
                break;
            case 'b':
                beginAttackPhaseHotkey();
                break;
            case 't':
                endTurnHotkey();
                break;
            case 'l':
                if (game.playtestMode) {
                    openPlaytestCardLibrary();
                }
                break;
            default:
                break;
        }
    });
}

function closeTopModal() {
    const modals = Array.from(document.querySelectorAll('.modal'))
        .filter(modal => !modal.classList.contains('hidden'));
    if (modals.length === 0) return;
    const topModal = modals[modals.length - 1];
    if (topModal.id) {
        closeModal(topModal.id);
    } else {
        topModal.classList.add('hidden');
    }
}

function handleModalOptionHotkey(key) {
    const modal = document.getElementById('action-modal');
    if (!modal || modal.classList.contains('hidden')) return false;

    const index = parseInt(key, 10);
    if (Number.isNaN(index) || index < 1 || index > 4) return false;

    const options = Array.from(modal.querySelectorAll('.target-option, .action-btn'))
        .filter(el => !el.disabled && !el.classList.contains('close-modal'))
        .filter(el => {
            const text = (el.textContent || '').toLowerCase();
            return text !== 'cancel' && text !== 'close';
        });

    const choice = options[index - 1];
    if (!choice) return false;

    choice.click();
    return true;
}

function playSelectedCardHotkey() {
    const card = game.selectedCard;
    if (!card) return;

    const player = game.players[game.currentPlayer];
    const inHand = player.hand.some(c => c.id === card.id);
    if (!inHand) return;

    const canPlayAnytime = game.playtestMode || game.phase === 'main';
    if (!canPlayAnytime) return;

    if (card.cardType === 'character') {
        if (!player.active) {
            playCharacterToActive(card.id);
            return;
        }
        const emptyBenchSlot = player.bench.indexOf(null);
        if (emptyBenchSlot !== -1) {
            playCharacterToBench(card.id, emptyBenchSlot);
        }
        return;
    }

    if (card.cardType === 'item' || card.cardType === 'tool') {
        playItem(card.id);
        return;
    }

    if (card.cardType === 'supporter') {
        if (!game.supporterPlayedThisTurn || game.playtestMode) {
            playSupporter(card.id);
        }
        return;
    }

    if (card.cardType === 'stadium') {
        playStadium(card.id);
    }
}

function attachEnergyHotkey() {
    if (!game.playtestMode && game.phase !== 'main') return;
    const player = game.players[game.currentPlayer];
    const selected = game.selectedCard;
    if (selected && selected.cardType === 'character') {
        if (player.active && player.active.id === selected.id) {
            attachEnergy('active');
            return;
        }
        const selectedBenchIndex = player.bench.findIndex(c => c && c.id === selected.id);
        if (selectedBenchIndex !== -1) {
            attachEnergy(selectedBenchIndex);
            return;
        }
    }
    if (player.active) {
        attachEnergy('active');
        return;
    }
    const benchIndex = player.bench.findIndex(c => c);
    if (benchIndex !== -1) {
        attachEnergy(benchIndex);
    }
}

function attackHotkey() {
    const player = game.players[game.currentPlayer];
    if (!player.active) return;
    showAttackMenu(player.active.id);
}

function useMoveHotkey(moveIndex) {
    const player = game.players[game.currentPlayer];
    if (!player.active) return;
    if (!game.playtestMode && game.attackedThisTurn) return;

    selectMove(player.active.id, moveIndex);
}

function retreatHotkey() {
    const player = game.players[game.currentPlayer];
    if (!player.active) return;
    showRetreatMenu(player.active.id);
}

function beginAttackPhaseHotkey() {
    attackHotkey();
}

function endTurnHotkey() {
    const button = document.getElementById('end-turn-btn');
    if (button) button.click();
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    setupStartScreen();
});

function setupStartScreen() {
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const startButton = document.getElementById('start-game-btn');
    const player1Select = document.getElementById('player1-deck-select');
    const player2Select = document.getElementById('player2-deck-select');
    const player1Desc = document.getElementById('player1-deck-description');
    const player2Desc = document.getElementById('player2-deck-description');
    const playtestToggle = document.getElementById('playtest-mode-toggle');
    const multiplayerToggle = document.getElementById('multiplayer-toggle');
    const multiplayerRoomInput = document.getElementById('multiplayer-room');

    // Update deck descriptions when selection changes
    player1Select.addEventListener('change', () => {
        const deckKey = player1Select.value;
        const deckTemplate = DECK_TEMPLATES[deckKey];
        if (deckTemplate) {
            player1Desc.textContent = deckTemplate.description;
        }
    });

    player2Select.addEventListener('change', () => {
        const deckKey = player2Select.value;
        const deckTemplate = DECK_TEMPLATES[deckKey];
        if (deckTemplate) {
            player2Desc.textContent = deckTemplate.description;
        }
    });

    // Start game button
    startButton.addEventListener('click', () => {
        const deck1Name = player1Select.value;
        const deck2Name = player2Select.value;
        const playtestMode = playtestToggle ? playtestToggle.checked : false;
        const roomId = (multiplayerRoomInput?.value || '').trim() || 'default';

        // Hide start screen and show game
        startScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        if (multiplayerToggle?.checked) {
            connectMultiplayer({ roomId, deck1Name, deck2Name, playtestMode });
        } else {
            initGame(deck1Name, deck2Name, playtestMode);
        }
    });

    // Deck builder button
    const deckBuilderButton = document.getElementById('open-deck-builder-btn');
    deckBuilderButton.addEventListener('click', () => {
        openDeckBuilder();
    });

    // View cards button
    const viewCardsButton = document.getElementById('view-cards-btn');
    viewCardsButton.addEventListener('click', () => {
        window.open('cards.md', '_blank');
    });

    // Load custom decks into dropdown on page load
    loadCustomDecksIntoDropdown();
}

// ===== DECK BUILDER FUNCTIONALITY =====

let currentDeck = [];
let currentDeckName = '';

function openDeckBuilder() {
    const modal = document.getElementById('deck-builder-modal');
    modal.classList.remove('hidden');

    // Reset deck builder state
    currentDeck = [];
    currentDeckName = '';
    document.getElementById('custom-deck-name').value = '';

    // Set up event listeners for deck builder
    setupDeckBuilderListeners();

    // Initialize with character tab
    switchCardTab('character');
    updateDeckDisplay();
    loadSavedDecks();
}

function setupDeckBuilderListeners() {
    // Close button
    const deckBuilderModal = document.getElementById('deck-builder-modal');
    const closeBtn = deckBuilderModal.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.onclick = () => {
            deckBuilderModal.classList.add('hidden');
        };
    }

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchCardTab(btn.dataset.type);
    });

    // Search input
    const searchInput = document.getElementById('card-search-input');
    if (searchInput) {
        searchInput.oninput = () => filterCardPool(searchInput.value);
    }

    // Save and Clear buttons
    const saveBtn = document.getElementById('save-deck-btn');
    const clearBtn = document.getElementById('clear-deck-btn');
    const exportBtn = document.getElementById('export-deck-btn');
    const importBtn = document.getElementById('import-deck-btn');

    if (saveBtn) saveBtn.onclick = saveDeck;
    if (clearBtn) clearBtn.onclick = clearDeck;
    if (exportBtn) exportBtn.onclick = exportDeck;
    if (importBtn) importBtn.onclick = importDeck;
}

function switchCardTab(cardType) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === cardType) {
            btn.classList.add('active');
        }
    });

    // Display cards of this type
    displayCardPool(cardType);
}

let currentCardType = 'character';

function displayCardPool(cardType) {
    currentCardType = cardType;
    const cardPool = document.getElementById('card-pool');
    cardPool.innerHTML = '';
    cardPool.className = 'card-pool';

    let cards = [];

    switch(cardType) {
        case 'character':
            cards = Object.values(CHARACTERS);
            break;
        case 'energy':
            // Energy cards no longer exist
            cards = [];
            break;
        case 'item':
            cards = Object.values(ITEMS);
            break;
        case 'tool':
            cards = Object.values(TOOLS);
            break;
        case 'supporter':
            cards = Object.values(SUPPORTERS);
            break;
        case 'stadium':
            cards = Object.values(STADIUMS);
            break;
    }

    cards.forEach(card => {
        const cardElement = createPoolCardElement(card, cardType);
        cardPool.appendChild(cardElement);
    });
}

function filterCardPool(searchTerm) {
    const cardPool = document.getElementById('card-pool');
    const cards = cardPool.querySelectorAll('.pool-card');
    const lowerSearch = searchTerm.toLowerCase();

    cards.forEach(cardElement => {
        const cardName = cardElement.querySelector('.pool-card-name').textContent.toLowerCase();
        const cardEffect = cardElement.querySelector('.pool-card-effect')?.textContent.toLowerCase() || '';
        
        if (cardName.includes(lowerSearch) || cardEffect.includes(lowerSearch)) {
            cardElement.style.display = '';
        } else {
            cardElement.style.display = 'none';
        }
    });
}

function createPoolCardElement(card, type) {
    const div = document.createElement('div');
    div.className = `pool-card ${type}`;

    const header = document.createElement('div');
    header.className = 'pool-card-header';

    const name = document.createElement('div');
    name.className = 'pool-card-name';
    name.textContent = card.name;

    const typeLabel = document.createElement('div');
    typeLabel.className = 'pool-card-type';
    typeLabel.textContent = type.toUpperCase();

    header.appendChild(name);
    header.appendChild(typeLabel);
    div.appendChild(header);

    // Add effect/description
    if (card.effect || card.description) {
        const effect = document.createElement('div');
        effect.className = 'pool-card-effect';
        effect.textContent = card.effect || card.description || '';
        div.appendChild(effect);
    }

    // Show HP for characters
    if (type === 'character' && card.hp) {
        const hp = document.createElement('div');
        hp.className = 'pool-card-effect';
        hp.textContent = `HP: ${card.hp}`;
        div.appendChild(hp);
    }

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'pool-card-add';
    addBtn.textContent = '+ Add to Deck';
    addBtn.onclick = () => addCardToDeck(card, type);
    div.appendChild(addBtn);

    return div;
}

function addCardToDeck(card, cardCategory) {
    // Check if deck is full
    if (currentDeck.length >= 20) {
        alert('Deck is full! Maximum 20 cards.');
        return;
    }

    // For energy cards, allow multiple copies
    // For other cards, typically limit to 4 copies (Pokemon-style rule)
    if (cardCategory !== 'energy') {
        const count = currentDeck.filter(c => c.name === card.name).length;
        if (count >= 4) {
            alert('Maximum 4 copies of the same card (except energy).');
            return;
        }
    }

    // Add card to deck with cardCategory property to avoid conflicts with character 'type' property
    currentDeck.push({ ...card, cardCategory });
    updateDeckDisplay();
}

function removeCardFromDeck(cardName) {
    const index = currentDeck.findIndex(c => c.name === cardName);
    if (index !== -1) {
        currentDeck.splice(index, 1);
        updateDeckDisplay();
    }
}

function updateDeckDisplay() {
    const deckList = document.getElementById('current-deck-list');
    const deckCount = document.getElementById('deck-count');
    const saveBtn = document.getElementById('save-deck-btn');
    const deckNameInput = document.getElementById('custom-deck-name');

    deckCount.textContent = currentDeck.length;

    // Enable save button if deck is valid
    const isValid = currentDeck.length === 20 && deckNameInput.value.trim().length > 0;
    saveBtn.disabled = !isValid;

    // Group cards by name
    const cardCounts = {};
    currentDeck.forEach(card => {
        if (!cardCounts[card.name]) {
            cardCounts[card.name] = { card, count: 0 };
        }
        cardCounts[card.name].count++;
    });

    // Display grouped cards
    deckList.innerHTML = '';
    Object.values(cardCounts).forEach(({ card, count }) => {
        const item = document.createElement('div');
        item.className = `deck-item ${card.cardCategory}`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'deck-item-name';
        nameSpan.textContent = card.name;

        const countSpan = document.createElement('span');
        countSpan.className = 'deck-item-count';
        countSpan.textContent = `x${count}`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'deck-item-remove';
        removeBtn.textContent = '-';
        removeBtn.onclick = () => removeCardFromDeck(card.name);

        item.appendChild(nameSpan);
        item.appendChild(countSpan);
        item.appendChild(removeBtn);
        deckList.appendChild(item);
    });
}

function clearDeck() {
    if (confirm('Clear current deck?')) {
        currentDeck = [];
        updateDeckDisplay();
    }
}

function saveDeck() {
    const deckName = document.getElementById('custom-deck-name').value.trim();

    if (!deckName) {
        alert('Please enter a deck name.');
        return;
    }

    if (currentDeck.length !== 20) {
        alert('Deck must have exactly 20 cards.');
        return;
    }

    // Get existing custom decks from localStorage
    const customDecks = JSON.parse(localStorage.getItem('customDecks') || '{}');

    // Save deck
    customDecks[deckName] = currentDeck;
    localStorage.setItem('customDecks', JSON.stringify(customDecks));

    alert(`Deck "${deckName}" saved successfully!`);

    // Refresh saved decks list
    loadSavedDecks();
    loadCustomDecksIntoDropdown();

    // Clear current deck
    currentDeck = [];
    document.getElementById('custom-deck-name').value = '';
    updateDeckDisplay();
}

function loadSavedDecks() {
    const savedDecksList = document.getElementById('saved-decks-list');
    const customDecks = JSON.parse(localStorage.getItem('customDecks') || '{}');

    savedDecksList.innerHTML = '';

    Object.keys(customDecks).forEach(deckName => {
        const item = document.createElement('div');
        item.className = 'saved-deck-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'saved-deck-name';
        nameSpan.textContent = deckName;

        const actions = document.createElement('div');
        actions.className = 'saved-deck-actions';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'load-deck-btn';
        loadBtn.textContent = 'Load';
        loadBtn.onclick = () => loadDeck(deckName);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-deck-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteDeck(deckName);

        actions.appendChild(loadBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(nameSpan);
        item.appendChild(actions);
        savedDecksList.appendChild(item);
    });
}

function loadDeck(deckName) {
    const customDecks = JSON.parse(localStorage.getItem('customDecks') || '{}');
    const deck = customDecks[deckName];

    if (deck) {
        currentDeck = [...deck];
        document.getElementById('custom-deck-name').value = deckName;
        updateDeckDisplay();
    }
}

function deleteDeck(deckName) {
    if (confirm(`Delete deck "${deckName}"?`)) {
        const customDecks = JSON.parse(localStorage.getItem('customDecks') || '{}');
        delete customDecks[deckName];
        localStorage.setItem('customDecks', JSON.stringify(customDecks));

        loadSavedDecks();
        loadCustomDecksIntoDropdown();
    }
}

// ===== DECK IMPORT/EXPORT FUNCTIONS =====

function exportDeck() {
    if (currentDeck.length === 0) {
        alert('No deck to export! Add cards to your deck first.');
        return;
    }

    // Get deck name
    const deckName = document.getElementById('custom-deck-name').value.trim() || 'Unnamed Deck';

    // Create export data
    const exportData = {
        name: deckName,
        cards: currentDeck.map(card => ({
            name: card.name,
            cardCategory: card.cardCategory, // character, energy, item, tool, supporter, stadium
            energyType: card.energyType // Only for energy cards
        }))
    };

    // Convert to JSON and Base64 encode
    const jsonString = JSON.stringify(exportData);
    const base64Code = btoa(jsonString);

    // Show export modal
    showExportModal(base64Code, deckName);
}

function showExportModal(code, deckName) {
    const modal = document.getElementById('deck-code-modal');
    const content = document.getElementById('deck-code-content');

    let html = `<h2>Export Deck: ${deckName}</h2>`;
    html += `<p>Share this code with others to import your deck:</p>`;
    html += `<textarea id="deck-export-code" readonly style="width: 100%; height: 150px; font-family: monospace; padding: 10px;">${code}</textarea>`;
    html += `<div class="action-buttons" style="margin-top: 10px;">`;
    html += `<button class="action-btn" onclick="copyDeckCode()">Copy to Clipboard</button>`;
    html += `<button class="action-btn" onclick="closeModal('deck-code-modal')">Close</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');

    // Auto-select the code for easy copying
    setTimeout(() => {
        const textarea = document.getElementById('deck-export-code');
        if (textarea) textarea.select();
    }, 100);
}

function copyDeckCode() {
    const textarea = document.getElementById('deck-export-code');
    if (textarea) {
        const code = textarea.value;

        // Use modern Clipboard API if available, fall back to execCommand
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                alert('Deck code copied to clipboard!');
            }).catch(() => {
                // Fallback: select and copy manually
                textarea.select();
                document.execCommand('copy');
                alert('Deck code copied to clipboard!');
            });
        } else {
            // Fallback for older browsers
            textarea.select();
            document.execCommand('copy');
            alert('Deck code copied to clipboard!');
        }
    }
}

function importDeck() {
    const modal = document.getElementById('deck-code-modal');
    const content = document.getElementById('deck-code-content');

    let html = `<h2>Import Deck</h2>`;
    html += `<p>Paste a deck code to import:</p>`;
    html += `<textarea id="deck-import-code" placeholder="Paste deck code here..." style="width: 100%; height: 150px; font-family: monospace; padding: 10px;"></textarea>`;
    html += `<div class="action-buttons" style="margin-top: 10px;">`;
    html += `<button class="action-btn" onclick="processDeckImport()">Import</button>`;
    html += `<button class="action-btn" onclick="closeModal('deck-code-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');

    // Focus on textarea
    setTimeout(() => {
        const textarea = document.getElementById('deck-import-code');
        if (textarea) textarea.focus();
    }, 100);
}

function processDeckImport() {
    const textarea = document.getElementById('deck-import-code');
    const code = textarea.value.trim();

    if (!code) {
        alert('Please paste a deck code first!');
        return;
    }

    try {
        // Decode Base64 and parse JSON
        const jsonString = atob(code);
        const importData = JSON.parse(jsonString);

        if (!importData.cards || !Array.isArray(importData.cards)) {
            throw new Error('Invalid deck format');
        }

        // Clear current deck
        currentDeck = [];

        // Reconstruct cards from card names
        let failedCards = [];
        importData.cards.forEach(cardData => {
            const card = findCardByName(cardData.name, cardData.cardCategory, cardData.energyType);
            if (card) {
                // Create a copy with cardCategory property
                const cardCopy = {
                    ...card,
                    cardCategory: cardData.cardCategory
                };
                if (cardData.energyType) {
                    cardCopy.energyType = cardData.energyType;
                }
                currentDeck.push(cardCopy);
            } else {
                failedCards.push(`${cardData.name} (${cardData.cardCategory})`);
            }
        });

        // Set deck name
        if (importData.name) {
            document.getElementById('custom-deck-name').value = importData.name;
            currentDeckName = importData.name;
        }

        // Update display
        updateDeckDisplay();

        // Close modal
        closeModal('deck-code-modal');

        // Show success message with warnings if any cards failed
        let message = `Deck "${importData.name}" imported successfully!\n\n`;
        message += `Cards imported: ${currentDeck.length}/${importData.cards.length}`;

        if (failedCards.length > 0) {
            message += `\n\nWarning: ${failedCards.length} card(s) could not be found:\n`;
            message += failedCards.join('\n');
        }

        alert(message);
    } catch (error) {
        alert('Invalid deck code! Please check the code and try again.\n\nError: ' + error.message);
    }
}

function findCardByName(name, type, energyType) {
    // Search in appropriate card pool based on type
    let card = null;

    switch(type) {
        case 'character':
            card = Object.values(CHARACTERS).find(c => c.name === name);
            break;
        case 'energy':
            // Energy cards no longer exist
            card = null;
            break;
        case 'item':
            card = Object.values(ITEMS).find(c => c.name === name);
            break;
        case 'tool':
            card = Object.values(TOOLS).find(c => c.name === name);
            break;
        case 'supporter':
            card = Object.values(SUPPORTERS).find(c => c.name === name);
            break;
        case 'stadium':
            card = Object.values(STADIUMS).find(c => c.name === name);
            break;
    }

    return card;
}

// ===== HELPER FUNCTIONS FOR MOVES =====

function flipCoin() {
    // Check for Jayden Brown's Four-leaf Clover ability
    const player = game.players[game.currentPlayer];
    const hasJayden = [player.active, ...player.bench].some(char => char && char.name === 'Jayden Brown');

    if (!abilitiesDisabledFor(game.currentPlayer) && hasJayden && !game.usedFourLeafClover) {
        game.usedFourLeafClover = true;
        game.log('Jayden Brown\'s Four-leaf Clover: Choose first coin flip result!');
        const rolledHeads = getRandom() < 0.5;
        const forceHeads = confirm(`Four-leaf Clover: Rolled ${rolledHeads ? 'Heads' : 'Tails'}. Force Heads? (OK = Heads, Cancel = Keep Result)`);
        return forceHeads ? true : rolledHeads;
    }

    return getRandom() < 0.5;
}

function rollD6() {
    return randInt(6) + 1;
}

// ===== MODAL FUNCTIONS FOR NEW MOVES =====

function showDrainHealSelection(player, benchedChars, healAmount) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Drain: Heal Benched Character</h2>`;
    html += `<p>Select a benched character to heal ${healAmount} damage:</p>`;
    html += `<div class="target-selection">`;

    benchedChars.forEach(char => {
        html += `<div class="target-option" onclick="applyDrainHeal('${char.id}', ${healAmount})">
            ${char.name} - ${char.hp - (char.damage || 0)}/${char.hp} HP
        </div>`;
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function applyDrainHeal(charId, healAmount) {
    const player = game.players[game.currentPlayer];
    const char = [player.active, ...player.bench].find(c => c && c.id === charId);

    if (char && char.damage > 0) {
        const actualHeal = Math.min(healAmount, char.damage);
        char.damage -= actualHeal;
        game.log(`Drain: ${char.name} healed ${actualHeal} damage!`, 'heal');
    }

    closeModal('action-modal');
    updateUI();
}

function showCherryHealSelection(player, benchedChars, healAmount) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Cherry Flavored Valve Oil: Heal Benched Character</h2>`;
    html += `<p>Select a benched character to heal ${healAmount} damage:</p>`;
    html += `<div class="target-selection">`;

    benchedChars.forEach(char => {
        const currentHp = char.hp - (char.damage || 0);
        html += `<div class="target-option" onclick="applyCherryHeal('${char.id}', ${healAmount})">
            ${char.name} - ${currentHp}/${char.hp} HP
        </div>`;
    });

    html += `</div>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function applyCherryHeal(charId, healAmount) {
    const player = game.players[game.currentPlayer];
    const char = [player.active, ...player.bench].find(c => c && c.id === charId);

    if (char) {
        game.dealDamage(char, -healAmount);
        game.log(`Cherry Flavored Valve Oil: ${char.name} healed ${healAmount} HP!`, 'heal');
    }

    closeModal('action-modal');
    updateUI();
}

function showEmbouchureSelection(player) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const charsWithEnergy = [player.active, ...player.bench].filter(c => c && c.attachedEnergy && c.attachedEnergy.length > 0);

    if (charsWithEnergy.length === 0) {
        alert('No characters have energy to move!');
        closeModal('action-modal');
        return;
    }

    let html = `<h2>Embouchure: Move Energy</h2>`;
    html += `<p>Select source character:</p>`;
    html += `<div class="target-selection">`;

    charsWithEnergy.forEach(char => {
        html += `<div class="target-option" onclick="selectEmbouchureSource('${char.id}')">
            ${char.name} - ${char.attachedEnergy.length} energy
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectEmbouchureSource(sourceId) {
    const player = game.players[game.currentPlayer];
    const source = [player.active, ...player.bench].find(c => c && c.id === sourceId);

    if (!source) return;

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Embouchure: Select Energy</h2>`;
    html += `<p>Select energy from ${source.name}:</p>`;
    html += `<div class="target-selection">`;

    source.attachedEnergy.forEach((energy, idx) => {
        html += `<div class="target-option" onclick="selectEmbouchureEnergy('${sourceId}', ${idx})">
            ${energy.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function selectEmbouchureEnergy(sourceId, energyIdx) {
    const player = game.players[game.currentPlayer];
    const source = [player.active, ...player.bench].find(c => c && c.id === sourceId);

    if (!source) return;

    game.tempSelections = game.tempSelections || {};
    game.tempSelections.embouchureSource = source;
    game.tempSelections.embouchureEnergyIdx = energyIdx;

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const targets = [player.active, ...player.bench].filter(c => c && c.id !== sourceId);

    let html = `<h2>Embouchure: Select Target</h2>`;
    html += `<p>Select character to receive energy:</p>`;
    html += `<div class="target-selection">`;

    targets.forEach(char => {
        html += `<div class="target-option" onclick="completeEmbouchure('${char.id}')">
            ${char.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function completeEmbouchure(targetId) {
    const player = game.players[game.currentPlayer];
    const source = game.tempSelections.embouchureSource;
    const energyIdx = game.tempSelections.embouchureEnergyIdx;
    const target = [player.active, ...player.bench].find(c => c && c.id === targetId);

    if (source && target && source.attachedEnergy[energyIdx]) {
        const energy = source.attachedEnergy.splice(energyIdx, 1)[0];
        target.attachedEnergy.push(energy);
        game.log(`Embouchure: Moved energy from ${source.name} to ${target.name}`);
    }

    closeModal('action-modal');
    updateUI();
}

function showDrumKidWorkshopSelection(percussionChars, attacker, target) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Drum Kid Workshop: Select Character</h2>`;
    html += `<p>Select a percussion character to copy an attack from:</p>`;
    html += `<div class="target-selection">`;

    percussionChars.forEach(char => {
        if (char.moves && char.moves.length > 0) {
            html += `<div class="target-option" onclick="showDrumKidWorkshopMoves('${char.id}', '${attacker.id}')">
                ${char.name} (${char.moves.length} move${char.moves.length > 1 ? 's' : ''})
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showDrumKidWorkshopMoves(sourceId, attackerId) {
    const allChars = [
        ...game.players[1].active ? [game.players[1].active] : [],
        ...game.players[1].bench.filter(c => c),
        ...game.players[2].active ? [game.players[2].active] : [],
        ...game.players[2].bench.filter(c => c)
    ];

    const source = allChars.find(c => c.id === sourceId);
    if (!source || !source.moves) return;

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Drum Kid Workshop: Select Attack</h2>`;
    html += `<p>Choose which attack from ${source.name} to copy:</p>`;
    html += `<div class="target-selection">`;

    source.moves.forEach((move, idx) => {
        const costStr = move.cost ? (Array.isArray(move.cost) ? move.cost.join('') : move.cost.toString()) : '0';
        html += `<div class="target-option" onclick="showDrumKidWorkshopTargetSelection('${sourceId}', '${attackerId}', ${idx})">
            ${move.name} [${costStr}] - ${move.damage || 0} dmg<br>
            <small style="color: #666;">${move.effect || ''}</small>
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showDrumKidWorkshopTargetSelection(sourceId, attackerId, moveIndex) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    const allChars = [
        ...game.players[1].active ? [game.players[1].active] : [],
        ...game.players[1].bench.filter(c => c),
        ...game.players[2].active ? [game.players[2].active] : [],
        ...game.players[2].bench.filter(c => c)
    ];

    const source = allChars.find(c => c.id === sourceId);
    const move = source && source.moves ? source.moves[moveIndex] : null;
    if (!move) return;

    const noTargetMoves = [
        'Turn Up!',
        'Vocal warmups',
        'Percussion Ensemble',
        'Personal use',
        'Arrangement procrastination'
    ];

    if (noTargetMoves.includes(move.name)) {
        const defaultTarget = opponent.active ? opponent.active.id : null;
        executeDrumKidWorkshop(sourceId, attackerId, defaultTarget, moveIndex);
        return;
    }

    const benchTargetingMoves = ['Small Ensemble Committee', 'Jennie spread attack', 'Rudiments', 'You know what it is'];
    const canTargetBench = benchTargetingMoves.includes(move.name);

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Drum Kid Workshop: Select Target</h2>`;
    html += `<div class="target-selection">`;

    if (opponent.active) {
        html += `<button class="target-option action-btn" onclick="executeDrumKidWorkshop('${sourceId}', '${attackerId}', '${opponent.active.id}', ${moveIndex})" style="color: #000;">
            ${opponent.active.name} (Active)
        </button>`;
    }

    if (canTargetBench) {
        opponent.bench.forEach((benchChar, idx) => {
            if (benchChar) {
                html += `<button class="target-option action-btn" onclick="executeDrumKidWorkshop('${sourceId}', '${attackerId}', '${benchChar.id}', ${moveIndex})" style="color: #000;">
                    ${benchChar.name} (Bench ${idx + 1})
                </button>`;
            }
        });
    }

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeDrumKidWorkshop(sourceId, attackerId, targetId, moveIndex = 0) {
    const allChars = [
        ...game.players[1].active ? [game.players[1].active] : [],
        ...game.players[1].bench.filter(c => c),
        ...game.players[2].active ? [game.players[2].active] : [],
        ...game.players[2].bench.filter(c => c)
    ];

    const source = allChars.find(c => c.id === sourceId);
    const attacker = allChars.find(c => c.id === attackerId);
    const target = allChars.find(c => c.id === targetId);

    if (source && source.moves && source.moves[moveIndex] && attacker && (targetId ? target : true)) {
        const copiedMove = source.moves[moveIndex];
        game.log(`Drum Kid Workshop: Copying ${copiedMove.name} from ${source.name}`);

        // Set attackedThisTurn
        game.attackedThisTurn = true;

        // Close selection modal before executing copied move
        closeModal('action-modal');

        // Execute the copied move effect directly
        if (typeof performMoveEffect === 'function') {
            const waitForModal = performMoveEffect(attacker, target, copiedMove);
            if (waitForModal) {
                game.tempSelections = game.tempSelections || {};
                game.tempSelections.drumKidWorkshopPendingTransfer = { sourceId, attackerId };
                return;
            }
        } else {
            console.error('performMoveEffect is not defined');
            // Fallback for damage execution
            if (copiedMove.damage > 0) {
                const damage = calculateDamage(attacker, target, copiedMove.damage, copiedMove);
                game.dealDamage(target, damage);
                game.log(`Drum Kid Workshop: ${damage} damage!`, 'damage');
            }
        }

        // Transfer all energy from attacker to source
        if (attacker.attachedEnergy && attacker.attachedEnergy.length > 0) {
            const energyToTransfer = [...attacker.attachedEnergy];
            attacker.attachedEnergy = [];
            
            if (!source.attachedEnergy) source.attachedEnergy = [];
            source.attachedEnergy.push(...energyToTransfer);
            
            game.log(`Drum Kid Workshop: Transferred ${energyToTransfer.length} energy to ${source.name}`, 'info');
        }
    }

    updateUI();
}

function showTrickyRhythmsModal(attacker, target, move) {
    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Tricky Rhythms</h2>`;
    html += `<p>Choose number of energy to discard from opponent (0-3):</p>`;
    html += `<div class="target-selection">`;

    for (let i = 0; i <= 3; i++) {
        html += `<div class="target-option" onclick="executeTrickyRhythms(${i}, '${target.id}')">
            Discard ${i} energy
        </div>`;
    }

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeTrickyRhythms(discardCount, targetId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const player = game.players[game.currentPlayer];
    const attacker = player.active;
    const target = [opponent.active, ...opponent.bench].find(c => c && c.id === targetId);

    if (!target) return;

    // Discard energy from opponent
    for (let i = 0; i < discardCount && target.attachedEnergy && target.attachedEnergy.length > 0; i++) {
        const energy = target.attachedEnergy.pop();
        opponent.discard.push(energy);
    }

    // Damage = 10 × (3 - discarded)
    const damage = 10 * (3 - discardCount);
    if (damage > 0) {
        const finalDamage = calculateDamage(attacker, target, damage, { name: 'Tricky Rhythms' });
        game.dealDamage(target, finalDamage);
        game.log(`Tricky Rhythms: Discarded ${discardCount} energy, ${finalDamage} damage!`, 'damage');
    }

    closeModal('action-modal');
    updateUI();
}

function showRacketSmashSelection(player, benchChars) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Racket Smash: Discard Energy</h2>`;
    html += `<p>Select an opponent's benched character to discard energy from:</p>`;
    html += `<div class="target-selection">`;

    benchChars.forEach(char => {
        html += `<div class="target-option" onclick="executeRacketSmash('${char.id}')">
            ${char.name} - ${char.attachedEnergy.length} energy
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showSnapPizzDiscardSelection(opponentChars) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Snap Pizz: Discard Energy</h2>`;
    html += `<p>Choose an opponent character to discard up to 2 energy from:</p>`;
    html += `<div class="target-selection">`;

    opponentChars.forEach(char => {
        const energyCount = char.attachedEnergy ? char.attachedEnergy.length : 0;
        html += `<div class="target-option" onclick="executeSnapPizzDiscard('${char.id}')">
            ${char.name} (${energyCount} energy)
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeSnapPizzDiscard(targetId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const target = [opponent.active, ...opponent.bench].find(c => c && c.id === targetId);

    if (target && target.attachedEnergy && target.attachedEnergy.length > 0) {
        const discardCount = Math.min(2, target.attachedEnergy.length);
        for (let i = 0; i < discardCount; i++) {
            const discardedEnergy = target.attachedEnergy.pop();
            opponent.discard.push(discardedEnergy);
        }
        game.log(`Snap Pizz: Discarded ${discardCount} energy from ${target.name}!`);
    } else {
        game.log('Snap Pizz: No energy to discard');
    }

    closeModal('action-modal');
    updateUI();
}

function executeRacketSmash(charId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const char = opponent.bench.find(c => c && c.id === charId);

    if (char && char.attachedEnergy && char.attachedEnergy.length > 0) {
        const energy = char.attachedEnergy.pop();
        opponent.discard.push(energy);
        game.log(`Racket Smash: Discarded energy from ${char.name}`);
    }

    closeModal('action-modal');
    updateUI();
}

function showBorrowSelection(player, stringChars, attacker, isAbility = false) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    game.tempSelections = game.tempSelections || {};
    game.tempSelections.borrowIsAbility = !!isAbility;

    let html = `<h2>Borrow: Move Energy</h2>`;
    html += `<p>Select string character to borrow energy from:</p>`;
    html += `<div class="target-selection">`;

    stringChars.forEach(char => {
        html += `<div class="target-option" onclick="executeBorrow('${char.id}', '${attacker.id}')">
            ${char.name} - ${char.attachedEnergy.length} energy
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showPercussionEnsembleSelection(player, percussionists) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Percussion Ensemble</h2>`;
    html += `<p>Select a benched Percussion character to attach energy to:</p>`;
    html += `<div class="target-selection">`;

    percussionists.forEach(char => {
        html += `<div class="target-option" onclick="showPercussionEnsembleEnergyCount('${char.id}')">
            ${char.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showPercussionEnsembleEnergyCount(targetId) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Percussion Ensemble</h2>`;
    html += `<p>Attach how many energy? (1 or 2)</p>`;
    html += `<div class="target-selection">`;
    html += `<div class="target-option" onclick="executePercussionEnsemble('${targetId}', 1)">Attach 1 energy</div>`;
    html += `<div class="target-option" onclick="executePercussionEnsemble('${targetId}', 2)">Attach 2 energy</div>`;
    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executePercussionEnsemble(targetId, energyCount) {
    const player = game.players[game.currentPlayer];
    const target = player.bench.find(c => c && c.id === targetId);

    if (target) {
        if (!target.attachedEnergy) target.attachedEnergy = [];
        const count = energyCount === 2 ? 2 : 1;
        for (let i = 0; i < count; i++) {
            target.attachedEnergy.push({ generic: true });
        }
        game.log(`Percussion Ensemble: Attached ${count} energy to ${target.name}`);
    }

    closeModal('action-modal');
    updateUI();
}

function executeBorrow(sourceId, attackerId) {
    const player = game.players[game.currentPlayer];
    const source = [player.active, ...player.bench].find(c => c && c.id === sourceId);
    const attacker = [player.active, ...player.bench].find(c => c && c.id === attackerId);

    if (source && attacker && source.attachedEnergy && source.attachedEnergy.length > 0) {
        const energy = source.attachedEnergy.pop();
        attacker.attachedEnergy.push(energy);
        game.log(`Borrow: Moved energy from ${source.name} to ${attacker.name}`);
        if (game.tempSelections && game.tempSelections.borrowIsAbility) {
            game.borrowABowUsedThisTurn = true;
        }
    }

    if (game.tempSelections) {
        delete game.tempSelections.borrowIsAbility;
    }

    closeModal('action-modal');
    updateUI();
}

function showForesightModal(opponent, topThree) {
    const modal = document.getElementById('action-modal');
    game.tempSelections = game.tempSelections || {};
    game.tempSelections.foresightCards = topThree;
    game.tempSelections.foresightOriginal = topThree.slice();
    game.tempSelections.foresightOpponent = opponent;
    game.tempSelections.foresightPending = true;

    renderForesightModal();
    modal.classList.remove('hidden');
}

function renderForesightModal() {
    const content = document.getElementById('action-content');
    const cards = game.tempSelections.foresightCards || [];

    let html = `<h2>Foresight: Rearrange Opponent's Deck</h2>`;
    html += `<p>Move cards to set the new top-to-bottom order:</p>`;
    html += `<div id="foresight-list" class="target-selection">`;

    cards.forEach((card, idx) => {
        html += `<div class="target-option" data-foresight-index="${idx}">`;
        html += `<div>${idx + 1}. ${card.name}</div>`;
        html += `<div class="action-buttons">`;
        html += `<button class="action-btn" onclick="moveForesightCard(${idx}, -1)">Up</button>`;
        html += `<button class="action-btn" onclick="moveForesightCard(${idx}, 1)">Down</button>`;
        html += `</div>`;
        html += `</div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="completeForesight()">Confirm Order</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
}

function moveForesightCard(index, direction) {
    const cards = game.tempSelections.foresightCards;
    if (!cards) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= cards.length) return;

    const temp = cards[index];
    cards[index] = cards[newIndex];
    cards[newIndex] = temp;

    renderForesightModal();
}

function completeForesight() {
    const cards = game.tempSelections.foresightCards;
    const opponent = game.tempSelections.foresightOpponent;

    if (cards && opponent) {
        opponent.deck.unshift(...cards);
    }

    if (game.tempSelections) {
        delete game.tempSelections.foresightCards;
        delete game.tempSelections.foresightOriginal;
        delete game.tempSelections.foresightOpponent;
        delete game.tempSelections.foresightPending;
    }

    game.log('Foresight: Opponent\'s top 3 cards rearranged');
    closeModal('action-modal');
    updateUI();
}

function showGachaGamingModal(player, attacker) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Gacha Gaming</h2>`;
    html += `<p>Draw one card at a time. Stop any time. Each draw deals 20 damage (cannot KO).</p>`;
    html += `<div class="action-buttons">`;
    html += `<button class="action-btn" onclick="executeGachaGaming(1)">Start Drawing</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeGachaGaming(drawCount) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;
    if (!game.tempSelections) game.tempSelections = {};
    if (!game.tempSelections.gachaGaming) {
        game.tempSelections.gachaGaming = {
            drawn: [],
            resolved: false
        };
    }

    executeGachaGamingStep();
}

function executeGachaGamingStep() {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections || !game.tempSelections.gachaGaming || game.tempSelections.gachaGaming.resolved) {
        return;
    }

    if (player.deck.length === 0) {
        finalizeGachaGaming(false);
        return;
    }

    const card = player.deck.shift();
    game.tempSelections.gachaGaming.drawn.push(card);
    game.log(`Gacha Gaming: Drew ${card.name}`);

    const currentHp = attacker.hp - (attacker.damage || 0);
    const maxDamage = Math.max(0, currentHp - 10);
    const damage = Math.min(20, maxDamage);
    if (damage > 0) {
        game.dealDamage(attacker, damage);
        game.log(`Gacha Gaming: Took ${damage} damage`, 'damage');
    }

    if (card.name === 'AVGE Birb') {
        finalizeGachaGaming(true);
        return;
    }

    let html = `<h2>Gacha Gaming</h2>`;
    html += `<p>Last draw: ${card.name}</p>`;
    const remainingHp = attacker.hp - (attacker.damage || 0);
    const canDrawAgain = remainingHp > 20;
    html += `<div class="action-buttons">`;
    if (canDrawAgain) {
        html += `<button class="action-btn" onclick="executeGachaGamingStep()">Draw Again</button>`;
    } else {
        html += `<p style="margin: 0; color: #b00020;">Cannot draw again (would KO).</p>`;
    }
    html += `<button class="action-btn" onclick="finalizeGachaGaming(false)">Stop Drawing</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
    updateUI();
}

function finalizeGachaGaming(drewBirb) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;
    const drawn = game.tempSelections?.gachaGaming?.drawn || [];

    if (drewBirb) {
        attacker.damage = 0;
        game.log('Gacha Gaming: Drew AVGE Birb, healed all damage and kept drawn cards!');
        drawn.forEach(card => {
            player.hand.push(card);
        });
    } else {
        player.deck.push(...drawn);
        game.shuffleDeck(game.currentPlayer);
        game.log('Gacha Gaming: Stopped drawing, shuffled drawn cards back into deck');
    }

    if (game.tempSelections && game.tempSelections.gachaGaming) {
        game.tempSelections.gachaGaming.resolved = true;
        delete game.tempSelections.gachaGaming;
    }

    closeModal('action-modal');
    updateUI();
}

function showSongVotingModal(opponent, attacker, target, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const hand = opponent.hand.map(c => c.name).join(', ');

    let html = `<h2>Song Voting</h2>`;
    html += `<p>Opponent's hand: ${hand}</p>`;
    html += `<p>Choose card type to count:</p>`;
    html += `<div class="target-selection">`;
    html += `<div class="target-option" onclick="executeSongVoting('character', '${target.id}')">Character</div>`;
    html += `<div class="target-option" onclick="executeSongVoting('energy', '${target.id}')">Energy</div>`;
    html += `<div class="target-option" onclick="executeSongVoting('item', '${target.id}')">Item</div>`;
    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showSongVotingSelectionModal(playerNum) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const player = game.players[playerNum];
    if (!game.tempSelections || !game.tempSelections.songVoting) return;

    game.tempSelections.songVoting.pendingForPlayer = playerNum;
    game.tempSelections.songVoting.prompted[playerNum] = true;

    let html = `<h2>Song Voting - Select 2 Cards</h2>`;
    html += `<p>Player ${playerNum}: Choose exactly two cards to reveal.</p>`;
    html += `<p>Selected: <span id="song-voting-count">0</span>/2</p>`;
    html += `<div class="target-selection">`;

    player.hand.forEach(card => {
        html += `<div class="target-option" id="song-voting-${playerNum}-${card.id}" onclick="toggleSongVotingCard(${playerNum}, '${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="confirmSongVotingSelection(${playerNum})">Confirm Selection</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleSongVotingCard(playerNum, cardId) {
    if (!game.tempSelections || !game.tempSelections.songVoting) return;
    const selection = game.tempSelections.songVoting.selections[playerNum];
    const cardElement = document.getElementById(`song-voting-${playerNum}-${cardId}`);

    const index = selection.indexOf(cardId);
    if (index >= 0) {
        selection.splice(index, 1);
        if (cardElement) cardElement.classList.remove('selected');
    } else {
        if (selection.length >= 2) {
            alert('You can only select 2 cards.');
            return;
        }
        selection.push(cardId);
        if (cardElement) cardElement.classList.add('selected');
    }

    const counter = document.getElementById('song-voting-count');
    if (counter) counter.textContent = selection.length;
}

function confirmSongVotingSelection(playerNum) {
    if (!game.tempSelections || !game.tempSelections.songVoting) return;
    const selection = game.tempSelections.songVoting.selections[playerNum];
    if (selection.length !== 2) {
        alert('Select exactly 2 cards.');
        return;
    }

    const otherPlayer = playerNum === 1 ? 2 : 1;
    if (!game.tempSelections.songVoting.selections[otherPlayer] || game.tempSelections.songVoting.selections[otherPlayer].length !== 2) {
        if (!multiplayer.enabled) {
            showSongVotingSelectionModal(otherPlayer);
        }
        closeModal('action-modal');
        updateUI();
        return;
    }

    resolveSongVoting();
}

function resolveSongVoting() {
    const sv = game.tempSelections && game.tempSelections.songVoting;
    if (!sv) return;
    const player1 = game.players[1];
    const player2 = game.players[2];

    const p1Cards = sv.selections[1].map(id => player1.hand.find(c => c.id === id)).filter(Boolean);
    const p2Cards = sv.selections[2].map(id => player2.hand.find(c => c.id === id)).filter(Boolean);

    const revealed = [...p1Cards, ...p2Cards];
    const supporterCount = revealed.filter(c => c.cardType === 'supporter').length;
    const characterCount = revealed.filter(c => c.cardType === 'character').length;

    const currentPlayerNum = game.currentPlayer;
    const opponentNum = currentPlayerNum === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const attacker = game.players[currentPlayerNum].active;

    if (supporterCount === 0 || supporterCount === 2) {
        if (opponent.active && attacker) {
            const dmg = calculateDamage(attacker, opponent.active, 50, { name: 'Song Voting' });
            game.dealDamage(opponent.active, dmg);
            game.log(`Song Voting: ${supporterCount} supporter cards → ${dmg} damage to opponent active`, 'damage');
        }
    }

    if (characterCount === 0 || characterCount === 2) {
        const benchTargets = opponent.bench.filter(c => c);
        if (benchTargets.length > 0 && attacker) {
            benchTargets.forEach(target => {
                const dmg = calculateDamage(attacker, target, 50, { name: 'Song Voting' });
                game.dealDamage(target, dmg);
                game.log(`Song Voting: ${characterCount} character cards → ${dmg} damage to ${target.name}`, 'damage');
            });
        }
    }

    delete game.tempSelections.songVoting;
    closeModal('action-modal');
    updateUI();
}

function executeSongVoting(cardType, targetId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const player = game.players[game.currentPlayer];
    const attacker = player.active;
    const target = [opponent.active, ...opponent.bench].find(c => c && c.id === targetId);

    const count = opponent.hand.filter(c => c.cardType === cardType).length;
    const damage = count * 10;

    if (damage > 0) {
        const finalDamage = calculateDamage(attacker, target, damage, { name: 'Song Voting' });
        game.dealDamage(target, finalDamage);
        game.log(`Song Voting: ${count} ${cardType} cards for ${finalDamage} damage!`, 'damage');
    } else {
        game.log('Song Voting: No cards of that type');
    }

    closeModal('action-modal');
    updateUI();
}

function showAnalysisParalysisModal(opponentNum) {
    const opponent = game.players[opponentNum];
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Analysis Paralysis: Shuffle Card Back</h2>`;
    html += `<p>Select card to shuffle back into deck:</p>`;
    html += `<div class="target-selection">`;

    opponent.hand.forEach((card, idx) => {
        html += `<div class="target-option" onclick="executeAnalysisParalysis(${opponentNum}, ${idx})">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeAnalysisParalysis(opponentNum, cardIdx) {
    const opponent = game.players[opponentNum];

    if (opponent.hand[cardIdx]) {
        const card = opponent.hand.splice(cardIdx, 1)[0];
        opponent.deck.push(card);
        game.shuffleDeck(opponentNum);
        game.log(`Analysis Paralysis: Shuffled ${card.name} back into opponent's deck`);
    }

    closeModal('action-modal');
    updateUI();
}

function showWipeoutSelection(player, opponent, attacker) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const allTargets = [
        player.active,
        ...player.bench,
        opponent.active,
        ...opponent.bench
    ].filter(c => c);

    game.tempSelections = game.tempSelections || {};
    game.tempSelections.wipeoutTargets = [attacker.id];
    game.tempSelections.wipeoutAttacker = attacker;

    let html = `<h2>Wipeout: Select 3 Targets</h2>`;
    html += `<p>You must include yourself. Select 2 other characters:</p>`;
    html += `<div id="wipeout-targets" class="target-selection">`;

    allTargets.forEach(char => {
        const isSelf = char.id === attacker.id;
        const selectedClass = isSelf ? ' selected' : '';
        html += `<div class="target-option${selectedClass}" data-wipeout-id="${char.id}" onclick="addWipeoutTarget('${char.id}')">
            ${char.name}${isSelf ? ' (You)' : ''}
        </div>`;
    });

    html += `</div>`;
    html += `<p id="wipeout-selected">Selected: 1/3</p>`;
    html += `<button class="action-btn" onclick="executeWipeout()">Confirm</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function addWipeoutTarget(charId) {
    const targets = game.tempSelections.wipeoutTargets;
    const attacker = game.tempSelections.wipeoutAttacker;
    if (attacker && charId === attacker.id) {
        return;
    }

    if (targets.includes(charId)) {
        // Remove if already selected
        game.tempSelections.wipeoutTargets = targets.filter(id => id !== charId);
    } else if (targets.length < 3) {
        targets.push(charId);
    }

    const option = document.querySelector(`[data-wipeout-id="${charId}"]`);
    if (option) {
        option.classList.toggle('selected', game.tempSelections.wipeoutTargets.includes(charId));
    }

    document.getElementById('wipeout-selected').textContent = `Selected: ${game.tempSelections.wipeoutTargets.length}/3`;
}

function executeWipeout() {
    const targets = game.tempSelections.wipeoutTargets;
    const attacker = game.tempSelections.wipeoutAttacker;

    if (targets.length !== 3) {
        alert('Must select exactly 3 targets!');
        return;
    }

    const allChars = [
        ...game.players[1].active ? [game.players[1].active] : [],
        ...game.players[1].bench.filter(c => c),
        ...game.players[2].active ? [game.players[2].active] : [],
        ...game.players[2].bench.filter(c => c)
    ];

    targets.forEach(targetId => {
        const target = allChars.find(c => c.id === targetId);
        if (target) {
            const damage = calculateDamage(attacker, target, 80, { name: 'Wipeout' });
            game.dealDamage(target, damage);
            game.log(`Wipeout: ${target.name} takes ${damage} damage!`, 'damage');
        }
    });

    closeModal('action-modal');
    updateUI();
}

function showOutreachSelection(player, characters) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    let html = `<h2>Outreach: Search for Character</h2>`;
    html += `<p>Select character to put on top of deck:</p>`;
    html += `<div class="target-selection">`;

    characters.forEach(char => {
        html += `<div class="target-option" onclick="executeOutreach('${char.id}')">
            ${char.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function showArtistAlleySelection(eligibleCards, attacker, target, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    game.tempSelections = game.tempSelections || {};
    game.tempSelections.artistAlleySelected = new Set();
    game.tempSelections.artistAlleyAttacker = attacker;
    game.tempSelections.artistAlleyTarget = target;
    game.tempSelections.artistAlleyMove = move;

    let html = `<h2>Artist Alley</h2>`;
    html += `<p>Select any number of Concert Programs/Tickets to discard:</p>`;
    html += `<div class="target-selection">`;

    eligibleCards.forEach(card => {
        html += `<div class="target-option" data-artist-card-id="${card.id}" onclick="toggleArtistAlleyCard('${card.id}')">
            ${card.name}
        </div>`;
    });

    html += `</div>`;
    html += `<p id="artist-alley-selected">Selected: 0</p>`;
    html += `<button class="action-btn" onclick="confirmArtistAlley()">Confirm</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleArtistAlleyCard(cardId) {
    if (!game.tempSelections || !game.tempSelections.artistAlleySelected) return;
    const selected = game.tempSelections.artistAlleySelected;

    if (selected.has(cardId)) {
        selected.delete(cardId);
    } else {
        selected.add(cardId);
    }

    const option = document.querySelector(`[data-artist-card-id="${cardId}"]`);
    if (option) {
        option.classList.toggle('selected', selected.has(cardId));
    }

    const count = selected.size;
    const countLabel = document.getElementById('artist-alley-selected');
    if (countLabel) countLabel.textContent = `Selected: ${count}`;
}

function confirmArtistAlley() {
    if (!game.tempSelections || !game.tempSelections.artistAlleySelected) return;
    const selected = Array.from(game.tempSelections.artistAlleySelected);
    const attacker = game.tempSelections.artistAlleyAttacker;
    const move = game.tempSelections.artistAlleyMove;
    const player = game.players[game.currentPlayer];

    if (selected.length === 0) {
        closeModal('action-modal');
        return;
    }

    selected.forEach(cardId => {
        const card = player.hand.find(c => c.id === cardId);
        if (card) {
            player.discard.push(card);
            player.hand = player.hand.filter(c => c.id !== cardId);
        }
    });

    const totalDamage = selected.length * 40;
    game.tempSelections.artistAlleyDamage = totalDamage;

    showArtistAlleyTargetSelection(attacker, move);
}

function showArtistAlleyTargetSelection(attacker, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const allChars = [
        game.players[1].active, ...game.players[1].bench,
        game.players[2].active, ...game.players[2].bench
    ].filter(c => c);

    let html = `<h2>Artist Alley - Choose Target</h2>`;
    html += `<p>Select any character in play to take the damage.</p>`;
    html += `<div class="target-selection">`;

    allChars.forEach(char => {
        html += `<div class="target-option" onclick="executeArtistAlleyDamage('${char.id}')">
            ${char.name} (${char === game.players[1].active || char === game.players[2].active ? 'Active' : 'Bench'})
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeArtistAlleyDamage(targetId) {
    const attacker = game.tempSelections.artistAlleyAttacker;
    const move = game.tempSelections.artistAlleyMove;
    const damage = game.tempSelections.artistAlleyDamage || 0;
    const allChars = [
        game.players[1].active, ...game.players[1].bench,
        game.players[2].active, ...game.players[2].bench
    ].filter(c => c);
    const target = allChars.find(c => c.id === targetId);

    if (attacker && target && damage > 0) {
        const finalDamage = calculateDamage(attacker, target, damage, move);
        game.dealDamage(target, finalDamage);
        game.log(`Artist Alley: Discarded programs/tickets for ${finalDamage} damage to ${target.name}!`, 'damage');
    }

    if (game.tempSelections) {
        delete game.tempSelections.artistAlleySelected;
        delete game.tempSelections.artistAlleyAttacker;
        delete game.tempSelections.artistAlleyMove;
        delete game.tempSelections.artistAlleyDamage;
    }
    closeModal('action-modal');
    updateUI();
}

function showRossAttackTargetSelection(opponentChars, attacker, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    game.tempSelections = game.tempSelections || {};
    game.tempSelections.rossAttack = { attackerId: attacker.id, moveName: move.name };

    let html = `<h2>Ross Attack! - Choose target</h2>`;
    html += `<div class="target-selection">`;

    opponentChars.forEach(char => {
        html += `<button class="target-option action-btn" onclick="executeRossAttackTarget('${char.id}')" style="color: #000;">
            ${char.name}
        </button>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeRossAttackTarget(targetId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const target = [opponent.active, ...opponent.bench].find(c => c && c.id === targetId);
    const selection = game.tempSelections && game.tempSelections.rossAttack;

    if (target && selection) {
        const player = game.players[game.currentPlayer];
        const attacker = [player.active, ...player.bench].find(c => c && c.id === selection.attackerId);
        const move = attacker && attacker.moves ? attacker.moves.find(m => m.name === selection.moveName) : { name: 'Ross Attack!' };

        if (attacker) {
            const rossDamage = calculateDamage(attacker, target, 50, move);
            game.dealDamage(target, rossDamage);
            game.log(`Ross Attack!: ${target.name} takes ${rossDamage} damage!`, 'damage');
        }
    }

    closeModal('action-modal');
    updateUI();
}

function showE2ReactionSelection(opponent, attacker, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const benchedChars = opponent.bench.filter(c => c);

    let html = `<h2>E2 Reaction</h2>`;
    html += `<p>Select an opponent's benched character to shuffle back into deck:</p>`;
    html += `<div class="target-selection">`;

    benchedChars.forEach(char => {
        html += `<div class="target-option" onclick="executeE2Reaction('${char.id}')">
            ${char.name}
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeE2Reaction(charId) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const benchIndex = opponent.bench.findIndex(c => c && c.id === charId);

    if (benchIndex !== -1) {
        const benchTarget = opponent.bench[benchIndex];
        opponent.bench[benchIndex] = null;
        if (benchTarget.attachedTools && benchTarget.attachedTools.length > 0) {
            opponent.deck.push(...benchTarget.attachedTools);
            benchTarget.attachedTools = [];
        }
        opponent.deck.push(benchTarget);
        game.shuffleDeck(opponentNum);
        game.log(`E2 Reaction: Shuffled ${benchTarget.name} back into deck`);
    }

    closeModal('action-modal');
    updateUI();
}

function showHarmonicsChoice(attacker, opponent, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.harmonics = {
        attackerId: attacker.id,
        moveName: move.name
    };

    let html = `<h2>Harmonics</h2>`;
    html += `<p>Choose a targeting option:</p>`;
    html += `<div class="target-selection">`;
    html += `<button class="action-btn" onclick="startHarmonicsSelection(3, 60)">3 targets for 60 each</button>`;
    html += `<button class="action-btn" onclick="startHarmonicsSelection(2, 70)">2 targets for 70 each</button>`;
    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function startHarmonicsSelection(targetCount, damage) {
    if (!game.tempSelections) game.tempSelections = {};
    game.tempSelections.harmonicsTargetCount = targetCount;
    game.tempSelections.harmonicsDamage = damage;
    game.tempSelections.harmonicsSelected = new Set();
    showHarmonicsTargetSelection();
}

function showHarmonicsTargetSelection() {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const targets = [opponent.active, ...opponent.bench].filter(c => c);

    if (targets.length === 0) {
        game.log('Harmonics: No targets available', 'info');
        closeModal('action-modal');
        return;
    }

    const selected = game.tempSelections.harmonicsSelected;
    const targetCount = game.tempSelections.harmonicsTargetCount;
    const damage = game.tempSelections.harmonicsDamage;

    let html = `<h2>Harmonics - Select Targets</h2>`;
    html += `<p>Select ${targetCount} target(s) for ${damage} damage each.</p>`;
    html += `<div class="target-selection">`;

    targets.forEach(char => {
        const isSelected = selected.has(char.id);
        html += `<div class="target-option${isSelected ? ' selected' : ''}" onclick="toggleHarmonicsTarget('${char.id}')">
            ${char.name}${char === opponent.active ? ' (Active)' : ''}
        </div>`;
    });

    html += `</div>`;
    html += `<p>Selected: ${selected.size}/${targetCount}</p>`;
    html += `<button class="action-btn" onclick="confirmHarmonicsTargets()">Confirm</button>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function toggleHarmonicsTarget(targetId) {
    const selected = game.tempSelections && game.tempSelections.harmonicsSelected;
    if (!selected) return;

    if (selected.has(targetId)) {
        selected.delete(targetId);
    } else {
        selected.add(targetId);
    }

    showHarmonicsTargetSelection();
}

function confirmHarmonicsTargets() {
    const selection = game.tempSelections && game.tempSelections.harmonics;
    const selected = game.tempSelections && game.tempSelections.harmonicsSelected;
    if (!selection || !selected) return;

    const targetCount = game.tempSelections.harmonicsTargetCount;
    if (selected.size !== targetCount) {
        alert(`Select exactly ${targetCount} targets.`);
        return;
    }

    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    const attacker = [player.active, ...player.bench].find(c => c && c.id === selection.attackerId);
    const move = attacker && attacker.moves ? attacker.moves.find(m => m.name === selection.moveName) : { name: 'Harmonics' };
    const damage = game.tempSelections.harmonicsDamage;

    if (attacker) {
        const allTargets = [opponent.active, ...opponent.bench].filter(c => c);
        selected.forEach(targetId => {
            const target = allTargets.find(c => c.id === targetId);
            if (target) {
                const finalDamage = calculateDamage(attacker, target, damage, move);
                game.dealDamage(target, finalDamage);
                game.log(`Harmonics: ${target.name} takes ${finalDamage} damage!`, 'damage');
            }
        });
    }

    delete game.tempSelections.harmonics;
    delete game.tempSelections.harmonicsTargetCount;
    delete game.tempSelections.harmonicsDamage;
    delete game.tempSelections.harmonicsSelected;
    closeModal('action-modal');
    updateUI();
}

function executeOutreach(charId) {
    const player = game.players[game.currentPlayer];
    const char = player.deck.find(c => c.id === charId);

    if (char) {
        player.deck = player.deck.filter(c => c.id !== charId);
        player.deck.unshift(char);
        game.log(`Outreach: Put ${char.name} on top of deck`);
    }

    closeModal('action-modal');
    updateUI();
}

function loadCustomDecksIntoDropdown() {
    const customDecks = JSON.parse(localStorage.getItem('customDecks') || '{}');
    const player1Select = document.getElementById('player1-deck-select');
    const player2Select = document.getElementById('player2-deck-select');

    // Remove old custom deck options
    player1Select.querySelectorAll('.custom-deck-option').forEach(opt => opt.remove());
    player2Select.querySelectorAll('.custom-deck-option').forEach(opt => opt.remove());

    // Add custom deck options
    Object.keys(customDecks).forEach(deckName => {
        const option1 = document.createElement('option');
        option1.value = `custom:${deckName}`;
        option1.textContent = `${deckName} (Custom)`;
        option1.className = 'custom-deck-option';
        player1Select.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = `custom:${deckName}`;
        option2.textContent = `${deckName} (Custom)`;
        option2.className = 'custom-deck-option';
        player2Select.appendChild(option2);
    });
}

// Event listeners for deck builder
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchCardTab(btn.dataset.type);
        });
    });

    // Save deck button
    document.getElementById('save-deck-btn').addEventListener('click', saveDeck);

    // Clear deck button
    document.getElementById('clear-deck-btn').addEventListener('click', clearDeck);

    // Update save button when deck name changes
    document.getElementById('custom-deck-name').addEventListener('input', updateDeckDisplay);
});

function performMoveEffect(attacker, target, move) {
    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    // Execute specific attack effects by move name
    switch (move.name) {
        case 'Vibrato':
            // Standard damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Vocal warmups':
            // Attach an energy from your hand to this character
            const energyCards = player.hand.filter(c => c.cardType === 'energy');
            if (energyCards.length > 0) {
                game.log(`${attacker.name} used Vocal warmups - select energy from hand to attach`);
                showHandEnergySelectionModal(player, attacker, energyCards);
                return true;
            } else {
                game.log('No energy in hand to attach');
            }
            break;

        case 'SATB':
            // For each choir in play, choose opponent's character and do 20 damage
            const choirCount = [player.active, ...player.bench].filter(c => c && c.type.includes(TYPES.CHOIR)).length;
            game.log(`SATB: Found ${choirCount} choir characters`);

            if (choirCount > 0) {
                // Initialize SATB targeting
                if (!game.tempSelections) game.tempSelections = {};
                game.tempSelections.satbHitsRemaining = choirCount;
                game.tempSelections.satbAttacker = attacker;
                showSATBTargetSelection(opponent);
                return true;
            } else {
                game.log('No choir characters in play', 'info');
            }
            break;

        case 'Artist Alley':
            // Discard chosen concert programs/tickets and do 40 damage each
            const eligible = player.hand.filter(c => c.name === 'Concert Program' || c.name === 'Concert Ticket');
            if (eligible.length > 0) {
                showArtistAlleySelection(eligible, attacker, target, move);
                return true;
            }
            game.log('Artist Alley: No Concert Programs or Tickets in hand', 'info');
            break;

        case 'Circular Breathing':
            // 10 damage, next turn +10 damage (stacks up to 50)
            executeDamageAttack(attacker, target, move);
            if (!attacker.circularBreathingBonus) attacker.circularBreathingBonus = 0;
            attacker.circularBreathingBonus = Math.min(50, attacker.circularBreathingBonus + 10);
            attacker.circularBreathingBonusTurn = game.turn + 2;
            game.log('Circular Breathing bonus will apply next turn!');
            break;

        case 'Turn Up!':
            // Next turn, guitars do 30 more damage
            if (!game.nextTurnEffects[game.currentPlayer].turnUpBonus) {
                game.nextTurnEffects[game.currentPlayer].turnUpBonus = 0;
            }
            game.nextTurnEffects[game.currentPlayer].turnUpBonus += 30;
            game.log('Turn Up!: Guitars will do +30 damage next turn');
            break;

        case 'Feedback Loop':
            // Damage to target, each benched guitar takes 10 damage
            executeDamageAttack(attacker, target, move);
            const feedbackLoopChars = player.bench.filter(c => c && c.type.includes(TYPES.GUITAR));
            feedbackLoopChars.forEach(char => {
                game.dealDamage(char, 10);
                game.log(`Feedback Loop: ${char.name} took 10 recoil damage`);
            });
            break;

        case 'Song voting':
            // 10 damage x number of unique members, 40 damage to self
            const uniqueTypes = new Set();
            [player.active, ...player.bench, opponent.active, ...opponent.bench]
                .filter(c => c)
                .forEach(c => c.type.forEach(t => uniqueTypes.add(t)));
            const damageAmount = uniqueTypes.size * 10;
            const songVotingDamage = calculateDamage(attacker, target, damageAmount, move);
            game.dealDamage(target, songVotingDamage);
            game.dealDamage(attacker, 40);
            game.log(`Song voting: ${uniqueTypes.size} unique types for ${songVotingDamage} damage, 40 recoil`, 'damage');
            break;

        case 'Diabolical arrangement':
            // All opponents are 10 health, this character is knocked out
            [opponent.active, ...opponent.bench].filter(c => c).forEach(char => {
                const damageNeeded = char.hp - 10 - (char.damage || 0);
                if (damageNeeded > 0) {
                    game.dealDamage(char, damageNeeded);
                    game.log(`${char.name} set to 10 HP`);
                }
            });
            game.knockOut(attacker);
            game.log('Diabolical arrangement: Mason knocked out!');
            break;

        case 'Arrangement procrastination':
            // Switch with benched, next turn reveal hand and do 10 damage per musescore file
            const benchChars = player.bench.filter(c => c);
            if (benchChars.length > 0) {
                showArrangementProcrastinationModal(player, benchChars);
                return true;
            } else {
                game.log('No benched characters to switch with');
            }
            game.nextTurnEffects[game.currentPlayer].arrangementProcrastination = true;
            break;

        case 'Three Hand Technique':
            // Three individual attacks of 20 damage each
            for (let i = 0; i < 3; i++) {
                const damage = calculateDamage(attacker, target, 20, move);
                game.dealDamage(target, damage);
                game.log(`Three Hand Technique hit ${i + 1}: ${damage} damage`);
            }
            break;

        case 'Arranging':
            // Discard musescore files for 20 damage each
            const musescoreCount = player.hand.filter(c => c.name === 'Musescore file').length;
            if (musescoreCount > 0) {
                const discardCount = parseInt(prompt(`Discard how many Musescore files? (0-${musescoreCount})`));
                if (discardCount > 0 && discardCount <= musescoreCount) {
                    for (let i = 0; i < discardCount; i++) {
                        const file = player.hand.find(c => c.name === 'Musescore file');
                        player.discard.push(file);
                        player.hand = player.hand.filter(c => c !== file);
                    }
                    const totalDamage = discardCount * 20;
                    const finalDamage = calculateDamage(attacker, target, totalDamage, move);
                    game.dealDamage(target, finalDamage);
                    game.log(`Arranging: Discarded ${discardCount} files for ${finalDamage} damage!`, 'damage');
                }
            }
            break;

        case 'Cymbal Crash':
            executeDamageAttack(attacker, target, move);
            break;

        case 'Arrange (variant)':
            // Reveal top 4, discard musescore files for 40 damage each, rest to hand
            const arrangeTopFour = player.deck.splice(0, 4);
            let musescoreDiscarded = 0;
            arrangeTopFour.forEach(card => {
                if (card.name === 'Musescore file') {
                    player.discard.push(card);
                    musescoreDiscarded++;
                    game.log(`Discarded ${card.name}`);
                } else {
                    player.hand.push(card);
                    game.log(`Drew ${card.name}`);
                }
            });
            if (musescoreDiscarded > 0) {
                const totalDamage = musescoreDiscarded * 40;
                const finalDamage = calculateDamage(attacker, target, totalDamage, move);
                game.dealDamage(target, finalDamage);
                game.log(`Arrange: ${musescoreDiscarded} files for ${finalDamage} damage!`, 'damage');
            }
            break;

        case 'Percussion Ensemble':
            // Attach up to 2 energy to one benched Percussion type
            const benchedPercussionists = player.bench.filter(c => c && c.type.includes(TYPES.PERCUSSION));

            if (benchedPercussionists.length > 0) {
                showPercussionEnsembleSelection(player, benchedPercussionists);
                return true;
            } else {
                game.log('No benched Percussion characters available');
            }
            break;

        case 'Personal use':
            // Retrieve camera from discard
            const camera = player.discard.find(c => c.name === 'Camera');
            if (camera) {
                player.hand.push(camera);
                player.discard = player.discard.filter(c => c !== camera);
                game.log('Retrieved Camera from discard pile');
            }
            break;

        case 'Improv':
            // Discard top card of opponent deck, 20 base damage + 80 if item
            let itemBonus = 0;
            const improvCard = opponent.deck.shift();
            if (improvCard) {
                opponent.discard.push(improvCard);
                game.log(`Opponent discarded ${improvCard.name}`);
                if (improvCard.cardType === 'item') {
                    itemBonus = 80;
                }
            }
            const improvBaseDamage = 20 + itemBonus;
            const improvFinalDamage = calculateDamage(attacker, target, improvBaseDamage, move);
            game.dealDamage(target, improvFinalDamage);
            game.log(`Improv: ${itemBonus > 0 ? 'Item discarded' : 'No item discarded'} for ${improvFinalDamage} damage!`, 'damage');
            break;

        case 'Conducting':
            // For each type in play, do 20 damage
            const typesInPlay = new Set();
            [player.active, ...player.bench, opponent.active, ...opponent.bench]
                .filter(c => c)
                .forEach(c => c.type.forEach(t => typesInPlay.add(t)));
            const conductingDamage = typesInPlay.size * 20;
            const conductingFinal = calculateDamage(attacker, target, conductingDamage, move);
            game.dealDamage(target, conductingFinal);
            game.log(`Conducting: ${typesInPlay.size} types for ${conductingFinal} damage!`, 'damage');
            break;

        case 'You know what it is':
            // Only usable if exactly 60 health, 70 damage to any opponent character
            if (attacker.hp - (attacker.damage || 0) === 60) {
                if (target) {
                    const moveOverride = { name: 'You know what it is', damage: 70 };
                    const damage = calculateDamage(attacker, target, 70, moveOverride);
                    game.dealDamage(target, damage);
                    game.log(`You know what it is: ${damage} damage to ${target.name}!`, 'damage');
                } else {
                    const opponentChars = [opponent.active, ...opponent.bench].filter(c => c);
                    if (opponentChars.length > 0) {
                        showYouKnowWhatItIsTargetSelection(opponent, attacker);
                        return true;
                    } else {
                        game.log('You know what it is: No valid targets');
                    }
                }
            } else {
                game.log('You know what it is can only be used at exactly 60 HP!');
            }
            break;

        case '440 Hz':
            // Attach free energy to your benched character
            const benchedChars = player.bench.filter(c => c);
            if (benchedChars.length > 0) {
                game.log('440 Hz: Select a benched character to attach energy');
                show440HzSelectionModal(player, [], benchedChars);
                return true;
            } else {
                game.log('Need a benched character to use 440 Hz');
            }
            break;

        case 'Triple Stop':
        case 'Triple Stops':
            // Flip 3 coins, 40 damage per heads
            let heads = 0;
            for (let i = 0; i < 3; i++) {
                if (flipCoin()) {
                    heads++;
                    game.log('Triple Stop: Heads!');
                } else {
                    game.log('Triple Stop: Tails');
                }
            }
            if (heads > 0) {
                const tripleStopsDamage = heads * 40;
                const tripleStopsFinal = calculateDamage(attacker, target, tripleStopsDamage, move);
                game.dealDamage(target, tripleStopsFinal);
                game.log(`Triple Stop: ${heads} heads for ${tripleStopsFinal} damage!`, 'damage');
            }
            break;

        case 'Four Mallets':
            // Four individual attacks of 10 damage each, then draw a card
            for (let i = 0; i < 4; i++) {
                const fourMalletsDamage = calculateDamage(attacker, target, 10, move);
                game.dealDamage(target, fourMalletsDamage);
                game.log(`Four Mallets hit ${i + 1}: ${fourMalletsDamage} damage`);
            }
            game.drawCards(game.currentPlayer, 1);
            break;

        case '30 Emails':
            // 40 damage, 2x if stadium is Ice Rink
            let emailsDamage = 40;
            if (game.stadium && game.stadium.name === 'Ice Rink') {
                emailsDamage *= 2;
                game.log('30 Emails: 2x damage from Ice Rink!');
            }
            const emailsFinal = calculateDamage(attacker, target, emailsDamage, move);
            game.dealDamage(target, emailsFinal);
            game.log(`${attacker.name} used 30 Emails for ${emailsFinal} damage!`, 'damage');
            break;

        case 'Ragebaited':
            // 20 damage, +30 when below 50% HP, +80 when below 20% HP
            let ragebaseDamage = 20;
            const currentHP = attacker.hp - (attacker.damage || 0);
            const hpPercent = currentHP / attacker.hp;

            if (hpPercent <= 0.2) {
                ragebaseDamage += 80;
                game.log('Ragebaited: +80 damage (below 20% HP)!');
            } else if (hpPercent <= 0.5) {
                ragebaseDamage += 30;
                game.log('Ragebaited: +30 damage (below 50% HP)!');
            }

            const rageFinal = calculateDamage(attacker, target, ragebaseDamage, move);
            game.dealDamage(target, rageFinal);
            game.log(`${attacker.name} used Ragebaited for ${rageFinal} damage!`, 'damage');
            break;

        case 'Rimshot':
            // Roll d6, if 1-4 do 70 damage
            const rimshotRoll = randInt(6) + 1;
            game.log(`Rimshot: Rolled ${rimshotRoll}`);
            if (rimshotRoll >= 1 && rimshotRoll <= 4) {
                const rimshotDamage = calculateDamage(attacker, target, 70, move);
                game.dealDamage(target, rimshotDamage);
                game.log(`Rimshot hit for ${rimshotDamage} damage!`, 'damage');
            } else {
                game.log('Rimshot missed!');
            }
            break;

        case 'Screech!':
            // Roll d6, damage = 30 + (10 * number)
            const screechRoll = randInt(6) + 1;
            const screechDamage = 30 + (10 * screechRoll);
            const screechFinal = calculateDamage(attacker, target, screechDamage, move);
            game.dealDamage(target, screechFinal);
            game.log(`Screech!: Rolled ${screechRoll} for ${screechFinal} damage!`, 'damage');
            break;

        case 'Double Tongue':
            // Two individual attacks of 10 damage each
            for (let i = 0; i < 2; i++) {
                const doubleTongueDamage = calculateDamage(attacker, target, 10, move);
                game.dealDamage(target, doubleTongueDamage);
                game.log(`Double Tongue hit ${i + 1}: ${doubleTongueDamage} damage`);
            }
            break;

        case 'Harmonics':
            // Flip 2 coins, both heads: choose 3 targets for 60 or 2 targets for 70
            const coin1 = flipCoin();
            const coin2 = flipCoin();
            game.log(`Harmonics: Coin 1 - ${coin1 ? 'Heads' : 'Tails'}, Coin 2 - ${coin2 ? 'Heads' : 'Tails'}`);
            if (coin1 && coin2) {
                showHarmonicsChoice(attacker, opponent, move);
                return true;
            }
            game.log('Harmonics: No damage');
            break;

        case 'Four Hands':
            // 50 damage, +30 if another piano on bench
            let fourHandsDamage = 50;
            const otherPianos = player.bench.filter(char =>
                char && char.type.includes(TYPES.PIANO) && char.id !== attacker.id
            );
            if (otherPianos.length > 0) {
                fourHandsDamage += 30;
                game.log('Four Hands: +30 damage from another piano on bench!');
            }
            const fourHandsFinal = calculateDamage(attacker, target, fourHandsDamage, move);
            game.dealDamage(target, fourHandsFinal);
            game.log(`Four Hands: ${fourHandsFinal} damage!`, 'damage');
            break;

        case 'Excused Absence':
            // Heal 30 damage from each of your characters
            const allCharsForHeal = [player.active, ...player.bench].filter(c => c);
            allCharsForHeal.forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(30, char.damage);
                    char.damage -= healAmount;
                    game.log(`${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            break;

        case 'Simulation':
            // Shuffle deck, guess number of characters in top 5
            game.shuffleDeck(game.currentPlayer);
            const guessNumber = parseInt(prompt('Simulation: Guess how many character cards are in the top 5 cards (0-5):'));
            const top5 = player.deck.slice(0, 5);
            const actualCharacters = top5.filter(c => c.cardType === 'character');

            game.log(`Simulation: Top 5 cards revealed - ${top5.map(c => c.name).join(', ')}`);
            game.log(`Simulation: ${actualCharacters.length} character cards found`);

            if (guessNumber === actualCharacters.length) {
                // Correct! Add characters to hand
                actualCharacters.forEach(char => {
                    player.hand.push(char);
                    player.deck = player.deck.filter(c => c.id !== char.id);
                });
                game.log(`Simulation: Correct! Added ${actualCharacters.length} characters to hand`, 'info');
            } else {
                game.log('Simulation: Incorrect guess. Shuffling cards back into deck', 'info');
                game.shuffleDeck(game.currentPlayer);
            }
            break;

        case 'Flute Solo':
            // 30 damage, or 80 if Evelyn is the only WW character in play
            const allCharsInPlay = [
                game.players[1].active, ...game.players[1].bench,
                game.players[2].active, ...game.players[2].bench
            ].filter(c => c);

            const woodwindChars = allCharsInPlay.filter(c => c.type.includes(TYPES.WOODWINDS));
            let fluteDamage = 30;

            if (woodwindChars.length === 1 && woodwindChars[0].id === attacker.id) {
                fluteDamage = 80;
                game.log('Flute Solo: Only WW in play, 80 damage!');
            }

            const fluteFinal = calculateDamage(attacker, target, fluteDamage, move);
            game.dealDamage(target, fluteFinal);
            game.log(`${attacker.name} used Flute Solo for ${fluteFinal} damage!`, 'damage');
            break;

        case 'Algorithm':
            // 50 damage to each opponent character that has a duplicate on your side
            const opponentChars = [opponent.active, ...opponent.bench].filter(c => c);
            const playerCharNames = [player.active, ...player.bench].filter(c => c).map(c => c.name);

            opponentChars.forEach(oppChar => {
                if (playerCharNames.includes(oppChar.name)) {
                    const algDamage = calculateDamage(attacker, oppChar, 50, move);
                    game.dealDamage(oppChar, algDamage);
                    game.log(`Algorithm: ${oppChar.name} takes ${algDamage} damage (duplicate found)!`, 'damage');
                }
            });
            break;

        case 'Touhou Ensemble':
            // 30 damage, +30 if Fumo plush in discard
            let touhouDamage = 30;
            const fumoInDiscard = player.discard.find(c => c.name === 'Fumo plush');

            if (fumoInDiscard) {
                touhouDamage += 30;
                player.discard = player.discard.filter(c => c.id !== fumoInDiscard.id);
                player.deck.push(fumoInDiscard);
                game.shuffleDeck(game.currentPlayer);
                game.log('Touhou Ensemble: +30 damage from Fumo plush! Shuffled back into deck');
            }

            const touhouFinal = calculateDamage(attacker, target, touhouDamage, move);
            game.dealDamage(target, touhouFinal);
            game.log(`${attacker.name} used Touhou Ensemble for ${touhouFinal} damage!`, 'damage');
            break;

        case 'Guitar Shredding':
            // 30 damage, discard all guitar energy, discard 1 card per energy from opponent's deck
            const shreddingEnergy = attacker.attachedEnergy.slice();

            if (shreddingEnergy.length > 0) {
                shreddingEnergy.forEach(energy => {
                    attacker.attachedEnergy = attacker.attachedEnergy.filter(e => e.id !== energy.id);
                    player.discard.push(energy);
                });
                game.log(`Guitar Shredding: Discarded ${shreddingEnergy.length} energy`);

                // Discard 1 card from opponent's deck per energy
                const cardsToDiscard = shreddingEnergy.length;
                for (let i = 0; i < cardsToDiscard && opponent.deck.length > 0; i++) {
                    const discarded = opponent.deck.shift();
                    opponent.discard.push(discarded);
                }
                game.log(`Guitar Shredding: Opponent discarded ${Math.min(cardsToDiscard, opponent.deck.length)} cards from deck`);

                const shreddingFinal = calculateDamage(attacker, target, 30, move);
                game.dealDamage(target, shreddingFinal);
                game.log(`${attacker.name} used Guitar Shredding for ${shreddingFinal} damage!`, 'damage');
            } else {
                game.log('Guitar Shredding: No energy to discard!');
            }
            break;

        case 'Snap Pizz':
            // 20 damage to opponent's active, then choose any opponent character to discard up to 2 energy
            if (opponent.active) {
                const snapPizzMove = { ...move, damage: 20 };
                executeDamageAttack(attacker, opponent.active, snapPizzMove);
            } else {
                game.log('Snap Pizz: No opponent active to damage');
            }

            const opponentCharsForSnap = [opponent.active, ...opponent.bench].filter(c => c);
            if (opponentCharsForSnap.length > 0) {
                showSnapPizzDiscardSelection(opponentCharsForSnap);
                return true;
            }
            break;

        case 'Grand Piano':
            // Base damage +20 if stadium is a performance hall
            let grandPianoDamage = move.damage;
            if (game.stadium && game.isPerformanceSpace(game.stadium.name)) {
                grandPianoDamage += 20;
                game.log('Grand Piano: +20 damage in performance hall!');
            }
            const grandPianoFinal = calculateDamage(attacker, target, grandPianoDamage, move);
            game.dealDamage(target, grandPianoFinal);
            game.log(`${attacker.name} used ${move.name} for ${grandPianoFinal} damage!`, 'damage');
            break;

        case 'Damper Pedal':
            // 20 damage, opponent's next attack is halved
            executeDamageAttack(attacker, target, move);
            game.nextTurnEffects[opponentNum].damperPedal = true;
            game.log('Damper Pedal: Opponent\'s next attack will be halved!');
            break;

        case 'Glissando':
            // 30 damage, can't use this attack next turn
            executeDamageAttack(attacker, target, move);
            attacker.cantUseGlissandoTurn = game.turn + 2;
            game.log('Glissando: Can\'t use this attack next turn');
            break;

        case 'Stick Trick':
            // Damage, swap with benched character for free
            executeDamageAttack(attacker, target, move);
            const stickTrickBench = player.bench.filter(c => c);
            if (stickTrickBench.length > 0) {
                game.log('Stick Trick: Select benched character to swap with');
                showStickTrickSwapModal(player, stickTrickBench);
                return true;
            } else {
                game.log('Stick Trick: No benched characters to swap with');
            }
            break;

        // ===== BRASS MOVES =====
        case 'Fanfare':
            // Not affected by weakness, resistance, or immunities
            const fanfareDamage = move.damage || 0;
            game.dealDamage(target, fanfareDamage, attacker, { ignoreImmunities: true }); // Direct damage, bypass calculateDamage
            game.log(`${attacker.name} used Fanfare for ${fanfareDamage} damage (ignores weakness, resistance, and immunities)!`, 'damage');
            break;

        case 'Drain':
            // Heal benched character for damage dealt
            const drainDamage = calculateDamage(attacker, target, move.damage, move);
            game.dealDamage(target, drainDamage);
            game.log(`${attacker.name} used Drain for ${drainDamage} damage!`, 'damage');

            const benchedForDrain = player.bench.filter(c => c && c.damage > 0);
            if (benchedForDrain.length > 0) {
                showDrainHealSelection(player, benchedForDrain, drainDamage);
                return true;
            }
            break;

        case 'Embouchure':
            // Deal damage, then move energy among characters
            executeDamageAttack(attacker, target, move);
            showEmbouchureSelection(player);
            return true;
            break;

        case 'Intense Echo':
            // Damage + 10 to each bench
            executeDamageAttack(attacker, target, move);
            opponent.bench.filter(c => c).forEach(benchChar => {
                const benchDamage = calculateDamage(attacker, benchChar, 10, move);
                game.dealDamage(benchChar, benchDamage);
                game.log(`Intense Echo: ${benchChar.name} takes ${benchDamage} bench damage`);
            });
            break;

        case 'Concert Pitch':
            // 40 damage, +20 per brass on bench
            let concertPitchDamage = 40;
            const brassCount = player.bench.filter(c => c && c.type.includes(TYPES.BRASS)).length;
            if (brassCount > 0) {
                concertPitchDamage += 20 * brassCount;
                game.log(`Concert Pitch: +${20 * brassCount} damage (${brassCount} brass on bench)!`);
            }

            const concertPitchFinal = calculateDamage(attacker, target, concertPitchDamage, move);
            game.dealDamage(target, concertPitchFinal);
            game.log(`${attacker.name} used Concert Pitch for ${concertPitchFinal} damage!`, 'damage');
            break;

        case 'Heart of the Cards':
            // Name card, draw, if match deal 60 damage
            const cardName = prompt('Heart of the Cards: Name a card:');
            if (cardName && player.deck.length > 0) {
                const drawnCard = player.deck.shift();
                player.hand.push(drawnCard);
                game.log(`Heart of the Cards: Drew ${drawnCard.name}`);

                if (drawnCard.name.toLowerCase() === cardName.toLowerCase()) {
                    const heartDamage = calculateDamage(attacker, target, 60, move);
                    game.dealDamage(target, heartDamage);
                    game.log(`Heart of the Cards: Match! ${heartDamage} damage!`, 'damage');
                } else {
                    game.log('Heart of the Cards: No match, no damage');
                }
            }
            break;

        // ===== CHOIR MOVES =====
        case 'Full Force':
        case 'Echoing Blast':
            // Renamed to Intense Echo
            executeDamageAttack(attacker, target, move);
            opponent.bench.filter(c => c).forEach(benchChar => {
                const benchDamage = calculateDamage(attacker, benchChar, 10, move);
                game.dealDamage(benchChar, benchDamage);
                game.log(`Intense Echo: ${benchChar.name} takes ${benchDamage} bench damage`);
            });
            break;

        case 'Ross Attack!':
            // If Ross on your bench: draw 2. If Ross on opp bench: 50 damage. If both: nothing
            const rossOnYourBench = player.bench.some(c => c && c.name === 'Ross Williams');
            const rossOnOppBench = opponent.bench.some(c => c && c.name === 'Ross Williams');

            if (rossOnYourBench && rossOnOppBench) {
                game.log('Ross Attack!: Ross on both benches - nothing happens!');
            } else if (rossOnYourBench) {
                game.drawCards(game.currentPlayer, 2);
                game.log('Ross Attack!: Drew 2 cards (Ross on your bench)!');
            } else if (rossOnOppBench) {
                // Choose target from opponent's characters
                showRossAttackTargetSelection([opponent.active, ...opponent.bench].filter(c => c), attacker, move);
                return true; // Wait for selection
            } else {
                game.log('Ross Attack!: No Ross on any bench - no effect');
            }
            break;

        case 'Tabemono King':
            // Heal all yours 30, opponent's 10, discard 1 energy
            [player.active, ...player.bench].filter(c => c).forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(30, char.damage);
                    char.damage -= healAmount;
                    game.log(`${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            [opponent.active, ...opponent.bench].filter(c => c).forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(10, char.damage);
                    char.damage -= healAmount;
                    game.log(`Opponent's ${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            // Discard 1 energy from attacker
            if (attacker.attachedEnergy.length > 0) {
                const discarded = attacker.attachedEnergy.pop();
                player.discard.push(discarded);
                game.log('Tabemono King: Discarded 1 energy');
            }
            break;

        case 'Chorus':
            // 30 damage + 10 per benched character
            const chorusBenchCount = player.bench.filter(c => c).length;
            const chorusDamage = 30 + (10 * chorusBenchCount);
            const chorusFinal = calculateDamage(attacker, target, chorusDamage, move);
            game.dealDamage(target, chorusFinal);
            game.log(`${attacker.name} used Chorus for ${chorusFinal} damage (${chorusBenchCount} benched)!`, 'damage');
            break;

        // ===== GUITAR MOVES =====
        case 'Domain Expansion':
            // Discard all energy, 50 damage to all opponents
            const guitarEnergyCount = attacker.attachedEnergy.length;
            attacker.attachedEnergy.forEach(e => player.discard.push(e));
            attacker.attachedEnergy = [];
            game.log(`Domain Expansion: Discarded ${guitarEnergyCount} energy`);

            [opponent.active, ...opponent.bench].filter(c => c).forEach(oppChar => {
                const domainDamage = calculateDamage(attacker, oppChar, 50, move);
                game.dealDamage(oppChar, domainDamage);
                game.log(`Domain Expansion: ${oppChar.name} takes ${domainDamage} damage!`, 'damage');
            });
            break;

        case 'Power Chord':
            // 90 damage, discard 2 energy
            executeDamageAttack(attacker, target, move);
            const powerChordEnergy = Math.min(2, attacker.attachedEnergy.length);
            for (let i = 0; i < powerChordEnergy; i++) {
                const discarded = attacker.attachedEnergy.pop();
                player.discard.push(discarded);
            }
            game.log(`Power Chord: Discarded ${powerChordEnergy} energy`);
            // Mark that Power Chord was used
            attacker.usedPowerChord = true;
            break;

        case 'Fingerstyle':
            // Only if didn't use Power Chord last turn, flip 5 coins, 20 damage per heads
            if (attacker.usedPowerChordLastTurn) {
                game.log('Fingerstyle: Cannot use after Power Chord!', 'warning');
            } else {
                let fingerstyleHeads = 0;
                for (let i = 0; i < 5; i++) {
                    if (flipCoin()) {
                        fingerstyleHeads++;
                    }
                }
                const fingerstyleDamage = fingerstyleHeads * 20;
                const fingerstyleFinal = calculateDamage(attacker, target, fingerstyleDamage, move);
                game.dealDamage(target, fingerstyleFinal);
                game.log(`Fingerstyle: ${fingerstyleHeads} heads for ${fingerstyleFinal} damage!`, 'damage');
            }
            // Clear Power Chord flag
            attacker.usedPowerChordLastTurn = false;
            break;

        case 'Packet Loss':
            // Flip coin per energy, discard on heads
            if (target.attachedEnergy && target.attachedEnergy.length > 0) {
                const energyCount = target.attachedEnergy.length;
                let discarded = 0;
                for (let i = energyCount - 1; i >= 0; i--) {
                    if (flipCoin()) { // Heads
                        const energy = target.attachedEnergy.splice(i, 1)[0];
                        opponent.discard.push(energy);
                        discarded++;
                    }
                }
                game.log(`Packet Loss: Discarded ${discarded} of ${energyCount} energy`);
            }
            break;

        case 'Distortion':
            // Damage, plucked strings +40 next turn
            executeDamageAttack(attacker, target, move);
            if (!game.nextTurnEffects[game.currentPlayer].distortionBonus) {
                game.nextTurnEffects[game.currentPlayer].distortionBonus = 0;
            }
            game.nextTurnEffects[game.currentPlayer].distortionBonus += 40;
            game.log('Distortion: Next turn bonus +40 damage set!');
            break;

        case 'Surprise Delivery':
            // Look top 3, reveal characters, put in hand, damage per char, topdeck rest
            const topThree = player.deck.splice(0, 3);
            if (topThree.length > 0) {
                showSurpriseDeliveryModal(player, target, topThree, attacker, move);
                return true;
            } else {
                game.log('Surprise Delivery: No cards in deck to look at.');
            }
            break;

        // ===== PERCUSSION MOVES =====
        case 'Snowball Effect':
            // Roll d6 until 6, damage = 10 × non-6 rolls
            let snowballRolls = 0;
            let roll;
            do {
                roll = rollD6();
                game.log(`Snowball Effect: Rolled ${roll}`);
                if (roll !== 6) snowballRolls++;
            } while (roll !== 6);

            const snowballDamage = snowballRolls * 10;
            const snowballFinal = calculateDamage(attacker, target, snowballDamage, move);
            game.dealDamage(target, snowballFinal);
            game.log(`Snowball Effect: ${snowballRolls} non-6 rolls for ${snowballFinal} damage!`, 'damage');
            break;

        case 'Ominous Chimes':
            // Shuffle self back, 70 damage at end of opponent's turn
            game.nextTurnEffects[opponentNum].ominousChimesDamage = 70;
            game.nextTurnEffects[opponentNum].ominousChimesTarget = target.id;

            // Shuffle attacker back into deck
            player.active = null;
            attacker.damage = 0; // Reset damage
            attacker.attachedEnergy = []; // Clear energy
            if (attacker.attachedTools && attacker.attachedTools.length > 0) {
                player.deck.push(...attacker.attachedTools);
            }
            attacker.attachedTools = []; // Clear tools
            player.deck.push(attacker);
            game.shuffleDeck(game.currentPlayer);
            game.log(`Ominous Chimes: ${attacker.name} shuffled back into deck. 70 damage will be dealt at end of opponent's turn!`);
            break;

        case 'Stickshot':
            // Roll d6 four times, damage = 40 × lowest roll
            const stickshotRolls = [];
            for (let i = 0; i < 4; i++) {
                stickshotRolls.push(rollD6());
            }
            const lowestRoll = Math.min(...stickshotRolls);
            const stickshotDamage = lowestRoll * 40;
            const stickshotDamageFinal = calculateDamage(attacker, target, stickshotDamage, move);
            game.dealDamage(target, stickshotDamageFinal);
            game.log(`Stickshot: Rolls ${stickshotRolls.join(', ')} → ${stickshotDamageFinal} damage (lowest roll: ${lowestRoll})!`, 'damage');
            break;

        case 'Drum Kid Workshop':
            // Copy another percussion's attack
            const percussionChars = [player.active, ...player.bench, opponent.active, ...opponent.bench]
                .filter(c => c && c.type.includes(TYPES.PERCUSSION) && c.id !== attacker.id);

            if (percussionChars.length > 0) {
                showDrumKidWorkshopSelection(percussionChars, attacker, target);
                return true;
            } else {
                game.log('Drum Kid Workshop: No other percussion characters in play');
            }
            break;

        case 'Tricky Rhythms':
            // Each character in play with a tool attached takes 50 damage
            const allCharsForTricky = [player.active, ...player.bench, opponent.active, ...opponent.bench].filter(c => c);
            allCharsForTricky.forEach(char => {
                if (char.attachedTools && char.attachedTools.length > 0) {
                    const trickyDamage = calculateDamage(attacker, char, 50, move);
                    game.dealDamage(char, trickyDamage);
                    game.log(`Tricky Rhythms: ${char.name} takes ${trickyDamage} damage!`, 'damage');
                }
            });
            break;

        case 'Rudiments':
            // 10 damage to chosen opponent character (should already exist but adding for completeness)
            if (!target) {
                game.log('Rudiments: Select a target');
            } else {
                executeDamageAttack(attacker, target, move);
            }
            break;

        // ===== PIANO MOVES =====
        case 'Nullify':
            // Benched this turn → opponent abilities no effect this turn
            if (attacker.wasJustBenched) {
                game.abilitiesDisabledThisTurn = opponentNum;
                game.log('Nullify: Opponent abilities disabled for the rest of this turn!');
            } else {
                game.log('Nullify: Can only use if this character was benched this turn', 'warning');
            }
            break;

        case 'Hands separately':
        case 'Separate Hands':
            // 0 damage, next turn 40 damage
            if (attacker.separateHandsPrimedTurn === game.turn) {
                const separateHandsMove = { ...move, damage: 40 };
                executeDamageAttack(attacker, target, separateHandsMove);
                attacker.separateHandsPrimedTurn = null;
            } else {
                attacker.separateHandsPrimedTurn = game.turn + 2;
                game.log('Separate Hands: Next turn will deal 40 damage');
            }
            break;

        case 'Inventory Management':
            // Flip coin per hand card, 20 damage each heads to opponent active
            const handSize = player.hand.length;
            let inventoryHeads = 0;
            for (let i = 0; i < handSize; i++) {
                if (flipCoin()) {
                    inventoryHeads++;
                }
            }
            const inventoryTarget = opponent.active || target;
            if (inventoryTarget) {
                const inventoryDamage = inventoryHeads * 20;
                const inventoryFinal = calculateDamage(attacker, inventoryTarget, inventoryDamage, move);
                game.dealDamage(inventoryTarget, inventoryFinal);
                game.log(`Inventory Management: ${inventoryHeads} heads from ${handSize} cards for ${inventoryFinal} damage!`, 'damage');
            } else {
                game.log('Inventory Management: No opponent active to target', 'info');
            }
            break;

        case 'Racket Smash':
            // 20 damage, discard energy from opponent's bench
            executeDamageAttack(attacker, target, move);
            const oppBenchWithEnergy = opponent.bench.filter(c => c && c.attachedEnergy && c.attachedEnergy.length > 0);
            if (oppBenchWithEnergy.length > 0) {
                showRacketSmashSelection(opponent, oppBenchWithEnergy);
                return true;
            }
            break;

        // ===== STRINGS MOVES =====
        case 'Borrow':
            // Move energy from another string to this
            const borrowStringChars = [player.active, ...player.bench].filter(c =>
                c && c.type.includes(TYPES.STRINGS) && c.id !== attacker.id && c.attachedEnergy && c.attachedEnergy.length > 0
            );
            if (borrowStringChars.length > 0) {
                showBorrowSelection(player, borrowStringChars, attacker);
                return true;
            } else {
                game.log('Borrow: No other strings with energy to borrow from');
            }
            break;

        case 'Foresight':
            // Rearrange top 3 of opponent's deck
            if (opponent.deck.length > 0) {
                const topThreeOpponent = opponent.deck.splice(0, Math.min(3, opponent.deck.length));
                showForesightModal(opponent, topThreeOpponent);
                return true;
            }
            break;

        case 'Open Strings':
            // 10 damage, draw card, if energy attach it
            executeDamageAttack(attacker, target, move);
            if (player.deck.length > 0) {
                const drawnCard = player.deck.shift();
                player.hand.push(drawnCard);
                game.log(`Open Strings: Drew ${drawnCard.name}`);

                if (drawnCard.cardType === 'item') {
                    game.log(`Open Strings: Must use ${drawnCard.name}`);
                    const waitForModal = executeItemEffect(drawnCard);
                    if (!waitForModal) {
                        if (game.stadium && game.stadium.name === 'Alumnae Hall') {
                            [player.active, ...player.bench].filter(c => c).forEach(char => {
                                if (char.damage < char.hp) {
                                    char.damage = Math.min(char.hp - 10, char.damage + 10);
                                }
                            });
                            game.log('Alumnae Hall: 10 damage to all your characters (nonlethal)');
                        }
                        player.hand = player.hand.filter(c => c.id !== drawnCard.id);
                        player.discard.push(drawnCard);
                    }
                }
            }
            break;

        case 'VocaRock!!':
            // 30 damage, +50 if Miku Otamatone attached
            let vocaRockDamage = 30;
            const mikuUsed = !!game.attackModifiers[game.currentPlayer].mikuOtamatoneUsed;
            if (mikuUsed || (attacker.attachedTools && attacker.attachedTools.some(t => t.name === 'Miku Otamatone'))) {
                vocaRockDamage += 50;
                game.log('VocaRock!!: +50 damage from Miku Otamatone!');
            }
            const vocaRockFinal = calculateDamage(attacker, target, vocaRockDamage, move);
            game.dealDamage(target, vocaRockFinal);
            game.log(`${attacker.name} used VocaRock!! for ${vocaRockFinal} damage!`, 'damage');
            break;

        case 'Midday Nap':
            // Heal 20 damage
            if (attacker.damage > 0) {
                const healAmount = Math.min(20, attacker.damage);
                attacker.damage -= healAmount;
                game.log(`${attacker.name} healed ${healAmount} damage!`, 'heal');
            } else {
                game.log('Midday Nap: Already at full HP');
            }
            break;

        case 'Gacha Gaming':
            // Draw cards taking damage, complex mechanics
            showGachaGamingModal(player, attacker);
            return true;
            break;

        case 'Arrangement Speedrun':
            // If arranger: deal 40 and remove arranger from all opposing characters
            if (attacker.status && attacker.status.includes('Arranger')) {
                const targetChar = target || opponent.active;
                if (targetChar) {
                    const arrangeDamage = calculateDamage(attacker, targetChar, 40, move);
                    game.dealDamage(targetChar, arrangeDamage);
                    game.log(`Arrangement Speedrun: ${targetChar.name} takes ${arrangeDamage} damage!`, 'damage');
                }
                [opponent.active, ...opponent.bench].filter(c => c).forEach(char => {
                    if (char.status && char.status.includes('Arranger')) {
                        char.status = char.status.filter(s => s !== 'Arranger');
                    }
                });
                game.log('Arrangement Speedrun: Removed Arranger status from all opposing characters');
            } else {
                // Not arranger: heal 40 and make all other friendly characters arrangers
                if (attacker.damage > 0) {
                    const healAmount = Math.min(40, attacker.damage);
                    attacker.damage -= healAmount;
                    game.log(`Arrangement Speedrun: ${attacker.name} healed ${healAmount} damage!`, 'heal');
                }
                [player.active, ...player.bench].filter(c => c && c.id !== attacker.id).forEach(char => {
                    if (!char.status) char.status = [];
                    if (!char.status.includes('Arranger')) {
                        char.status.push('Arranger');
                    }
                });
                game.log('Arrangement Speedrun: All other friendly characters are now Arrangers');
            }
            break;

        case 'Song Voting':
            // Each player selects two cards to reveal, then resolve
            if (!game.tempSelections) game.tempSelections = {};
            game.tempSelections.songVoting = {
                attackerId: attacker.id,
                targetId: target ? target.id : null,
                selections: { 1: [], 2: [] },
                prompted: { 1: false, 2: false }
            };
            showSongVotingSelectionModal(game.currentPlayer);
            return true;
            break;

        // ===== WOODWINDS MOVES =====
        case 'Overblow':
            // 50 damage, 10 recoil
            executeDamageAttack(attacker, target, move);
            game.dealDamage(attacker, 10);
            game.log('Overblow: 10 recoil damage', 'damage');
            break;

        case 'Analysis Paralysis':
            // Reveal hand, shuffle one back
            game.log(`Analysis Paralysis: Opponent's hand is ${opponent.hand.map(c => c.name).join(', ')}`);
            if (opponent.hand.length > 0) {
                showAnalysisParalysisModal(opponentNum);
                return true;
            }
            break;

        case 'Speedrun Central':
            // 40 damage, +60 if came off bench this turn
            let speedrunDamage = 40;
            if (attacker.cameOffBenchThisTurn) {
                speedrunDamage += 60;
                game.log('Speedrun Central: +60 damage (came off bench this turn)!');
            }
            const speedrunFinal = calculateDamage(attacker, target, speedrunDamage, move);
            game.dealDamage(target, speedrunFinal);
            game.log(`${attacker.name} used Speedrun Central for ${speedrunFinal} damage!`, 'damage');
            break;

        case 'Trickster':
            // Next turn effects: opponent attacks +20, this character +60
            game.nextTurnEffects[opponentNum].tricksterOpponentBonus = 20;
            game.nextTurnEffects[game.currentPlayer].tricksterSelfBonus = {
                attackerId: attacker.id,
                bonus: 60
            };
            game.log('Trickster: Opponent attacks +20 next turn; this character +60 next turn', 'info');
            break;

        case 'Sparkling run':
            // 30 damage, heal 20
            executeDamageAttack(attacker, target, move);
            if (attacker.damage > 0) {
                const healAmount = Math.min(20, attacker.damage);
                attacker.damage -= healAmount;
                game.log(`Sparkling run: ${attacker.name} healed ${healAmount} damage!`, 'heal');
            }
            break;

        case 'Banana Bread for Everyone!':
            // Heal 30 all, discard energy
            [player.active, ...player.bench].filter(c => c).forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(30, char.damage);
                    char.damage -= healAmount;
                    game.log(`${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            if (attacker.attachedEnergy.length > 0) {
                const discarded = attacker.attachedEnergy.pop();
                player.discard.push(discarded);
                game.log('Banana Bread: Discarded 1 energy');
            }
            break;

        case 'Wipeout':
            // 80 damage to 3 different (including self)
            showWipeoutSelection(player, opponent, attacker);
            return true;
            break;

        case 'Clarinet Solo':
        case 'Piccolo Solo':
            // Only usable if no other woodwinds in play; 70 damage if only WW in play
            const allCharsForSolo = [
                game.players[1].active, ...game.players[1].bench,
                game.players[2].active, ...game.players[2].bench
            ].filter(c => c);

            const woodwindCharsForSolo = allCharsForSolo.filter(c => c.type.includes(TYPES.WOODWINDS));
            if (woodwindCharsForSolo.length > 1) {
                game.log(`${move.name}: Cannot be used while another Woodwinds character is in play`, 'warning');
                break;
            }
            let soloDamage = move.damage || 0;

            if (woodwindCharsForSolo.length === 1 && woodwindCharsForSolo[0].id === attacker.id) {
                soloDamage = 70;
                game.log(`${move.name}: Only WW in play, 70 damage!`);
            }

            const soloFinal = calculateDamage(attacker, target, soloDamage, move);
            game.dealDamage(target, soloFinal);
            game.log(`${attacker.name} used ${move.name} for ${soloFinal} damage!`, 'damage');
            break;

        case 'Outreach':
            // Search for character, put on top of deck
            const charactersInDeck = player.deck.filter(c => c.cardType === 'character');
            if (charactersInDeck.length > 0) {
                showOutreachSelection(player, charactersInDeck);
                return true;
            } else {
                game.log('Outreach: No characters in deck');
            }
            break;

        case 'SE lord':
            // Fully heal opponent's bench, damage active by total healed
            let totalHealed = 0;
            opponent.bench.filter(c => c).forEach(char => {
                const healAmount = Math.max(0, char.damage || 0);
                if (healAmount > 0) {
                    char.damage = 0;
                    totalHealed += healAmount;
                    game.log(`SE lord: Healed ${char.name} for ${healAmount}`, 'heal');
                }
            });

            if (totalHealed > 0 && opponent.active) {
                const seLordDamage = calculateDamage(attacker, opponent.active, totalHealed, move);
                game.dealDamage(opponent.active, seLordDamage);
                game.log(`SE lord: Dealt ${seLordDamage} damage to opponent's active!`, 'damage');
            }
            break;

        case 'Blast':
            // Standard damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Strum':
            // Standard 20 damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Seal Attack':
            // Standard damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Sparkling Run':
        case 'Sparkling run':
            // 30 damage and heal 20
            executeDamageAttack(attacker, target, move);
            game.dealDamage(attacker, -20); // Negative damage = healing
            game.log(`${attacker.name} healed 20 damage!`);
            break;

        case 'Synchro Summon':
            // Reveal cards until character found
            let revealedCards = [];
            let characterFound = null;

            while (player.deck.length > 0 && !characterFound) {
                const card = player.deck.shift();
                revealedCards.push(card);
                if (card.cardType === 'character') {
                    characterFound = card;
                }
            }

            if (characterFound) {
                const isStringType = characterFound.type && characterFound.type.includes(TYPES.STRINGS);
                if (!isStringType) {
                    const synchDamage = calculateDamage(attacker, target, 30, move);
                    game.dealDamage(target, synchDamage);
                    game.log(`Synchro Summon: Found non-String character, dealt ${synchDamage} damage!`);
                }
                player.hand.push(characterFound);
                game.log(`${characterFound.name} added to hand!`);

                // Shuffle other revealed cards back
                revealedCards = revealedCards.filter(c => c !== characterFound);
                player.deck.push(...revealedCards);
                game.shuffleDeck(game.currentPlayer);
            } else {
                // No character found, shuffle all back
                player.deck.push(...revealedCards);
                game.shuffleDeck(game.currentPlayer);
                game.log('Synchro Summon: No character found');
            }
            break;

        case 'Spike':
            // 10 damage, discard 1 energy from each opponent benched character
            executeDamageAttack(attacker, target, move);
            opponent.bench.filter(c => c).forEach(benchChar => {
                if (benchChar.attachedEnergy && benchChar.attachedEnergy.length > 0) {
                    const discarded = benchChar.attachedEnergy.pop();
                    opponent.discard.push(discarded);
                    game.log(`Spike: Discarded energy from ${benchChar.name}`);
                }
            });
            break;

        case 'Photograph':
            // Look at opponent's hand, use an Item card effect
            if (opponent.hand.length > 0) {
                const itemCards = opponent.hand.filter(c => c.cardType === 'item');
                if (itemCards.length > 0) {
                    showPhotographSelectionModal(itemCards, opponentNum);
                    return true;
                } else {
                    game.log('Photograph: No items in opponent hand');
                }
            } else {
                game.log('Photograph: Opponent has no cards in hand');
            }
            break;

        case 'Small Ensemble Committee':
            // 20 damage to each opponent if another committee member is in play
            // 40 damage to each if at least two other members are in play
            const requiredNames = ['Evelyn Wu', 'Luke Xu', 'David Man', 'Roberto Gonzales', 'Bokai Bi', 'Jennie Wang'];
            const committeeCharsInPlay = [
                player.active, ...player.bench,
                opponent.active, ...opponent.bench
            ].filter(c => c);
            const normalizeName = name => (name || '')
                .toLowerCase()
                .replace(/[^a-z\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const committeeAliases = requiredNames.flatMap(fullName => {
                const parts = fullName.split(' ');
                const firstName = parts[0];
                return [fullName, firstName];
            });
            committeeAliases.push('Bokai');
            const committeeNameSet = new Set(committeeAliases.map(normalizeName));
            const committeeMembersInPlay = committeeCharsInPlay.filter(char => committeeNameSet.has(normalizeName(char.name)));
            const committeeCount = committeeMembersInPlay.length;
            const committeeMemberNames = committeeMembersInPlay.map(char => char.name);
            game.log(`Small Ensemble Committee: Members in play (${committeeCount}) - ${committeeMemberNames.join(', ') || 'none'}`, 'info');

            if (committeeCount >= 2) {
                const opponentAll = [opponent.active, ...opponent.bench].filter(c => c);
                const committeeDamage = committeeCount >= 3 ? 40 : 20;

                opponentAll.forEach(oppChar => {
                    const committeeFinal = calculateDamage(attacker, oppChar, committeeDamage, move);
                    game.dealDamage(oppChar, committeeFinal);
                    game.log(`Small Ensemble Committee: ${oppChar.name} takes ${committeeFinal} damage!`, 'damage');
                });

                if (committeeCount >= 3) {
                    game.log('Small Ensemble Committee: At least three members present! 40 damage each!');
                }
            } else {
                game.log('Small Ensemble Committee: Need another committee member in play');
            }
            break;

        case 'Multiphonics':
            // Flip 2 coins - both heads = 50 to each bench, both tails = 100 to active
            const multiCoin1 = flipCoin();
            const multiCoin2 = flipCoin();
            game.log(`Multiphonics: Flipped ${multiCoin1 ? 'heads' : 'tails'} and ${multiCoin2 ? 'heads' : 'tails'}`);

            if (multiCoin1 && multiCoin2) {
                // Both heads - 50 to each benched
                opponent.bench.filter(c => c).forEach(benchChar => {
                    const benchDmg = calculateDamage(attacker, benchChar, 50, move);
                    game.dealDamage(benchChar, benchDmg);
                    game.log(`Multiphonics: ${benchDmg} damage to ${benchChar.name}`, 'damage');
                });
            } else if (!multiCoin1 && !multiCoin2) {
                // Both tails - 100 to active
                const activeDmg = calculateDamage(attacker, opponent.active, 100, move);
                game.dealDamage(opponent.active, activeDmg);
                game.log(`Multiphonics: ${activeDmg} damage to ${opponent.active.name}!`, 'damage');
            } else {
                game.log('Multiphonics: Mixed results, no damage');
            }
            break;

        case 'Four Hands Piano':
            // 50 damage, +30 if piano on bench
            let fourHandsBaseDamage = 50;
            const hasPianoOnBench = player.bench.some(c => c && c.type.includes(TYPES.PIANO));
            if (hasPianoOnBench) {
                fourHandsBaseDamage += 30;
                game.log('Four Hands Piano: +30 damage for piano on bench!');
            }
            const fourHandsPianoDamage = calculateDamage(attacker, target, fourHandsBaseDamage, move);
            game.dealDamage(target, fourHandsPianoDamage);
            game.log(`Four Hands Piano: ${fourHandsPianoDamage} damage!`, 'damage');
            break;

        case 'E2 Reaction':
            // Only works if opponent has 2+ benched characters
            const benchedCount = opponent.bench.filter(c => c).length;
            if (benchedCount >= 2) {
                executeDamageAttack(attacker, target, move);
                showE2ReactionSelection(opponent, attacker, move);
                return true;
            }
            game.log('E2 Reaction: Opponent needs at least 2 benched characters');
            break;

        case 'Cherry Flavored Valve Oil':
            // 40 damage, heal one benched character for same amount dealt
            const cherryDamage = calculateDamage(attacker, target, 40, move);
            game.dealDamage(target, cherryDamage);
            game.log(`Cherry Flavored Valve Oil: ${cherryDamage} damage dealt!`, 'damage');

            const benchedForCherry = player.bench.filter(c => c);
            if (benchedForCherry.length > 0) {
                showCherryHealSelection(player, benchedForCherry, cherryDamage);
            } else {
                game.log('Cherry Flavored Valve Oil: No benched characters to heal', 'info');
            }
            break;

        default:
            // Standard damage attack for unlisted moves
            if (move.damage > 0) {
                executeDamageAttack(attacker, target, move);
            }
            break;
    }
}

function showAttackTargeting(attacker, target) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const player = game.players[game.currentPlayer];

    if (!attacker || !attacker.moves) {
        console.error('Attacker or moves not found for showAttackTargeting');
        return;
    }

    let html = `<h2>Select Attack</h2>`;
    html += `<p>Attacking ${target.name} with ${attacker.name}</p>`;
    html += `<div class="target-selection">`;

    // Include Ross Williams' moves if he is on the bench
    const availableMoves = [...attacker.moves];
    const rossOnBench = player.bench.find(c => c && c.name === 'Ross Williams');
    if (!abilitiesDisabledFor(game.currentPlayer) && rossOnBench && rossOnBench.moves) {
        availableMoves.push(...rossOnBench.moves);
    }

    availableMoves.forEach((move, idx) => {
        const energyCost = getMoveEnergyCost(move);
        const canAfford = (attacker.attachedEnergy ? attacker.attachedEnergy.length : 0) >= energyCost;
        const disabled = !canAfford ? 'disabled' : '';
        const costColor = !canAfford ? 'red' : 'black';

        html += `<div class="target-option" style="padding: 10px; border-bottom: 1px solid #eee;">
            <button class="action-btn" ${disabled} data-move-index="${idx}" style="color: #000;">
                <strong>${move.name}</strong>
            </button>
            <p style="margin: 5px 0;">
                <span style="color: ${costColor};">Cost: ${energyCost}</span> | Damage: ${move.damage || 0}
            </p>
            <p style="font-size: 0.9em; color: #555;">${move.effect || ''}</p>
        </div>`;
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');

    document.querySelectorAll('[data-move-index]').forEach(btn => {
        btn.addEventListener('click', () => {
            const moveIndex = Number(btn.getAttribute('data-move-index'));
            const selectedMove = availableMoves[moveIndex];
            if (selectedMove) {
                executeAttack(attacker.id, selectedMove.name, target.id);
            }
        });
    });
}

const EXPORTED_ACTIONS = {
    playCharacterToActive,
    playCharacterToBench,
    showAttackMenu,
    showRetreatMenu,
    attachEnergy,
    useCategoryTheoryFromHand,
    useActivatedAbility,
    switchToActive,
    playItem,
    playSupporter,
    playStadium,
    closeModal,
    setPlaytestCardType,
    updatePlaytestCardSearch,
    addPlaytestCard,
    selectDeckCard,
    toggleDiscardCard,
    confirmDiscardSelection,
    cancelDiscardSelection,
    attachTool,
    discardOpponentCard,
    toggleOpponentDiscardCard,
    confirmOpponentDiscard,
    showSteinertPracticeDiscardModal,
    executeSteinertPracticeDiscard,
    placeAnnotatedCard,
    shuffleBenchIntoDeck,
    forceOpponentSwitch,
    chooseFriedmanCard,
    fullHealCharacter,
    toggleCameraSelection,
    confirmCameraSelection,
    selectSearchedCharacter,
    healSelectedCharacter,
    toggleFoldingStandCard,
    confirmFoldingStand,
    selectBUOStandCard,
    switchWithBench,
    selectConcertRosterCharacter,
    selectVictoriaType,
    toggleVictoriaCharacter,
    confirmVictoriaSelection,
    toggleLucasCharacter,
    confirmLucasSelection,
    attachEnergyFromHand,
    select440HzEnergy,
    select440HzTarget,
    confirm440HzSelection,
    switchArrangementProcrastination,
    attachPercussionEnsembleEnergy,
    skipPercussionEnsemble,
    selectSATBTarget,
    selectYouKnowWhatItIsTarget,
    selectMove,
    retreat,
    confirmSwitch,
    executeStickTrickSwap,
    executeClericSpell,
    discardToolForProfitMargins,
    copyDeckCode,
    processDeckImport,
    applyDrainHeal,
    applyCherryHeal,
    selectEmbouchureSource,
    selectEmbouchureEnergy,
    completeEmbouchure,
    showPhotographSelectionModal,
    selectPhotographItem,
    confirmPhotographSelection,
    cancelPhotographSelection,
    selectSurpriseDeliveryCard,
    confirmSurpriseDelivery,
    cancelSurpriseDelivery,
    showDrumKidWorkshopMoves,
    showDrumKidWorkshopTargetSelection,
    executeDrumKidWorkshop,
    executeTrickyRhythms,
    executeRacketSmash,
    executeBorrow,
    executeSnapPizzDiscard,
    showPercussionEnsembleEnergyCount,
    executePercussionEnsemble,
    completeForesight,
    moveForesightCard,
    executeGachaGaming,
    executeGachaGamingStep,
    finalizeGachaGaming,
    showSongVotingSelectionModal,
    toggleSongVotingCard,
    confirmSongVotingSelection,
    executeSongVoting,
    executeAnalysisParalysis,
    addWipeoutTarget,
    executeWipeout,
    executeAttack,
    handleTargetSelection,
    executeOutreach,
    toggleArtistAlleyCard,
    confirmArtistAlley,
    executeRossAttackTarget,
    executeE2Reaction
};

Object.assign(window, EXPORTED_ACTIONS);

const MULTIPLAYER_ACTION_BLACKLIST = new Set([
    'closeModal',
    'copyDeckCode',
    'processDeckImport'
]);

Object.keys(EXPORTED_ACTIONS).forEach((name) => {
    const original = EXPORTED_ACTIONS[name];
    window[name] = (...args) => {
        if (MULTIPLAYER_ACTION_BLACKLIST.has(name)) {
            return original(...args);
        }

        if (multiplayer.enabled && !multiplayer.isApplyingRemote) {
            sendMultiplayerAction(name, args);
            return;
        }

        return original(...args);
    };
});
