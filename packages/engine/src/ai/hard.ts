// ── Hard AI: Card-counting, quota-aware, strategic play ──
// - Tracks played cards to infer opponent holdings
// - Calculates probability of winning each trick
// - Manages trump resources carefully
// - Makes quota-aware decisions (sacrifice vs push)
// - Advanced pluck strategy (target opponent weaknesses)
// - Endgame trick counting

import type { Card, Suit } from '../card.js';
import type { GameState } from '../types.js';
import type { AIStrategy } from './types.js';
import {
  rankValue,
  effectiveSuit,
  cardId,
  SUITS,
  RANKS,
  suited,
  joker,
} from '../card.js';
import {
  weakestCard,
  strongestCard,
  cheapestWinner,
  currentTrickBest,
  tricksNeeded,
  tricksRemaining,
  isLeading,
  isLastToPlay,
  suitCounts,
  trumpCards,
  offSuitCards,
} from './helpers.js';

export class HardAI implements AIStrategy {
  /** Track which cards have been played (card IDs) */
  private playedCards: Set<string> = new Set();

  pickCard(legalMoves: Card[], state: GameState, playerId: string): Card {
    if (legalMoves.length === 1) return legalMoves[0];

    // Update card tracking from trick history
    this.updatePlayedCards(state);

    const trumpSuit = state.trumpSuit!;
    const needed = tricksNeeded(state, playerId);
    const remaining = tricksRemaining(state);
    if (isLeading(state)) {
      return this.pickLead(legalMoves, trumpSuit, needed, remaining, state);
    }

    return this.pickFollow(legalMoves, trumpSuit, needed, remaining, state);
  }

  private pickLead(
    legalMoves: Card[],
    trumpSuit: Suit,
    needed: number,
    remaining: number,
    state: GameState,
  ): Card {
    const nonTrump = legalMoves.filter(c => effectiveSuit(c, trumpSuit) !== trumpSuit);
    const trump = legalMoves.filter(c => effectiveSuit(c, trumpSuit) === trumpSuit);

    // ── Endgame: if we need all remaining tricks, lead trump to flush ──
    if (needed > 0 && needed >= remaining - 1 && trump.length > 0) {
      // Lead highest trump to pull out opponents' trump
      return strongestCard(trump, trumpSuit, trumpSuit);
    }

    // ── Already met quota: dump off weak cards ──
    if (needed <= 0) {
      if (nonTrump.length > 0) return weakestCard(nonTrump, trumpSuit);
      return weakestCard(trump, trumpSuit);
    }

    // ── Need tricks: find "safe" leads ──

    // Lead guaranteed winners first (cards that can't be beaten)
    const guaranteed = this.findGuaranteedWinners(legalMoves, trumpSuit, state);
    if (guaranteed.length > 0) {
      return guaranteed[0]; // Play a guaranteed winner
    }

    // Lead aces of non-trump (likely winners early in the hand)
    if (nonTrump.length > 0) {
      const aces = nonTrump.filter(c => c.type === 'suited' && c.rank === 'A');
      if (aces.length > 0) {
        // Lead ace of a suit where opponents likely have cards (to win the trick)
        const bestAce = this.bestAceToLead(aces, state);
        if (bestAce) return bestAce;
      }

      // Lead from a long suit (higher chance of controlling it)
      const counts = suitCounts(nonTrump);
      let longestSuit: Suit | null = null;
      let longest = 0;
      for (const [suit, count] of Object.entries(counts) as [Suit, number][]) {
        if (suit !== trumpSuit && count > longest) {
          longest = count;
          longestSuit = suit;
        }
      }

      if (longestSuit) {
        const suitCards = nonTrump.filter(
          c => c.type === 'suited' && c.suit === longestSuit
        );
        // Lead high card from long suit
        return strongestCard(suitCards, trumpSuit, longestSuit);
      }
    }

    // Lead trump strategically
    if (trump.length > 0) {
      // If we have lots of trump, lead high to flush out opponents' trump
      if (trump.length >= 4) {
        return strongestCard(trump, trumpSuit, trumpSuit);
      }
      // Otherwise lead low trump
      return weakestCard(trump, trumpSuit);
    }

    return weakestCard(legalMoves, trumpSuit);
  }

