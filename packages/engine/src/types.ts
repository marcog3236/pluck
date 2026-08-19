// ── Core game types ──

import type { Card, Suit } from './card.js';

export type GameMode = 'three-player' | 'four-player';

export type PlayerPosition = number; // 0, 1, 2 (or 0-3 for 4p)
export type TeamId = 0 | 1;

export interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  team?: TeamId; // Only used in 4-player mode
  isAI: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
}

// ── Game phases ──

export type GamePhase =
  | 'waiting'       // Lobby, waiting for players
  | 'dealing'       // Cards being dealt (animation phase)
  | 'plucking'      // Pluck exchange phase (hand 2+)
  | 'declaring'     // Dealer choosing trump suit
  | 'playing'       // Trick-taking phase
  | 'scoring'       // End of hand, tallying results
  | 'finished';     // Game over

// ── Trick ──

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export interface Trick {
  plays: TrickPlay[];
  ledSuit: Suit | null;  // Suit of the first card played
  winnerId: string | null;
}

// ── Pluck action ──

export interface PluckAction {
  pluckerId: string;
  pluckeeId: string;
  cardGiven: Card;       // Card passed from plucker to pluckee
  cardReceived: Card;    // Highest card of that suit returned
}

// ── Hand result (per player) ──

export interface HandPlayerResult {
  playerId: string;
  tricksWon: number;
  quota: number;
  plucksEarned: number;  // tricks over quota (≥0)
  plucksOwed: number;    // tricks under quota (≥0)
  pointsEarned: number;
}

export interface HandResult {
  handNumber: number;
  dealerId: string;
  trumpSuit: Suit;
  playerResults: HandPlayerResult[];
  tricks: Trick[];
  pluckActions: PluckAction[];
}

// ── Full game state ──

export interface GameConfig {
  mode: GameMode;
  pointsToWin: number;        // Default 10
  turnTimeoutSeconds: number;  // 0 = no timer
  allowSpectators: boolean;
}

export interface GameState {
  config: GameConfig;
  phase: GamePhase;
  players: Player[];
  hands: Map<string, Card[]>;  // playerId → current hand
  scores: Map<string, number>; // playerId → cumulative score (3p) or teamId → score (4p)
  teamScores?: Map<TeamId, number>; // 4-player team scores

  // Current hand state
  handNumber: number;
  dealerIndex: PlayerPosition;
  callerIndex?: PlayerPosition;  // 4-player: who calls trump this hand
  trumpSuit: Suit | null;
  trumpBroken: boolean;

  // Trick state
  currentTrick: Trick;
  trickNumber: number;
  currentPlayerIndex: PlayerPosition;
  tricksWon: Map<string, number>;  // playerId → tricks won this hand

  // Pluck state
  pendingPlucks: PendingPluck[];
  currentPluckIndex: number;

  // History
  handHistory: HandResult[];
  winnerId: string | null;       // 3-player
  winningTeam: TeamId | null;    // 4-player
}

export interface PendingPluck {
  pluckerId: string;
  pluckeeId: string;
  count: number;        // How many plucks this plucker gets from this pluckee
  completed: number;    // How many have been done
}

// ── Actions (player inputs) ──

export type GameAction =
  | { type: 'join'; playerId: string; name: string; isAI?: boolean; aiDifficulty?: 'easy' | 'medium' | 'hard' }
  | { type: 'start' }
  | { type: 'declare-trump'; playerId: string; suit: Suit }
  | { type: 'play-card'; playerId: string; card: Card }
  | { type: 'pluck-give'; playerId: string; card: Card }  // Plucker chooses card to pass

// ── Events (state changes, for UI/network) ──

export type GameEvent =
  | { type: 'game-started'; players: Player[] }
  | { type: 'hand-started'; handNumber: number; dealerId: string }
  | { type: 'cards-dealt'; hands: Map<string, Card[]> }
  | { type: 'pluck-phase-started'; plucks: PendingPluck[] }
  | { type: 'pluck-exchanged'; action: PluckAction }
  | { type: 'pluck-phase-ended' }
  | { type: 'trump-declared'; suit: Suit; declaredBy: string }
  | { type: 'trick-started'; trickNumber: number; leaderId: string }
  | { type: 'card-played'; playerId: string; card: Card }
  | { type: 'trick-won'; winnerId: string; trick: Trick }
  | { type: 'hand-ended'; result: HandResult }
  | { type: 'game-ended'; winnerId: string | null; winningTeam: TeamId | null }
  | { type: 'error'; message: string };

// ── Quotas ──

export function getQuota3Player(
  playerPosition: PlayerPosition,
  dealerIndex: PlayerPosition,
): number {
  // Relative position from dealer
  const relative = ((playerPosition - dealerIndex) + 3) % 3;
  switch (relative) {
    case 0: return 7; // Dealer
    case 1: return 6; // Left of dealer
    case 2: return 4; // Right of dealer
    default: return 0;
  }
}

export function getQuota4Player(
  playerTeam: TeamId,
  callingTeam: TeamId,
): number {
  return playerTeam === callingTeam ? 8 : 5;
}
