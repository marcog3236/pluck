// ── AI types ──

import type { Card, Suit } from '../card.js';
import type { GameState } from '../types.js';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIStrategy {
  /** Pick a card to play from legal moves */
  pickCard(legalMoves: Card[], state: GameState, playerId: string): Card;

  /** Pick a trump suit to declare */
  pickTrump(hand: Card[], state: GameState, playerId: string): Suit;

  /** Pick a card to give during plucking */
  pickPluckGive(legalCards: Card[], state: GameState, pluckerId: string, pluckeeId: string): Card;
}
