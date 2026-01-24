// GameState class for Discord bot - Core game logic
import { TYPES, RESISTANCE_CHAIN, CHARACTERS, STADIUMS } from './cards.js';
import {
    createCard,
    findCardById,
    removeCardById,
    hasEnoughEnergy,
    hasStatus,
    addStatus,
    removeStatus,
    getRetreatCost,
    shuffle
} from '../utils/cardHelpers.js';

export class GameState {
    constructor(player1Id, player2Id, deck1, deck2) {
        // Discord user IDs
        this.player1Id = player1Id;
        this.player2Id = player2Id;

        // Game ID (for persistence)
        this.gameId = `${player1Id}_${player2Id}_${Date.now()}`;

        // Core game state
        this.currentPlayer = 1;
        this.phase = 'main'; // main, attack, gameover
        this.turn = 1;
        this.isFirstTurn = true;

        // Turn restrictions
        this.energyPlayedThisTurn = false;
        this.supporterPlayedThisTurn = false;
        this.attackedThisTurn = false;
        this.helperCardsPlayedThisTurn = 0; // For Main Hall stadium

        // Player states
        this.players = {
            1: this.createPlayerState(deck1),
            2: this.createPlayerState(deck2)
        };

        // Shared game state
        this.stadium = null;
        this.attackModifiers = { 1: {}, 2: {} };
        this.nextTurnEffects = { 1: {}, 2: {} };
        this.gameLog = [];

        // Win condition
        this.winner = null;

        // Initialize game
        this.setupGame();
    }

    createPlayerState(deckCards) {
        return {
            deck: shuffle([...deckCards]),
            hand: [],
            discard: [],
            active: null,
            bench: [null, null, null],
            koCount: 0
        };
    }

    setupGame() {
        // Guarantee each player has a character in opening hand
        this.ensureStartingCharacter(1);
        this.ensureStartingCharacter(2);

        // Draw starting hands (4 more cards = 5 total)
        this.drawCards(1, 4);
        this.drawCards(2, 4);

        this.log('═════════════════════════════════════');
        this.log('Game Started!');
        this.log(`Player 1's turn begins`);
        this.log('═════════════════════════════════════');
    }

    ensureStartingCharacter(playerNum) {
        const player = this.players[playerNum];
        const charIndex = player.deck.findIndex(card => card.cardType === 'character');

        if (charIndex !== -1) {
            const character = player.deck.splice(charIndex, 1)[0];
            player.hand.push(character);
            this.log(`Player ${playerNum} starts with ${character.name}`);
        } else {
            this.log(`WARNING: Player ${playerNum} has no characters in deck!`);
        }
    }

    // ======================
    // TURN MANAGEMENT
    // ======================

    switchPlayer() {
        const previousPlayer = this.currentPlayer;

        // Clear previous player's next turn effects
        this.nextTurnEffects[previousPlayer] = {};

        // Apply end-of-turn effects
        this.applyEndOfTurnEffects();

        // Update turn state
        if (this.currentPlayer === 1 && this.isFirstTurn) {
            this.isFirstTurn = false;
        }

        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.energyPlayedThisTurn = false;
        this.supporterPlayedThisTurn = false;
        this.attackedThisTurn = false;
        this.helperCardsPlayedThisTurn = 0;
        this.turn++;
        this.phase = 'main';

        // Clear attack modifiers
        this.attackModifiers[previousPlayer] = {};

        this.log('═════════════════════════════════════');
        this.log(`Turn ${this.turn}: Player ${this.currentPlayer}'s turn begins`);
        this.log('═════════════════════════════════════');

        // Apply start-of-turn effects
        this.applyStartOfTurnEffects();

        // Draw card at start of turn (except first turn)
        if (this.turn > 2) {
            this.drawCards(this.currentPlayer, 1);
        }

        // Check if current player has any characters
        this.checkNoCharactersLoss(this.currentPlayer);

        return { success: true };
    }

