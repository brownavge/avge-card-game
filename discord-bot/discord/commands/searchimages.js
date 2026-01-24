// Search Images Command Handler
import { EmbedBuilder } from 'discord.js';

// Helper function to check if a message has images
function hasImages(message) {
    const imageAttachments = message.attachments.filter(attachment => {
        return attachment.contentType && attachment.contentType.startsWith('image/');
    });

    const imageEmbeds = message.embeds.filter(embed => {
        return embed.image || embed.thumbnail;
    });

    return imageAttachments.size > 0 || imageEmbeds.length > 0;
}

// Helper function to get total reaction count
function getTotalReactions(message) {
    let total = 0;
    message.reactions.cache.forEach(reaction => {
        total += reaction.count;
    });
    return total;
}

// Helper function to extract image URLs from a message
function getImageUrls(message) {
    const urls = [];

    message.attachments.forEach(attachment => {
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
            urls.push(attachment.url);
        }
    });

    message.embeds.forEach(embed => {
        if (embed.image) urls.push(embed.image.url);
        if (embed.thumbnail) urls.push(embed.thumbnail.url);
    });

    return urls;
}

// Search a single channel
async function searchChannel(channel, minReactions, limit) {
    const results = [];
    let lastMessageId;
    let totalMessagesScanned = 0;

    while (totalMessagesScanned < limit) {
        const options = { limit: 100 };
        if (lastMessageId) {
            options.before = lastMessageId;
        }

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        messages.forEach(message => {
            totalMessagesScanned++;

            if (hasImages(message)) {
                const totalReactions = getTotalReactions(message);

                if (totalReactions >= minReactions) {
                    results.push({
                        message,
                        totalReactions,
                        imageUrls: getImageUrls(message),
                        channel: channel.name,
                        channelId: channel.id
                    });
                }
            }
        });

        lastMessageId = messages.last().id;
        if (totalMessagesScanned >= limit) break;
    }

    return results;
}

// Search entire server
async function searchServer(guild, minReactions, maxMessagesPerChannel) {
    const allResults = [];

    const textChannels = guild.channels.cache.filter(
        channel => channel.isTextBased() && !channel.isThread()
    );

    for (const [channelId, channel] of textChannels) {
        try {
            const results = await searchChannel(channel, minReactions, maxMessagesPerChannel);
            allResults.push(...results);
        } catch (error) {
            console.error(`Error searching channel ${channel.name}:`, error.message);
        }
    }

    allResults.sort((a, b) => b.totalReactions - a.totalReactions);
    return allResults;
}

// Format results for display
function formatResults(results, limit = 10) {
    if (results.length === 0) {
        return 'No images found with the specified reaction count.';
    }

    let output = `**Found ${results.length} image${results.length === 1 ? '' : 's'} with reactions**\n\n`;

    const displayResults = results.slice(0, limit);

    displayResults.forEach((result, index) => {
        const { message, totalReactions, imageUrls, channel } = result;
        output += `**${index + 1}.** [Jump to Message](${message.url}) - **${totalReactions} reaction${totalReactions === 1 ? '' : 's'}** in #${channel}\n`;

        if (imageUrls.length > 0) {
            output += `   🖼️ ${imageUrls[0]}\n`;
        }

        if (message.content) {
            const snippet = message.content.slice(0, 100);
            output += `   💬 "${snippet}${message.content.length > 100 ? '...' : ''}"\n`;
        }

        output += '\n';
    });

    if (results.length > limit) {
        output += `\n...and ${results.length - limit} more result${results.length - limit === 1 ? '' : 's'}.`;
    }

    return output;
}

// Handle the searchimages slash command
export async function handleSearchImagesCommand(interaction) {
    const minReactions = interaction.options.getInteger('min_reactions') || 5;
    const scope = interaction.options.getString('scope') || 'server';

    await interaction.deferReply();

    try {
        let results;

        if (scope === 'channel') {
            // Search only current channel
            await interaction.editReply(`🔍 Searching this channel for images with ${minReactions}+ reactions...`);
            results = await searchChannel(interaction.channel, minReactions, 500);
        } else {
            // Search entire server
            await interaction.editReply(`🔍 Searching server for images with ${minReactions}+ reactions... This may take a while!`);
            results = await searchServer(interaction.guild, minReactions, 100);
        }

        // Format and send results
        const formattedOutput = formatResults(results, 20);

        if (formattedOutput.length > 2000) {
            // Split into multiple messages
            const chunks = formattedOutput.match(/[\s\S]{1,2000}/g);
            await interaction.editReply(chunks[0]);
            for (let i = 1; i < chunks.length; i++) {
                await interaction.followUp(chunks[i]);
            }
        } else {
            await interaction.editReply(formattedOutput);
        }

        // Create detailed embed for top result
        if (results.length > 0) {
            const topResult = results[0];
            const embed = new EmbedBuilder()
                .setTitle('🏆 Most Reacted Image')
                .setDescription(`${topResult.totalReactions} reaction${topResult.totalReactions === 1 ? '' : 's'} in #${topResult.channel}`)
                .setURL(topResult.message.url)
                .setColor(0xFFD700)
                .setTimestamp(topResult.message.createdAt);

            if (topResult.imageUrls.length > 0) {
                embed.setImage(topResult.imageUrls[0]);
            }

            if (topResult.message.author) {
                embed.setFooter({
                    text: `Posted by ${topResult.message.author.tag}`,
                    iconURL: topResult.message.author.displayAvatarURL()
                });
            }

            await interaction.followUp({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error during image search:', error);
        await interaction.editReply(`❌ Error: ${error.message}`);
    }
}
