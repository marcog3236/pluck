// ── Rule validation: what moves are legal? ──

import {
  type Card,
  type Suit,
  cardsOfSuit,
  effectiveSuit,
  hasTwoOfClubs,
  cardStrength,
  cardsEqual,
  rankValue,
} from './card.js';
import type { GameState, Trick } from './types.js';

/**
 * Get the legal cards a player can play from their hand.
 *
 * Rules:
 * 1. First trick of every hand: holder of 2♣ MUST lead it
 * 2. Must follow suit if able (jokers count as trump suit)
 * 3. If void in led suit, can play anything
 * 4. Cannot lead trump until trump has been broken
 *    (Exception: clubs as trump + first trick opens trump)
 *    (Exception: player has ONLY trump cards left)
 */
export function getLegalPlays(
  hand: Card[],
  state: GameState,
): Card[] {
  const { trumpSuit, trumpBroken, currentTrick, trickNumber } = state;

  if (!trumpSuit) return []; // Trump not yet declared

  const isLeading = currentTrick.plays.length === 0;

  // ── First trick of the hand: must lead 2♣ ──
  if (trickNumber === 0 && isLeading && hasTwoOfClubs(hand)) {
    return hand.filter(c =>
      c.type === 'suited' && c.suit === 'clubs' && c.rank === '2'
    );
  }

  if (isLeading) {
    // ── Leading a trick ──
    if (!trumpBroken) {
      // Can't lead trump unless that's all you have
      const nonTrump = hand.filter(c => effectiveSuit(c, trumpSuit) !== trumpSuit);
      if (nonTrump.length > 0) return nonTrump;
      // Only trump left — can lead trump
    }
    return hand; // Can lead anything (trump broken or only trump left)
  }

  // ── Following ──
  const ledSuit = currentTrick.ledSuit!;

  // Must follow suit if able
  const matchingSuit = cardsOfSuit(hand, ledSuit, trumpSuit);
  if (matchingSuit.length > 0) return matchingSuit;

  // Void in led suit — can play anything
  return hand;
}

/**
 * Determine the winner of a completed trick.
 */
export function determineTrickWinner(trick: Trick, trumpSuit: Suit): string {
  if (trick.plays.length === 0 || !trick.ledSuit) {
    throw new Error('Cannot determine winner of empty trick');
  }

  let bestStrength = -1;
  let winnerId = trick.plays[0].playerId;

  for (const play of trick.plays) {
    const strength = cardStrength(play.card, trumpSuit, trick.ledSuit);
    if (strength > bestStrength) {
      bestStrength = strength;
      winnerId = play.playerId;
    }
  }

  return winnerId;
}

/**
 * Check if playing a card to a trick breaks trump.
 */
export function doesBreakTrump(
  card: Card,
  trumpSuit: Suit,
  ledSuit: Suit,
): boolean {
  const cardSuit = effectiveSuit(card, trumpSuit);
  // Trump is broken when someone plays a trump card while not following
  // the led suit (i.e., they're cutting/trumping in)
  return cardSuit === trumpSuit && ledSuit !== trumpSuit;
}

// ── Pluck validation ──

/**
 * Get the legal cards a plucker can give to a pluckee.
 * Jokers cannot be passed during plucking (no suit assigned yet).
 */
export function getLegalPluckGives(hand: Card[]): Card[] {
  return hand.filter(c => c.type !== 'joker');
}

/**
 * Determine what card the pluckee must return.
 * Must return their highest card of the same suit as the received card.
 * Jokers are never returned (they have no suit pre-trump).
 */
export function getPluckReturn(
  pluckeeHand: Card[],
  receivedCard: Card,
): Card {
  if (receivedCard.type === 'joker') {
    throw new Error('Jokers cannot be passed during plucking');
  }

  const suit = receivedCard.suit;

  // Get all suited cards of that suit in pluckee's hand
  // (exclude the card they just received — it's already added to hand)
  const suitCards = pluckeeHand.filter(
    c => c.type === 'suited' && c.suit === suit
  );

  if (suitCards.length === 0) {
    // Pluckee has no cards of that suit (only the received card)
    // They return the received card back
    return receivedCard;
  }

  // Return the highest-ranked card of that suit
  let highest = suitCards[0];
  for (const card of suitCards) {
    if (card.type === 'suited' && highest.type === 'suited') {
      if (rankValue(card.rank) > rankValue(highest.rank)) {
        highest = card;
      }
    }
  }

  return highest;
}

/**
 * Validate that a card play is legal.
 */
export function isLegalPlay(
  card: Card,
  hand: Card[],
  state: GameState,
): boolean {
  const legal = getLegalPlays(hand, state);
  return legal.some(c => cardsEqual(c, card));
}