    applyStartOfTurnEffects() {
        const player = this.players[this.currentPlayer];
        const opponent = this.players[this.currentPlayer === 1 ? 2 : 1];

        // Apply passive statuses (e.g., Fiona giving Maid status)
        this.applyPassiveStatuses();

        // Stadium effects
        if (this.stadium) {
            if (this.stadium.name === 'Petteruti Lounge' && player.active) {
                this.dealDamage(player.active, 10, true); // nonlethal
                this.log('Petteruti Lounge: Active character takes 10 nonlethal damage');
            }

            if (this.stadium.name === 'Riley Hall') {
                const emptySlots = player.bench.filter(slot => !slot).length;
                if (emptySlots > 0) {
                    const allChars = [player.active, ...player.bench].filter(c => c);
                    allChars.forEach(char => {
                        this.dealDamage(char, 10 * emptySlots, false);
                        this.log(`Riley Hall: ${char.name} takes ${10 * emptySlots} damage (${emptySlots} empty slots)`);
                    });
                }
            }

            if (this.stadium.name === 'Steinert Basement Studio') {
                const pianoCount = player.bench.filter(c => c && c.type.includes(TYPES.PIANO)).length;
                if (pianoCount === 2) {
                    this.drawCards(this.currentPlayer, 2);
                    this.log('Steinert Basement Studio: Drew 2 cards (Duo Queue)');
                }
            }
        }

        // AVGE Sticker: draw extra card
        if (player.active && player.active.tools) {
            player.active.tools.forEach(tool => {
                if (tool.name === 'AVGE showcase sticker') {
                    this.drawCards(this.currentPlayer, 1);
                    this.log('AVGE showcase sticker: Drew 1 extra card');
                }
            });
        }

        // Grace's Royalties ability
        if (opponent.active && opponent.active.name === 'Grace') {
            if (player.active && player.active.tools) {
                const hasAVGE = player.active.tools.some(t =>
                    t.name === 'AVGE T-shirt' || t.name === 'AVGE showcase sticker'
                );
                if (hasAVGE) {
                    this.dealDamage(player.active, 20, false);
                    this.log("Grace's Royalties: Active character takes 20 damage!");
                }
            }
        }
    }

    applyEndOfTurnEffects() {
        const player = this.players[this.currentPlayer];

        // Katie's Nausicaa's heartbeat
        [player.active, ...player.bench].filter(c => c).forEach(char => {
            if (char.name === 'Katie' && (char.hp - (char.damage || 0)) === 10) {
                [player.active, ...player.bench].filter(c => c).forEach(healChar => {
                    if (healChar.damage && healChar.damage > 0) {
                        healChar.damage = Math.max(0, healChar.damage - 10);
                        this.log(`Nausicaa's heartbeat: ${healChar.name} healed 10 damage`);
                    }
                });
            }
        });
    }

    applyPassiveStatuses() {
        // Fiona's "Getting dressed" - while on bench, active gains maid status
        [1, 2].forEach(playerNum => {
            const player = this.players[playerNum];
            const hasFionaOnBench = player.bench.some(c => c && c.name === 'Fiona');

            if (player.active) {
                if (hasFionaOnBench) {
                    addStatus(player.active, 'Maid');
                } else {
                    // Remove maid unless from equipment
                    const hasMaidTool = player.active.tools?.some(t => t.grantStatus === 'Maid');
                    if (!hasMaidTool) {
                        removeStatus(player.active, 'Maid');
                    }
                }
            }
        });
    }

    // ======================
    // CARD DRAWING
    // ======================

    drawCards(playerNum, count) {
        const player = this.players[playerNum];

        for (let i = 0; i < count; i++) {
            if (player.deck.length === 0) {
                // Deck-out loss
                const winner = playerNum === 1 ? 2 : 1;
                this.log(`Player ${playerNum} deck is empty!`);
                this.endGame(winner, 'deck-out');
                return { success: false, reason: 'deck-out' };
            }

            const card = player.deck.shift();
            player.hand.push(card);

            // Alumnae Hall: nonlethal damage when drawing
            if (this.stadium && this.stadium.name === 'Alumnae Hall') {
                const allChars = [player.active, ...player.bench].filter(c => c);
                allChars.forEach(char => {
                    this.dealDamage(char, 10, true); // nonlethal
                });
                this.log('Alumnae Hall: All characters take 10 nonlethal damage');
            }
        }

        return { success: true, cardsDrawn: count };
    }

    // ======================
    // DAMAGE & KNOCKOUT
    // ======================

