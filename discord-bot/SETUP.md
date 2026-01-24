# Musician Card Game Discord Bot - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd discord-bot
npm install
```

### 2. Set Up Discord Bot

#### Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "Musician Card Game")
4. Click "Create"

#### Get Your Bot Token

1. Go to the "Bot" tab
2. Click "Add Bot"
3. Under "TOKEN", click "Reset Token" and copy it
4. **Save this token securely - you'll need it for .env**

#### Enable Intents

Still in the "Bot" tab, scroll down to "Privileged Gateway Intents":
- Enable ✅ **MESSAGE CONTENT INTENT**
- Enable ✅ **SERVER MEMBERS INTENT**

#### Get Your Application ID

1. Go to the "General Information" tab
2. Copy your "APPLICATION ID" (this is your CLIENT_ID)

### 3. Configure Environment Variables

Create a `.env` file in the `discord-bot` directory:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Your bot token from the Bot tab
DISCORD_TOKEN=your_bot_token_here

# Your application ID from General Information
CLIENT_ID=your_client_id_here

# Your test server ID (optional, but recommended for faster testing)
GUILD_ID=your_guild_id_here
```

**How to get your Guild ID:**
1. Enable Developer Mode in Discord: Settings → Advanced → Developer Mode
2. Right-click your server → Copy Server ID

### 4. Invite Bot to Your Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Create Public Threads
   - ✅ Use Slash Commands
4. Copy the generated URL at the bottom
5. Open the URL in your browser
6. Select your server and authorize

### 5. Run the Bot

Development mode (auto-restart on changes):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

You should see:
```
✅ Bot logged in as YourBotName#1234
🎮 Musician Card Game Bot is ready!
🔄 Refreshing application (/) commands...
✅ Successfully registered guild commands in guild 123456789
```

## Usage

### Starting a Game

1. Challenge someone:
```
/challenge @opponent deck:strings-aggro
```

2. They accept:
```
/accept @challenger deck:piano-control
```

3. The bot creates a thread for your game!

### Playing the Game

The bot will show:
- 🎮 Your game board with buttons
- 🎴 Your hand of cards
- ⚔️ Action buttons (Play Card, Attack, End Turn, etc.)

**Basic Turn Flow:**
1. Play a character to your active or bench (if you have one in hand)
2. Play energy once per turn (attach to any character)
3. Click "Begin Attack" to enter attack phase
4. Choose a move and target
5. Click "End Turn" when done

### Available Commands

- `/challenge @user [deck]` - Challenge another user
- `/accept @user [deck]` - Accept a challenge
- `/forfeit` - Give up and end the game
- `/deck list` - See all available decks
- `/deck view [deck_name]` - See what's in a deck

### Available Decks

- `strings-aggro` - String Section (Emily, Sophia, Ash, Fiona)
- `guitar-rock` - Electric Ensemble (Roberto, Grace, Ryan, Ash)
- `piano-control` - Piano Trio (Katie, David, Jennie, Henry)
- `percussion-midrange` - Rhythm Section (Bokai, Pascal, Cavin, Loang)
- `choir-support` - A Cappella (Rachel, Ross, Evelyn, Izzy)
- `brass-tempo` - Brass Band (Kei, Ryan, Marcus, Lily)
- `toolbox` - Mixed Ensemble (Katie, Grace, Bokai, Ross)

## Troubleshooting

### Bot doesn't respond to commands

**Check:**
- Is the bot online (green status)?
- Does it have permissions in the channel?
- Did you enable MESSAGE CONTENT INTENT in Developer Portal?
- Is DISCORD_TOKEN correct in .env?

**Fix:**
```bash
# Stop the bot (Ctrl+C)
# Restart it
npm start
```

### Commands don't show up

**If using GUILD_ID (recommended for testing):**
- Commands appear instantly in that server

**If not using GUILD_ID (global commands):**
- Can take up to 1 hour to propagate
- Add GUILD_ID to .env for instant updates during development

### Game state lost after bot restart

- Games are saved to `storage/games/` as JSON files
- They should persist between restarts
- Check that the directory exists and has write permissions

### Errors when playing cards

The bot currently has simplified implementations for:
- ✅ Playing character cards to active/bench
- ✅ Playing stadium cards
- ✅ Attacking with basic damage calculation
- ✅ End turn and switching players
- ⚠️ Energy attachment (needs character selector)
- ⚠️ Item/Tool/Supporter cards (need full effect implementations)
- ⚠️ Retreat (needs energy selection)

These features are marked "coming soon" in the bot and can be implemented as needed.

## Project Structure

```
discord-bot/
├── bot.js                  # Main entry point
├── game/                   # Core game logic
│   ├── cards.js           # Card database
│   ├── GameState.js       # Game state management
│   ├── DamageCalculator.js # Damage calculation
│   └── GameValidator.js   # Action validation
├── discord/               # Discord-specific code
│   ├── commands/          # Slash commands
│   ├── components/        # UI components (embeds, buttons)
│   └── handlers/          # Interaction handlers
├── storage/               # Persistence
│   ├── GameManager.js     # Save/load games
│   ├── DeckManager.js     # Deck templates
│   ├── games/             # Active game files
│   └── decks/             # Custom deck files
└── utils/                 # Helpers
    ├── constants.js       # Discord constants
    └── cardHelpers.js     # Card utilities
```

## Next Steps

### To fully implement the game:

1. **Energy Attachment** - Add character selector when playing energy
2. **Item Effects** - Implement all 40+ item effects
3. **Supporter Effects** - Implement all 9 supporter effects
4. **Tool Attachment** - Add character selector for tools
5. **Retreat Mechanic** - Add energy selection for retreat cost
6. **Move Effects** - Implement special move effects (healing, bench damage, etc.)
7. **Activated Abilities** - Implement character abilities like Rachel's Program Production
8. **Deck Builder** - Add custom deck creation interface
9. **Spectator Mode** - Allow users to watch ongoing games

### Testing Your Changes

1. Make changes to code
2. Save files
3. If using `npm run dev`, bot auto-restarts
4. Test in Discord with `/challenge`

## Support

If you encounter issues:
1. Check the console logs for errors
2. Verify your .env file is correct
3. Make sure the bot has all required permissions
4. Try restarting the bot

## Development Tips

- Use `GUILD_ID` in .env for instant command updates during testing
- Check `storage/games/` to see saved game files
- Game logs are stored in each game's state
- Use `console.log()` in handlers to debug interactions
