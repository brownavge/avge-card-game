// Forfeit Command - Forfeit the current game
import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/constants.js';
import { getActiveGames, loadGame, deleteGame } from '../../storage/GameManager.js';

export async function handleForfeitCommand(interaction) {
    const user = interaction.user;

    // Find user's active game
    const activeGames = await getActiveGames(user.id);

    if (activeGames.length === 0) {
        return interaction.reply({
            content: '❌ You are not in an active game!',
            ephemeral: true
        });
    }

    const gameInfo = activeGames[0];
    const game = await loadGame(gameInfo.gameId);

    if (!game) {
        return interaction.reply({
            content: '❌ Could not find your game!',
            ephemeral: true
        });
    }

    // Determine winner (the opponent)
    const forfeitingPlayer = game.player1Id === user.id ? 1 : 2;
    const winner = forfeitingPlayer === 1 ? 2 : 1;
    const winnerId = winner === 1 ? game.player1Id : game.player2Id;

    // Delete the game
    await deleteGame(game.gameId);

    // Create forfeit embed
    const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🏳️ Game Forfeited')
        .setDescription(`${interaction.user} has forfeited the game!`)
        .addFields(
            { name: 'Winner', value: `<@${winnerId}> (by forfeit)`, inline: true },
            { name: 'Turn', value: `${game.turn}`, inline: true }
        )
        .setTimestamp();

    await interaction.reply({
        content: `<@${winnerId}>`,
        embeds: [embed]
    });
}
