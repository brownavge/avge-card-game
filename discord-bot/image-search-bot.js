// Image Search Bot - Finds images with 5+ reactions
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Helper function to check if a message has images
function hasImages(message) {
    // Check attachments for images
    const imageAttachments = message.attachments.filter(attachment => {
        return attachment.contentType && attachment.contentType.startsWith('image/');
    });

    // Check embeds for images
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

    // Get attachment images
    message.attachments.forEach(attachment => {
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
            urls.push(attachment.url);
        }
    });

    // Get embed images
    message.embeds.forEach(embed => {
        if (embed.image) urls.push(embed.image.url);
        if (embed.thumbnail) urls.push(embed.thumbnail.url);
    });

    return urls;
}

// Search function
async function searchImagesWithReactions(channel, minReactions = 5, limit = 100) {
    const results = [];
    let lastMessageId;
    let totalMessagesScanned = 0;

    console.log(`🔍 Searching ${channel.name} for images with ${minReactions}+ reactions...`);

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

        // Stop if we've scanned enough
        if (totalMessagesScanned >= limit) break;
    }

    console.log(`✅ Found ${results.length} images with ${minReactions}+ reactions (scanned ${totalMessagesScanned} messages)`);
    return results;
}

// Search entire server
async function searchServer(guild, minReactions = 5, maxMessagesPerChannel = 100) {
    console.log(`🔍 Starting server-wide search in: ${guild.name}`);
    const allResults = [];

    // Get all text channels
    const textChannels = guild.channels.cache.filter(
        channel => channel.isTextBased() && !channel.isThread()
    );

    console.log(`📊 Found ${textChannels.size} text channels to search`);

    for (const [channelId, channel] of textChannels) {
        try {
            const results = await searchImagesWithReactions(channel, minReactions, maxMessagesPerChannel);
            allResults.push(...results);
        } catch (error) {
            console.error(`❌ Error searching channel ${channel.name}:`, error.message);
        }
    }

    // Sort by reaction count (highest first)
    allResults.sort((a, b) => b.totalReactions - a.totalReactions);

    return allResults;
}

// Format results for display
function formatResults(results, limit = 10) {
    if (results.length === 0) {
        return 'No images found with the specified reaction count.';
    }

    let output = `**Found ${results.length} images with 5+ reactions**\n\n`;

    const displayResults = results.slice(0, limit);

    displayResults.forEach((result, index) => {
        const { message, totalReactions, imageUrls, channel } = result;
        output += `**${index + 1}.** [Message Link](${message.url}) - **${totalReactions} reactions** in #${channel}\n`;

        // Show first image URL
        if (imageUrls.length > 0) {
            output += `   🖼️ ${imageUrls[0]}\n`;
        }

        // Show snippet of message content
        if (message.content) {
            const snippet = message.content.slice(0, 100);
            output += `   💬 "${snippet}${message.content.length > 100 ? '...' : ''}"\n`;
        }

        output += '\n';
    });

    if (results.length > limit) {
        output += `\n...and ${results.length - limit} more results.`;
    }

    return output;
}

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Image Search Bot logged in as ${client.user.tag}`);
    console.log(`🔍 Ready to search for popular images!`);
});

// Handle messages (simple command interface)
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check for search command
    if (message.content.startsWith('!searchimages')) {
        const args = message.content.split(' ');
        const minReactions = parseInt(args[1]) || 5;

        await message.reply(`🔍 Searching server for images with ${minReactions}+ reactions... This may take a while!`);

        try {
            const results = await searchServer(message.guild, minReactions, 100);

            // Send results in chunks to avoid Discord message limits
            const formattedOutput = formatResults(results, 20);

            if (formattedOutput.length > 2000) {
                // Split into multiple messages
                const chunks = formattedOutput.match(/[\s\S]{1,2000}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(formattedOutput);
            }

            // Create detailed embed for top result
            if (results.length > 0) {
                const topResult = results[0];
                const embed = new EmbedBuilder()
                    .setTitle('🏆 Most Reacted Image')
                    .setDescription(`${topResult.totalReactions} reactions in #${topResult.channel}`)
                    .setURL(topResult.message.url)
                    .setColor(0x00FF00)
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

                await message.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error during search:', error);
            await message.reply(`❌ Error: ${error.message}`);
        }
    }

    // Help command
    else if (message.content === '!help-imagesearch') {
        const helpText = `
**Image Search Bot Commands**

\`!searchimages [min_reactions]\` - Search server for images with reactions
  - Default minimum reactions: 5
  - Example: \`!searchimages 10\` - Find images with 10+ reactions

\`!help-imagesearch\` - Show this help message

**Note:** Searches the last 100 messages per channel by default.
`;
        await message.reply(helpText);
    }
});

// Handle errors
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
if (!process.env.IMAGE_SEARCH_BOT_TOKEN) {
    console.error('❌ IMAGE_SEARCH_BOT_TOKEN not found in .env file');
    console.log('💡 Add IMAGE_SEARCH_BOT_TOKEN=your_token_here to your .env file');
    process.exit(1);
}

client.login(process.env.IMAGE_SEARCH_BOT_TOKEN);
