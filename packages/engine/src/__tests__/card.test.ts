import { describe, it, expect } from 'vitest';
import {
  suited,
  joker,
  cardId,
  cardsEqual,
  cardDisplay,
  cardStrength,
  effectiveSuit,
  createThreePlayerDeck,
  createFourPlayerDeck,
  deal,
  hasTwoOfClubs,
  cardsOfSuit,
  sortHand,
  rankValue,
} from '../card.js';

describe('Card constructors', () => {
  it('creates suited cards', () => {
    const card = suited('hearts', 'A');
    expect(card.type).toBe('suited');
    expect(card.suit).toBe('hearts');
    expect(card.rank).toBe('A');
  });

  it('creates jokers', () => {
    const big = joker('big');
    expect(big.type).toBe('joker');
    expect(big.kind).toBe('big');
  });
});

describe('Card identity', () => {
  it('generates unique IDs', () => {
    expect(cardId(suited('hearts', 'A'))).toBe('A:hearts');
    expect(cardId(joker('big'))).toBe('joker:big');
  });

  it('compares cards correctly', () => {
    expect(cardsEqual(suited('hearts', 'A'), suited('hearts', 'A'))).toBe(true);
    expect(cardsEqual(suited('hearts', 'A'), suited('spades', 'A'))).toBe(false);
    expect(cardsEqual(joker('big'), joker('big'))).toBe(true);
    expect(cardsEqual(joker('big'), joker('little'))).toBe(false);
  });
});

describe('Card display', () => {
  it('displays suited cards', () => {
    expect(cardDisplay(suited('hearts', 'A'))).toBe('A♥');
    expect(cardDisplay(suited('clubs', '2'))).toBe('2♣');
  });

  it('displays jokers', () => {
    expect(cardDisplay(joker('big'))).toBe('🃏 Big Joker');
    expect(cardDisplay(joker('little'))).toBe('🃏 Little Joker');
  });
});

describe('Card strength', () => {
  it('jokers are strongest trump', () => {
    const bigStrength = cardStrength(joker('big'), 'hearts', 'clubs');
    const littleStrength = cardStrength(joker('little'), 'hearts', 'clubs');
    const aceOfTrump = cardStrength(suited('hearts', 'A'), 'hearts', 'clubs');

    expect(bigStrength).toBeGreaterThan(littleStrength);
    expect(littleStrength).toBeGreaterThan(aceOfTrump);
  });

  it('trump beats non-trump', () => {
    const trump3 = cardStrength(suited('hearts', '3'), 'hearts', 'clubs');
    const nonTrumpAce = cardStrength(suited('clubs', 'A'), 'hearts', 'clubs');

    expect(trump3).toBeGreaterThan(nonTrumpAce);
  });

  it('off-suit non-trump scores zero', () => {
    const offSuit = cardStrength(suited('diamonds', 'A'), 'hearts', 'clubs');
    expect(offSuit).toBe(0);
  });

  it('led suit cards rank by value', () => {
    const ace = cardStrength(suited('clubs', 'A'), 'hearts', 'clubs');
    const king = cardStrength(suited('clubs', 'K'), 'hearts', 'clubs');
    expect(ace).toBeGreaterThan(king);
  });
});

describe('Effective suit', () => {
  it('jokers belong to trump suit', () => {
    expect(effectiveSuit(joker('big'), 'hearts')).toBe('hearts');
    expect(effectiveSuit(joker('little'), 'spades')).toBe('spades');
  });

  it('suited cards keep their suit', () => {
    expect(effectiveSuit(suited('clubs', 'A'), 'hearts')).toBe('clubs');
  });
});

describe('Deck construction', () => {
  it('3-player deck has 51 cards', () => {
    const deck = createThreePlayerDeck();
    expect(deck).toHaveLength(51);
  });

  it('3-player deck has no 2♥, 2♦, 2♠ but keeps 2♣', () => {
    const deck = createThreePlayerDeck();
    const twos = deck.filter(
      c => c.type === 'suited' && c.rank === '2'
    );
    expect(twos).toHaveLength(1);
    expect(twos[0].type === 'suited' && twos[0].suit).toBe('clubs');
  });

  it('3-player deck has both jokers', () => {
    const deck = createThreePlayerDeck();
    const jokers = deck.filter(c => c.type === 'joker');
    expect(jokers).toHaveLength(2);
  });

  it('4-player deck has 52 cards, no jokers', () => {
    const deck = createFourPlayerDeck();
    expect(deck).toHaveLength(52);
    const jokers = deck.filter(c => c.type === 'joker');
    expect(jokers).toHaveLength(0);
  });
});

describe('Deal', () => {
  it('deals 17 cards each for 3 players', () => {
    const deck = createThreePlayerDeck();
    const hands = deal(deck, 3);
    expect(hands).toHaveLength(3);
    for (const hand of hands) {
      expect(hand).toHaveLength(17);
    }
  });

  it('deals 13 cards each for 4 players', () => {
    const deck = createFourPlayerDeck();
    const hands = deal(deck, 4);
    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(13);
    }
  });

  it('deals all unique cards', () => {
    const deck = createThreePlayerDeck();
    const hands = deal(deck, 3);
    const allCards = hands.flat();
    const ids = new Set(allCards.map(c => cardId(c)));
    expect(ids.size).toBe(51);
  });
});

describe('Hand utilities', () => {
  it('hasTwoOfClubs detects correctly', () => {
    const hand = [suited('clubs', '2'), suited('hearts', 'A')];
    expect(hasTwoOfClubs(hand)).toBe(true);

    const noTwo = [suited('clubs', 'A'), suited('hearts', 'A')];
    expect(hasTwoOfClubs(noTwo)).toBe(false);
  });

  it('cardsOfSuit filters correctly', () => {
    const hand = [
      suited('hearts', 'A'),
      suited('hearts', 'K'),
      suited('clubs', '3'),
      joker('big'),
    ];
    const hearts = cardsOfSuit(hand, 'hearts');
    expect(hearts).toHaveLength(2);
  });

  it('cardsOfSuit includes jokers when filtering trump', () => {
    const hand = [
      suited('hearts', 'A'),
      joker('big'),
      joker('little'),
      suited('clubs', '3'),
    ];
    const trumpCards = cardsOfSuit(hand, 'hearts', 'hearts');
    expect(trumpCards).toHaveLength(3); // A♥ + both jokers
  });

  it('sortHand groups by suit and orders by rank', () => {
    const hand = [
      suited('hearts', '3'),
      suited('clubs', 'A'),
      suited('hearts', 'A'),
      suited('clubs', 'K'),
    ];
    const sorted = sortHand(hand);
    // Spades first, then hearts, then diamonds, then clubs
    expect(sorted[0]).toEqual(suited('hearts', 'A'));
    expect(sorted[1]).toEqual(suited('hearts', '3'));
    expect(sorted[2]).toEqual(suited('clubs', 'A'));
    expect(sorted[3]).toEqual(suited('clubs', 'K'));
  });
});