  private pickFollow(
    legalMoves: Card[],
    trumpSuit: Suit,
    needed: number,
    remaining: number,
    state: GameState,
  ): Card {
    const ledSuit = state.currentTrick.ledSuit!;
    const bestInTrick = currentTrickBest(state);
    const lastPlayer = isLastToPlay(state);

    // ── Following suit ──
    const inSuit = legalMoves.filter(c => effectiveSuit(c, trumpSuit) === ledSuit);

    if (inSuit.length > 0) {
      if (needed > 0) {
        // Try to win cheaply
        const winner = cheapestWinner(inSuit, bestInTrick, trumpSuit, ledSuit);
        if (winner) return winner;

        // Can't win in-suit — play lowest (save high cards for later)
        return weakestCard(inSuit, trumpSuit);
      }

      // Don't need tricks — play lowest in suit
      return weakestCard(inSuit, trumpSuit);
    }

    // ── Void in led suit: can play anything ──

    if (needed > 0) {
      // Should we trump in?
      const myTrump = trumpCards(legalMoves, trumpSuit);
      if (myTrump.length > 0) {
        // Last to play: trump with cheapest winner
        if (lastPlayer) {
          const winner = cheapestWinner(myTrump, bestInTrick, trumpSuit, ledSuit);
          if (winner) return winner;
        }

        // Not last: trump if we really need tricks and have plenty of trump
        if (myTrump.length >= 3 || needed >= remaining - 1) {
          const winner = cheapestWinner(myTrump, bestInTrick, trumpSuit, ledSuit);
          if (winner) return winner;
        }
      }

      // Can't/shouldn't trump — dump weakest off-suit card
      const offSuit = offSuitCards(legalMoves, ledSuit, trumpSuit);
      if (offSuit.length > 0) return weakestCard(offSuit, trumpSuit);
    }

    // Don't need tricks — dump weakest, avoid wasting trump
    const nonTrump = legalMoves.filter(c => effectiveSuit(c, trumpSuit) !== trumpSuit);
    if (nonTrump.length > 0) return weakestCard(nonTrump, trumpSuit);

    return weakestCard(legalMoves, trumpSuit);
  }

  /** Find cards that are guaranteed to win (no higher unplayed cards exist) */
  private findGuaranteedWinners(cards: Card[], trumpSuit: Suit, _state: GameState): Card[] {
    const winners: Card[] = [];

    for (const card of cards) {
      if (card.type === 'joker' && card.kind === 'big') {
        winners.push(card); // Big joker always wins
        continue;
      }

      if (card.type === 'joker' && card.kind === 'little') {
        // Little joker wins if big joker has been played
        if (this.playedCards.has(cardId(joker('big')))) {
          winners.push(card);
        }
        continue;
      }

      if (card.type === 'suited') {
        const suit = card.suit;

        // For trump cards: check if all higher trump + jokers are played
        if (suit === trumpSuit) {
          const isHighest = this.isHighestRemainingOfSuit(card, trumpSuit, true);
          if (isHighest) winners.push(card);
          continue;
        }

        // For non-trump leads: guaranteed if it's the highest remaining of its suit
        // AND opponents might not be void (can't check this perfectly)
        if (this.isHighestRemainingOfSuit(card, suit, false)) {
          winners.push(card);
        }
      }
    }

    return winners;
  }

  /** Check if a card is the highest remaining (unplayed) of its suit */
  private isHighestRemainingOfSuit(card: Card, suit: Suit, _includeTrumpAbove: boolean): boolean {
    if (card.type !== 'suited') return false;

    // Check for higher cards of same suit that haven't been played
    for (const rank of RANKS) {
      if (rankValue(rank) > rankValue(card.rank)) {
        const higherCard = suited(suit, rank);
        // Skip cards that don't exist in the deck (2s other than 2♣ in 3p mode)
        if (rank === '2' && suit !== 'clubs') continue;
        if (!this.playedCards.has(cardId(higherCard))) {
          return false; // Higher card still out there
        }
      }
    }

    // For trump suit, also check jokers
    if (_includeTrumpAbove) {
      if (!this.playedCards.has(cardId(joker('big')))) return false;
      if (!this.playedCards.has(cardId(joker('little')))) return false;
    }

    return true;
  }

