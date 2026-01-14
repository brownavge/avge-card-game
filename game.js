// Game State Management

// Helper function to map cost symbols to energy types
function getCostSymbol(energyType) {
    const symbolMap = {
        [TYPES.WOODWINDS]: 'W',
        [TYPES.PERCUSSION]: 'P',
        [TYPES.PIANO]: 'K',
        [TYPES.STRINGS]: 'S',
        [TYPES.PLUCKED]: 'G', // G for Guitar
        [TYPES.CHOIR]: 'C',
        [TYPES.BRASS]: 'B'
    };
    return symbolMap[energyType] || '?';
}

// Helper function to get energy type from cost symbol
function getTypeFromSymbol(symbol) {
    const typeMap = {
        'W': TYPES.WOODWINDS,
        'P': TYPES.PERCUSSION,
        'K': TYPES.PIANO,
        'S': TYPES.STRINGS,
        'G': TYPES.PLUCKED, // G for Guitar/Plucked Strings
        'C': TYPES.CHOIR,
        'B': TYPES.BRASS
    };
    return typeMap[symbol];
}

class GameState {
    constructor() {
        this.currentPlayer = 1;
        this.phase = 'setup'; // setup, main, attack
        this.turn = 1;
        this.energyPlayedThisTurn = false;
        this.supporterPlayedThisTurn = false;
        this.attackedThisTurn = false;

        this.players = {
            1: this.createPlayerState(),
            2: this.createPlayerState()
        };

        this.stadium = null;
        this.selectedCard = null;
        this.attackModifiers = { 1: {}, 2: {} }; // Temporary attack modifiers and effects
        this.nextTurnEffects = { 1: {}, 2: {} }; // Effects for next turn
        this.gameLog = [];
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

    switchPlayer() {
        // Apply end-of-turn effects before switching
        this.applyEndOfTurnEffects();

        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.energyPlayedThisTurn = false;
        this.supporterPlayedThisTurn = false;
        this.attackedThisTurn = false;
        this.turn++;
        this.phase = 'main';
        this.log(`═════════════════════════════════════`, 'turn-change');
        this.log(`Turn ${this.turn}: Player ${this.currentPlayer}'s turn begins`, 'turn-change');
        this.log(`═════════════════════════════════════`, 'turn-change');

        // Clear turn effects from previous turn
        this.nextTurnEffects[this.currentPlayer] = {};

        // Clear attack modifiers from previous player's turn
        const previousPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.attackModifiers[previousPlayer] = {};

        this.applyStartOfTurnEffects();
    }

    applyEndOfTurnEffects() {
        const player = this.players[this.currentPlayer];

        // Katie's Nausicaa's heartbeat
        [player.active, ...player.bench].filter(c => c).forEach(char => {
            if (char.name === 'Katie' && (char.hp - (char.damage || 0)) === 10) {
                // Heal 10 damage from all your characters
                [player.active, ...player.bench].filter(c => c).forEach(healChar => {
                    if (healChar.damage && healChar.damage > 0) {
                        healChar.damage = Math.max(0, healChar.damage - 10);
                        this.log(`Nausicaa's heartbeat: ${healChar.name} healed 10 damage`, 'heal');
                    }
                });
            }
        });
    }

    beginAttackPhase() {
        if (this.phase === 'attack') {
            alert('Already in attack phase!');
            return;
        }
        this.phase = 'attack';
        this.log(`▶ Attack Phase begins`, 'turn-change');
        this.render();
    }

    applyStartOfTurnEffects() {
        const player = this.players[this.currentPlayer];
        const opponentNum = this.currentPlayer === 1 ? 2 : 1;
        const opponent = this.players[opponentNum];

        // Stadium effects at start of turn
        if (this.stadium && this.stadium.name === 'Petteruti Lounge' && player.active) {
            this.dealDamage(player.active, 10);
            this.log('Petteruti Lounge: Active character takes 10 damage');
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

        // Grace's Royalties ability
        if (opponent.active && opponent.active.name === 'Grace') {
            if (player.active && player.active.attachedTools) {
                const hasAVGEItem = player.active.attachedTools.some(tool =>
                    tool.name === 'AVGE T-shirt' || tool.name === 'AVGE showcase sticker'
                );
                if (hasAVGEItem) {
                    this.dealDamage(player.active, 20);
                    this.log('Grace\'s Royalties: Active character takes 20 damage!');
                }
            }
        }
    }

    dealDamage(characterCard, amount) {
        if (!characterCard) return;

        // Apply defensive abilities and status effects
        let finalDamage = amount;

        // Goon status: -20 damage, reflects 50%
        if (characterCard.status && characterCard.status.includes('Goon')) {
            finalDamage -= 20;
            // TODO: Implement reflect damage
        }

        // Conductor status: double healing from music stands (handled elsewhere)

        // Maid status: immune to <=20 damage
        if (characterCard.status && characterCard.status.includes('Maid') && finalDamage <= 20) {
            this.log(`${characterCard.name} is protected by Maid status!`);
            return;
        }

        // Character-specific abilities
        if (characterCard.name === 'Kana') {
            finalDamage -= 20; // Immense Aura
            this.log('Kana\'s Immense Aura reduces damage by 20');
        }

        // Check for synergy abilities (Katie/Mason)
        const player = this.findPlayerWithCharacter(characterCard);
        if (characterCard.name === 'Katie' && this.isCharacterInPlay('Mason', player)) {
            finalDamage -= 10;
            this.log('Katie takes 10 less damage (Mason in play)');
        }
        if (characterCard.name === 'Mason' && this.isCharacterInPlay('Katie', player)) {
            finalDamage -= 10;
            this.log('Mason takes 10 less damage (Katie in play)');
        }

        finalDamage = Math.max(0, finalDamage);
        characterCard.damage = (characterCard.damage || 0) + finalDamage;

        // Arranger status: retrieve item when damaged
        if (characterCard.status && characterCard.status.includes('Arranger') && finalDamage > 0) {
            this.log(`${characterCard.name} may retrieve an item from discard pile (Arranger status)`);
            // TODO: Show modal for item retrieval
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

        // Move to discard
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
        }

        this.render();
    }

    endGame(winner) {
        alert(`Player ${winner} wins!`);
        this.phase = 'gameover';
        this.render();
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
        if (player.active && player.active.name === characterName) return true;
        return player.bench.some(char => char && char.name === characterName);
    }

    drawCards(playerNum, count) {
        const player = this.players[playerNum];
        for (let i = 0; i < count; i++) {
            if (player.deck.length === 0) {
                this.log(`Player ${playerNum} has no cards left to draw!`);
                break;
            }
            const card = player.deck.shift();
            player.hand.push(card);
        }
        this.render();
    }

    shuffleDeck(playerNum) {
        const player = this.players[playerNum];
        for (let i = player.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
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

// Initialize game
function initGame() {
    // Create sample decks for testing
    createSampleDecks();

    // Guarantee each player starts with at least one musician in hand
    ensureStartingMusician(1);
    ensureStartingMusician(2);

    // Draw starting hands (including the guaranteed musician)
    game.drawCards(1, 4); // Draw 4 more to make 5 total
    game.drawCards(2, 4);

    game.phase = 'main';
    updateUI();
    setupEventListeners();
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
    }
}

function createSampleDecks() {
    // Create simple decks for testing
    // Player 1 deck
    game.players[1].deck = [
        createCharacterCard(CHARACTERS.EMILY),
        createCharacterCard(CHARACTERS.GRACE),
        createCharacterCard(CHARACTERS.ASH),
        createCharacterCard(CHARACTERS.GABE),
        ...Array(8).fill(null).map(() => createEnergyCard(TYPES.STRINGS)),
        ...Array(5).fill(null).map(() => createEnergyCard(TYPES.PLUCKED)),
        ...Array(3).fill(null).map(() => createItemCard(ITEMS.MATCHA_LATTE)),
        ...Array(2).fill(null).map(() => createItemCard(ITEMS.CONCERT_TICKET)),
        ...Array(2).fill(null).map(() => createToolCard(TOOLS.MAID_OUTFIT)),
        ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
        ...Array(3).fill(null).map(() => createStadiumCard(STADIUMS.RED_ROOM))
    ];

    // Player 2 deck
    game.players[2].deck = [
        createCharacterCard(CHARACTERS.KATIE),
        createCharacterCard(CHARACTERS.HENRY),
        createCharacterCard(CHARACTERS.KANA),
        createCharacterCard(CHARACTERS.RACHEL),
        ...Array(8).fill(null).map(() => createEnergyCard(TYPES.PIANO)),
        ...Array(5).fill(null).map(() => createEnergyCard(TYPES.WOODWINDS)),
        ...Array(3).fill(null).map(() => createItemCard(ITEMS.MATCHA_LATTE)),
        ...Array(2).fill(null).map(() => createItemCard(ITEMS.CONCERT_TICKET)),
        ...Array(2).fill(null).map(() => createToolCard(TOOLS.CONDUCTOR_BATON)),
        ...Array(2).fill(null).map(() => createSupporterCard(SUPPORTERS.LIO)),
        ...Array(3).fill(null).map(() => createStadiumCard(STADIUMS.LINDEMANN))
    ];

    game.shuffleDeck(1);
    game.shuffleDeck(2);
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

function createEnergyCard(energyType) {
    return {
        name: `${energyType} Energy`,
        cardType: 'energy',
        energyType: energyType,
        id: generateCardId()
    };
}

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
    document.getElementById('phase-info').textContent = `${game.phase.charAt(0).toUpperCase() + game.phase.slice(1)} Phase`;
    document.getElementById('energy-status').textContent = game.energyPlayedThisTurn ? 'Yes' : 'No';
    document.getElementById('supporter-status').textContent = game.supporterPlayedThisTurn ? 'Yes' : 'No';
    document.getElementById('attacked-status').textContent = game.attackedThisTurn ? 'Yes' : 'No';

    // Update button visibility based on phase
    const beginAttackBtn = document.getElementById('begin-attack-btn');
    const endTurnBtn = document.getElementById('end-turn-btn');

    if (game.phase === 'main') {
        beginAttackBtn.style.display = 'inline-block';
        endTurnBtn.style.display = 'none';
    } else if (game.phase === 'attack') {
        beginAttackBtn.style.display = 'none';
        endTurnBtn.style.display = 'inline-block';
    } else {
        beginAttackBtn.style.display = 'inline-block';
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
}

function renderCharacterSlot(characterCard, slotElement) {
    if (characterCard) {
        slotElement.innerHTML = renderCard(characterCard);
        slotElement.classList.add('occupied');
        // Add click handler to the card
        const cardDiv = slotElement.querySelector('.card');
        if (cardDiv) {
            cardDiv.onclick = () => selectCard(characterCard);
        }
    } else {
        slotElement.innerHTML = '<div class="empty-slot-text">Empty</div>';
        slotElement.classList.remove('occupied');
    }
}

function renderHand() {
    const handElement = document.getElementById('hand-cards');
    const currentPlayer = game.players[game.currentPlayer];

    handElement.innerHTML = '';
    currentPlayer.hand.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.innerHTML = renderCard(card);
        cardElement.classList.add('hand-card-wrapper');
        cardElement.onclick = () => selectCard(card);
        handElement.appendChild(cardElement);
    });
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
            html += `<div class="card-energy-attached">`;
            card.attachedEnergy.forEach(energy => {
                const typeInitial = getCostSymbol(energy.energyType);
                html += `<span class="energy-icon type-${energy.energyType.toLowerCase().replace(' ', '-')}">${typeInitial}</span>`;
            });
            html += `</div>`;
        }

        if (card.moves && card.moves.length > 0) {
            html += `<div class="card-moves">`;
            card.moves.forEach(move => {
                html += `<div class="move"><span class="move-cost">${move.cost ? move.cost.join('') : ''}</span> ${move.name}</div>`;
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

        // Show moves/attacks
        if (card.moves && card.moves.length > 0) {
            html += `<div style="margin-top: 8px;"><strong>Moves:</strong></div>`;
            card.moves.forEach(move => {
                html += `<div style="margin: 5px 0; padding: 5px; background: #fff3e0; border-radius: 3px;">`;
                html += `<p><strong>${move.name}</strong> [${move.cost ? move.cost.join('') : ''}] - ${move.damage || 0} damage</p>`;
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
        if (game.phase === 'main') {
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

        // If character is in play, show other actions
        if (player.active === card) {
            const attackDisabled = (game.phase !== 'attack' || game.attackedThisTurn) ? 'disabled' : '';
            const attackLabel = game.phase !== 'attack' ? ' (Need Attack Phase)' : (game.attackedThisTurn ? ' (Already Used)' : '');
            html += `<button class="action-btn" ${attackDisabled} onclick="showAttackMenu('${card.id}')">Attack${attackLabel}</button>`;
            html += `<button class="action-btn" onclick="showRetreatMenu('${card.id}')">Retreat</button>`;

            // Show activated abilities for active character
            if (card.ability && card.ability.type === 'activated') {
                html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability')">Use ${card.ability.name}</button>`;
            }
            if (card.ability2 && card.ability2.type === 'activated') {
                html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability2')">Use ${card.ability2.name}</button>`;
            }
        }
        if (player.bench.includes(card)) {
            html += `<button class="action-btn" onclick="switchToActive('${card.id}')">Switch to Active</button>`;

            // Show bench-activated abilities
            if (card.ability && card.ability.type === 'activated') {
                html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability')">Use ${card.ability.name}</button>`;
            }
            if (card.ability2 && card.ability2.type === 'activated') {
                html += `<button class="action-btn" onclick="useActivatedAbility('${card.id}', 'ability2')">Use ${card.ability2.name}</button>`;
            }
        }
    } else if (card.cardType === 'energy') {
        if (game.phase === 'main') {
            if (!game.energyPlayedThisTurn && player.active) {
                html += `<button class="action-btn" onclick="attachEnergy('${card.id}', 'active')">Attach to Active</button>`;
            }
            player.bench.forEach((benchChar, idx) => {
                if (benchChar && !game.energyPlayedThisTurn) {
                    html += `<button class="action-btn" onclick="attachEnergy('${card.id}', ${idx})">Attach to Bench ${idx + 1}</button>`;
                }
            });
        } else {
            html += `<p style="color: red;">Can only attach energy during Main Phase</p>`;
        }
    } else if (card.cardType === 'item' || card.cardType === 'tool') {
        if (game.phase === 'main') {
            html += `<button class="action-btn" onclick="playItem('${card.id}')">Play Item</button>`;
        } else {
            html += `<p style="color: red;">Can only play items during Main Phase</p>`;
        }
    } else if (card.cardType === 'supporter') {
        if (game.phase === 'main') {
            if (!game.supporterPlayedThisTurn) {
                html += `<button class="action-btn" onclick="playSupporter('${card.id}')">Play Supporter</button>`;
            } else {
                html += `<p style="color: red;">Already played a Supporter this turn</p>`;
            }
        } else {
            html += `<p style="color: red;">Can only play supporters during Main Phase</p>`;
        }
    } else if (card.cardType === 'stadium') {
        if (game.phase === 'main') {
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

function playCharacterToActive(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (card && !player.active) {
        player.active = card;
        player.hand = player.hand.filter(c => c.id !== cardId);
        game.log(`${card.name} played to Active`);
        closeModal('action-modal');
        updateUI();
    }
}

function playCharacterToBench(cardId, slotIndex) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (card && player.bench[slotIndex] === null) {
        player.bench[slotIndex] = card;
        player.hand = player.hand.filter(c => c.id !== cardId);
        game.log(`${card.name} played to Bench`);
        closeModal('action-modal');
        updateUI();
    }
}

function attachEnergy(cardId, target) {
    const player = game.players[game.currentPlayer];
    const energyCard = player.hand.find(c => c.id === cardId);

    if (!energyCard || game.energyPlayedThisTurn) return;

    let targetChar;
    if (target === 'active') {
        targetChar = player.active;
    } else {
        targetChar = player.bench[target];
    }

    if (targetChar) {
        targetChar.attachedEnergy.push(energyCard);
        player.hand = player.hand.filter(c => c.id !== cardId);
        game.energyPlayedThisTurn = true;
        game.log(`Attached ${energyCard.name} to ${targetChar.name}`);
        closeModal('action-modal');
        updateUI();
    }
}

function playItem(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (!card) return;

    // Implement specific item effects
    executeItemEffect(card);

    player.hand = player.hand.filter(c => c.id !== cardId);
    player.discard.push(card);

    closeModal('action-modal');
    updateUI();
}

function executeItemEffect(card) {
    const player = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    game.log(`Played ${card.name}`, 'info');

    switch(card.name) {
        // Tool items - these attach to characters
        case 'Maid outfit':
        case 'Conductor Baton':
        case "Kiki's headband":
        case 'Bucket':
        case 'AVGE T-shirt':
        case 'AVGE showcase sticker':
        case 'Musescore subscription':
            showToolAttachmentModal(card);
            return; // Don't discard yet, will discard after attachment

        // Healing items
        case 'Matcha Latte':
            player.bench.forEach(char => {
                if (char) {
                    const healAmount = game.stadium && game.stadium.name === 'Matcha Maid Cafe' ? 20 : 10;
                    char.damage = Math.max(0, (char.damage || 0) - healAmount);
                    game.log(`${char.name} healed ${healAmount} HP`, 'heal');
                }
            });
            break;

        case 'Strawberry Matcha Latte':
            // Cannot be used in performance space (ignoring for now)
            player.bench.forEach(char => {
                if (char) {
                    const healAmount = game.stadium && game.stadium.name === 'Matcha Maid Cafe' ? 30 : 20;
                    char.damage = Math.max(0, (char.damage || 0) - healAmount);
                    game.log(`${char.name} healed ${healAmount} HP`, 'heal');
                }
            });
            break;

        // Special energy items
        case 'Otamatone':
            if (!game.attackModifiers[game.currentPlayer].otamatoneBonus) {
                game.attackModifiers[game.currentPlayer].otamatoneBonus = 0;
            }
            game.attackModifiers[game.currentPlayer].otamatoneBonus += 1;
            game.log('Active character has +1 typeless energy this turn', 'info');
            break;

        case 'Miku otamatone':
            // Only in concert halls
            if (!game.attackModifiers[game.currentPlayer].otamatoneBonus) {
                game.attackModifiers[game.currentPlayer].otamatoneBonus = 0;
            }
            game.attackModifiers[game.currentPlayer].otamatoneBonus += 2;
            game.log('Active character has +2 typeless energy this turn', 'info');
            break;

        // Deck manipulation
        case 'Concert program':
            showTopCards(player, 5);
            break;

        case 'Dress rehearsal roster':
            showDeckSelection(player, 3, 1);
            break;

        case 'Printed score':
            if (opponent.deck.length > 0) {
                const topCard = opponent.deck[0];
                if (confirm(`Top card of opponent's deck: ${topCard.name}. Discard it?`)) {
                    opponent.discard.push(opponent.deck.shift());
                    game.log(`Discarded opponent's top card: ${topCard.name}`, 'info');
                } else {
                    game.log('Did not discard opponent\'s top card', 'info');
                }
            }
            break;

        case 'Annotated score':
            if (opponent.deck.length >= 2) {
                showAnnotatedScoreModal(opponent);
                return; // Don't discard yet
            } else if (opponent.deck.length === 1) {
                alert(`Opponent has only 1 card: ${opponent.deck[0].name}`);
            }
            break;

        // Hand disruption
        case 'Musescore file':
            if (opponent.hand.length >= 3) {
                showHandRevealModal(opponent, 3, false);
                return; // Don't discard yet
            } else {
                alert(`Opponent has only ${opponent.hand.length} cards in hand`);
            }
            break;

        case 'Corrupted file':
            const coinFlip = Math.random() < 0.5;
            if (!coinFlip) {
                if (player.hand.length > 0) {
                    const randomCard = player.hand[Math.floor(Math.random() * player.hand.length)];
                    player.discard.push(randomCard);
                    player.hand = player.hand.filter(c => c !== randomCard);
                    game.log(`Coin flip: Tails. Discarded ${randomCard.name} from your hand`, 'info');
                }
            } else {
                game.log('Coin flip: Heads', 'info');
            }
            if (opponent.hand.length >= 3) {
                showHandRevealModal(opponent, 3, false);
                return; // Don't discard yet
            }
            break;

        // Board manipulation
        case 'Cast reserve':
            const castCoinFlip = Math.random() < 0.5;
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

        case 'Ice skates':
            if (opponent.active && opponent.bench.some(c => c)) {
                showOpponentSwitchModal(opponent);
                return; // Don't discard yet
            } else {
                game.log('Cannot switch opponent (no bench)', 'info');
            }
            break;

        // Damage modifiers
        case 'Folding stand':
            if (!game.attackModifiers[game.currentPlayer].damageBonus) {
                game.attackModifiers[game.currentPlayer].damageBonus = 0;
            }
            game.attackModifiers[game.currentPlayer].damageBonus += 10;
            game.log('Active character does +10 damage this turn', 'info');
            break;

        case 'BUO stand':
            if (player.active && player.active.attachedEnergy && player.active.attachedEnergy.length > 0) {
                const discardedEnergy = player.active.attachedEnergy.pop();
                player.discard.push(discardedEnergy);
                game.log(`Discarded ${discardedEnergy.name} from active`, 'info');

                if (!game.attackModifiers[game.currentPlayer].damageBonus) {
                    game.attackModifiers[game.currentPlayer].damageBonus = 0;
                }
                game.attackModifiers[game.currentPlayer].damageBonus += 20;
                game.log('Active character does +20 damage this turn', 'info');
            } else {
                game.log('No energy to discard from active character', 'info');
            }
            break;

        // Draw items
        case 'Concert ticket':
            const cardsToDraw = Math.max(0, 4 - player.hand.length);
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
                    return; // Don't discard yet
                }
            }
            break;

        // Search items
        case 'SE concert roster':
            // Search for low health character
            showCharacterSearchModal(player, 'low-hp');
            return; // Don't discard yet

        // Stadium removal
        case 'BAI Email':
            if (game.stadium) {
                player.discard.push(game.stadium);
                game.log(`Discarded stadium: ${game.stadium.name}`, 'info');
                game.stadium = null;
            } else {
                game.log('No stadium in play', 'info');
            }
            break;

        // Tool removal
        case 'AVGE Birb':
            let toolsRemoved = 0;
            [opponent.active, ...opponent.bench].filter(c => c).forEach(char => {
                if (char.attachedTools && char.attachedTools.length > 0) {
                    toolsRemoved += char.attachedTools.length;
                    char.attachedTools.forEach(tool => {
                        opponent.discard.push(tool);
                        game.log(`Removed ${tool.name} from ${char.name}`, 'info');
                    });
                    char.attachedTools = [];
                }
            });

            if (toolsRemoved > 0) {
                game.log(`Removed ${toolsRemoved} tool(s)`, 'info');
            }

            // Next turn penalty
            if (!game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty) {
                game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty = 0;
            }
            game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty = 30;
            game.log('Next turn: Active takes +30 damage from attacks', 'info');
            break;

        // Discard retrieval
        case 'Camera':
            selectFromDiscard(player, 'supporter');
            break;

        case 'Video Camera':
            selectMultipleFromDiscard(player, 'energy', 2);
            break;

        default:
            game.log(`${card.name} effect not yet implemented`, 'info');
    }
}

function showTopCards(player, count) {
    const topCards = player.deck.slice(0, Math.min(count, player.deck.length));
    alert(`Top ${count} cards: ${topCards.map(c => c.name).join(', ')}`);
    game.log(`Looked at top ${count} cards`, 'info');
}

function showDeckSelection(player, viewCount, selectCount) {
    const topCards = player.deck.slice(0, Math.min(viewCount, player.deck.length));
    // For now, just auto-select first card and discard rest
    if (topCards.length > 0) {
        const selected = topCards[0];
        player.hand.push(selected);
        player.deck = player.deck.filter(c => c.id !== selected.id);

        topCards.slice(1).forEach(c => {
            player.discard.push(c);
            player.deck = player.deck.filter(card => card.id !== c.id);
        });

        game.log(`Selected ${selected.name}, discarded ${topCards.length - 1} cards`, 'info');
    }
}

function selectFromDiscard(player, cardType) {
    const eligibleCards = player.discard.filter(c => c.cardType === cardType);
    if (eligibleCards.length > 0) {
        // For now, just take the first one
        const card = eligibleCards[0];
        player.hand.push(card);
        player.discard = player.discard.filter(c => c.id !== card.id);
        game.log(`Retrieved ${card.name} from discard`, 'info');
    } else {
        game.log(`No ${cardType} cards in discard`, 'info');
    }
}

function selectMultipleFromDiscard(player, cardType, count) {
    const eligibleCards = player.discard.filter(c => c.cardType === cardType).slice(0, count);
    eligibleCards.forEach(card => {
        player.hand.push(card);
        player.discard = player.discard.filter(c => c.id !== card.id);
        game.log(`Retrieved ${card.name} from discard`, 'info');
    });
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

    closeModal('action-modal');
    updateUI();
}

// Annotated score modal
function showAnnotatedScoreModal(opponent) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');

    const topTwo = opponent.deck.slice(0, 2);

    let html = `<h2>Annotated Score - Top 2 Cards</h2>`;
    html += `<p>Choose position for each card</p>`;

    topTwo.forEach((card, idx) => {
        html += `<div style="margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">`;
        html += `<p><strong>${card.name}</strong></p>`;
        html += `<button class="action-btn" onclick="placeAnnotatedCard(${idx}, 'top')">Place on Top</button>`;
        html += `<button class="action-btn" onclick="placeAnnotatedCard(${idx}, 'bottom')">Place on Bottom</button>`;
        html += `</div>`;
    });

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function placeAnnotatedCard(cardIndex, position) {
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    const card = opponent.deck[cardIndex];
    game.log(`Placed ${card.name} on ${position}`, 'info');

    // Simple implementation: just log the choice
    // In a full implementation, you'd track both choices before rearranging

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

    closeModal('action-modal');
    updateUI();
}

function playSupporter(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (!card || game.supporterPlayedThisTurn) return;

    // Implement specific supporter effects
    executeSupporterEffect(card);

    player.hand = player.hand.filter(c => c.id !== cardId);
    player.discard.push(card);
    game.supporterPlayedThisTurn = true;

    closeModal('action-modal');
    updateUI();
}

function executeSupporterEffect(card) {
    const player = game.players[game.currentPlayer];
    const opponent = game.players[game.currentPlayer === 1 ? 2 : 1];

    game.log(`Played supporter: ${card.name}`, 'info');

    switch(card.name) {
        case 'Johann':
            // Retrieve one of each type from discard
            selectFromDiscard(player, 'supporter');
            selectFromDiscard(player, 'item');
            selectFromDiscard(player, 'stadium');
            break;

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
            // Shuffle all discard into deck, end turn
            const discardCount = player.discard.length;
            player.deck.push(...player.discard);
            player.discard = [];
            game.shuffleDeck(game.currentPlayer);
            game.log(`Shuffled ${discardCount} cards from discard into deck. Turn ends.`, 'info');
            setTimeout(() => {
                game.switchPlayer();
                game.drawCards(game.currentPlayer, 1);
                updateUI();
            }, 1000);
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
            // Bench must be empty - search for 3 different type characters
            if (player.bench.every(slot => slot === null)) {
                // For now, auto-select first 3 characters of different types
                const characters = player.deck.filter(c => c.cardType === 'character');
                const selectedTypes = new Set();
                const selected = [];

                for (const char of characters) {
                    const charType = char.type[0]; // First type
                    if (!selectedTypes.has(charType) && selected.length < 3) {
                        selected.push(char);
                        selectedTypes.add(charType);
                    }
                }

                selected.forEach((char, idx) => {
                    player.bench[idx] = char;
                    player.deck = player.deck.filter(c => c.id !== char.id);
                    game.log(`Placed ${char.name} on bench`, 'info');
                });
            } else {
                game.log('Bench must be empty to use Lucas!', 'info');
            }
            break;

        case 'Angel':
            // Give active goon status
            if (player.active) {
                if (!player.active.status) player.active.status = [];
                player.active.status.push('Goon');
                game.log(`${player.active.name} gained Goon status`, 'info');
            }
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
            // Switch opponent's active with benched
            if (opponent.bench.some(slot => slot !== null)) {
                // For now, auto-select first benched
                const benchIndex = opponent.bench.findIndex(slot => slot !== null);
                if (benchIndex !== -1) {
                    const temp = opponent.active;
                    opponent.active = opponent.bench[benchIndex];
                    opponent.bench[benchIndex] = temp;
                    game.log(`Opponent's ${opponent.active.name} switched to active`, 'info');
                }
            }
            break;

        case 'Victoria Chen':
            // Search for up to 3 characters of chosen type
            // For now, just get first 3 of most common type in deck
            const allChars = player.deck.filter(c => c.cardType === 'character');
            const typeCounts = {};
            allChars.forEach(char => {
                const type = char.type[0];
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            });

            const mostCommonType = Object.keys(typeCounts).reduce((a, b) =>
                typeCounts[a] > typeCounts[b] ? a : b, null);

            if (mostCommonType) {
                const selected = allChars
                    .filter(char => char.type.includes(mostCommonType))
                    .slice(0, 3);

                selected.forEach((char, idx) => {
                    const emptySlot = player.bench.findIndex(slot => slot === null);
                    if (emptySlot !== -1) {
                        player.bench[emptySlot] = char;
                        player.deck = player.deck.filter(c => c.id !== char.id);
                        game.log(`Placed ${char.name} on bench`, 'info');
                    }
                });
            }
            break;

        default:
            game.log(`${card.name} effect not yet implemented`, 'info');
    }
}

function playStadium(cardId) {
    const player = game.players[game.currentPlayer];
    const card = player.hand.find(c => c.id === cardId);

    if (!card) return;

    // Discard old stadium if exists
    if (game.stadium) {
        player.discard.push(game.stadium);
    }

    game.stadium = card;
    player.hand = player.hand.filter(c => c.id !== cardId);
    game.log(`Played stadium: ${card.name}`);

    closeModal('action-modal');
    updateUI();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Attack System
function showAttackMenu(cardId) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;

    if (!attacker || attacker.id !== cardId) {
        alert('This character must be active to attack!');
        return;
    }

    if (game.phase !== 'attack') {
        alert('You must enter the Attack Phase first! Click "Begin Attack Phase" button.');
        closeModal('action-modal');
        return;
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
    if (attacker.moves && attacker.moves.length > 0) {
        attacker.moves.forEach((move, idx) => {
            const canUse = canUseMove(attacker, move);
            const disabled = canUse ? '' : 'disabled';
            html += `<button class="action-btn" ${disabled} onclick="selectMove('${cardId}', ${idx})">${move.name} [${move.cost ? move.cost.join('') : ''}] - ${move.damage || 0} dmg</button>`;
        });
    } else {
        html += `<p>No moves available</p>`;
    }

    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function canUseMove(character, move) {
    if (!move.cost || move.cost.length === 0) return true;

    const energyCount = {};
    character.attachedEnergy.forEach(energy => {
        energyCount[energy.energyType] = (energyCount[energy.energyType] || 0) + 1;
    });

    // Add Otamatone bonus energy (typeless)
    let bonusEnergy = 0;
    if (game.attackModifiers[game.currentPlayer].otamatoneBonus) {
        bonusEnergy = game.attackModifiers[game.currentPlayer].otamatoneBonus;
    }

    let colorlessNeeded = 0;
    for (const costSymbol of move.cost) {
        if (costSymbol === 'X') {
            colorlessNeeded++;
        } else {
            // Find matching type using the helper function
            const typeNeeded = getTypeFromSymbol(costSymbol);
            if (typeNeeded) {
                if (!energyCount[typeNeeded] || energyCount[typeNeeded] === 0) {
                    return false;
                }
                energyCount[typeNeeded]--;
            }
        }
    }

    // Check if we have enough total energy for colorless costs (including bonus)
    const totalEnergy = Object.values(energyCount).reduce((sum, val) => sum + val, 0) + bonusEnergy;
    return totalEnergy >= colorlessNeeded;
}

function selectMove(cardId, moveIndex) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;
    const move = attacker.moves[moveIndex];

    closeModal('action-modal');

    // Show target selection
    showTargetSelection(attacker, move);
}

function showTargetSelection(attacker, move) {
    const modal = document.getElementById('action-modal');
    const content = document.getElementById('action-content');
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    let html = `<h2>Select Target for ${move.name}</h2>`;
    html += `<div class="target-selection">`;

    // Add opponent's active as target
    if (opponent.active) {
        html += `<div class="target-option" onclick="executeAttack('${attacker.id}', '${move.name}', '${opponent.active.id}')">
            ${opponent.active.name} (Active) - ${opponent.active.hp - (opponent.active.damage || 0)}/${opponent.active.hp} HP
        </div>`;
    }

    // Add opponent's benched characters as targets (for some moves)
    opponent.bench.forEach((benchChar, idx) => {
        if (benchChar) {
            html += `<div class="target-option" onclick="executeAttack('${attacker.id}', '${move.name}', '${benchChar.id}')">
                ${benchChar.name} (Bench ${idx + 1}) - ${benchChar.hp - (benchChar.damage || 0)}/${benchChar.hp} HP
            </div>`;
        }
    });

    html += `</div>`;
    html += `<button class="action-btn" onclick="closeModal('action-modal')">Cancel</button>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function executeAttack(attackerId, moveName, targetId) {
    const player = game.players[game.currentPlayer];
    const attacker = player.active;
    const move = attacker.moves.find(m => m.name === moveName);

    if (!move) return;

    // Find target
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];
    let target = opponent.active && opponent.active.id === targetId ? opponent.active : null;
    if (!target) {
        target = opponent.bench.find(char => char && char.id === targetId);
    }

    if (!target) {
        alert('Target not found!');
        return;
    }

    // Mark that an attack has been used this turn
    game.attackedThisTurn = true;

    // Execute specific attack effects by move name
    switch (move.name) {
        case 'Vibrato':
            // Standard damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Vocal warmups':
            // Attach an energy from your hand to this character
            if (player.hand.some(c => c.cardType === 'energy')) {
                game.log(`${attacker.name} used Vocal warmups - select energy from hand to attach`);
                // TODO: Show energy selection modal
            }
            break;

        case 'SATB':
            // For each choir in play, choose opponent's character and do 10 damage
            const choirCount = [player.active, ...player.bench].filter(c => c && c.type.includes(TYPES.CHOIR)).length;
            game.log(`SATB: Found ${choirCount} choir characters`);
            for (let i = 0; i < choirCount; i++) {
                // TODO: Let player select target for each hit
                const allOpponentChars = [opponent.active, ...opponent.bench].filter(c => c);
                if (allOpponentChars.length > 0) {
                    const randomTarget = allOpponentChars[Math.floor(Math.random() * allOpponentChars.length)];
                    game.dealDamage(randomTarget, 10);
                    game.log(`SATB hit ${randomTarget.name} for 10 damage`);
                }
            }
            break;

        case 'Artist Alley':
            // Discard concert posters and do 30 damage each
            const posterCount = player.hand.filter(c => c.name === 'Concert poster').length;
            if (posterCount > 0) {
                const discardCount = parseInt(prompt(`Discard how many concert posters? (0-${posterCount})`));
                if (discardCount > 0 && discardCount <= posterCount) {
                    for (let i = 0; i < discardCount; i++) {
                        const poster = player.hand.find(c => c.name === 'Concert poster');
                        player.discard.push(poster);
                        player.hand = player.hand.filter(c => c !== poster);
                    }
                    const totalDamage = discardCount * 30;
                    const finalDamage = calculateDamage(attacker, target, totalDamage, move);
                    game.dealDamage(target, finalDamage);
                    game.log(`Artist Alley: Discarded ${discardCount} posters for ${finalDamage} damage!`, 'damage');
                }
            }
            break;

        case 'Circular Breathing':
            // 10 damage, next turn +10 damage (stacks)
            executeDamageAttack(attacker, target, move);
            if (!attacker.circularBreathingBonus) attacker.circularBreathingBonus = 0;
            attacker.circularBreathingBonus += 10;
            game.log('Circular Breathing bonus will apply next turn!');
            break;

        case 'Turn Up!':
            // Next turn, plucked strings do 30 more damage
            if (!game.nextTurnEffects[game.currentPlayer].turnUpBonus) {
                game.nextTurnEffects[game.currentPlayer].turnUpBonus = 0;
            }
            game.nextTurnEffects[game.currentPlayer].turnUpBonus += 30;
            game.log('Turn Up!: Plucked strings will do +30 damage next turn');
            break;

        case 'Feedback Loop':
            // 40 damage to target, each plucked strings takes 10 damage
            executeDamageAttack(attacker, target, move);
            const pluckedChars = [player.active, ...player.bench].filter(c => c && c.type.includes(TYPES.PLUCKED));
            pluckedChars.forEach(char => {
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
            const finalDamage = calculateDamage(attacker, target, damageAmount, move);
            game.dealDamage(target, finalDamage);
            game.dealDamage(attacker, 40);
            game.log(`Song voting: ${uniqueTypes.size} unique types for ${finalDamage} damage, 40 recoil`, 'damage');
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
            // TODO: Implement switch mechanic
            game.nextTurnEffects[game.currentPlayer].arrangementProcrastination = true;
            game.log('Arrangement procrastination effect will trigger next turn!');
            break;

        case 'Three Hand Technique':
            // Three individual attacks of 10 damage each
            for (let i = 0; i < 3; i++) {
                const damage = calculateDamage(attacker, target, 10, move);
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
            const topFour = player.deck.splice(0, 4);
            let musescoreDiscarded = 0;
            topFour.forEach(card => {
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
            // Search deck for 3 percussion instruments and attach to any percussionist
            game.log('Percussion Ensemble: Search deck for percussion instruments');
            // TODO: Implement deck search UI
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
            // Discard top 3 of opponent deck, 40 damage per item card
            const topThree = opponent.deck.splice(0, 3);
            let itemsDiscarded = 0;
            topThree.forEach(card => {
                opponent.discard.push(card);
                if (card.cardType === 'item') {
                    itemsDiscarded++;
                }
                game.log(`Opponent discarded ${card.name}`);
            });
            if (itemsDiscarded > 0) {
                const totalDamage = itemsDiscarded * 40;
                const finalDamage = calculateDamage(attacker, target, totalDamage, move);
                game.dealDamage(target, finalDamage);
                game.log(`Improv: ${itemsDiscarded} items for ${finalDamage} damage!`, 'damage');
            }
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
            // Only usable if exactly 60 health, 70 damage
            if (attacker.hp - (attacker.damage || 0) === 60) {
                executeDamageAttack(attacker, target, move);
            } else {
                game.log('You know what it is can only be used at exactly 60 HP!');
            }
            break;

        case '440 Hz':
            // Attach energy from hand to benched character
            game.log('440 Hz: Select energy from hand and benched character');
            // TODO: Implement energy attachment UI
            break;

        case 'Triple Stops':
            // Flip 3 coins, 30 damage per heads
            let heads = 0;
            for (let i = 0; i < 3; i++) {
                if (Math.random() < 0.5) {
                    heads++;
                    game.log('Triple Stops: Heads!');
                } else {
                    game.log('Triple Stops: Tails');
                }
            }
            if (heads > 0) {
                const tripleStopsDamage = heads * 30;
                const tripleStopsFinal = calculateDamage(attacker, target, tripleStopsDamage, move);
                game.dealDamage(target, tripleStopsFinal);
                game.log(`Triple Stops: ${heads} heads for ${tripleStopsFinal} damage!`, 'damage');
            }
            break;

        default:
            // Standard damage attack for unlisted moves
            if (move.damage > 0) {
                executeDamageAttack(attacker, target, move);
            }
            break;
    }

    closeModal('action-modal');
    updateUI();
}

// Helper function for standard damage attacks
function executeDamageAttack(attacker, target, move) {
    let baseDamage = move.damage || 0;

    // Apply Circular Breathing bonus
    if (attacker.circularBreathingBonus && move.name === 'Circular Breathing') {
        baseDamage += attacker.circularBreathingBonus;
        game.log(`Circular Breathing bonus: +${attacker.circularBreathingBonus} damage`);
    }

    const finalDamage = calculateDamage(attacker, target, baseDamage, move);
    game.dealDamage(target, finalDamage);
    game.log(`${attacker.name} used ${move.name} on ${target.name} for ${finalDamage} damage!`, 'damage');
}

function calculateDamage(attacker, defender, baseDamage, move) {
    let damage = baseDamage;

    // Apply type resistance
    attacker.type.forEach(attackerType => {
        if (RESISTANCE_CHAIN[attackerType] && defender.type.includes(RESISTANCE_CHAIN[attackerType])) {
            damage = Math.floor(damage * 0.5); // Resisted damage is halved
            game.log(`${defender.name} resists ${attackerType} type!`);
        }
    });

    // Apply stadium effects
    if (game.stadium) {
        if (game.stadium.name === 'Red Room') {
            if (attacker.type.includes(TYPES.STRINGS) || attacker.type.includes(TYPES.WOODWINDS)) {
                damage -= 10;
            }
            if (attacker.type.includes(TYPES.PLUCKED) || attacker.type.includes(TYPES.PERCUSSION)) {
                damage += 10;
            }
        } else if (game.stadium.name === 'Lindemann Big Practice Room') {
            if (attacker.type.includes(TYPES.WOODWINDS) || attacker.type.includes(TYPES.BRASS)) {
                damage += 10;
            }
        } else if (game.stadium.name === 'Matcha Maid Cafe') {
            if (attacker.status && attacker.status.includes('Maid')) {
                damage += 10;
            }
        } else if (game.stadium.name === 'Steinert Practice Room') {
            if (attacker.type.includes(TYPES.PIANO)) {
                damage += 10;
            }
        } else if (game.stadium.name === 'Friedman Hall') {
            if (attacker.type.includes(TYPES.CHOIR)) {
                damage += 10;
            }
        }
    }

    // Apply character abilities
    const currentPlayer = game.players[game.currentPlayer];
    const opponentNum = game.currentPlayer === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    // Grace's Amplify (bench ability)
    const hasGraceOnBench = currentPlayer.bench.some(char => char && char.name === 'Grace');
    if (hasGraceOnBench && attacker.type.includes(TYPES.PLUCKED)) {
        damage += 20;
        game.log('Grace\'s Amplify: +20 damage');
    }

    // Turn Up! bonus for plucked strings
    if (game.nextTurnEffects[game.currentPlayer].turnUpBonus && attacker.type.includes(TYPES.PLUCKED)) {
        damage += game.nextTurnEffects[game.currentPlayer].turnUpBonus;
        game.log(`Turn Up! bonus: +${game.nextTurnEffects[game.currentPlayer].turnUpBonus} damage`);
    }

    // Ash's Instagram Viral
    if (attacker.name === 'Ash') {
        const bothBenchesFull = currentPlayer.bench.every(slot => slot !== null) &&
                                 opponent.bench.every(slot => slot !== null);
        if (bothBenchesFull) {
            damage *= 2;
            game.log('Ash\'s Instagram Viral: 2x damage!');
        }
    }

    // Grace's Royalties (if Grace is active and opponent has AVGE items)
    if (attacker.name === 'Grace' && currentPlayer.active === attacker) {
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

    // Apply AVGE Birb penalty (from previous turn)
    if (game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty && attacker === currentPlayer.active) {
        damage += game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty;
        game.log(`AVGE Birb penalty: +${game.nextTurnEffects[game.currentPlayer].avgebBirbPenalty} damage to active`);
    }

    return Math.max(0, damage);
}

// Retreat and Switch
function showRetreatMenu(cardId) {
    const player = game.players[game.currentPlayer];
    const active = player.active;

    if (!active || active.id !== cardId) return;

    const retreatCost = active.retreatCost || 1;
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

    game.log(`${active.name} retreated, ${benchChar.name} is now active`);

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
        game.log(`${player.active.name} moved to active`, 'info');
    } else {
        // Manual switch requires retreat cost from active pokemon
        const active = player.active;
        const retreatCost = active.retreatCost || 1;
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

    game.log(`${active.name} switched to bench, ${benchChar.name} is now active (paid ${retreatCost} energy)`, 'info');

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

    game.log(`${card.name} uses ${ability.name}!`, 'info');

    // Implement specific activated abilities
    switch (ability.name) {
        case 'Profit Margins':
            // Emily: Discard a tool to draw 2 cards
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
                const programsAndTickets = player.discard.filter(c =>
                    c.name === 'Concert program' || c.name === 'Concert ticket'
                );
                if (programsAndTickets.length > 0) {
                    programsAndTickets.forEach(item => {
                        player.hand.push(item);
                        player.discard = player.discard.filter(c => c !== item);
                        game.log(`Retrieved ${item.name} from discard`);
                    });
                    closeModal('action-modal');
                    updateUI();
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

        default:
            game.log(`${ability.name} effect not yet implemented`);
            closeModal('action-modal');
            break;
    }
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
    card.attachedTools.splice(toolIndex, 1);
    player.discard.push(tool);

    game.log(`Discarded ${tool.name}, drawing 2 cards`);
    game.drawCards(game.currentPlayer, 2);

    closeModal('action-modal');
    updateUI();
}

function setupEventListeners() {
    // End turn button
    document.getElementById('end-turn-btn').addEventListener('click', () => {
        game.switchPlayer();
        game.drawCards(game.currentPlayer, 1);
        updateUI();
    });

    // Begin attack phase button
    document.getElementById('begin-attack-btn').addEventListener('click', () => {
        game.beginAttackPhase();
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

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    initGame();
});
