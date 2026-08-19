// ── Medium AI: Solid heuristic play ──
// Follows basic trick-taking strategy:
// - Leads strong suits, avoids leading trump early
// - Tries to win tricks cheaply when needed for quota
// - Dumps weak cards when can't/shouldn't win
// - Reasonable trump and pluck decisions

import type { Card, Suit } from '../card.js';
import type { GameState } from '../types.js';
import type { AIStrategy } from './types.js';
import { effectiveSuit } from '../card.js';
import {
  bestTrumpSuit,
  weakestCard,
  strongestCard,
  cheapestWinner,
  currentTrickBest,
  tricksNeeded,
  isLeading,
  isLastToPlay,
  trumpCards,
  suitCounts,
} from './helpers.js';

export class MediumAI implements AIStrategy {
  pickCard(legalMoves: Card[], state: GameState, playerId: string): Card {
    if (legalMoves.length === 1) return legalMoves[0];

    const trumpSuit = state.trumpSuit!;
    const needed = tricksNeeded(state, playerId);

    // ── Leading a trick ──
    if (isLeading(state)) {
      return this.pickLead(legalMoves, trumpSuit, needed);
    }

    // ── Following / responding ──
    const ledSuit = state.currentTrick.ledSuit!;
    const bestInTrick = currentTrickBest(state);

    // Need tricks? Try to win cheaply.
    if (needed > 0) {
      const winner = cheapestWinner(legalMoves, bestInTrick, trumpSuit, ledSuit);
      if (winner) return winner;

      // Can't win with in-suit cards — consider trumping
      const myTrump = trumpCards(legalMoves, trumpSuit);
      if (myTrump.length > 0 && ledSuit !== trumpSuit) {
        const cheapTrump = cheapestWinner(myTrump, bestInTrick, trumpSuit, ledSuit);
        if (cheapTrump) return cheapTrump;
      }
    }

    // Don't need more tricks or can't win — dump weakest
    // If last player and partner is winning (4p), don't trump over them
    if (isLastToPlay(state) && needed <= 0) {
      return weakestCard(legalMoves, trumpSuit);
    }

    // Default: dump weakest
    return weakestCard(legalMoves, trumpSuit);
  }

  private pickLead(legalMoves: Card[], trumpSuit: Suit, needed: number): Card {
    // Separate trump vs non-trump
    const nonTrump = legalMoves.filter(c => effectiveSuit(c, trumpSuit) !== trumpSuit);
    const trump = legalMoves.filter(c => effectiveSuit(c, trumpSuit) === trumpSuit);

    if (needed > 0) {
      // Need tricks: lead high cards from strong non-trump suits
      if (nonTrump.length > 0) {
        // Find aces (guaranteed winners if not trumped)
        const aces = nonTrump.filter(c => c.type === 'suited' && c.rank === 'A');
        if (aces.length > 0) return aces[0];

        // Lead from longest suit
        const counts = suitCounts(nonTrump);
        let longestSuit: Suit = 'spades';
        let longest = 0;
        for (const [suit, count] of Object.entries(counts) as [Suit, number][]) {
          if (suit !== trumpSuit && count > longest) {
            longest = count;
            longestSuit = suit;
          }
        }
        const suitCards = nonTrump.filter(
          c => c.type === 'suited' && c.suit === longestSuit
        );
        if (suitCards.length > 0) {
          // Lead highest from longest suit
          return strongestCard(suitCards, trumpSuit, longestSuit);
        }
      }

      // Only trump left — lead high trump
      if (trump.length > 0) {
        return strongestCard(trump, trumpSuit, trumpSuit);
      }
    }

    // Don't need tricks: lead weakest non-trump
    if (nonTrump.length > 0) {
      return weakestCard(nonTrump, trumpSuit);
    }

    // Only trump: lead lowest
    return weakestCard(trump, trumpSuit);
  }

  pickTrump(hand: Card[], _state: GameState, _playerId: string): Suit {
    return bestTrumpSuit(hand);
  }

  pickPluckGive(legalCards: Card[], state: GameState, pluckerId: string): Card {
    // Smart pluck: give a low card from a suit where we have a lot of cards
    // This way we get back a high card from that suit, strengthening our hand
    const hand = state.hands.get(pluckerId) ?? [];
    const counts = suitCounts(hand);

    // Find the suit where we have the most cards
    let bestSuit: Suit = 'clubs';
    let bestCount = 0;
    for (const [suit, count] of Object.entries(counts) as [Suit, number][]) {
      if (count > bestCount) {
        bestCount = count;
        bestSuit = suit;
      }
    }

    // Give the lowest card of that suit
    const suitCards = legalCards.filter(
      c => c.type === 'suited' && c.suit === bestSuit
    );
    if (suitCards.length > 0) {
      return weakestCard(suitCards);
    }

    // Fallback: give weakest card overall
    return weakestCard(legalCards);
  }
}
