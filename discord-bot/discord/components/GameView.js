// Game View Component - Renders game state as Discord embeds
import { EmbedBuilder } from 'discord.js';
import { EMOJI, COLORS, createHPBar, formatEnergyCost } from '../../utils/constants.js';

/**
 * Render the complete game state for a player
 * @param {GameState} gameState - The current game state
 * @param {number} perspective - 1 or 2 (which player's perspective)
 * @param {boolean} isSpectator - If true, show both hands
 */
export function renderGameState(gameState, perspective, isSpectator = false) {
    const embed = new EmbedBuilder();

    // Set color based on whose turn it is
    if (gameState.phase === 'gameover') {
        embed.setColor(COLORS.GAME_OVER);
    } else if (gameState.currentPlayer === perspective) {
        embed.setColor(COLORS.YOUR_TURN);
    } else {
        embed.setColor(COLORS.OPPONENT_TURN);
    }

    // Title
    const turnIndicator = gameState.currentPlayer === perspective ? '🟢 YOUR TURN' : '🔵 OPPONENT\'S TURN';
    embed.setTitle(`${EMOJI.CHARACTER} Musician Card Game - Turn ${gameState.turn}`);
    embed.setDescription(`**${turnIndicator}** | Phase: ${gameState.phase.toUpperCase()}`);

    // Opponent's board (top)
    const opponentNum = perspective === 1 ? 2 : 1;
    const opponent = gameState.players[opponentNum];

    embed.addFields({
        name: `${EMOJI.DECK} Opponent's Board`,
        value: renderOpponentBoard(opponent),
        inline: false
    });

    // Stadium (if active)
    if (gameState.stadium) {
        embed.addFields({
            name: `${EMOJI.STADIUM} Stadium: ${gameState.stadium.name}`,
            value: gameState.stadium.effect || 'Active',
            inline: false
        });
    }

    // Your board (bottom)
    const player = gameState.players[perspective];

    embed.addFields({
        name: `${EMOJI.ACTIVE} Your Active Character`,
        value: renderActiveCharacter(player.active),
        inline: false
    });

    embed.addFields({
        name: `${EMOJI.BENCH} Your Bench`,
        value: renderBench(player.bench),
        inline: false
    });

    embed.addFields({
        name: `${EMOJI.INFO} Game Info`,
        value: renderGameInfo(player, opponent),
        inline: false
    });

    // Your hand (only if not spectator or show for player)
    if (!isSpectator) {
        embed.addFields({
            name: `${EMOJI.HAND} Your Hand (${player.hand.length} cards)`,
            value: renderHand(player.hand),
            inline: false
        });
    }

    // Recent log entries
    const recentLog = gameState.gameLog.slice(-3);
    if (recentLog.length > 0) {
        embed.addFields({
            name: `📋 Recent Actions`,
            value: recentLog.map(entry => `• ${entry.message}`).join('\n') || 'No recent actions',
            inline: false
        });
    }

    // Footer
    embed.setFooter({ text: `Game ID: ${gameState.gameId.split('_')[2]}` });
    embed.setTimestamp();

    return embed;
}

/**
 * Render opponent's board (limited info)
 */
function renderOpponentBoard(opponent) {
    let text = '';

    // Active character
    if (opponent.active) {
        const char = opponent.active;
        const currentHP = char.hp - (char.damage || 0);
        const hpBar = createHPBar(currentHP, char.hp, 10);

        text += `**Active:** ${char.name}\n`;
        text += `${EMOJI.HP} ${hpBar} ${currentHP}/${char.hp} HP\n`;
        text += `${EMOJI.ENERGY} ${char.energy?.length || 0} energy attached\n`;

        if (char.status && char.status.length > 0) {
            text += `Status: ${char.status.join(', ')}\n`;
        }
    } else {
        text += '**Active:** (Empty)\n';
    }

    // Bench
    const benchCount = opponent.bench.filter(c => c).length;
    text += `\n**Bench:** ${benchCount}/3 characters\n`;

    opponent.bench.forEach((char, idx) => {
        if (char) {
            const currentHP = char.hp - (char.damage || 0);
            text += `${idx + 1}. ${char.name} (${currentHP}/${char.hp} HP)\n`;
        }
    });

    // Stats
    text += `\n${EMOJI.KO} KO Count: ${opponent.koCount}/3`;
    text += ` | ${EMOJI.DECK} Deck: ${opponent.deck.length}`;
    text += ` | ${EMOJI.HAND} Hand: ${opponent.hand.length}`;
    text += ` | ${EMOJI.DISCARD} Discard: ${opponent.discard.length}`;

    return text || 'No characters in play';
}

/**
 * Render your active character (detailed)
 */
