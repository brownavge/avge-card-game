// Challenge Command - Challenge another user to a game
import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/constants.js';
import { isUserInGame } from '../../storage/GameManager.js';

// Store pending challenges (in memory)
// Format: { challengerId_opponentId: { challenger, opponent, deck, timestamp } }
const pendingChallenges = new Map();

// Cleanup old challenges after 5 minutes
setInterval(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    for (const [key, challenge] of pendingChallenges.entries()) {
        if (now - challenge.timestamp > fiveMinutes) {
            pendingChallenges.delete(key);
        }
    }
}, 60 * 1000); // Check every minute

export async function handleChallengeCommand(interaction) {
    const challenger = interaction.user;
    const opponent = interaction.options.getUser('opponent');
    const deckName = interaction.options.getString('deck') || 'strings-aggro';

    try {
        // Validate opponent - quick synchronous checks first
        if (opponent.id === challenger.id) {
            return interaction.reply({
                content: '❌ You cannot challenge yourself!',
                ephemeral: true
            });
        }

        if (opponent.bot) {
            return interaction.reply({
                content: '❌ You cannot challenge a bot!',
                ephemeral: true
            });
        }

        // Check if challenger is already in a game
        const challengerInGame = await isUserInGame(challenger.id);
        if (challengerInGame) {
            return interaction.reply({
                content: '❌ You are already in an active game! Use `/forfeit` to end it first.',
                ephemeral: true
            });
        }

        // Check if opponent is already in a game
        const opponentInGame = await isUserInGame(opponent.id);
        if (opponentInGame) {
            return interaction.reply({
                content: `❌ ${opponent.username} is already in an active game!`,
                ephemeral: true
            });
        }

        // Store the challenge
        const challengeKey = `${challenger.id}_${opponent.id}`;
        pendingChallenges.set(challengeKey, {
            challengerId: challenger.id,
            opponentId: opponent.id,
            challengerDeck: deckName,
            timestamp: Date.now()
        });

        // Create challenge embed
        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('🎮 Card Game Challenge!')
            .setDescription(`${challenger} has challenged ${opponent} to a Musician Card Game!`)
            .addFields(
                { name: 'Challenger Deck', value: getDeckDisplayName(deckName), inline: true },
                { name: 'Status', value: '⏳ Waiting for acceptance...', inline: true }
            )
            .setFooter({ text: 'Challenge expires in 5 minutes' })
            .setTimestamp();

        await interaction.reply({
            content: `${opponent}, you have been challenged! Use \`/accept @${challenger.username}\` to accept.`,
            embeds: [embed]
        });
    } catch (error) {
        console.error('Error handling challenge command:', error);
        try {
            if (interaction.replied) {
                await interaction.followUp({
                    content: `❌ Error creating challenge: ${error.message}`,
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: `❌ Error creating challenge: ${error.message}`
                });
            } else {
                await interaction.reply({
                    content: `❌ Error creating challenge: ${error.message}`,
                    ephemeral: true
                });
            }
        } catch (replyError) {
            console.error('Could not send error reply:', replyError);
        }
    }
}

/**
 * Get a pending challenge
 */
export function getPendingChallenge(challengerId, opponentId) {
    const challengeKey = `${challengerId}_${opponentId}`;
    return pendingChallenges.get(challengeKey);
}

/**
 * Remove a pending challenge
 */
export function removePendingChallenge(challengerId, opponentId) {
    const challengeKey = `${challengerId}_${opponentId}`;
    return pendingChallenges.delete(challengeKey);
}

/**
 * Get display name for deck
 */
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
