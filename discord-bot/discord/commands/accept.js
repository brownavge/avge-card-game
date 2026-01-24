// Accept Command - Accept a challenge and start the game
import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/constants.js';
import { createGame, isUserInGame } from '../../storage/GameManager.js';
import { buildDeck } from '../../storage/DeckManager.js';
import { getPendingChallenge, removePendingChallenge } from './challenge.js';
import { renderGameState } from '../components/GameView.js';
import { createActionButtons } from '../components/ActionButtons.js';

export async function handleAcceptCommand(interaction) {
    const accepter = interaction.user;
    const challenger = interaction.options.getUser('challenger');
    const deckName = interaction.options.getString('deck') || 'piano-control';

    // Defer the interaction IMMEDIATELY - must happen within 3 seconds
    try {
        await interaction.deferReply();
    } catch (error) {
        console.error('Error deferring reply:', error);
        return;
    }

    try {
        // Check if there's a pending challenge
        const challenge = getPendingChallenge(challenger.id, accepter.id);

        if (!challenge) {
            return await interaction.editReply({
                content: `❌ No pending challenge from ${challenger.username}. They must use \`/challenge @${accepter.username}\` first.`
            });
        }

        // Check if accepter is already in a game
        const accepterInGame = await isUserInGame(accepter.id);
        if (accepterInGame) {
            return await interaction.editReply({
                content: '❌ You are already in an active game! Use `/forfeit` to end it first.'
            });
        }

        // Check if challenger is still available
        const challengerInGame = await isUserInGame(challenger.id);
        if (challengerInGame) {
            removePendingChallenge(challenger.id, accepter.id);
            return await interaction.editReply({
                content: `❌ ${challenger.username} is now in another game. Challenge cancelled.`
            });
        }

        // Build decks
        const deck1 = buildDeck(challenge.challengerDeck);
        const deck2 = buildDeck(deckName);

        // Create game
        const game = await createGame(challenger.id, accepter.id, deck1, deck2);

        // Remove pending challenge
        removePendingChallenge(challenger.id, accepter.id);

        // Send initial game message to channel
        try {
            const embed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle('🎮 Game Started!')
                .setDescription(`${challenger} vs ${accepter}`)
                .addFields(
                    { name: 'Player 1', value: `${challenger} - ${getDeckDisplayName(challenge.challengerDeck)}`, inline: true },
                    { name: 'Player 2', value: `${accepter} - ${getDeckDisplayName(deckName)}`, inline: true },
                    { name: 'Status', value: `Turn 1 - Player 1's turn`, inline: false }
                )
                .setFooter({ text: `Game ID: ${game.gameId}` })
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed] });

            // Send game state to player 1
            const p1View = renderGameState(game, 1);
            const p1Buttons = createActionButtons(game, 1);
            await interaction.channel.send({
                content: `${challenger} - Your turn!`,
                embeds: [p1View],
                components: p1Buttons
            });

            // Send game state to player 2
            const p2View = renderGameState(game, 2);
            const p2Buttons = createActionButtons(game, 2);
            await interaction.channel.send({
                content: `${accepter} - Waiting for opponent...`,
                embeds: [p2View],
                components: p2Buttons
            });

            // Reply to original interaction
            await interaction.editReply({
                content: `✅ Game started! Check the channel above for game details.`,
            });
        } catch (channelError) {
            if (channelError.code === 50001) {
                await interaction.editReply({
                    content: `❌ Bot is missing permissions in this channel. Please make sure the bot has "Send Messages", "Embed Links", and "Use Application Commands" permissions.`
                });
            } else {
                throw channelError;
            }
        }

    } catch (error) {
        console.error('Error starting game:', error);
        try {
            await interaction.editReply({
                content: `❌ Error starting game: ${error.message}`
            });
        } catch (editError) {
            console.error('Could not edit reply:', editError);
        }
    }
}

function getDeckDisplayName(deckId) {
    const names = {
        'strings-aggro': 'String Section',
        'guitar-rock': 'Electric Ensemble',
        'piano-control': 'Piano Trio',
        'percussion-midrange': 'Rhythm Section',
        'choir-support': 'A Cappella',
        'brass-tempo': 'Brass Band',
        'toolbox': 'Mixed Ensemble'
    };
    return names[deckId] || deckId;
}
