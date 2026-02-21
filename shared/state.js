import { CHARACTERS, ITEMS, TOOLS, SUPPORTERS, STADIUMS } from '../cards.js';

export function createGameState({ deck1Name, deck2Name, playtestMode = false, seed = null }) {
  return {
    version: 1,
    turn: 1,
    currentPlayer: 1,
    playtestMode,
    randomSeed: seed ?? Date.now(),
    randomState: (seed ?? Date.now()) >>> 0,
    players: {
      1: createPlayerState(deck1Name),
      2: createPlayerState(deck2Name)
    },
    stadium: null,
    log: []
  };
}

export function createPlayerState(deckName) {
  return {
    deckName,
    hand: [],
    deck: [],
    discard: [],
    active: null,
    bench: [null, null, null],
    koCount: 0
  };
}

export function applyAction(state, action) {
  if (!action) return state;
  if (action.type === 'STATE_SNAPSHOT' && action.payload && action.payload.state) {
    return action.payload.state;
  }
  switch (action.type) {
    case 'NOOP':
      return state;
    default:
      throw new Error(`Unhandled action: ${action.type}`);
  }
}

export const CARD_POOLS = {
  CHARACTERS,
  ITEMS,
  TOOLS,
  SUPPORTERS,
  STADIUMS
};
