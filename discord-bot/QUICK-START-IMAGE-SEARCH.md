# Quick Start - Image Search Bot

## 1. Create Your Bot

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it (e.g., "Image Search Bot")
4. Go to "Bot" tab → "Add Bot"
5. Enable these intents under "Privileged Gateway Intents":
   - ✅ Message Content Intent
6. Copy your bot token

## 2. Add Token to .env

Edit your `.env` file and add:

```
IMAGE_SEARCH_BOT_TOKEN=paste_your_token_here
```

## 3. Invite Bot to Your Server

1. In Developer Portal, go to "OAuth2" → "URL Generator"
2. Select:
   - Scopes: `bot`
   - Permissions:
     - Read Messages/View Channels
     - Send Messages
     - Read Message History
3. Copy the URL and open in browser
4. Select your server and authorize

## 4. Run the Bot

```bash
npm run image-search
```

Or with auto-reload during development:

```bash
npm run image-search-dev
```

## 5. Use It!

In any channel where the bot has access, type:

```
!searchimages
```

This will search for all images with 5+ reactions.

Want to search for images with more reactions?

```
!searchimages 10
```

Need help?

```
!help-imagesearch
```

## That's It!

The bot will scan your server and show you all the popular images ranked by reaction count.

---

**Note:** This is a completely separate bot from the card game bot. They can run at the same time without interfering with each other.
