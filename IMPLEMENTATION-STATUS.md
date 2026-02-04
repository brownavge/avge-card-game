# Game Implementation Status

## Completed Updates

### Character Ability Damage Values ✅
- **Cavin Xue**: Maid damage bonus updated from +10 to +20 per maid
- **Ryan Li**: Now has "Moe moe kyun~!" ability (+20 damage for maids, was Loang's)
- **Grace Zhao**: Royalties damage reduced from 20 to 10
- **Ashley Toby**: Instagram Viral ability updated (2x damage when both benches full)

### New Passive Abilities Added ✅
- **Juan Burgos**: Baking Buff (+20 damage to brass active when on bench)
- **Daniel Yang**: Delicate Ears (+20 damage when no brass in play)
- **Carolyn Zheng**: Procrastinate (+40 damage per turn not attacking, stacks)

### Move Implementations Added ✅
- **Percussion Ensemble**: Updated to search for 2 energies (was 3)
- **Excused Absence**: Updated to heal 30 damage per character
- **Four Mallets**: Four individual 10 damage attacks
- **Triple Stop**: Flip 3 coins, 30 damage per heads
- **Ragebaited**: Updated damage formula (10 base, +20 at 50% HP, +60 at 20% HP)
- **Rimshot**: Roll d6, 60 damage on 1-4
- **Screech!**: Roll d6, damage = 10 + (10 × roll)
- **Double Tongue**: Two 10 damage attacks
- **Harmonics**: Flip 2 coins, 80 damage if both heads
- **Four Hands**: 30 damage, +30 if another piano on bench
- **Snap Pizz**: 20 damage, discard 2 energy from opponent
- **Grand Piano**: 60 damage (only in performance stadiums)
- **Damper Pedal**: 20 damage, halve opponent's next attack
- **Glissando**: 30 damage, can't use next turn
- **Stick Trick**: 10 damage, free swap with bench
- **Guitar Shredding**: Updated to 10 damage + mill effect

## Moves Still Needing Implementation

### High Priority (Frequently Used)

**BRASS**
- [ ] **Fanfare**: Not affected by weakness, resistance, or immunities
- [ ] **Drain**: Heal benched character for damage dealt
- [ ] **Embouchure**: Move energy among characters
- [ ] **Blast**: Standard damage (should work with default)
- [ ] **Echoing Blast**: 40 damage + 10 to each bench
- [ ] **Concert Pitch**: 20 damage, +20 per brass if only brass on bench
- [ ] **Heart of the Cards**: Name card, draw, if match deal 60 damage

**CHOIR**
- [ ] **Full Force**: 30 damage + 10 to each bench (partial - SATB exists)
- [ ] **Ross Attack!**: Complex conditional (Ross on bench/opponent's bench)
- [ ] **Tabemono King**: Heal all yours 30, opponent's 10, discard energy
- [ ] **Chorus**: 20 damage + 10 per benched character

**GUITAR**
- [ ] **Feedback Loop**: Already exists but needs update
- [ ] **Domain Expansion**: Discard all energy, 40 damage to all opponents
- [ ] **Fingerstyle**: Only if didn't use Power Chord last turn, flip 8 coins
- [ ] **Power Chord**: 70 damage, discard 2 energy
- [ ] **Packet Loss**: Flip coins to discard opponent's energy
- [ ] **Distortion**: 30 damage, plucked strings +40 next turn
- [ ] **Strum**: Standard 20 damage
- [ ] **Surprise Delivery**: Look top 3, attach energies, damage per energy

**PERCUSSION**
- [ ] **Tricky Rhythms**: Complex energy discard and damage
- [ ] **Cymbal Crash**: Standard damage (already exists)
- [ ] **Snowball Effect**: Roll d6 until 6, damage = 10 × non-6 rolls
- [ ] **Ominous Chimes**: Shuffle self back, 50 damage at end of opponent's turn
- [ ] **Stickshot**: Roll d6, if 1-4 roll again, damage = 10 × highest
- [ ] **Drum Kid Workshop**: Copy another percussion's attack
- [ ] **Rudiments**: 10 damage to chosen opponent character (already exists)

**PIANO**
- [ ] **Nullify**: Benched this turn → opponent abilities no effect
- [ ] **Improv**: Already exists
- [ ] **Separate Hands**: 0 damage, next turn 40 damage
- [ ] **Inventory Management**: Flip coin per hand card, 10 damage each heads
- [ ] **Three Hand Technique**: Four 10 damage attacks
- [ ] **Racket Smash**: 10 damage, discard energy from bench
- [ ] **Small Ensemble Committee**: Updated version needed

**STRINGS**
- [ ] **Borrow**: Move energy from another string to this
- [ ] **Foresight**: Rearrange top 3 of opponent's deck
- [ ] **Seal Attack**: Standard damage
- [ ] **Open Strings**: 10 damage, draw card, if energy attach it
- [ ] **VocaRock!!**: 20 damage, +50 if Miku Otamatone attached
- [ ] **Midday Nap**: Heal 20 damage
- [ ] **You know what it is**: Already exists
- [ ] **Vibrato**: Standard damage (already exists)
- [ ] **440 Hz**: Already exists
- [ ] **Song Voting**: Updated complex version needed
- [ ] **Gacha Gaming**: Draw cards taking damage, complex mechanics

**WOODWINDS**
- [ ] **Overblow**: 40 damage, 10 recoil
- [ ] **Analysis Paralysis**: Reveal hand, shuffle one back
- [ ] **Multiphonics**: Flip 2 coins, 40 to bench or 80 to active (already exists)
- [ ] **Speedrun Central**: 20 damage, +40 if came off bench this turn
- [ ] **Trickster**: Complex turn-delayed damage
- [ ] **Sparkling run**: 20 damage, heal 20
- [ ] **Banana Bread for Everyone!**: Heal 30 all, discard energy
- [ ] **Wipeout**: 60 damage to 3 different (including self)
- [ ] **Clarinet Solo/Piccolo Solo**: 80 damage if only WW in play
- [ ] **Circular Breathing**: Already exists
- [ ] **SN2**: 20 damage, shuffle bench back (if bench not full)
- [ ] **Outreach**: Search for character, put on top of deck
- [ ] **SE lord**: Heal opponent's bench, damage active by that amount
- [ ] **Artist Alley**: Already exists

## Passive Abilities Still Needing Implementation

### Character-Specific Abilities

**High Priority**
- [ ] **Barron Lee - Get Served**: Opponent's active max 3 energy
- [ ] **Yanwan Zhu - Bass Boost**: If has 2 Guitar energy, draw after attack
- [ ] **Ross Williams - I Am Become Ross**: Active can use Ross's attacks from bench
- [ ] **Happy Ruth - Leave Rehearsal Early**: Return to hand if no attachments
- [ ] **Meya Gao - I See Your Soul**: Both can't attack next turn if damaged
- [ ] **Eugenia Ampofo - Fermentation**: Attach 3 energy instead of 1
- [ ] **Luke Xu - Nullify**: Benched this turn → opponent abilities off
- [ ] **Katie Xiang - Nausicaa's Undying Heartbeat**: At ≤40 HP, heal 20 all
- [ ] **Demi Lu - Steinert Warrior**: Immune on bench if Steinert stadium
- [ ] **David Man - Reverse Heist**: Shuffle discard, pull items/tools
- [ ] **Matthew Wang - Pot of Greed**: Flip coin at turn start, heads = draw
- [ ] **Sophia Wang - Original is Better**: First energy attach → opp discards
- [ ] **Ina Ma - Borrow**: Move energy from another string
- [ ] **Jessica Jung - Cleric Spell**: Shuffle one discard back to deck
- [ ] **Emily Wang - Profit Margins**: Already exists
- [ ] **Yuelin Hu - Musical Cat**: Draw AVGE birb → discard + 30 damage
- [ ] **Alice Wang - Euclidean Algorithm**: Hand size equalization
- [ ] **Weston Poe - Right back at you**: Reflect 50+ damage
- [ ] **Felix Chen - Synesthesia**: One Woodwind energy as any type
- [ ] **Jayden Brown - Four-leaf Clover**: First coin flip = choose heads
- [ ] **Daniel Zhu - Share the Pain**: Redirect up to 20 damage
- [ ] **Anna Brown - Do Not Disturb**: On bench, reduce damage by 30
- [ ] **Bokai Bi - Algorithm**: Opponent plays duplicate → 50 damage

## Stadium Updates Needed

The stadiums have been updated in cards.js. Need to verify:
- [x] Riley Hall
- [x] Alumnae Hall
- [x] Main Hall
- [x] Salomon DECI
- [x] Red Room
- [x] Lindemann
- [x] Petteruti (updated with Matcha Maid Cafe effect)
- [ ] Steinert Practice Room (verify 2 bench limit)
- [ ] Steinert Basement Studio (verify 15 Minute Walk - +1 energy cost)
- [x] Friedman Hall

## Implementation Priority

### Immediate (Game-Breaking if Missing)
1. **Barron Lee - Get Served**: Prevents energy stacking
2. **Eugenia Ampofo - Fermentation**: Triple energy attachment
3. **Katie Xiang - Nausicaa's Undying Heartbeat**: Mass healing trigger
4. **Luke Xu - Nullify**: Ability shutdown

### High (Commonly Used Moves)
1. **Embouchure**: Energy movement
2. **Drain**: Healing mechanic
3. **Domain Expansion**: Board wipe
4. **Ominous Chimes**: Delayed damage
5. **Snowball Effect**: RNG damage
6. **Packet Loss**: Energy removal
7. **Distortion**: Turn-delayed buff

### Medium (Complex Mechanics)
1. **Heart of the Cards**: Card prediction
2. **Ross Attack!**: Conditional bench effect
3. **Gacha Gaming**: Draw/damage/heal combo
4. **Song Voting**: Card reveal mechanic
5. **Drum Kid Workshop**: Attack copying
6. **Tricky Rhythms**: Energy manipulation

### Low (Edge Cases)
1. **Synesthesia**: Energy type conversion
2. **Share the Pain**: Damage redirection
3. **Algorithm**: Duplicate detection
4. **Right back at you**: Damage reflection

## Testing Checklist

Once implementations are complete:
- [ ] Test each type of character in battle
- [ ] Verify damage calculations match card text
- [ ] Test passive abilities trigger correctly
- [ ] Test move special effects work
- [ ] Verify energy costs are correct
- [ ] Test stadium effects
- [ ] Test tool/item interactions
- [ ] Test win conditions still work

## Notes

- Many moves have similar patterns (standard damage, coin flips, energy manipulation)
- Helper functions may be needed for:
  - Coin flipping with optional control (Four-leaf Clover)
  - Energy manipulation (moving, discarding, conditional)
  - Delayed effects (next turn bonuses/penalties)
  - Bench character selection
  - Hand/deck manipulation
- Some abilities require UI modals for selection (already exist for some moves)
- Consider creating a "move effect library" for common patterns
