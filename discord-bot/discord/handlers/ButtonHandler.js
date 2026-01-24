// Button Handler - Handles all button interactions
import { parseCustomId, ACTIONS } from '../../utils/constants.js';
import { loadGame, saveGame, deleteGame } from '../../storage/GameManager.js';
import { renderGameState } from '../components/GameView.js';
import { createActionButtons, createHandSelector, createMoveSelector } from '../components/ActionButtons.js';
import { canBeginAttackPhase } from '../../game/GameValidator.js';

export async function handleButtonInteraction(interaction) {
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

    // Verify it's the user's turn
    const userPlayerNum = game.player1Id === interaction.user.id ? 1 :
                          game.player2Id === interaction.user.id ? 2 : null;

    if (!userPlayerNum) {
        return interaction.reply({
            content: '❌ You are not in this game!',
            ephemeral: true
        });
    }

    if (game.currentPlayer !== userPlayerNum) {
        return interaction.reply({
            content: '❌ It is not your turn!',
            ephemeral: true
        });
    }

    // Handle different actions
    try {
        switch (action) {
            case ACTIONS.PLAY_CARD:
                await handlePlayCard(interaction, game, userPlayerNum);
                break;

            case ACTIONS.BEGIN_ATTACK:
                await handleBeginAttack(interaction, game, userPlayerNum);
                break;

            case ACTIONS.ATTACK:
                await handleAttack(interaction, game, userPlayerNum);
                break;

            case ACTIONS.RETREAT:
                await handleRetreat(interaction, game, userPlayerNum);
                break;

            case ACTIONS.END_TURN:
                await handleEndTurn(interaction, game, userPlayerNum);
                break;

            case ACTIONS.FORFEIT:
                await handleForfeit(interaction, game, userPlayerNum);
                break;

            default:
                await interaction.reply({
                    content: '❌ Unknown action!',
                    ephemeral: true
                });
        }
    } catch (error) {
        console.error('Error in button handler:', error);
        await interaction.reply({
            content: `❌ Error: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handlePlayCard(interaction, game, playerNum) {
    const player = game.players[playerNum];

    if (player.hand.length === 0) {
        return interaction.reply({
            content: '❌ You have no cards in hand!',
            ephemeral: true
        });
    }

    // Show hand selector
    const handSelector = createHandSelector(player.hand, game.gameId);

    await interaction.reply({
        content: 'Choose a card to play:',
        components: [handSelector],
        ephemeral: true
    });
}

async function handleBeginAttack(interaction, game, playerNum) {
    const validation = canBeginAttackPhase(game, playerNum);

    if (!validation.valid) {
        return interaction.reply({
            content: `❌ ${validation.reason}`,
            ephemeral: true
        });
    }

    // Change to attack phase
    game.phase = 'attack';
    game.log(`▶ Attack Phase begins`);

    await saveGame(game);

    // Update game view
    await updateGameView(interaction, game);

    await interaction.reply({
        content: '⚔️ Attack phase! Choose your attack.',
        ephemeral: true
    });
}

async function handleAttack(interaction, game, playerNum) {
    const player = game.players[playerNum];

    if (!player.active) {
        return interaction.reply({
            content: '❌ No active character!',
            ephemeral: true
        });
    }

    if (game.attackedThisTurn) {
        return interaction.reply({
            content: '❌ Already attacked this turn!',
            ephemeral: true
        });
    }

    // Show move selector
    const moveSelector = createMoveSelector(player.active, game.gameId);

    await interaction.reply({
        content: 'Choose a move:',
        components: [moveSelector],
        ephemeral: true
    });
}

async function handleRetreat(interaction, game, playerNum) {
    // For now, just show a message - full implementation would need character/energy selection
    await interaction.reply({
        content: '🏃 Retreat feature coming soon! (Needs character selector)',
        ephemeral: true
    });
}

async function handleEndTurn(interaction, game, playerNum) {
    // Switch players
    game.switchPlayer();

    await saveGame(game);

    // Update game view
    await updateGameView(interaction, game);

    const nextPlayer = game.currentPlayer === 1 ? game.player1Id : game.player2Id;

    await interaction.reply({
        content: `✅ Turn ended. <@${nextPlayer}>'s turn!`
    });
}

async function handleForfeit(interaction, game, playerNum) {
    const winner = playerNum === 1 ? 2 : 1;
    const winnerId = winner === 1 ? game.player1Id : game.player2Id;

    game.endGame(winner, 'forfeit');
    await deleteGame(game.gameId);

    await interaction.reply({
        content: `🏳️ ${interaction.user} has forfeited! <@${winnerId}> wins!`
    });
}

/**
 * Update game view in the channel
 */
async function updateGameView(interaction, game) {
    // Send updated view to both players
    const channel = interaction.channel;

    // Player 1 view
    const p1View = renderGameState(game, 1);
    const p1Buttons = createActionButtons(game, 1);
    const player1 = await interaction.client.users.fetch(game.player1Id);

    await channel.send({
        content: `${player1}`,
        embeds: [p1View],
        components: p1Buttons
    });

    // Player 2 view
    const p2View = renderGameState(game, 2);
    const p2Buttons = createActionButtons(game, 2);
    const player2 = await interaction.client.users.fetch(game.player2Id);

    await channel.send({
        content: `${player2}`,
        embeds: [p2View],
        components: p2Buttons
    });
}
