# Musician Card Game - Discord Bot

A multiplayer Discord bot implementation of the Musician Card Game, a strategic trading card game featuring musician characters, energy types, and special abilities.

## Features

- **Multiplayer Gameplay**: Challenge other Discord users to card battles
- **Interactive UI**: Discord buttons and select menus for seamless gameplay
- **Deck Building**: Create custom 30-card decks or use pre-built decks
- **Spectator Mode**: Watch ongoing games in real-time
- **Persistent State**: Games persist between sessions using JSON storage

## Setup

### Prerequisites

- Node.js 18 or higher
- A Discord account and server
- Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications))

### Installation

1. Clone the repository:
```bash
cd discord-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from template:
```bash
cp .env.example .env
```

4. Add your Discord bot token to `.env`:
```env
DISCORD_TOKEN=your_actual_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_for_testing
```

### Getting Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" tab and click "Add Bot"
4. Under "TOKEN", click "Copy" to get your bot token
5. Under "Privileged Gateway Intents", enable:
   - MESSAGE CONTENT INTENT
   - SERVER MEMBERS INTENT (optional, for enhanced features)

### Inviting Bot to Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions:
   - Read Messages/View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Add Reactions
   - Create Public Threads
   - Send Messages in Threads
4. Copy the generated URL and open in browser
5. Select your server and authorize

### Running the Bot

Development mode (auto-restart on file changes):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Commands

### Game Commands

- `/challenge @user [deck]` - Challenge another user to a game
- `/accept @user [deck]` - Accept a pending challenge
- `/forfeit` - Forfeit current game

### Deck Management

- `/deck list` - View available decks
- `/deck create [name]` - Create a custom deck
- `/deck view [name]` - View deck contents
- `/deck delete [name]` - Delete a custom deck

### Spectator Commands

- `/spectate list` - List ongoing games
- `/spectate join [gameId]` - Join a game as spectator
- `/spectate leave` - Leave spectator mode

### Utility Commands

- `/help` - View game rules and commands
- `/stats [@user]` - View player statistics (coming soon)
- `/searchimages [min_reactions] [scope]` - Search for popular images with reactions
  - `min_reactions`: Minimum reactions required (default: 5)
  - `scope`: Search "channel" or entire "server" (default: server)

## Game Rules

### Objective
Be the first player to knock out (KO) 3 of your opponent's characters.

### Turn Structure

1. **Main Phase**:
   - Play 1 character to active or bench (3 bench slots max)
   - Attach 1 energy per turn to any character
   - Play items, tools, supporters (1 supporter per turn limit)
   - Play stadiums
   - Use activated abilities
   - Retreat active character (costs energy)

2. **Attack Phase**:
   - Choose a move from your active character
   - Select target (usually opponent's active)
   - Deal damage based on move cost, type resistance, and effects

3. **End Turn**: Pass to opponent

### Key Mechanics

- **Energy Types**: Woodwinds (W), Percussion (P), Piano (K), Strings (S), Guitar (G), Choir (C), Brass (B)
- **Type Resistance**: Circular chain - if attacker's type matches defender's resistance, damage is halved
- **Status Conditions**: Maid (immune to small attacks), Goon (-20 dmg, reflect), Conductor (+30 HP)
- **Stadiums**: Shared field effects affecting both players
- **Win Conditions**: 3 KOs, opponent has no characters, opponent deck-out

## Development

### Project Structure

```
discord-bot/
├── game/              # Core game logic (ported from browser version)
├── discord/           # Discord-specific code
│   ├── commands/      # Slash command handlers
│   ├── components/    # UI components (embeds, buttons, selects)
│   └── handlers/      # Interaction handlers
├── storage/           # Persistence layer
│   ├── games/         # Active game states (JSON)
│   └── decks/         # Custom deck files (JSON)
└── utils/             # Helper functions and constants
```

### Adding New Cards

1. Edit `game/cards.js`
2. Add to appropriate constant (CHARACTERS, ITEMS, etc.)
3. If card has unique effect, add handler in appropriate module

### Testing

Run a test game:
```bash
# In Discord:
/challenge @friend piano-control
# Friend accepts:
/accept @you strings-aggro
# Play through a game to test mechanics
```

## Troubleshooting

**Bot doesn't respond to commands:**
- Check bot token in `.env` is correct
- Verify bot has proper permissions in server
- Check bot is online (green status)
- Ensure MESSAGE CONTENT INTENT is enabled

**Commands don't show up:**
- Wait a few minutes for Discord to sync (global commands take up to 1 hour)
- Use GUILD_ID for instant updates during development
- Check CLIENT_ID in .env matches your application

**Game state lost:**
- Check `storage/games/` directory exists
- Verify write permissions
- Check for JSON syntax errors in game files

## License

MIT

## Credits

Original browser-based game design and mechanics by Ryan Lee.
Discord bot implementation using discord.js v14.
