// Action Buttons - Creates interactive button components
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { ACTIONS, createCustomId } from '../../utils/constants.js';
import { canBeginAttackPhase } from '../../game/GameValidator.js';

/**
 * Create action buttons for the current game state
 * @param {GameState} gameState - Current game state
 * @param {number} playerNum - Player number (1 or 2)
 * @returns {Array<ActionRowBuilder>} - Array of action rows
 */
export function createActionButtons(gameState, playerNum) {
    const rows = [];
    const isCurrentPlayer = gameState.currentPlayer === playerNum;

    if (gameState.phase === 'gameover') {
        return []; // No buttons when game is over
    }

    if (!isCurrentPlayer) {
        // Not your turn - show waiting message
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('waiting')
                .setLabel('Waiting for opponent...')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
        return [row];
    }

    // Main phase buttons
    if (gameState.phase === 'main') {
        rows.push(createMainPhaseButtons(gameState, playerNum));
    }

    // Attack phase buttons
    if (gameState.phase === 'attack') {
        rows.push(createAttackPhaseButtons(gameState, playerNum));
    }

    // Always show end turn button
    rows.push(createUtilityButtons(gameState, playerNum));

    return rows;
}

/**
 * Create buttons for main phase
 */
function createMainPhaseButtons(gameState, playerNum) {
    const player = gameState.players[playerNum];

    const row = new ActionRowBuilder();

    // Play Card button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(createCustomId(ACTIONS.PLAY_CARD, gameState.gameId))
            .setLabel('Play Card')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎴')
            .setDisabled(player.hand.length === 0)
    );

    // Begin Attack Phase button
    const canAttack = canBeginAttackPhase(gameState, playerNum);
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(createCustomId(ACTIONS.BEGIN_ATTACK, gameState.gameId))
            .setLabel('Begin Attack')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️')
            .setDisabled(!canAttack.valid)
    );

    // Retreat button
    const canRetreat = player.active && player.bench.some(c => c);
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(createCustomId(ACTIONS.RETREAT, gameState.gameId))
            .setLabel('Retreat')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏃')
            .setDisabled(!canRetreat)
    );

    // Use Ability button (for activated abilities)
    const hasActivatedAbility = player.active && player.active.ability && player.active.ability.type === 'activated';
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(createCustomId(ACTIONS.USE_ABILITY, gameState.gameId))
            .setLabel('Use Ability')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✨')
            .setDisabled(!hasActivatedAbility)
    );

    return row;
}

/**
 * Create buttons for attack phase
 */
function createAttackPhaseButtons(gameState, playerNum) {
    const player = gameState.players[playerNum];

    const row = new ActionRowBuilder();

    // Attack button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(createCustomId(ACTIONS.ATTACK, gameState.gameId))
            .setLabel('Choose Attack')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️')
            .setDisabled(!player.active || gameState.attackedThisTurn)
    );

    return row;
}

/**
 * Create utility buttons (end turn, forfeit)
 */
function createUtilityButtons(gameState, playerNum) {
    const row = new ActionRowBuilder();

    // End Turn button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(createCustomId(ACTIONS.END_TURN, gameState.gameId))
            .setLabel('End Turn')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
    );

    // Forfeit button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(createCustomId(ACTIONS.FORFEIT, gameState.gameId))
            .setLabel('Forfeit')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏳️')
    );

    return row;
}

/**
 * Create card selector from hand
 */
export function createHandSelector(hand, gameId) {
    if (hand.length === 0) {
        return null;
    }

    // Group cards by type for better organization
    const options = hand.slice(0, 25).map(card => ({
        label: card.name,
        description: `${card.cardType} - ${card.effect || card.hp || 'Energy'}`.substring(0, 100),
        value: card.id,
        emoji: getCardTypeEmoji(card.cardType)
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(createCustomId(ACTIONS.SELECT_CARD, gameId))
        .setPlaceholder('Choose a card to play')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create move selector for active character
 */
export function createMoveSelector(character, gameId) {
    if (!character || !character.moves) {
        return null;
    }

    const options = character.moves.map((move, idx) => ({
        label: move.name,
        description: `${move.damage || 0} damage - ${move.effect || 'No effect'}`.substring(0, 100),
        value: String(idx),
        emoji: '⚔️'
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(createCustomId(ACTIONS.SELECT_MOVE, gameId))
        .setPlaceholder('Choose a move to use')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create character target selector
 */
export function createTargetSelector(characters, gameId, label = 'Choose a target') {
    if (!characters || characters.length === 0) {
        return null;
    }

    const options = characters.map((char, idx) => ({
        label: char.name,
        description: `${char.hp - (char.damage || 0)}/${char.hp} HP`,
        value: char.id,
        emoji: '🎯'
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(createCustomId(ACTIONS.SELECT_CHARACTER_TARGET, gameId))
        .setPlaceholder(label)
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create bench slot selector
 */
export function createBenchSlotSelector(bench, gameId) {
    const options = [];

    bench.forEach((char, idx) => {
        if (!char) {
            options.push({
                label: `Slot ${idx + 1} (Empty)`,
                description: 'Empty bench slot',
                value: String(idx),
                emoji: '⬜'
            });
        }
    });

    if (options.length === 0) {
        return null;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(createCustomId(ACTIONS.SELECT_BENCH_SLOT, gameId))
        .setPlaceholder('Choose a bench slot')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Create energy selector (for retreat or discarding)
 */
export function createEnergySelector(energyCards, gameId, count = 1) {
    if (!energyCards || energyCards.length === 0) {
        return null;
    }

    const options = energyCards.map((energy, idx) => ({
        label: energy.name,
        description: energy.energyType || 'Colorless',
        value: energy.id,
        emoji: '⚡'
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(createCustomId(ACTIONS.SELECT_ENERGY, gameId))
        .setPlaceholder(`Select ${count} energy to discard`)
        .setMinValues(count)
        .setMaxValues(count)
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Get emoji for card type
 */
function getCardTypeEmoji(cardType) {
    const emojis = {
        character: '🎭',
        energy: '⚡',
        item: '🎁',
        tool: '🔧',
        supporter: '👤',
        stadium: '🎪'
    };
    return emojis[cardType] || '🎴';
}