  /** Pick the best ace to lead based on card tracking */
  private bestAceToLead(aces: Card[], _state: GameState): Card | null {
    // Prefer aces where opponents likely still have cards of that suit
    // (so the trick generates followers, not voids/trump-ins)
    let bestAce: Card | null = null;
    let bestRemaining = 0;

    for (const ace of aces) {
      if (ace.type !== 'suited') continue;
      const remaining = this.countRemainingInSuit(ace.suit, _state);
      if (remaining > bestRemaining) {
        bestRemaining = remaining;
        bestAce = ace;
      }
    }

    return bestAce || aces[0];
  }

  /** Count how many cards of a suit remain unplayed (not in our hand) */
  private countRemainingInSuit(suit: Suit, _state: GameState): number {
    let count = 0;
    for (const rank of RANKS) {
      if (rank === '2' && suit !== 'clubs') continue;
      const card = suited(suit, rank);
      if (!this.playedCards.has(cardId(card))) count++;
    }
    return count;
  }

  /** Update tracked played cards from game state */
  private updatePlayedCards(state: GameState): void {
    // Track cards from completed tricks (hand history)
    for (const result of state.handHistory) {
      for (const trick of result.tricks) {
        for (const play of trick.plays) {
          this.playedCards.add(cardId(play.card));
        }
      }
    }
    // Track cards in current trick
    for (const play of state.currentTrick.plays) {
      this.playedCards.add(cardId(play.card));
    }
  }

  pickTrump(hand: Card[], _state: GameState, _playerId: string): Suit {
    // Reset card tracking for new hand
    this.playedCards.clear();

    // Score each suit more carefully than medium AI
    let bestSuit: Suit = 'spades';
    let bestScore = -1;

    for (const suit of SUITS) {
      let score = 0;
      const suitCards = hand.filter(c => c.type === 'suited' && c.suit === suit);
      const jokerCount = hand.filter(c => c.type === 'joker').length;

      // Base: count * 20
      score += suitCards.length * 20;

      // High cards are worth more as trump
      for (const card of suitCards) {
        if (card.type === 'suited') {
          const rv = rankValue(card.rank);
          if (rv >= 14) score += 15; // Ace
          else if (rv >= 13) score += 12; // King
          else if (rv >= 12) score += 10; // Queen
          else if (rv >= 11) score += 8;  // Jack
          else score += rv;
        }
      }

      // Jokers add value to any trump suit
      score += jokerCount * 18;

      // Bonus for having sequential high cards (A, K, Q — control)
      const hasAce = suitCards.some(c => c.type === 'suited' && c.rank === 'A');
      const hasKing = suitCards.some(c => c.type === 'suited' && c.rank === 'K');
      const hasQueen = suitCards.some(c => c.type === 'suited' && c.rank === 'Q');
      if (hasAce && hasKing) score += 10;
      if (hasAce && hasKing && hasQueen) score += 15;

      // Penalty for very short suits (hard to control as trump)
      if (suitCards.length <= 2) score -= 15;

      if (score > bestScore) {
        bestScore = score;
        bestSuit = suit;
      }
    }

    return bestSuit;
  }

  pickPluckGive(legalCards: Card[], state: GameState, pluckerId: string, _pluckeeId: string): Card {
    const hand = state.hands.get(pluckerId) ?? [];
    const counts = suitCounts(hand);

    // Strategy: give a low card from our strongest suit to get back their
    // highest card, further consolidating our control of that suit.
    // But also consider: give from a suit where pluckee likely has high cards.

    // Primary: pluck from our longest suit (get back their best card of that suit)
    let bestSuit: Suit = 'clubs';
    let bestCount = 0;
    for (const [suit, count] of Object.entries(counts) as [Suit, number][]) {
      if (count > bestCount) {
        bestCount = count;
        bestSuit = suit;
      }
    }

    const suitCards = legalCards.filter(
      c => c.type === 'suited' && c.suit === bestSuit
    );

    if (suitCards.length > 0) {
      // Give the LOWEST card of that suit (we get back their highest)
      let lowest = suitCards[0];
      for (const card of suitCards) {
        if (card.type === 'suited' && lowest.type === 'suited') {
          if (rankValue(card.rank) < rankValue(lowest.rank)) {
            lowest = card;
          }
        }
      }
      return lowest;
    }

    // Fallback: give weakest card from a short suit (thin out weak holdings)
    return weakestCard(legalCards);
  }
}