    dealDamage(characterCard, amount, isNonlethal = false) {
        if (!characterCard) return;

        let finalDamage = amount;

        // Goon status: -20 damage
        if (hasStatus(characterCard, 'Goon')) {
            finalDamage -= 20;
        }

        // Maid status: immune to <=10 damage
        if (hasStatus(characterCard, 'Maid') && finalDamage <= 10) {
            this.log(`${characterCard.name} is protected by Maid status!`);
            return;
        }

        // Character abilities
        if (characterCard.name === 'Kana') {
            finalDamage -= 20;
            this.log("Kana's Immense Aura: -20 damage");
        }

        const playerNum = this.findPlayerWithCharacter(characterCard);

        // Synergy abilities
        if (characterCard.name === 'Katie' && this.isCharacterInPlay('Mason', playerNum)) {
            finalDamage -= 10;
        }
        if (characterCard.name === 'Mason' && this.isCharacterInPlay('Katie', playerNum)) {
            finalDamage -= 10;
        }
        if (characterCard.name === 'Sophia' && this.isCharacterInPlay('Pascal', playerNum)) {
            finalDamage -= 10;
        }
        if (characterCard.name === 'Pascal' && this.isCharacterInPlay('Sophia', playerNum)) {
            finalDamage -= 10;
        }

        // Izzy's BAI wrangler
        if (characterCard.name === 'Izzy' && this.stadium && this.isPerformanceSpace(this.stadium.name)) {
            finalDamage -= 20;
            this.log("Izzy's BAI wrangler: -20 damage (Concert Hall)");
        }

        finalDamage = Math.max(0, finalDamage);
        characterCard.damage = (characterCard.damage || 0) + finalDamage;

        // Arranger status: retrieve item when damaged
        if (hasStatus(characterCard, 'Arranger') && finalDamage > 0) {
            this.log(`${characterCard.name} may retrieve an item (Arranger status)`);
            // This would trigger a selection prompt in Discord
        }

        // Check knockout (unless nonlethal)
        if (!isNonlethal && characterCard.damage >= characterCard.hp) {
            this.knockOut(characterCard);
        }
    }

    knockOut(characterCard) {
        const playerNum = this.findPlayerWithCharacter(characterCard);
        const player = this.players[playerNum];

        this.log(`${characterCard.name} was knocked out!`);

        // Move to discard
        player.discard.push(characterCard);

        // Remove from field
        if (player.active === characterCard) {
            player.active = null;
        } else {
            const benchIndex = player.bench.indexOf(characterCard);
            if (benchIndex !== -1) {
                player.bench[benchIndex] = null;
            }
        }

        // Increment opponent's KO count
        const opponentNum = playerNum === 1 ? 2 : 1;
        this.players[opponentNum].koCount++;

        // Check win condition
        if (this.players[opponentNum].koCount >= 3) {
            this.endGame(opponentNum, '3-kos');
            return;
        }

        // Check if player has no characters
        this.checkNoCharactersLoss(playerNum);
    }

    // ======================
    // WIN CONDITIONS
    // ======================

    endGame(winner, reason) {
        this.winner = winner;
        this.phase = 'gameover';
        this.log('═════════════════════════════════════');
        this.log(`Player ${winner} wins! (${reason})`);
        this.log('═════════════════════════════════════');
    }

    checkNoCharactersLoss(playerNum) {
        if (this.turn <= 2) return; // Grace period for setup

        const player = this.players[playerNum];
        const hasCharacters = player.active || player.bench.some(c => c !== null);

        if (!hasCharacters) {
            const winner = playerNum === 1 ? 2 : 1;
            this.endGame(winner, 'no-characters');
        }
    }

    // ======================
    // HELPER METHODS
    // ======================

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
        if (player.active && player.active.name === characterName) return true;
        return player.bench.some(c => c && c.name === characterName);
    }

    isPerformanceSpace(stadiumName) {
        const spaces = ['Main Hall', 'Alumnae Hall', 'Riley Hall', 'Salomon DECI'];
        return spaces.includes(stadiumName);
    }

    log(message, type = 'info') {
        this.gameLog.push({ message, type, timestamp: Date.now() });
        if (this.gameLog.length > 50) {
            this.gameLog.shift();
        }
    }

    // ======================
    // SERIALIZATION
    // ======================

    toJSON() {
        return {
            gameId: this.gameId,
            player1Id: this.player1Id,
            player2Id: this.player2Id,
            currentPlayer: this.currentPlayer,
            phase: this.phase,
            turn: this.turn,
            isFirstTurn: this.isFirstTurn,
            energyPlayedThisTurn: this.energyPlayedThisTurn,
            supporterPlayedThisTurn: this.supporterPlayedThisTurn,
            attackedThisTurn: this.attackedThisTurn,
            helperCardsPlayedThisTurn: this.helperCardsPlayedThisTurn,
            players: this.players,
            stadium: this.stadium,
            attackModifiers: this.attackModifiers,
            nextTurnEffects: this.nextTurnEffects,
            gameLog: this.gameLog,
            winner: this.winner
        };
    }

    static fromJSON(data) {
        const game = Object.create(GameState.prototype);
        Object.assign(game, data);
        return game;
    }
}
