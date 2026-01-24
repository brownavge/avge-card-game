import { buildDeck } from './storage/DeckManager.js';

try {
    console.log('Building strings-aggro...');
    const deck1 = buildDeck('strings-aggro');
    console.log('✓ strings-aggro built:', deck1.length, 'cards');
} catch (e) {
    console.error('✗ strings-aggro error:', e.message);
}

try {
    console.log('\nBuilding piano-control...');
    const deck2 = buildDeck('piano-control');
    console.log('✓ piano-control built:', deck2.length, 'cards');
} catch (e) {
    console.error('✗ piano-control error:', e.message);
}

try {
    console.log('\nBuilding guitar-rock...');
    const deck3 = buildDeck('guitar-rock');
    console.log('✓ guitar-rock built:', deck3.length, 'cards');
} catch (e) {
    console.error('✗ guitar-rock error:', e.message);
}

try {
    console.log('\nBuilding percussion-midrange...');
    const deck4 = buildDeck('percussion-midrange');
    console.log('✓ percussion-midrange built:', deck4.length, 'cards');
} catch (e) {
    console.error('✗ percussion-midrange error:', e.message);
}

try {
    console.log('\nBuilding choir-support...');
    const deck5 = buildDeck('choir-support');
    console.log('✓ choir-support built:', deck5.length, 'cards');
} catch (e) {
    console.error('✗ choir-support error:', e.message);
}

try {
    console.log('\nBuilding brass-tempo...');
    const deck6 = buildDeck('brass-tempo');
    console.log('✓ brass-tempo built:', deck6.length, 'cards');
} catch (e) {
    console.error('✗ brass-tempo error:', e.message);
}

try {
    console.log('\nBuilding toolbox...');
    const deck7 = buildDeck('toolbox');
    console.log('✓ toolbox built:', deck7.length, 'cards');
} catch (e) {
    console.error('✗ toolbox error:', e.message);
}


