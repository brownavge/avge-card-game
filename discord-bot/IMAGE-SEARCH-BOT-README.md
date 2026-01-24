# Image Search Bot

A Discord bot that searches a server for all images with at least a specified number of reactions.

## Features

- Search entire Discord server for images with reactions
- Configurable minimum reaction threshold (default: 5 reactions)
- Scans message attachments and embeds
- Results sorted by reaction count (most reactions first)
- Shows message links, reaction counts, and image previews
- Displays top result in a detailed embed

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "Image Search Bot")
3. Go to the "Bot" section and click "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - **Message Content Intent**
   - **Server Members Intent** (optional)
5. Click "Reset Token" and copy your bot token

### 2. Configure Environment Variables

Add this line to your `.env` file:

```
IMAGE_SEARCH_BOT_TOKEN=your_bot_token_here
```

### 3. Invite Bot to Server

1. In Discord Developer Portal, go to "OAuth2" > "URL Generator"
2. Select scopes:
   - `bot`
3. Select permissions:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   - Add Reactions
4. Copy the generated URL and open it in browser
5. Select your server and authorize

### 4. Run the Bot

```bash
node image-search-bot.js
```

## Usage

### Commands

**`!searchimages [min_reactions]`**
- Search the entire server for images with the specified minimum reactions
- Default: 5 reactions
- Examples:
  - `!searchimages` - Find images with 5+ reactions
  - `!searchimages 10` - Find images with 10+ reactions
  - `!searchimages 20` - Find images with 20+ reactions

**`!help-imagesearch`**
- Display help information

### Example Output

```
Found 15 images with 5+ reactions

1. [Message Link] - 45 reactions in #general
   🖼️ https://cdn.discordapp.com/attachments/...
   💬 "Check out this awesome art!"

2. [Message Link] - 32 reactions in #memes
   🖼️ https://cdn.discordapp.com/attachments/...
   💬 "This is hilarious 😂"

...
```

The bot also shows the most reacted image in a detailed embed with:
- Image preview
- Total reaction count
- Channel where it was posted
- Author information
- Timestamp

## Configuration

You can modify these settings in the code:

- `minReactions`: Minimum reactions required (default: 5, can be set via command)
- `maxMessagesPerChannel`: Number of messages to scan per channel (default: 100)
- `resultLimit`: Number of results to display (default: 20)

## Limitations

- Searches the last 100 messages per channel by default (adjustable)
- Large servers may take time to scan
- Bot needs "Read Message History" permission for all channels
- Discord API rate limits may apply for very large servers

## Notes

- The bot only searches text channels (not voice or announcement channels)
- Reaction count includes all reactions combined (not unique users)
- Results are sorted by total reactions (highest first)
- Bot ignores its own messages

## Troubleshooting

**Bot not responding:**
- Check if `IMAGE_SEARCH_BOT_TOKEN` is set in `.env`
- Verify bot has proper permissions in the server
- Check console for error messages

**Missing images:**
- Ensure bot has "Read Message History" permission
- Bot can only scan recent messages (default: 100 per channel)
- Increase `maxMessagesPerChannel` for deeper searches

**Rate limit errors:**
- Bot automatically handles basic rate limiting
- Very large servers may need slower scanning
- Consider searching specific channels instead of entire server
