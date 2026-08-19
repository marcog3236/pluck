// ── @pluck/engine — Public API ──

export {
  // Card types & constructors
  type Card,
  type Suit,
  type Rank,
  type JokerKind,
  SUITS,
  RANKS,
  suited,
  joker,
  cardId,
  cardsEqual,
  cardDisplay,
  rankValue,
  cardStrength,
  effectiveSuit,

  // Deck construction
  createThreePlayerDeck,
  createFourPlayerDeck,
  shuffle,
  deal,

  // Hand utilities
  cardsOfSuit,
  hasTwoOfClubs,
  sortHand,
} from './card.js';

export {
  // Game types
  type GameMode,
  type PlayerPosition,
  type TeamId,
  type Player,
  type GamePhase,
  type Trick,
  type TrickPlay,
  type PluckAction,
  type HandPlayerResult,
  type HandResult,
  type GameConfig,
  type GameState,
  type PendingPluck,
  type GameAction,
  type GameEvent,

  // Quota helpers
  getQuota3Player,
  getQuota4Player,
} from './types.js';

export {
  // Rule validation
  getLegalPlays,
  determineTrickWinner,
  doesBreakTrump,
  getLegalPluckGives,
  getPluckReturn,
  isLegalPlay,
} from './rules.js';

export {
  // Game engine
  PluckGame,
  DEFAULT_CONFIG,
} from './game.js';

export {
  // AI
  type AIStrategy,
  type AIDifficulty,
  EasyAI,
  MediumAI,
  HardAI,
  createAI,
} from './ai/index.js';
