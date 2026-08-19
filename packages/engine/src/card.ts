// ── Card types and deck construction ──

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10',
  'J', 'Q', 'K', 'A',
] as const;
export type Rank = (typeof RANKS)[number];

export type JokerKind = 'big' | 'little';

/** A card is either a suited card or a joker */
export type Card =
  | { type: 'suited'; suit: Suit; rank: Rank }
  | { type: 'joker'; kind: JokerKind };

// ── Constructors ──

export function suited(suit: Suit, rank: Rank): Card {
  return { type: 'suited', suit, rank };
}

export function joker(kind: JokerKind): Card {
  return { type: 'joker', kind };
}

// ── Card identity ──

export function cardId(card: Card): string {
  if (card.type === 'joker') return `joker:${card.kind}`;
  return `${card.rank}:${card.suit}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return cardId(a) === cardId(b);
}

export function cardDisplay(card: Card): string {
  if (card.type === 'joker') {
    return card.kind === 'big' ? '🃏 Big Joker' : '🃏 Little Joker';
  }
  const suitSymbol: Record<Suit, string> = {
    clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠',
  };
  return `${card.rank}${suitSymbol[card.suit]}`;
}

// ── Rank ordering ──

const RANK_ORDER: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export function rankValue(rank: Rank): number {
  return RANK_ORDER[rank];
}

// ── Card comparison (within a trick context) ──

/**
 * Returns a numeric score for a card within the context of a trick.
 * Higher = stronger.
 *
 * Trump cards beat non-trump cards. Jokers are the highest trump.
 * Among non-trump, only cards matching `ledSuit` can win.
 */
export function cardStrength(
  card: Card,
  trumpSuit: Suit,
  ledSuit: Suit,
): number {
  if (card.type === 'joker') {
    // Jokers are always the top two trump cards
    return card.kind === 'big' ? 200 : 199;
  }

  if (card.suit === trumpSuit) {
    // Trump cards: 100 + rank value
    return 100 + rankValue(card.rank);
  }

  if (card.suit === ledSuit) {
    // Led suit (not trump): rank value
    return rankValue(card.rank);
  }

  // Off-suit, non-trump: can never win
  return 0;
}

/**
 * Get the effective suit of a card (jokers belong to trump suit).
 */
export function effectiveSuit(card: Card, trumpSuit: Suit): Suit {
  if (card.type === 'joker') return trumpSuit;
  return card.suit;
}

// ── Deck construction ──

/**
 * Build the 3-player PLUCK deck (51 cards).
 * Standard 52 minus 2♥, 2♦, 2♠, plus Big Joker and Little Joker.
 */
export function createThreePlayerDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      // Only keep the 2 of clubs
      if (rank === '2' && suit !== 'clubs') continue;
      deck.push(suited(suit, rank));
    }
  }

  deck.push(joker('big'));
  deck.push(joker('little'));

  return deck; // 51 cards
}

/**
 * Build the 4-player PLUCK deck (52 cards, no jokers).
 * Standard 52-card deck.
 */
export function createFourPlayerDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(suited(suit, rank));
    }
  }

  return deck; // 52 cards
}

// ── Shuffle (Fisher-Yates) ──

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Deal cards evenly to N players.
 * Returns an array of hands (one per player).
 */
export function deal(deck: Card[], playerCount: number): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  const shuffled = shuffle(deck);

  for (let i = 0; i < shuffled.length; i++) {
    hands[i % playerCount].push(shuffled[i]);
  }

  return hands;
}

// ── Hand utilities ──

/** Get all cards of a specific suit in a hand (jokers match trump) */
export function cardsOfSuit(hand: Card[], suit: Suit, trumpSuit?: Suit): Card[] {
  return hand.filter(card => {
    if (card.type === 'joker') return trumpSuit !== undefined && suit === trumpSuit;
    return card.suit === suit;
  });
}

/** Check if a hand contains the 2 of clubs */
export function hasTwoOfClubs(hand: Card[]): boolean {
  return hand.some(c => c.type === 'suited' && c.suit === 'clubs' && c.rank === '2');
}

/** Sort a hand by suit then rank for display */
export function sortHand(hand: Card[], trumpSuit?: Suit): Card[] {
  const suitOrder: Record<Suit, number> = {
    spades: 0, hearts: 1, diamonds: 2, clubs: 3,
  };

  return [...hand].sort((a, b) => {
    // Jokers first
    if (a.type === 'joker' && b.type === 'joker') {
      return a.kind === 'big' ? -1 : 1;
    }
    if (a.type === 'joker') return -1;
    if (b.type === 'joker') return 1;

    // Trump suit first if declared
    if (trumpSuit) {
      const aIsTrump = a.suit === trumpSuit;
      const bIsTrump = b.suit === trumpSuit;
      if (aIsTrump && !bIsTrump) return -1;
      if (!aIsTrump && bIsTrump) return 1;
    }

    // Then by suit
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) return suitDiff;

    // Then by rank (high to low)
    return rankValue(b.rank) - rankValue(a.rank);
  });
}
