// Select Handler - Handles select menu interactions
import { parseCustomId, ACTIONS } from '../../utils/constants.js';
import { loadGame, saveGame } from '../../storage/GameManager.js';
import { renderGameState } from '../components/GameView.js';
import { createActionButtons, createTargetSelector, createBenchSlotSelector } from '../components/ActionButtons.js';
import { canPlayCard, canUseMove } from '../../game/GameValidator.js';
import { findCardById, removeCardById } from '../../utils/cardHelpers.js';
import { calculateDamage } from '../../game/DamageCalculator.js';

export async function handleSelectMenuInteraction(interaction) {
    const { action, params } = parseCustomId(interaction.customId);
    const gameId = params[0];

    // Load game
    const game = await loadGame(gameId);
    if (!game) {
        return interaction.reply({
            content: '❌ Game not found!',
            ephemeral: true
        });
    }

    // Verify user
    const userPlayerNum = game.player1Id === interaction.user.id ? 1 :
                          game.player2Id === interaction.user.id ? 2 : null;

    if (!userPlayerNum) {
        return interaction.reply({
            content: '❌ You are not in this game!',
            ephemeral: true
        });
    }

    try {
        switch (action) {
            case ACTIONS.SELECT_CARD:
                await handleCardSelection(interaction, game, userPlayerNum);
                break;

            case ACTIONS.SELECT_MOVE:
                await handleMoveSelection(interaction, game, userPlayerNum);
                break;

            case ACTIONS.SELECT_CHARACTER_TARGET:
                await handleTargetSelection(interaction, game, userPlayerNum);
                break;

            case ACTIONS.SELECT_BENCH_SLOT:
                await handleBenchSlotSelection(interaction, game, userPlayerNum);
                break;

            default:
                await interaction.reply({
                    content: '❌ Unknown selection!',
                    ephemeral: true
                });
        }
    } catch (error) {
        console.error('Error in select handler:', error);
        await interaction.reply({
            content: `❌ Error: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleCardSelection(interaction, game, playerNum) {
    const cardId = interaction.values[0];
    const player = game.players[playerNum];

    const card = findCardById(player.hand, cardId);
    if (!card) {
        return interaction.reply({
            content: '❌ Card not found in hand!',
            ephemeral: true
        });
    }

    // Validate card play
    const validation = canPlayCard(game, playerNum, cardId);
    if (!validation.valid) {
        return interaction.reply({
            content: `❌ ${validation.reason}`,
            ephemeral: true
        });
    }

    // Handle different card types
    switch (card.cardType) {
        case 'character':
            await playCharacterCard(interaction, game, playerNum, card);
            break;

        case 'energy':
            // Need to show character selector - simplified for now
            await interaction.reply({
                content: '⚡ Energy cards need character selector (coming soon)',
                ephemeral: true
            });
            break;

        case 'stadium':
            await playStadiumCard(interaction, game, playerNum, card);
            break;

        case 'item':
        case 'tool':
        case 'supporter':
            await interaction.reply({
                content: `${card.cardType} cards need full implementation (coming soon)`,
                ephemeral: true
            });
            break;
    }
}

async function playCharacterCard(interaction, game, playerNum, card) {
    const player = game.players[playerNum];

    // Remove from hand
    removeCardById(player.hand, card.id);

    // Check if active is empty
    if (!player.active) {
        player.active = card;
        game.log(`Player ${playerNum} played ${card.name} to active slot`);
    } else {
        // Find empty bench slot
        const emptySlot = player.bench.findIndex(slot => slot === null);
        if (emptySlot !== -1) {
            player.bench[emptySlot] = card;
            game.log(`Player ${playerNum} played ${card.name} to bench slot ${emptySlot + 1}`);
        } else {
            // Should not happen due to validation
            player.hand.push(card);
            return interaction.reply({
                content: '❌ No space on bench!',
                ephemeral: true
            });
        }
    }

    await saveGame(game);
    await updateGameView(interaction, game);

    await interaction.update({
        content: `✅ Played ${card.name}!`,
        components: []
    });
}

async function playStadiumCard(interaction, game, playerNum, card) {
    const player = game.players[playerNum];

    // Remove from hand
    removeCardById(player.hand, card.id);

    // Discard old stadium
    if (game.stadium) {
        game.log(`${game.stadium.name} was replaced`);
    }

    // Set new stadium
    game.stadium = card;
    game.log(`Player ${playerNum} played stadium: ${card.name}`);

    await saveGame(game);
    await updateGameView(interaction, game);

    await interaction.update({
        content: `✅ Played stadium: ${card.name}!`,
        components: []
    });
}

async function handleMoveSelection(interaction, game, playerNum) {
    const moveIndex = parseInt(interaction.values[0]);
    const player = game.players[playerNum];
    const attacker = player.active;

    if (!attacker) {
        return interaction.reply({
            content: '❌ No active character!',
            ephemeral: true
        });
    }

    const move = attacker.moves[moveIndex];
    if (!move) {
        return interaction.reply({
            content: '❌ Invalid move!',
            ephemeral: true
        });
    }

    // Validate move
    const validation = canUseMove(game, attacker, moveIndex);
    if (!validation.valid) {
        return interaction.reply({
            content: `❌ ${validation.reason}`,
            ephemeral: true
        });
    }

    // Execute attack (simplified - attacks opponent's active)
    const opponentNum = playerNum === 1 ? 2 : 1;
    const opponent = game.players[opponentNum];

    if (!opponent.active) {
        return interaction.reply({
            content: '❌ Opponent has no active character!',
            ephemeral: true
        });
    }

    // Calculate damage
    const baseDamage = move.damage || 0;
    const finalDamage = calculateDamage(attacker, opponent.active, baseDamage, move, game);

    // Deal damage
    game.dealDamage(opponent.active, finalDamage);
    game.attackedThisTurn = true;

    game.log(`Player ${playerNum}'s ${attacker.name} used ${move.name} for ${finalDamage} damage!`);

    // Check if game ended
    if (game.phase === 'gameover') {
        await saveGame(game);
        await updateGameView(interaction, game);

        const winnerId = game.winner === 1 ? game.player1Id : game.player2Id;

        return interaction.update({
            content: `🏆 Game Over! <@${winnerId}> wins!`,
            components: []
        });
    }

    await saveGame(game);
    await updateGameView(interaction, game);

    await interaction.update({
        content: `⚔️ ${attacker.name} used ${move.name} for ${finalDamage} damage!`,
        components: []
    });
}

async function handleTargetSelection(interaction, game, playerNum) {
    await interaction.reply({
        content: '🎯 Target selection (coming soon)',
        ephemeral: true
    });
}

async function handleBenchSlotSelection(interaction, game, playerNum) {
    await interaction.reply({
        content: '📋 Bench slot selection (coming soon)',
        ephemeral: true
    });
}

/**
 * Update game view in the channel
 */
async function updateGameView(interaction, game) {
    const channel = interaction.channel;

    // Player 1 view
    const p1View = renderGameState(game, 1);
    const p1Buttons = createActionButtons(game, 1);
    const player1 = await interaction.client.users.fetch(game.player1Id);

    await channel.send({
        content: game.currentPlayer === 1 ? `${player1} - Your turn!` : `${player1}`,
        embeds: [p1View],
        components: p1Buttons
    });

    // Player 2 view
    const p2View = renderGameState(game, 2);
    const p2Buttons = createActionButtons(game, 2);
    const player2 = await interaction.client.users.fetch(game.player2Id);

    await channel.send({
        content: game.currentPlayer === 2 ? `${player2} - Your turn!` : `${player2}`,
        embeds: [p2View],
        components: p2Buttons
    });
}
