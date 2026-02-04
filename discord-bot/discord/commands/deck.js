// Deck Command - View and manage decks
import { EmbedBuilder } from 'discord.js';
import { COLORS, PREBUILT_DECKS } from '../../utils/constants.js';
import { getPrebuiltDecks, buildDeck } from '../../storage/DeckManager.js';

export async function handleDeckCommand(interaction) {
    const action = interaction.options.getString('action');
    const deckName = interaction.options.getString('deck_name');

    if (action === 'list') {
        await handleListDecks(interaction);
    } else if (action === 'view') {
        await handleViewDeck(interaction, deckName);
    }
}

async function handleListDecks(interaction) {
    const prebuiltDecks = getPrebuiltDecks();

    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('📚 Available Decks')
        .setDescription('Choose from these prebuilt decks when challenging or accepting:')
        .setFooter({ text: 'Use /deck view <deck_name> to see deck contents' });

    prebuiltDecks.forEach(deck => {
        embed.addFields({
            name: deck.name,
            value: `ID: \`${deck.id}\``,
            inline: true
        });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleViewDeck(interaction, deckName) {
    if (!deckName) {
        return interaction.reply({
            content: '❌ Please specify a deck name to view!',
            ephemeral: true
        });
    }

    try {
        const cards = buildDeck(deckName);

        // Count cards by type
        const counts = {
            character: 0,
            energy: 0,
            item: 0,
            tool: 0,
            supporter: 0,
            stadium: 0
        };

        const cardsByType = {
            character: [],
            energy: [],
            item: [],
            tool: [],
            supporter: [],
            stadium: []
        };

        cards.forEach(card => {
            counts[card.cardType]++;
            cardsByType[card.cardType].push(card);
        });

        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle(`📋 Deck: ${getDeckDisplayName(deckName)}`)
            .setDescription(`Total: ${cards.length} cards`)
            .addFields(
                { name: '🎭 Characters', value: formatCardList(cardsByType.character), inline: false },
                { name: '⚡ Energy', value: `${counts.energy} cards`, inline: true },
                { name: '🎁 Items', value: formatCardList(cardsByType.item), inline: false },
                { name: '🔧 Tools', value: formatCardList(cardsByType.tool), inline: false },
                { name: '👤 Supporters', value: formatCardList(cardsByType.supporter), inline: false },
                { name: '🎪 Stadiums', value: formatCardList(cardsByType.stadium), inline: false }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        await interaction.reply({
            content: `❌ Unknown deck: ${deckName}`,
            ephemeral: true
        });
    }
}

function getDeckDisplayName(deckId) {
    return PREBUILT_DECKS[deckId] || deckId;
}

function formatCardList(cards) {
    if (cards.length === 0) return 'None';

    const cardCounts = {};
    cards.forEach(card => {
        cardCounts[card.name] = (cardCounts[card.name] || 0) + 1;
    });

    return Object.entries(cardCounts)
        .map(([name, count]) => `• ${name}${count > 1 ? ` x${count}` : ''}`)
        .join('\n') || 'None';
}
