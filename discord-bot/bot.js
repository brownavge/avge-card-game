// Main Discord Bot Entry Point
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import handlers
import { handleButtonInteraction } from './discord/handlers/ButtonHandler.js';
import { handleSelectMenuInteraction } from './discord/handlers/SelectHandler.js';
import { handleChallengeCommand } from './discord/commands/challenge.js';
import { handleAcceptCommand } from './discord/commands/accept.js';
import { handleForfeitCommand } from './discord/commands/forfeit.js';
import { handleDeckCommand } from './discord/commands/deck.js';
import { handleSearchImagesCommand } from './discord/commands/searchimages.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Slash command definitions
const commands = [
    {
        name: 'challenge',
        description: 'Challenge another user to a card game',
        options: [
            {
                name: 'opponent',
                description: 'The user you want to challenge',
                type: 6, // USER type
                required: true
            },
            {
                name: 'deck',
                description: 'Choose your deck',
                type: 3, // STRING type
                required: false,
                choices: [
                    { name: 'String Section (Strings Aggro)', value: 'strings-aggro' },
                    { name: 'Electric Ensemble (Guitar Rock)', value: 'guitar-rock' },
                    { name: 'Piano Trio (Piano Control)', value: 'piano-control' },
                    { name: 'Rhythm Section (Percussion)', value: 'percussion-midrange' },
                    { name: 'A Cappella (Choir Support)', value: 'choir-support' },
                    { name: 'Brass Band (Brass Tempo)', value: 'brass-tempo' },
                    { name: 'Mixed Ensemble (Toolbox)', value: 'toolbox' }
                ]
            }
        ]
    },
    {
        name: 'accept',
        description: 'Accept a challenge from another user',
        options: [
            {
                name: 'challenger',
                description: 'The user who challenged you',
                type: 6, // USER type
                required: true
            },
            {
                name: 'deck',
                description: 'Choose your deck',
                type: 3, // STRING type
                required: false,
                choices: [
                    { name: 'String Section (Strings Aggro)', value: 'strings-aggro' },
                    { name: 'Electric Ensemble (Guitar Rock)', value: 'guitar-rock' },
                    { name: 'Piano Trio (Piano Control)', value: 'piano-control' },
                    { name: 'Rhythm Section (Percussion)', value: 'percussion-midrange' },
                    { name: 'A Cappella (Choir Support)', value: 'choir-support' },
                    { name: 'Brass Band (Brass Tempo)', value: 'brass-tempo' },
                    { name: 'Mixed Ensemble (Toolbox)', value: 'toolbox' }
                ]
            }
        ]
    },
    {
        name: 'forfeit',
        description: 'Forfeit your current game'
    },
    {
        name: 'deck',
        description: 'Manage your custom decks',
        options: [
            {
                name: 'action',
                description: 'What to do with decks',
                type: 3, // STRING type
                required: true,
                choices: [
                    { name: 'List available decks', value: 'list' },
                    { name: 'View deck contents', value: 'view' }
                ]
            },
            {
                name: 'deck_name',
                description: 'Name of the deck (for view action)',
                type: 3, // STRING type
                required: false
            }
        ]
    },
    {
        name: 'searchimages',
        description: 'Search for images with reactions in the server',
        options: [
            {
                name: 'min_reactions',
                description: 'Minimum number of reactions (default: 5)',
                type: 4, // INTEGER type
                required: false
            },
            {
                name: 'scope',
                description: 'Where to search',
                type: 3, // STRING type
                required: false,
                choices: [
                    { name: 'This channel only', value: 'channel' },
                    { name: 'Entire server', value: 'server' }
                ]
            }
        ]
    }
];

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`🎮 Musician Card Game Bot is ready!`);

    // Register slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        console.log('🔄 Refreshing application (/) commands...');

        if (process.env.GUILD_ID) {
            // Guild commands (instant update for testing)
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            console.log(`✅ Successfully registered guild commands in guild ${process.env.GUILD_ID}`);
        } else {
            // Global commands (takes up to 1 hour to propagate)
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('✅ Successfully registered global commands');
        }
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    try {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;

            switch (commandName) {
                case 'challenge':
                    await handleChallengeCommand(interaction);
                    break;

                case 'accept':
                    await handleAcceptCommand(interaction);
                    break;

                case 'forfeit':
                    await handleForfeitCommand(interaction);
                    break;

                case 'deck':
                    await handleDeckCommand(interaction);
                    break;

                case 'searchimages':
                    await handleSearchImagesCommand(interaction);
                    break;

                default:
                    await interaction.reply({ content: 'Unknown command!', ephemeral: true });
            }
        }

        // Handle button interactions
        else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }

        // Handle select menu interactions
        else if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        }

    } catch (error) {
        console.error('Error handling interaction:', error);

        // Try to respond with error message
        try {
            const errorMessage = { content: `❌ Error: ${error.message}`, ephemeral: true };

            // Check if interaction has been replied to or deferred
            if (interaction.replied) {
                // Already replied, use followUp
                await interaction.followUp(errorMessage);
            } else if (interaction.deferred) {
                // Deferred, use editReply
                await interaction.editReply(errorMessage);
            } else {
                // Not yet responded, can use reply
                await interaction.reply(errorMessage);
            }
        } catch (followUpError) {
            console.error('Could not send error message to user:', followUpError);
        }
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
client.login(process.env.DISCORD_TOKEN);

// Export client for use in other modules
export { client };
