// ── AI helper utilities ──

import {
  type Card,
  type Suit,
  SUITS,
  rankValue,
  effectiveSuit,
  cardStrength,
} from '../card.js';
import type { GameState } from '../types.js';
import { getQuota3Player, getQuota4Player } from '../types.js';

/** Count cards of each suit in a hand (jokers counted toward trump if known) */
export function suitCounts(hand: Card[], trumpSuit?: Suit): Record<Suit, number> {
  const counts: Record<Suit, number> = { clubs: 0, diamonds: 0, hearts: 0, spades: 0 };
  for (const card of hand) {
    if (card.type === 'joker') {
      if (trumpSuit) counts[trumpSuit]++;
    } else {
      counts[card.suit]++;
    }
  }
  return counts;
}

/** Sum rank values for cards of a given suit */
export function suitStrength(hand: Card[], suit: Suit): number {
  let total = 0;
  for (const card of hand) {
    if (card.type === 'joker') {
      total += 15; // Jokers are valuable in any trump
    } else if (card.suit === suit) {
      total += rankValue(card.rank);
    }
  }
  return total;
}

/** Get the best suit to declare as trump (most cards, then strongest) */
export function bestTrumpSuit(hand: Card[]): Suit {
  const counts = suitCounts(hand);
  let bestSuit: Suit = 'spades';
  let bestScore = -1;

  for (const suit of SUITS) {
    // Score = count * 20 + total rank values
    const score = counts[suit] * 20 + suitStrength(hand, suit);
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }
  return bestSuit;
}

/** Get the weakest card in hand (lowest rank, non-trump preferred) */
export function weakestCard(cards: Card[], trumpSuit?: Suit): Card {
  let worst = cards[0];
  let worstScore = Infinity;

  for (const card of cards) {
    let score: number;
    if (card.type === 'joker') {
      score = 200; // Never throw away jokers
    } else {
      score = rankValue(card.rank);
      if (trumpSuit && card.suit === trumpSuit) score += 100; // Protect trump
    }
    if (score < worstScore) {
      worstScore = score;
      worst = card;
    }
  }
  return worst;
}

/** Get the strongest card from a list */
export function strongestCard(cards: Card[], trumpSuit: Suit, ledSuit: Suit): Card {
  let best = cards[0];
  let bestScore = -1;

  for (const card of cards) {
    const score = cardStrength(card, trumpSuit, ledSuit);
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}

/** Find the cheapest card that still wins the current trick */
export function cheapestWinner(
  cards: Card[],
  currentBest: number,
  trumpSuit: Suit,
  ledSuit: Suit,
): Card | null {
  let winner: Card | null = null;
  let winnerScore = Infinity;

  for (const card of cards) {
    const score = cardStrength(card, trumpSuit, ledSuit);
    if (score > currentBest && score < winnerScore) {
      winnerScore = score;
      winner = card;
    }
  }
  return winner;
}

/** Get the current best strength in a trick */
export function currentTrickBest(state: GameState): number {
  if (!state.trumpSuit || !state.currentTrick.ledSuit) return -1;
  let best = -1;
  for (const play of state.currentTrick.plays) {
    const s = cardStrength(play.card, state.trumpSuit, state.currentTrick.ledSuit);
    if (s > best) best = s;
  }
  return best;
}

/** How many tricks does this player still need to hit quota? */
export function tricksNeeded(state: GameState, playerId: string): number {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 0;

  let quota: number;
  if (state.config.mode === 'three-player') {
    quota = getQuota3Player(player.position, state.dealerIndex);
  } else {
    const callingTeam = state.players[state.callerIndex ?? 0].team ?? 0;
    quota = getQuota4Player(player.team ?? 0, callingTeam);
  }

  const won = state.tricksWon.get(playerId) ?? 0;
  return Math.max(0, quota - won);
}

/** How many tricks remain in the hand? */
export function tricksRemaining(state: GameState): number {
  const total = state.config.mode === 'three-player' ? 17 : 13;
  return total - state.trickNumber;
}

/** Is this player currently leading the trick? */
export function isLeading(state: GameState): boolean {
  return state.currentTrick.plays.length === 0;
}

/** Is this player the last to play in the trick? */
export function isLastToPlay(state: GameState): boolean {
  const playersInTrick = state.config.mode === 'three-player' ? 3 : 4;
  return state.currentTrick.plays.length === playersInTrick - 1;
}

/** Get cards of the led suit from hand */
export function followSuitCards(hand: Card[], ledSuit: Suit, trumpSuit: Suit): Card[] {
  return hand.filter(c => effectiveSuit(c, trumpSuit) === ledSuit);
}

/** Get non-trump, non-led-suit cards (throwaway candidates) */
export function offSuitCards(hand: Card[], ledSuit: Suit, trumpSuit: Suit): Card[] {
  return hand.filter(c => {
    const s = effectiveSuit(c, trumpSuit);
    return s !== ledSuit && s !== trumpSuit;
  });
}

/** Get trump cards from hand */
export function trumpCards(hand: Card[], trumpSuit: Suit): Card[] {
  return hand.filter(c => effectiveSuit(c, trumpSuit) === trumpSuit);
}

/** Pick a suit where the player has few cards (good for pluck targeting) */
export function shortSuit(hand: Card[], excludeSuit?: Suit): Suit | null {
  const counts = suitCounts(hand);
  let shortest: Suit | null = null;
  let shortestCount = Infinity;

  for (const suit of SUITS) {
    if (suit === excludeSuit) continue;
    if (counts[suit] > 0 && counts[suit] < shortestCount) {
      shortestCount = counts[suit];
      shortest = suit;
    }
  }
  return shortest;
}
