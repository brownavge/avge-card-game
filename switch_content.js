
    // Mark that an attack has been used this turn
    game.attackedThisTurn = true;

    // Execute specific attack effects by move name
    switch (move.name) {
        case 'Vibrato':
            // Standard damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Vocal warmups':
            // Attach an energy from your hand to this character
            const energyCards = player.hand.filter(c => c.cardType === 'energy');
            if (energyCards.length > 0) {
                game.log(`${attacker.name} used Vocal warmups - select energy from hand to attach`);
                showHandEnergySelectionModal(player, attacker, energyCards);
            } else {
                game.log('No energy in hand to attach');
            }
            break;

        case 'SATB':
            // For each choir in play, choose opponent's character and do 10 damage
            const choirCount = [player.active, ...player.bench].filter(c => c && c.type.includes(TYPES.CHOIR)).length;
            game.log(`SATB: Found ${choirCount} choir characters`);

            if (choirCount > 0) {
                // Initialize SATB targeting
                if (!game.tempSelections) game.tempSelections = {};
                game.tempSelections.satbHitsRemaining = choirCount;
                game.tempSelections.satbAttacker = attacker;
                showSATBTargetSelection(opponent);
            } else {
                game.log('No choir characters in play', 'info');
            }
            break;

        case 'Artist Alley':
            // Discard concert posters and do 30 damage each
            const posterCount = player.hand.filter(c => c.name === 'Concert poster').length;
            if (posterCount > 0) {
                const discardCount = parseInt(prompt(`Discard how many concert posters? (0-${posterCount})`));
                if (discardCount > 0 && discardCount <= posterCount) {
                    for (let i = 0; i < discardCount; i++) {
                        const poster = player.hand.find(c => c.name === 'Concert poster');
                        player.discard.push(poster);
                        player.hand = player.hand.filter(c => c !== poster);
                    }
                    const totalDamage = discardCount * 30;
                    const finalDamage = calculateDamage(attacker, target, totalDamage, move);
                    game.dealDamage(target, finalDamage);
                    game.log(`Artist Alley: Discarded ${discardCount} posters for ${finalDamage} damage!`, 'damage');
                }
            }
            break;

        case 'Circular Breathing':
            // 10 damage, next turn +10 damage (stacks)
            executeDamageAttack(attacker, target, move);
            if (!attacker.circularBreathingBonus) attacker.circularBreathingBonus = 0;
            attacker.circularBreathingBonus += 10;
            game.log('Circular Breathing bonus will apply next turn!');
            break;

        case 'Turn Up!':
            // Next turn, guitars do 30 more damage
            if (!game.nextTurnEffects[game.currentPlayer].turnUpBonus) {
                game.nextTurnEffects[game.currentPlayer].turnUpBonus = 0;
            }
            game.nextTurnEffects[game.currentPlayer].turnUpBonus += 30;
            game.log('Turn Up!: Guitars will do +30 damage next turn');
            break;

        case 'Feedback Loop':
            // 40 damage to target, each string character takes 10 damage
            executeDamageAttack(attacker, target, move);
            const feedbackLoopChars = [player.active, ...player.bench].filter(c => c && c.type.includes(TYPES.STRINGS));
            feedbackLoopChars.forEach(char => {
                game.dealDamage(char, 10);
                game.log(`Feedback Loop: ${char.name} took 10 recoil damage`);
            });
            break;

        case 'Song voting':
            // 10 damage x number of unique members, 40 damage to self
            const uniqueTypes = new Set();
            [player.active, ...player.bench, opponent.active, ...opponent.bench]
                .filter(c => c)
                .forEach(c => c.type.forEach(t => uniqueTypes.add(t)));
            const damageAmount = uniqueTypes.size * 10;
            const songVotingDamage = calculateDamage(attacker, target, damageAmount, move);
            game.dealDamage(target, songVotingDamage);
            game.dealDamage(attacker, 40);
            game.log(`Song voting: ${uniqueTypes.size} unique types for ${songVotingDamage} damage, 40 recoil`, 'damage');
            break;

        case 'Diabolical arrangement':
            // All opponents are 10 health, this character is knocked out
            [opponent.active, ...opponent.bench].filter(c => c).forEach(char => {
                const damageNeeded = char.hp - 10 - (char.damage || 0);
                if (damageNeeded > 0) {
                    game.dealDamage(char, damageNeeded);
                    game.log(`${char.name} set to 10 HP`);
                }
            });
            game.knockOut(attacker);
            game.log('Diabolical arrangement: Mason knocked out!');
            break;

        case 'Arrangement procrastination':
            // Switch with benched, next turn reveal hand and do 10 damage per musescore file
            const benchChars = player.bench.filter(c => c);
            if (benchChars.length > 0) {
                showArrangementProcrastinationModal(player, benchChars);
            } else {
                game.log('No benched characters to switch with');
            }
            game.nextTurnEffects[game.currentPlayer].arrangementProcrastination = true;
            break;

        case 'Three Hand Technique':
            // Three individual attacks of 10 damage each
            for (let i = 0; i < 3; i++) {
                const damage = calculateDamage(attacker, target, 10, move);
                game.dealDamage(target, damage);
                game.log(`Three Hand Technique hit ${i + 1}: ${damage} damage`);
            }
            break;

        case 'Arranging':
            // Discard musescore files for 20 damage each
            const musescoreCount = player.hand.filter(c => c.name === 'Musescore file').length;
            if (musescoreCount > 0) {
                const discardCount = parseInt(prompt(`Discard how many Musescore files? (0-${musescoreCount})`));
                if (discardCount > 0 && discardCount <= musescoreCount) {
                    for (let i = 0; i < discardCount; i++) {
                        const file = player.hand.find(c => c.name === 'Musescore file');
                        player.discard.push(file);
                        player.hand = player.hand.filter(c => c !== file);
                    }
                    const totalDamage = discardCount * 20;
                    const finalDamage = calculateDamage(attacker, target, totalDamage, move);
                    game.dealDamage(target, finalDamage);
                    game.log(`Arranging: Discarded ${discardCount} files for ${finalDamage} damage!`, 'damage');
                }
            }
            break;

        case 'Cymbal Crash':
            executeDamageAttack(attacker, target, move);
            break;

        case 'Arrange (variant)':
            // Reveal top 4, discard musescore files for 40 damage each, rest to hand
            const topFour = player.deck.splice(0, 4);
            let musescoreDiscarded = 0;
            topFour.forEach(card => {
                if (card.name === 'Musescore file') {
                    player.discard.push(card);
                    musescoreDiscarded++;
                    game.log(`Discarded ${card.name}`);
                } else {
                    player.hand.push(card);
                    game.log(`Drew ${card.name}`);
                }
            });
            if (musescoreDiscarded > 0) {
                const totalDamage = musescoreDiscarded * 40;
                const finalDamage = calculateDamage(attacker, target, totalDamage, move);
                game.dealDamage(target, finalDamage);
                game.log(`Arrange: ${musescoreDiscarded} files for ${finalDamage} damage!`, 'damage');
            }
            break;

        case 'Percussion Ensemble':
            // Attach up to 2 energy to one benched Percussion type
            const benchedPercussionists = player.bench.filter(c => c && c.type.includes(TYPES.PERCUSSION));

            if (benchedPercussionists.length > 0) {
                // Let player choose which benched percussionist
                const targetName = prompt(`Choose benched Percussion character: ${benchedPercussionists.map(c => c.name).join(', ')}`);
                const targetPercussionist = benchedPercussionists.find(c => c.name === targetName);

                if (targetPercussionist) {
                    // Attach up to 2 energy
                    const numEnergy = parseInt(prompt('Attach how many energy? (1 or 2)'));
                    if (numEnergy === 1 || numEnergy === 2) {
                        for (let i = 0; i < numEnergy; i++) {
                            targetPercussionist.attachedEnergy.push({ generic: true });
                        }
                        game.log(`Percussion Ensemble: Attached ${numEnergy} energy to ${targetPercussionist.name}`);
                    }
                }
            } else {
                game.log('No benched Percussion characters available');
            }
            break;

        case 'Personal use':
            // Retrieve camera from discard
            const camera = player.discard.find(c => c.name === 'Camera');
            if (camera) {
                player.hand.push(camera);
                player.discard = player.discard.filter(c => c !== camera);
                game.log('Retrieved Camera from discard pile');
            }
            break;

        case 'Improv':
            // Discard top 3 of opponent deck, 50 base damage + 20 per item card
            const topThree = opponent.deck.splice(0, 3);
            let itemsDiscarded = 0;
            topThree.forEach(card => {
                opponent.discard.push(card);
                if (card.cardType === 'item') {
                    itemsDiscarded++;
                }
                game.log(`Opponent discarded ${card.name}`);
            });
            const improvBaseDamage = 50 + (itemsDiscarded * 20);
            const improvFinalDamage = calculateDamage(attacker, target, improvBaseDamage, move);
            game.dealDamage(target, improvFinalDamage);
            game.log(`Improv: ${itemsDiscarded} items for ${improvFinalDamage} damage!`, 'damage');
            break;

        case 'Conducting':
            // For each type in play, do 20 damage
            const typesInPlay = new Set();
            [player.active, ...player.bench, opponent.active, ...opponent.bench]
                .filter(c => c)
                .forEach(c => c.type.forEach(t => typesInPlay.add(t)));
            const conductingDamage = typesInPlay.size * 20;
            const conductingFinal = calculateDamage(attacker, target, conductingDamage, move);
            game.dealDamage(target, conductingFinal);
            game.log(`Conducting: ${typesInPlay.size} types for ${conductingFinal} damage!`, 'damage');
            break;

        case 'You know what it is':
            // Only usable if exactly 60 health, 70 damage to any opponent character
            if (attacker.hp - (attacker.damage || 0) === 60) {
                const opponentChars = [opponent.active, ...opponent.bench].filter(c => c);
                if (opponentChars.length > 0) {
                    showYouKnowWhatItIsTargetSelection(opponent, attacker);
                } else {
                    game.log('You know what it is: No valid targets');
                }
            } else {
                game.log('You know what it is can only be used at exactly 60 HP!');
            }
            break;

        case '440 Hz':
            // Attach energy from hand to benched character
            const handEnergy = player.hand.filter(c => c.cardType === 'energy');
            const benchedChars = player.bench.filter(c => c);
            if (handEnergy.length > 0 && benchedChars.length > 0) {
                game.log('440 Hz: Select energy from hand and benched character');
                show440HzSelectionModal(player, handEnergy, benchedChars);
            } else {
                game.log('Need energy in hand and benched characters to use 440 Hz');
            }
            break;

        case 'Triple Stop':
        case 'Triple Stops':
            // Flip 3 coins, 30 damage per heads
            let heads = 0;
            for (let i = 0; i < 3; i++) {
                if (Math.random() < 0.5) {
                    heads++;
                    game.log('Triple Stop: Heads!');
                } else {
                    game.log('Triple Stop: Tails');
                }
            }
            if (heads > 0) {
                const tripleStopsDamage = heads * 30;
                const tripleStopsFinal = calculateDamage(attacker, target, tripleStopsDamage, move);
                game.dealDamage(target, tripleStopsFinal);
                game.log(`Triple Stop: ${heads} heads for ${tripleStopsFinal} damage!`, 'damage');
            }
            break;

        case 'Four Mallets':
            // Four individual attacks of 10 damage each
            for (let i = 0; i < 4; i++) {
                const fourMalletsDamage = calculateDamage(attacker, target, 10, move);
                game.dealDamage(target, fourMalletsDamage);
                game.log(`Four Mallets hit ${i + 1}: ${fourMalletsDamage} damage`);
            }
            break;

        case '30 Emails':
            // 40 damage, 2x if stadium is Ice Rink
            let emailsDamage = 40;
            if (game.stadium && game.stadium.name === 'Ice Rink') {
                emailsDamage *= 2;
                game.log('30 Emails: 2x damage from Ice Rink!');
            }
            const emailsFinal = calculateDamage(attacker, target, emailsDamage, move);
            game.dealDamage(target, emailsFinal);
            game.log(`${attacker.name} used 30 Emails for ${emailsFinal} damage!`, 'damage');
            break;

        case 'Ragebaited':
            // 10 damage, +20 when below 50% HP, +60 when below 20% HP
            let ragebaseDamage = 10;
            const currentHP = attacker.hp - (attacker.damage || 0);
            const hpPercent = currentHP / attacker.hp;

            if (hpPercent <= 0.2) {
                ragebaseDamage += 60;
                game.log('Ragebaited: +60 damage (below 20% HP)!');
            } else if (hpPercent <= 0.5) {
                ragebaseDamage += 20;
                game.log('Ragebaited: +20 damage (below 50% HP)!');
            }

            const rageFinal = calculateDamage(attacker, target, ragebaseDamage, move);
            game.dealDamage(target, rageFinal);
            game.log(`${attacker.name} used Ragebaited for ${rageFinal} damage!`, 'damage');
            break;

        case 'Rimshot':
            // Roll d6, if 1-4 do 60 damage
            const rimshotRoll = Math.floor(Math.random() * 6) + 1;
            game.log(`Rimshot: Rolled ${rimshotRoll}`);
            if (rimshotRoll >= 1 && rimshotRoll <= 4) {
                const rimshotDamage = calculateDamage(attacker, target, 60, move);
                game.dealDamage(target, rimshotDamage);
                game.log(`Rimshot hit for ${rimshotDamage} damage!`, 'damage');
            } else {
                game.log('Rimshot missed!');
            }
            break;

        case 'Screech!':
            // Roll d6, damage = 10 + (10 * number)
            const screechRoll = Math.floor(Math.random() * 6) + 1;
            const screechDamage = 10 + (10 * screechRoll);
            const screechFinal = calculateDamage(attacker, target, screechDamage, move);
            game.dealDamage(target, screechFinal);
            game.log(`Screech!: Rolled ${screechRoll} for ${screechFinal} damage!`, 'damage');
            break;

        case 'Double Tongue':
            // Two individual attacks of 10 damage each
            for (let i = 0; i < 2; i++) {
                const doubleTongueDamage = calculateDamage(attacker, target, 10, move);
                game.dealDamage(target, doubleTongueDamage);
                game.log(`Double Tongue hit ${i + 1}: ${doubleTongueDamage} damage`);
            }
            break;

        case 'Harmonics':
            // Flip 2 coins, if both heads do 80 damage
            const coin1 = Math.random() < 0.5;
            const coin2 = Math.random() < 0.5;
            game.log(`Harmonics: Coin 1 - ${coin1 ? 'Heads' : 'Tails'}, Coin 2 - ${coin2 ? 'Heads' : 'Tails'}`);
            if (coin1 && coin2) {
                const harmonicsDamage = calculateDamage(attacker, target, 80, move);
                game.dealDamage(target, harmonicsDamage);
                game.log(`Harmonics: Both heads! ${harmonicsDamage} damage!`, 'damage');
            } else {
                game.log('Harmonics: No damage');
            }
            break;

        case 'Four Hands':
            // 30 damage, +30 if another piano on bench
            let fourHandsDamage = 30;
            const otherPianos = player.bench.filter(char =>
                char && char.type.includes(TYPES.PIANO) && char.id !== attacker.id
            );
            if (otherPianos.length > 0) {
                fourHandsDamage += 30;
                game.log('Four Hands: +30 damage from another piano on bench!');
            }
            const fourHandsFinal = calculateDamage(attacker, target, fourHandsDamage, move);
            game.dealDamage(target, fourHandsFinal);
            game.log(`Four Hands: ${fourHandsFinal} damage!`, 'damage');
            break;

        case 'Excused Absence':
            // Heal 30 damage from each of your characters
            const allCharsForHeal = [player.active, ...player.bench].filter(c => c);
            allCharsForHeal.forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(30, char.damage);
                    char.damage -= healAmount;
                    game.log(`${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            break;

        case 'Simulation':
            // Shuffle deck, guess number of characters in top 5
            game.shuffleDeck(game.currentPlayer);
            const guessNumber = parseInt(prompt('Simulation: Guess how many character cards are in the top 5 cards (0-5):'));
            const top5 = player.deck.slice(0, 5);
            const actualCharacters = top5.filter(c => c.cardType === 'character');

            game.log(`Simulation: Top 5 cards revealed - ${top5.map(c => c.name).join(', ')}`);
            game.log(`Simulation: ${actualCharacters.length} character cards found`);

            if (guessNumber === actualCharacters.length) {
                // Correct! Add characters to hand
                actualCharacters.forEach(char => {
                    player.hand.push(char);
                    player.deck = player.deck.filter(c => c.id !== char.id);
                });
                game.log(`Simulation: Correct! Added ${actualCharacters.length} characters to hand`, 'info');
            } else {
                game.log('Simulation: Incorrect guess. Shuffling cards back into deck', 'info');
                game.shuffleDeck(game.currentPlayer);
            }
            break;

        case 'Flute Solo':
            // 30 damage, or 80 if Evelyn is the only WW character in play
            const allCharsInPlay = [
                game.players[1].active, ...game.players[1].bench,
                game.players[2].active, ...game.players[2].bench
            ].filter(c => c);

            const woodwindChars = allCharsInPlay.filter(c => c.type.includes(TYPES.WOODWINDS));
            let fluteDamage = 30;

            if (woodwindChars.length === 1 && woodwindChars[0].id === attacker.id) {
                fluteDamage = 80;
                game.log('Flute Solo: Only WW in play, 80 damage!');
            }

            const fluteFinal = calculateDamage(attacker, target, fluteDamage, move);
            game.dealDamage(target, fluteFinal);
            game.log(`${attacker.name} used Flute Solo for ${fluteFinal} damage!`, 'damage');
            break;

        case 'Algorithm':
            // 50 damage to each opponent character that has a duplicate on your side
            const opponentChars = [opponent.active, ...opponent.bench].filter(c => c);
            const playerCharNames = [player.active, ...player.bench].filter(c => c).map(c => c.name);

            opponentChars.forEach(oppChar => {
                if (playerCharNames.includes(oppChar.name)) {
                    const algDamage = calculateDamage(attacker, oppChar, 50, move);
                    game.dealDamage(oppChar, algDamage);
                    game.log(`Algorithm: ${oppChar.name} takes ${algDamage} damage (duplicate found)!`, 'damage');
                }
            });
            break;

        case 'Touhou Ensemble':
            // 30 damage, +30 if Fumo plush in discard
            let touhouDamage = 30;
            const fumoInDiscard = player.discard.find(c => c.name === 'Fumo plush');

            if (fumoInDiscard) {
                touhouDamage += 30;
                player.discard = player.discard.filter(c => c.id !== fumoInDiscard.id);
                player.deck.push(fumoInDiscard);
                game.shuffleDeck(game.currentPlayer);
                game.log('Touhou Ensemble: +30 damage from Fumo plush! Shuffled back into deck');
            }

            const touhouFinal = calculateDamage(attacker, target, touhouDamage, move);
            game.dealDamage(target, touhouFinal);
            game.log(`${attacker.name} used Touhou Ensemble for ${touhouFinal} damage!`, 'damage');
            break;

        case 'Small Ensemble committee':
            // 10 damage to each opponent if at least one of David/Evelyn/Bokai/Roberto in play
            // 50 damage to each if all four in play
            const requiredNames = ['David', 'Evelyn', 'Bokai', 'Roberto'];
            const playerCharsAll = [player.active, ...player.bench].filter(c => c);
            const foundNames = requiredNames.filter(name =>
                playerCharsAll.some(char => char.name === name)
            );

            if (foundNames.length > 0) {
                const opponentAll = [opponent.active, ...opponent.bench].filter(c => c);
                const committeeDamage = foundNames.length === 4 ? 50 : 10;

                opponentAll.forEach(oppChar => {
                    const committeeFinal = calculateDamage(attacker, oppChar, committeeDamage, move);
                    game.dealDamage(oppChar, committeeFinal);
                    game.log(`Small Ensemble: ${oppChar.name} takes ${committeeFinal} damage!`, 'damage');
                });

                if (foundNames.length === 4) {
                    game.log('Small Ensemble: All 4 members present! 50 damage each!');
                }
            } else {
                game.log('Small Ensemble: No required members in play');
            }
            break;

        case 'Guitar Shredding':
            // 10 damage, discard all guitar energy, discard 2 cards per energy from opponent's deck
            const guitarEnergy = attacker.attachedEnergy.filter(e => e.energyType === TYPES.GUITAR);

            if (guitarEnergy.length > 0) {
                guitarEnergy.forEach(energy => {
                    attacker.attachedEnergy = attacker.attachedEnergy.filter(e => e.id !== energy.id);
                    player.discard.push(energy);
                });
                game.log(`Guitar Shredding: Discarded ${guitarEnergy.length} guitar energy`);

                // Discard 2 cards from opponent's deck per energy
                const cardsToDiscard = guitarEnergy.length * 2;
                for (let i = 0; i < cardsToDiscard && opponent.deck.length > 0; i++) {
                    const discarded = opponent.deck.shift();
                    opponent.discard.push(discarded);
                }
                game.log(`Guitar Shredding: Opponent discarded ${Math.min(cardsToDiscard, opponent.deck.length)} cards from deck`);

                const shreddingFinal = calculateDamage(attacker, target, 10, move);
                game.dealDamage(target, shreddingFinal);
                game.log(`${attacker.name} used Guitar Shredding for ${shreddingFinal} damage!`, 'damage');
            } else {
                game.log('Guitar Shredding: No guitar energy to discard!');
            }
            break;

        case 'Snap Pizz':
            // 20 damage, discard 2 energy from opponent's character
            executeDamageAttack(attacker, target, move);
            if (target.attachedEnergy && target.attachedEnergy.length >= 2) {
                for (let i = 0; i < 2; i++) {
                    const discardedEnergy = target.attachedEnergy.pop();
                    opponent.discard.push(discardedEnergy);
                }
                game.log('Snap Pizz: Discarded 2 energy from opponent!');
            } else if (target.attachedEnergy && target.attachedEnergy.length > 0) {
                const discardedEnergy = target.attachedEnergy.pop();
                opponent.discard.push(discardedEnergy);
                game.log('Snap Pizz: Discarded 1 energy from opponent (only had 1)');
            }
            break;

        case 'Grand Piano':
            // 40 damage, +20 if stadium is a performance hall
            let grandPianoDamage = move.damage;
            if (game.stadium && game.isPerformanceSpace(game.stadium.name)) {
                grandPianoDamage += 20;
                game.log('Grand Piano: +20 damage in performance hall!');
            }
            const grandPianoFinal = calculateDamage(attacker, target, grandPianoDamage, move);
            game.dealDamage(target, grandPianoFinal);
            game.log(`${attacker.name} used ${move.name} for ${grandPianoFinal} damage!`, 'damage');
            break;

        case 'Damper Pedal':
            // 20 damage, opponent's next attack is halved
            executeDamageAttack(attacker, target, move);
            game.nextTurnEffects[opponentNum].damperPedal = true;
            game.log('Damper Pedal: Opponent\'s next attack will be halved!');
            break;

        case 'Glissando':
            // 30 damage, can't use this attack next turn
            executeDamageAttack(attacker, target, move);
            attacker.cantUseGlissando = true;
            game.log('Glissando: Can\'t use this attack next turn');
            break;

        case 'Stick Trick':
            // 10 damage, swap with benched character for free
            executeDamageAttack(attacker, target, move);
            const stickTrickBench = player.bench.filter(c => c);
            if (stickTrickBench.length > 0) {
                game.log('Stick Trick: Select benched character to swap with');
                showStickTrickSwapModal(player, stickTrickBench);
                return; // Wait for swap selection
            } else {
                game.log('Stick Trick: No benched characters to swap with');
            }
            break;

        // ===== BRASS MOVES =====
        case 'Fanfare':
            // Not affected by weakness, resistance, or immunities
            const fanfareDamage = move.damage || 0;
            game.dealDamage(target, fanfareDamage); // Direct damage, bypass calculateDamage
            game.log(`${attacker.name} used Fanfare for ${fanfareDamage} damage (ignores resistance/weakness)!`, 'damage');
            break;

        case 'Drain':
            // Heal benched character for damage dealt
            const drainDamage = calculateDamage(attacker, target, move.damage, move);
            game.dealDamage(target, drainDamage);
            game.log(`${attacker.name} used Drain for ${drainDamage} damage!`, 'damage');

            const benchedForDrain = player.bench.filter(c => c && c.damage > 0);
            if (benchedForDrain.length > 0) {
                showDrainHealSelection(player, benchedForDrain, drainDamage);
            }
            break;

        case 'Embouchure':
            // Move energy among characters
            showEmbouchureSelection(player);
            break;

        case 'Echoing Blast':
            // 40 damage + 10 to each bench
            executeDamageAttack(attacker, target, move);
            opponent.bench.filter(c => c).forEach(benchChar => {
                const benchDamage = calculateDamage(attacker, benchChar, 10, move);
                game.dealDamage(benchChar, benchDamage);
                game.log(`Echoing Blast: ${benchChar.name} takes ${benchDamage} bench damage`);
            });
            break;

        case 'Concert Pitch':
            // 20 damage, +20 per brass if only brass on bench
            let concertPitchDamage = 20;
            const benchTypes = player.bench.filter(c => c).map(c => c.type).flat();
            const onlyBrass = player.bench.filter(c => c).every(c => !c || c.type.includes(TYPES.BRASS));

            if (onlyBrass && player.bench.some(c => c)) {
                const brassCount = player.bench.filter(c => c && c.type.includes(TYPES.BRASS)).length;
                concertPitchDamage += 20 * brassCount;
                game.log(`Concert Pitch: +${20 * brassCount} damage (${brassCount} brass on bench)!`);
            }

            const concertPitchFinal = calculateDamage(attacker, target, concertPitchDamage, move);
            game.dealDamage(target, concertPitchFinal);
            game.log(`${attacker.name} used Concert Pitch for ${concertPitchFinal} damage!`, 'damage');
            break;

        case 'Heart of the Cards':
            // Name card, draw, if match deal 60 damage
            const cardName = prompt('Heart of the Cards: Name a card:');
            if (cardName && player.deck.length > 0) {
                const drawnCard = player.deck.shift();
                player.hand.push(drawnCard);
                game.log(`Heart of the Cards: Drew ${drawnCard.name}`);

                if (drawnCard.name.toLowerCase() === cardName.toLowerCase()) {
                    const heartDamage = calculateDamage(attacker, target, 60, move);
                    game.dealDamage(target, heartDamage);
                    game.log(`Heart of the Cards: Match! ${heartDamage} damage!`, 'damage');
                } else {
                    game.log('Heart of the Cards: No match, no damage');
                }
            }
            break;

        // ===== CHOIR MOVES =====
        case 'Full Force':
            // 30 damage + 10 to each bench
            executeDamageAttack(attacker, target, move);
            opponent.bench.filter(c => c).forEach(benchChar => {
                const benchDamage = calculateDamage(attacker, benchChar, 10, move);
                game.dealDamage(benchChar, benchDamage);
                game.log(`Full Force: ${benchChar.name} takes ${benchDamage} bench damage`);
            });
            break;

        case 'Ross Attack!':
            // If Ross on your bench: draw 2. If Ross on opp bench: 50 damage. If both: nothing
            const rossOnYourBench = player.bench.some(c => c && c.name === 'Ross Williams');
            const rossOnOppBench = opponent.bench.some(c => c && c.name === 'Ross Williams');

            if (rossOnYourBench && rossOnOppBench) {
                game.log('Ross Attack!: Ross on both benches - nothing happens!');
            } else if (rossOnYourBench) {
                game.drawCards(game.currentPlayer, 2);
                game.log('Ross Attack!: Drew 2 cards (Ross on your bench)!');
            } else if (rossOnOppBench) {
                // Choose target from opponent's characters
                showTargetSelection([opponent.active, ...opponent.bench].filter(c => c), (selectedTarget) => {
                    const rossDamage = calculateDamage(attacker, selectedTarget, 50, move);
                    game.dealDamage(selectedTarget, rossDamage);
                    game.log(`Ross Attack!: ${selectedTarget.name} takes ${rossDamage} damage!`, 'damage');
                }, 'Ross Attack! - Choose target');
                return; // Wait for selection
            } else {
                game.log('Ross Attack!: No Ross on any bench - no effect');
            }
            break;

        case 'Tabemono King':
            // Heal all yours 30, opponent's 10, discard energy
            [player.active, ...player.bench].filter(c => c).forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(30, char.damage);
                    char.damage -= healAmount;
                    game.log(`${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            [opponent.active, ...opponent.bench].filter(c => c).forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(10, char.damage);
                    char.damage -= healAmount;
                    game.log(`Opponent's ${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            // Discard all energy from attacker
            if (attacker.attachedEnergy.length > 0) {
                const discardedCount = attacker.attachedEnergy.length;
                attacker.attachedEnergy.forEach(e => player.discard.push(e));
                attacker.attachedEnergy = [];
                game.log(`Tabemono King: Discarded ${discardedCount} energy`);
            }
            break;

        case 'Chorus':
            // 20 damage + 10 per benched character
            const chorusBenchCount = player.bench.filter(c => c).length;
            const chorusDamage = 20 + (10 * chorusBenchCount);
            const chorusFinal = calculateDamage(attacker, target, chorusDamage, move);
            game.dealDamage(target, chorusFinal);
            game.log(`${attacker.name} used Chorus for ${chorusFinal} damage (${chorusBenchCount} benched)!`, 'damage');
            break;

        // ===== GUITAR MOVES =====
        case 'Domain Expansion':
            // Discard all energy, 40 damage to all opponents
            const guitarEnergyCount = attacker.attachedEnergy.length;
            attacker.attachedEnergy.forEach(e => player.discard.push(e));
            attacker.attachedEnergy = [];
            game.log(`Domain Expansion: Discarded ${guitarEnergyCount} energy`);

            [opponent.active, ...opponent.bench].filter(c => c).forEach(oppChar => {
                const domainDamage = calculateDamage(attacker, oppChar, 40, move);
                game.dealDamage(oppChar, domainDamage);
                game.log(`Domain Expansion: ${oppChar.name} takes ${domainDamage} damage!`, 'damage');
            });
            break;

        case 'Power Chord':
            // 70 damage, discard 2 energy
            executeDamageAttack(attacker, target, move);
            const powerChordEnergy = Math.min(2, attacker.attachedEnergy.length);
            for (let i = 0; i < powerChordEnergy; i++) {
                const discarded = attacker.attachedEnergy.pop();
                player.discard.push(discarded);
            }
            game.log(`Power Chord: Discarded ${powerChordEnergy} energy`);
            // Mark that Power Chord was used
            attacker.usedPowerChordLastTurn = true;
            break;

        case 'Fingerstyle':
            // Only if didn't use Power Chord last turn, flip 8 coins, 20 damage per heads
            if (attacker.usedPowerChordLastTurn) {
                game.log('Fingerstyle: Cannot use after Power Chord!', 'warning');
            } else {
                let fingerstyleHeads = 0;
                for (let i = 0; i < 8; i++) {
                    if (flipCoin()) {
                        fingerstyleHeads++;
                    }
                }
                const fingerstyleDamage = fingerstyleHeads * 20;
                const fingerstyleFinal = calculateDamage(attacker, target, fingerstyleDamage, move);
                game.dealDamage(target, fingerstyleFinal);
                game.log(`Fingerstyle: ${fingerstyleHeads} heads for ${fingerstyleFinal} damage!`, 'damage');
            }
            // Clear Power Chord flag
            attacker.usedPowerChordLastTurn = false;
            break;

        case 'Packet Loss':
            // Flip coin per energy, discard on tails
            if (target.attachedEnergy && target.attachedEnergy.length > 0) {
                const energyCount = target.attachedEnergy.length;
                let discarded = 0;
                for (let i = energyCount - 1; i >= 0; i--) {
                    if (!flipCoin()) { // Tails
                        const energy = target.attachedEnergy.splice(i, 1)[0];
                        opponent.discard.push(energy);
                        discarded++;
                    }
                }
                game.log(`Packet Loss: Discarded ${discarded} of ${energyCount} energy`);
            }
            break;

        case 'Distortion':
            // 30 damage, plucked strings +40 next turn
            executeDamageAttack(attacker, target, move);
            if (!game.nextTurnEffects[game.currentPlayer].distortionBonus) {
                game.nextTurnEffects[game.currentPlayer].distortionBonus = 0;
            }
            game.nextTurnEffects[game.currentPlayer].distortionBonus += 40;
            game.log('Distortion: Next turn bonus +40 damage set!');
            break;

        case 'Surprise Delivery':
            // Look top 3, attach energies, damage per energy
            const topThreeCards = player.deck.splice(0, 3);
            let attachedCount = 0;
            topThreeCards.forEach(card => {
                if (card.cardType === 'energy' && attacker.attachedEnergy) {
                    attacker.attachedEnergy.push(card);
                    attachedCount++;
                    game.log(`Surprise Delivery: Attached ${card.name}`);
                } else {
                    player.deck.push(card);
                }
            });
            game.shuffleDeck(game.currentPlayer);

            if (attachedCount > 0) {
                const surpriseDamage = attachedCount * 20;
                const surpriseFinal = calculateDamage(attacker, target, surpriseDamage, move);
                game.dealDamage(target, surpriseFinal);
                game.log(`Surprise Delivery: ${attachedCount} energies for ${surpriseFinal} damage!`, 'damage');
            }
            break;

        // ===== PERCUSSION MOVES =====
        case 'Snowball Effect':
            // Roll d6 until 6, damage = 10 × non-6 rolls
            let snowballRolls = 0;
            let roll;
            do {
                roll = rollD6();
                game.log(`Snowball Effect: Rolled ${roll}`);
                if (roll !== 6) snowballRolls++;
            } while (roll !== 6);

            const snowballDamage = snowballRolls * 10;
            const snowballFinal = calculateDamage(attacker, target, snowballDamage, move);
            game.dealDamage(target, snowballFinal);
            game.log(`Snowball Effect: ${snowballRolls} non-6 rolls for ${snowballFinal} damage!`, 'damage');
            break;

        case 'Ominous Chimes':
            // Shuffle self back, 50 damage at end of opponent's turn
            game.nextTurnEffects[opponentNum].ominousChimesDamage = 50;
            game.nextTurnEffects[opponentNum].ominousChimesTarget = target.id;

            // Shuffle attacker back into deck
            player.active = null;
            attacker.damage = 0; // Reset damage
            attacker.attachedEnergy = []; // Clear energy
            attacker.attachedTools = []; // Clear tools
            player.deck.push(attacker);
            game.shuffleDeck(game.currentPlayer);
            game.log(`Ominous Chimes: ${attacker.name} shuffled back into deck. 50 damage will be dealt at end of opponent's turn!`);
            break;

        case 'Stickshot':
            // Roll d6, if 1-4 roll again, damage = 10 × highest
            let stickshotRoll1 = rollD6();
            game.log(`Stickshot: First roll ${stickshotRoll1}`);
            let stickshotFinal = stickshotRoll1;

            if (stickshotRoll1 <= 4) {
                const stickshotRoll2 = rollD6();
                game.log(`Stickshot: Second roll ${stickshotRoll2}`);
                stickshotFinal = Math.max(stickshotRoll1, stickshotRoll2);
            }

            const stickshotDamage = stickshotFinal * 10;
            const stickshotDamageFinal = calculateDamage(attacker, target, stickshotDamage, move);
            game.dealDamage(target, stickshotDamageFinal);
            game.log(`Stickshot: ${stickshotDamageFinal} damage (highest roll: ${stickshotFinal})!`, 'damage');
            break;

        case 'Drum Kid Workshop':
            // Copy another percussion's attack
            const percussionChars = [player.active, ...player.bench, opponent.active, ...opponent.bench]
                .filter(c => c && c.type.includes(TYPES.PERCUSSION) && c.id !== attacker.id);

            if (percussionChars.length > 0) {
                showDrumKidWorkshopSelection(percussionChars, attacker, target);
                return; // Wait for modal selection
            } else {
                game.log('Drum Kid Workshop: No other percussion characters in play');
            }
            break;

        case 'Tricky Rhythms':
            // Complex energy discard and damage
            showTrickyRhythmsModal(attacker, target, move);
            return; // Wait for modal selection
            break;

        case 'Rudiments':
            // 10 damage to chosen opponent character (should already exist but adding for completeness)
            if (!target) {
                game.log('Rudiments: Select a target');
            } else {
                executeDamageAttack(attacker, target, move);
            }
            break;

        // ===== PIANO MOVES =====
        case 'Nullify':
            // Benched this turn → opponent abilities no effect
            if (attacker.wasJustBenched) {
                game.nextTurnEffects[opponentNum].abilitiesDisabled = true;
                game.log('Nullify: Opponent abilities disabled next turn!');
            } else {
                game.log('Nullify: Can only use if this character was benched this turn', 'warning');
            }
            break;

        case 'Separate Hands':
            // 0 damage, next turn 40 damage
            game.log('Separate Hands: Next turn will deal 40 damage');
            attacker.separateHandsActive = true;
            break;

        case 'Inventory Management':
            // Flip coin per hand card, 10 damage each heads
            const handSize = player.hand.length;
            let inventoryHeads = 0;
            for (let i = 0; i < handSize; i++) {
                if (flipCoin()) {
                    inventoryHeads++;
                }
            }
            const inventoryDamage = inventoryHeads * 10;
            const inventoryFinal = calculateDamage(attacker, target, inventoryDamage, move);
            game.dealDamage(target, inventoryFinal);
            game.log(`Inventory Management: ${inventoryHeads} heads from ${handSize} cards for ${inventoryFinal} damage!`, 'damage');
            break;

        case 'Racket Smash':
            // 10 damage, discard energy from bench
            executeDamageAttack(attacker, target, move);
            const benchWithEnergy = player.bench.filter(c => c && c.attachedEnergy && c.attachedEnergy.length > 0);
            if (benchWithEnergy.length > 0) {
                showRacketSmashSelection(player, benchWithEnergy);
            }
            break;

        // ===== STRINGS MOVES =====
        case 'Borrow':
            // Move energy from another string to this
            const borrowStringChars = [player.active, ...player.bench].filter(c =>
                c && c.type.includes(TYPES.STRINGS) && c.id !== attacker.id && c.attachedEnergy && c.attachedEnergy.length > 0
            );
            if (borrowStringChars.length > 0) {
                showBorrowSelection(player, borrowStringChars, attacker);
            } else {
                game.log('Borrow: No other strings with energy to borrow from');
            }
            break;

        case 'Foresight':
            // Rearrange top 3 of opponent's deck
            if (opponent.deck.length > 0) {
                const topThreeOpponent = opponent.deck.splice(0, Math.min(3, opponent.deck.length));
                showForesightModal(opponent, topThreeOpponent);
            }
            break;

        case 'Open Strings':
            // 10 damage, draw card, if energy attach it
            executeDamageAttack(attacker, target, move);
            if (player.deck.length > 0) {
                const drawnCard = player.deck.shift();
                player.hand.push(drawnCard);
                game.log(`Open Strings: Drew ${drawnCard.name}`);

                if (drawnCard.cardType === 'energy') {
                    attacker.attachedEnergy.push(drawnCard);
                    player.hand = player.hand.filter(c => c.id !== drawnCard.id);
                    game.log(`Open Strings: Attached ${drawnCard.name} to ${attacker.name}`);
                }
            }
            break;

        case 'VocaRock!!':
            // 20 damage, +50 if Miku Otamatone attached
            let vocaRockDamage = 20;
            if (attacker.attachedTools && attacker.attachedTools.some(t => t.name === 'Miku Otamatone')) {
                vocaRockDamage += 50;
                game.log('VocaRock!!: +50 damage from Miku Otamatone!');
            }
            const vocaRockFinal = calculateDamage(attacker, target, vocaRockDamage, move);
            game.dealDamage(target, vocaRockFinal);
            game.log(`${attacker.name} used VocaRock!! for ${vocaRockFinal} damage!`, 'damage');
            break;

        case 'Midday Nap':
            // Heal 20 damage
            if (attacker.damage > 0) {
                const healAmount = Math.min(20, attacker.damage);
                attacker.damage -= healAmount;
                game.log(`${attacker.name} healed ${healAmount} damage!`, 'heal');
            } else {
                game.log('Midday Nap: Already at full HP');
            }
            break;

        case 'Gacha Gaming':
            // Draw cards taking damage, complex mechanics
            showGachaGamingModal(player, attacker);
            break;

        case 'Song Voting':
            // Updated: Reveal opponent's hand, choose card type, damage based on count
            showSongVotingModal(opponent, attacker, target, move);
            break;

        // ===== WOODWINDS MOVES =====
        case 'Overblow':
            // 40 damage, 10 recoil
            executeDamageAttack(attacker, target, move);
            game.dealDamage(attacker, 10);
            game.log('Overblow: 10 recoil damage', 'damage');
            break;

        case 'Analysis Paralysis':
            // Reveal hand, shuffle one back
            game.log(`Analysis Paralysis: Your hand is ${player.hand.map(c => c.name).join(', ')}`);
            if (player.hand.length > 0) {
                showAnalysisParalysisModal(player);
            }
            break;

        case 'Speedrun Central':
            // 20 damage, +40 if came off bench this turn
            let speedrunDamage = 20;
            if (attacker.cameOffBenchThisTurn) {
                speedrunDamage += 40;
                game.log('Speedrun Central: +40 damage (came off bench this turn)!');
            }
            const speedrunFinal = calculateDamage(attacker, target, speedrunDamage, move);
            game.dealDamage(target, speedrunFinal);
            game.log(`${attacker.name} used Speedrun Central for ${speedrunFinal} damage!`, 'damage');
            break;

        case 'Trickster':
            // Complex turn-delayed damage
            const tricksterDamage = move.damage || 30;
            game.nextTurnEffects[opponentNum].tricksterDamage = tricksterDamage;
            game.nextTurnEffects[opponentNum].tricksterTarget = opponent.active ? opponent.active.id : null;
            game.log(`Trickster: ${tricksterDamage} damage will be dealt at start of opponent's next turn`);
            break;

        case 'Sparkling run':
            // 20 damage, heal 20
            executeDamageAttack(attacker, target, move);
            if (attacker.damage > 0) {
                const healAmount = Math.min(20, attacker.damage);
                attacker.damage -= healAmount;
                game.log(`Sparkling run: ${attacker.name} healed ${healAmount} damage!`, 'heal');
            }
            break;

        case 'Banana Bread for Everyone!':
            // Heal 30 all, discard energy
            [player.active, ...player.bench].filter(c => c).forEach(char => {
                if (char.damage > 0) {
                    const healAmount = Math.min(30, char.damage);
                    char.damage -= healAmount;
                    game.log(`${char.name} healed ${healAmount} damage!`, 'heal');
                }
            });
            if (attacker.attachedEnergy.length > 0) {
                const discarded = attacker.attachedEnergy.pop();
                player.discard.push(discarded);
                game.log('Banana Bread: Discarded 1 energy');
            }
            break;

        case 'Wipeout':
            // 60 damage to 3 different (including self)
            showWipeoutSelection(player, opponent, attacker);
            break;

        case 'Clarinet Solo':
        case 'Piccolo Solo':
            // 80 damage if only WW in play
            const allCharsForSolo = [
                game.players[1].active, ...game.players[1].bench,
                game.players[2].active, ...game.players[2].bench
            ].filter(c => c);

            const woodwindCharsForSolo = allCharsForSolo.filter(c => c.type.includes(TYPES.WOODWINDS));
            let soloDamage = move.damage || 30;

            if (woodwindCharsForSolo.length === 1 && woodwindCharsForSolo[0].id === attacker.id) {
                soloDamage = 80;
                game.log(`${move.name}: Only WW in play, 80 damage!`);
            }

            const soloFinal = calculateDamage(attacker, target, soloDamage, move);
            game.dealDamage(target, soloFinal);
            game.log(`${attacker.name} used ${move.name} for ${soloFinal} damage!`, 'damage');
            break;

        case 'SN2':
            // 20 damage, shuffle bench back (if bench not full)
            executeDamageAttack(attacker, target, move);
            const benchNotFull = player.bench.some(slot => slot === null);
            if (benchNotFull) {
                const benchToShuffle = player.bench.filter(c => c);
                if (benchToShuffle.length > 0) {
                    showSN2ShuffleSelection(player, benchToShuffle);
                }
            } else {
                game.log('SN2: Bench is full, cannot shuffle back');
            }
            break;

        case 'Outreach':
            // Search for character, put on top of deck
            const charactersInDeck = player.deck.filter(c => c.cardType === 'character');
            if (charactersInDeck.length > 0) {
                showOutreachSelection(player, charactersInDeck);
            } else {
                game.log('Outreach: No characters in deck');
            }
            break;

        case 'SE lord':
            // Heal opponent's bench, damage active by that amount
            let totalHealed = 0;
            opponent.bench.filter(c => c && c.damage > 0).forEach(char => {
                const healAmount = Math.min(30, char.damage);
                char.damage -= healAmount;
                totalHealed += healAmount;
                game.log(`SE lord: Healed ${char.name} for ${healAmount}`, 'heal');
            });

            if (totalHealed > 0 && opponent.active) {
                const seLordDamage = calculateDamage(attacker, opponent.active, totalHealed, move);
                game.dealDamage(opponent.active, seLordDamage);
                game.log(`SE lord: Dealt ${seLordDamage} damage to opponent's active!`, 'damage');
            }
            break;

        case 'Blast':
            // Standard 50 damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Strum':
            // Standard 20 damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Seal Attack':
            // Standard 30 damage attack
            executeDamageAttack(attacker, target, move);
            break;

        case 'Sparkling Run':
        case 'Sparkling run':
            // 20 damage and heal 20
            executeDamageAttack(attacker, target, move);
            game.dealDamage(attacker, -20); // Negative damage = healing
            game.log(`${attacker.name} healed 20 damage!`);
            break;

        case 'Synchro Summon':
            // Reveal cards until character found
            let revealedCards = [];
            let characterFound = null;

            while (player.deck.length > 0 && !characterFound) {
                const card = player.deck.shift();
                revealedCards.push(card);
                if (card.cardType === 'character') {
                    characterFound = card;
                }
            }

            if (characterFound) {
                const isStringType = characterFound.type && characterFound.type.includes(TYPES.STRINGS);
                if (!isStringType) {
                    const synchDamage = calculateDamage(attacker, target, 20, move);
                    game.dealDamage(target, synchDamage);
                    game.log(`Synchro Summon: Found non-String character, dealt ${synchDamage} damage!`);
                }
                player.hand.push(characterFound);
                game.log(`${characterFound.name} added to hand!`);

                // Shuffle other revealed cards back
                revealedCards = revealedCards.filter(c => c !== characterFound);
                player.deck.push(...revealedCards);
                game.shuffleDeck(game.currentPlayer);
            } else {
                // No character found, shuffle all back
                player.deck.push(...revealedCards);
                game.shuffleDeck(game.currentPlayer);
                game.log('Synchro Summon: No character found');
            }
            break;

        case 'Spike':
            // 10 damage, discard 1 energy from each opponent benched character
            executeDamageAttack(attacker, target, move);
            opponent.bench.filter(c => c).forEach(benchChar => {
                if (benchChar.attachedEnergy && benchChar.attachedEnergy.length > 0) {
                    benchChar.attachedEnergy.pop();
                    game.log(`Spike: Discarded energy from ${benchChar.name}`);
                }
            });
            break;

        case 'Photograph':
            // Look at opponent's hand, use an Item card effect
            if (opponent.hand.length > 0) {
                const itemCards = opponent.hand.filter(c => c.cardType === 'item');
                if (itemCards.length > 0) {
                    const itemNames = itemCards.map(c => c.name).join(', ');
                    const chosenName = prompt(`Photograph: Choose an item card from opponent's hand to copy:\n${itemNames}`);
                    const chosenItem = itemCards.find(c => c.name === chosenName);
                    if (chosenItem) {
                        game.log(`Photograph: Copying ${chosenItem.name} effect`, 'info');
                        // Temporarily add the item to current player's hand, execute it, then remove it
                        const tempItem = { ...chosenItem, id: generateCardId() };
                        player.hand.push(tempItem);
                        const waitForModal = executeItemEffect(tempItem);
                        if (!waitForModal) {
                            // Remove temp item immediately if no modal
                            player.hand = player.hand.filter(c => c.id !== tempItem.id);
                        }
                        // Note: If modal is shown, the item will be removed when modal closes
                    }
                } else {
                    game.log('Photograph: No items in opponent hand');
                }
            } else {
                game.log('Photograph: Opponent has no cards in hand');
            }
            break;

        case 'Small Ensemble Committee':
            // Count small ensemble members, deal damage accordingly
            const ensembleMembers = ['Katie Xiang', 'Jennie Wang', 'Luke Xu', 'Henry Wang', 'David Man'];
            const membersInPlay = [player.active, ...player.bench, opponent.active, ...opponent.bench]
                .filter(c => c && ensembleMembers.includes(c.name)).length;

            if (membersInPlay >= 1) {
                const ensembleDamage = membersInPlay >= 3 ? 30 : 10;
                [opponent.active, ...opponent.bench].filter(c => c).forEach(oppChar => {
                    const dmg = calculateDamage(attacker, oppChar, ensembleDamage, move);
                    game.dealDamage(oppChar, dmg);
                    game.log(`Small Ensemble Committee: ${dmg} damage to ${oppChar.name}`);
                });
            } else {
                game.log('No ensemble members in play');
            }
            break;

        case 'Hands separately':
            // 0 damage this turn, 40 next turn
            if (!attacker.handsSeperatelyPrimed) {
                attacker.handsSeperatelyPrimed = true;
                game.log('Hands separately primed - next turn will do 40 damage!');
            } else {
                const handsDamage = calculateDamage(attacker, target, 40, move);
                game.dealDamage(target, handsDamage);
                attacker.handsSeperatelyPrimed = false;
                game.log(`Hands separately: ${handsDamage} damage!`, 'damage');
            }
            break;

        case 'Multiphonics':
            // Flip 2 coins - both heads = 40 to each bench, both tails = 80 to active
            const multiCoin1 = Math.random() < 0.5;
            const multiCoin2 = Math.random() < 0.5;
            game.log(`Multiphonics: Flipped ${multiCoin1 ? 'heads' : 'tails'} and ${multiCoin2 ? 'heads' : 'tails'}`);

            if (multiCoin1 && multiCoin2) {
                // Both heads - 40 to each benched
                opponent.bench.filter(c => c).forEach(benchChar => {
                    const benchDmg = calculateDamage(attacker, benchChar, 40, move);
                    game.dealDamage(benchChar, benchDmg);
                    game.log(`Multiphonics: ${benchDmg} damage to ${benchChar.name}`, 'damage');
                });
            } else if (!multiCoin1 && !multiCoin2) {
                // Both tails - 80 to active
                const activeDmg = calculateDamage(attacker, opponent.active, 80, move);
                game.dealDamage(opponent.active, activeDmg);
                game.log(`Multiphonics: ${activeDmg} damage to ${opponent.active.name}!`, 'damage');
            } else {
                game.log('Multiphonics: Mixed results, no damage');
            }
            break;

        case 'Four Hands Piano':
            // 30 damage, +30 if piano on bench
            let fourHandsBaseDamage = 30;
            const hasPianoOnBench = player.bench.some(c => c && c.type.includes(TYPES.PIANO));
            if (hasPianoOnBench) {
                fourHandsBaseDamage += 30;
                game.log('Four Hands Piano: +30 damage for piano on bench!');
            }
            const fourHandsPianoDamage = calculateDamage(attacker, target, fourHandsBaseDamage, move);
            game.dealDamage(target, fourHandsPianoDamage);
            game.log(`Four Hands Piano: ${fourHandsPianoDamage} damage!`, 'damage');
            break;

        case 'E2 Reaction':
            // Only works if opponent has 2+ benched
            const benchedCount = opponent.bench.filter(c => c).length;
            if (benchedCount >= 2) {
                executeDamageAttack(attacker, target, move);
                // Let player choose which benched character to shuffle
                const benchedChars = opponent.bench.filter(c => c);
                const targetName = prompt(`E2 Reaction: Choose opponent's benched character to shuffle back into deck:\n${benchedChars.map(c => c.name).join(', ')}`);
                const benchTarget = benchedChars.find(c => c.name === targetName);
                if (benchTarget) {
                    opponent.bench[opponent.bench.indexOf(benchTarget)] = null;
                    opponent.deck.push(benchTarget);
                    game.shuffleDeck(3 - game.currentPlayer);
                    game.log(`E2 Reaction: Shuffled ${benchTarget.name} back into deck`);
                }
            } else {
                game.log('E2 Reaction: Opponent needs at least 2 benched characters');
            }
            break;

        case 'Cherry Flavored Valve Oil':
            // 30 damage, heal one benched character for same amount dealt
            const cherryDamage = calculateDamage(attacker, target, 30, move);
            game.dealDamage(target, cherryDamage);
            game.log(`Cherry Flavored Valve Oil: ${cherryDamage} damage dealt!`, 'damage');

            const benchedForCherry = player.bench.filter(c => c);
            if (benchedForCherry.length > 0) {
                showCherryHealSelection(player, benchedForCherry, cherryDamage);
                return; // Wait for heal selection
            } else {
                game.log('Cherry Flavored Valve Oil: No benched characters to heal', 'info');
            }
            break;

        default:
            // Standard damage attack for unlisted moves
            if (move.damage > 0) {
                executeDamageAttack(attacker, target, move);
            }
            break;
    }

