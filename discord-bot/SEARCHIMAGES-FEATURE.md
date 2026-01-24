# Search Images Feature

The bot now includes a powerful image search feature that finds all images with reactions across your Discord server!

## Usage

### Basic Search

Find all images with 5+ reactions in the entire server:

```
/searchimages
```

### Custom Reaction Threshold

Find images with 10+ reactions:

```
/searchimages min_reactions:10
```

### Search Current Channel Only

Search only the current channel instead of entire server:

```
/searchimages scope:This channel only
```

### Combined Options

Find images with 20+ reactions in current channel:

```
/searchimages min_reactions:20 scope:This channel only
```

## What Gets Searched

- Image attachments (PNG, JPG, GIF, etc.)
- Images in embeds (from links, bots, etc.)
- All text channels in the server (not voice/announcement channels)

## Results Display

The bot will show:
- Total number of images found
- List of top 20 results sorted by reaction count
- Message links (click to jump to original message)
- Image preview URLs
- Message content snippets
- Special embed for the most reacted image

## Example Output

```
🔍 Searching server for images with 5+ reactions... This may take a while!

**Found 15 images with reactions**

**1.** [Jump to Message] - **45 reactions** in #general
   🖼️ https://cdn.discordapp.com/attachments/...
   💬 "Check out this amazing artwork!"

**2.** [Jump to Message] - **32 reactions** in #memes
   🖼️ https://cdn.discordapp.com/attachments/...
   💬 "This is hilarious 😂"

...and 13 more results.

[Embed showing the most reacted image with full preview]
```

## Performance Notes

- **Channel search**: Scans last 500 messages (fast)
- **Server search**: Scans last 100 messages per channel (may take 10-30 seconds for large servers)
- Bot needs "Read Message History" permission to search
- Results are sorted by total reaction count (highest first)

## Tips

- Use channel scope for faster searches in active channels
- Use server scope to find the most popular images across your entire community
- Higher min_reactions values = faster searches (fewer results to process)
- The bot counts ALL reactions combined (not unique users)

## Permissions Required

Make sure the bot has these permissions:
- ✅ Read Messages/View Channels
- ✅ Read Message History
- ✅ Send Messages
- ✅ Embed Links

If the bot can't access a channel, it will skip it and continue searching others.