function renderActiveCharacter(active) {
    if (!active) {
        return '(No active character - play one from your hand!)';
    }

    const currentHP = active.hp - (active.damage || 0);
    const hpBar = createHPBar(currentHP, active.hp, 15);

    let text = `**${active.name}** (${active.type.join('/')})\n`;
    text += `${EMOJI.HP} ${hpBar} **${currentHP}/${active.hp}** HP\n`;
    text += `${EMOJI.DAMAGE} Damage: ${active.damage || 0}\n\n`;

    // Energy
    if (active.energy && active.energy.length > 0) {
        text += `**Energy Attached (${active.energy.length}):**\n`;
        const energyCounts = {};
        active.energy.forEach(e => {
            const type = e.energyType || 'Colorless';
            energyCounts[type] = (energyCounts[type] || 0) + 1;
        });
        Object.entries(energyCounts).forEach(([type, count]) => {
            text += `• ${type}: ${count}\n`;
        });
    } else {
        text += `**Energy:** None\n`;
    }

    // Moves
    text += `\n**Moves:**\n`;
    active.moves.forEach((move, idx) => {
        const cost = formatEnergyCost(move.cost);
        text += `${idx + 1}. **${move.name}** (${cost}) - ${move.damage || 0} damage\n`;
        if (move.effect) {
            text += `   _${move.effect}_\n`;
        }
    });

    // Tools
    if (active.tools && active.tools.length > 0) {
        text += `\n**Tools:** ${active.tools.map(t => t.name).join(', ')}`;
    }

    // Status
    if (active.status && active.status.length > 0) {
        text += `\n**Status:** ${active.status.join(', ')}`;
    }

    // Retreat cost
    const retreatCost = active.retreatCost || 0;
    text += `\n**Retreat Cost:** ${retreatCost} energy`;

    return text;
}

/**
 * Render bench (detailed)
 */
function renderBench(bench) {
    let text = '';

    bench.forEach((char, idx) => {
        if (char) {
            const currentHP = char.hp - (char.damage || 0);
            const hpBar = createHPBar(currentHP, char.hp, 8);

            text += `**${idx + 1}. ${char.name}**\n`;
            text += `${hpBar} ${currentHP}/${char.hp} HP | ${EMOJI.ENERGY} ${char.energy?.length || 0} energy\n`;

            if (char.status && char.status.length > 0) {
                text += `Status: ${char.status.join(', ')}\n`;
            }
        } else {
            text += `**${idx + 1}.** (Empty)\n`;
        }
    });

    return text || 'Bench is empty';
}

/**
 * Render game info
 */
function renderGameInfo(player, opponent) {
    let text = '';

    text += `**Your Stats:**\n`;
    text += `${EMOJI.KO} KO Count: ${player.koCount}/3\n`;
    text += `${EMOJI.DECK} Deck: ${player.deck.length} cards\n`;
    text += `${EMOJI.DISCARD} Discard: ${player.discard.length} cards\n\n`;

    text += `**Turn Status:**\n`;
    text += `Energy played: ${player.energyPlayedThisTurn ? '✅' : '❌'}\n`;
    text += `Supporter played: ${player.supporterPlayedThisTurn ? '✅' : '❌'}\n`;
    text += `Attacked: ${player.attackedThisTurn ? '✅' : '❌'}`;

    return text;
}

/**
 * Render hand
 */
function renderHand(hand) {
    if (hand.length === 0) {
        return 'No cards in hand';
    }

    const cardGroups = {
        character: [],
        energy: [],
        item: [],
        tool: [],
        supporter: [],
        stadium: []
    };

    hand.forEach(card => {
        cardGroups[card.cardType].push(card);
    });

    let text = '';

    Object.entries(cardGroups).forEach(([type, cards]) => {
        if (cards.length > 0) {
            const emoji = {
                character: EMOJI.CHARACTER,
                energy: EMOJI.ENERGY,
                item: EMOJI.ITEM,
                tool: EMOJI.TOOL,
                supporter: EMOJI.SUPPORTER,
                stadium: EMOJI.STADIUM
            }[type];

            text += `\n${emoji} **${type.toUpperCase()}** (${cards.length}):\n`;
            cards.forEach(card => {
                text += `• ${card.name}`;
                if (card.cardType === 'character') {
                    text += ` (${card.hp} HP)`;
                }
                text += `\n`;
            });
        }
    });

    return text;
}

/**
 * Render a simple game summary (for game list)
 */
export function renderGameSummary(gameState, client) {
    const player1 = client.users.cache.get(gameState.player1Id);
    const player2 = client.users.cache.get(gameState.player2Id);

    const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`Game in Progress`)
        .addFields(
            { name: 'Player 1', value: player1 ? player1.tag : 'Unknown', inline: true },
            { name: 'Player 2', value: player2 ? player2.tag : 'Unknown', inline: true },
            { name: 'Turn', value: `${gameState.turn}`, inline: true },
            { name: 'Phase', value: gameState.phase, inline: true },
            { name: 'Current Player', value: `Player ${gameState.currentPlayer}`, inline: true }
        )
        .setFooter({ text: `Game ID: ${gameState.gameId}` });

    return embed;
}
