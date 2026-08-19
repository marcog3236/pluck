// ── Easy AI: Random play with slight preference ──
// Picks randomly from legal moves. Not completely stupid —
// slightly prefers following suit and avoids wasting big cards.

import type { Card, Suit } from '../card.js';
import type { GameState } from '../types.js';
import type { AIStrategy } from './types.js';
import { bestTrumpSuit, weakestCard } from './helpers.js';

export class EasyAI implements AIStrategy {
  pickCard(legalMoves: Card[], _state: GameState, _playerId: string): Card {
    // 70% chance: play random. 30% chance: play weakest.
    if (Math.random() < 0.7) {
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }
    return weakestCard(legalMoves);
  }

  pickTrump(hand: Card[], _state: GameState, _playerId: string): Suit {
    // Sometimes picks a random suit, sometimes picks the best
    if (Math.random() < 0.4) {
      const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
      return suits[Math.floor(Math.random() * 4)];
    }
    return bestTrumpSuit(hand);
  }

  pickPluckGive(legalCards: Card[], _state: GameState): Card {
    // Just give a random card
    return legalCards[Math.floor(Math.random() * legalCards.length)];
  }
}
