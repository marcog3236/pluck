// ── Game state machine: the core engine ──

import {
  type Card,
  cardsEqual,
  effectiveSuit,
  hasTwoOfClubs,
  createThreePlayerDeck,
  createFourPlayerDeck,
  deal,
} from './card.js';
import {
  type GameState,
  type GameConfig,
  type GameAction,
  type GameEvent,
  type Player,
  type PendingPluck,
  type HandPlayerResult,
  type HandResult,
  type PluckAction,
  type TeamId,
  getQuota3Player,
  getQuota4Player,
} from './types.js';
import {
  getLegalPlays,
  determineTrickWinner,
  doesBreakTrump,
  getLegalPluckGives,
  getPluckReturn,
  isLegalPlay,
} from './rules.js';

// ── Default config ──

export const DEFAULT_CONFIG: GameConfig = {
  mode: 'three-player',
  pointsToWin: 10,
  turnTimeoutSeconds: 30,
  allowSpectators: true,
};

// ── Game engine ──

export class PluckGame {
  state: GameState;
  private eventLog: GameEvent[] = [];

  constructor(config: Partial<GameConfig> = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    this.state = createInitialState(fullConfig);
  }

  /** Process an action and return resulting events */
  dispatch(action: GameAction): GameEvent[] {
    const events: GameEvent[] = [];

    switch (action.type) {
      case 'join':
        this.handleJoin(action, events);
        break;
      case 'start':
        this.handleStart(events);
        break;
      case 'declare-trump':
        this.handleDeclareTrump(action, events);
        break;
      case 'play-card':
        this.handlePlayCard(action, events);
        break;
      case 'pluck-give':
        this.handlePluckGive(action, events);
        break;
    }

    this.eventLog.push(...events);
    return events;
  }

  /** Get legal moves for the current player */
  getLegalMoves(): Card[] {
    if (this.state.phase === 'playing') {
      const currentPlayer = this.state.players[this.state.currentPlayerIndex];
      const hand = this.state.hands.get(currentPlayer.id) ?? [];
      return getLegalPlays(hand, this.state);
    }
    if (this.state.phase === 'plucking') {
      const pluck = this.getCurrentPluck();
      if (!pluck) return [];
      const pluckerHand = this.state.hands.get(pluck.pluckerId) ?? [];
      return getLegalPluckGives(pluckerHand);
    }
    return [];
  }

  /** Get the current pending pluck (if in plucking phase) */
  getCurrentPluck(): PendingPluck | null {
    if (this.state.phase !== 'plucking') return null;
    return this.state.pendingPlucks[this.state.currentPluckIndex] ?? null;
  }

  /** Get player quota for current hand */
  getQuota(playerId: string): number {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return 0;

    if (this.state.config.mode === 'three-player') {
      return getQuota3Player(player.position, this.state.dealerIndex);
    } else {
      const callingTeam = this.state.players[this.state.callerIndex ?? 0].team ?? 0;
      return getQuota4Player(player.team ?? 0, callingTeam);
    }
  }

  /** Get the full event log */
  getEvents(): GameEvent[] {
    return [...this.eventLog];
  }

  // ── Action handlers ──

  private handleJoin(
    action: Extract<GameAction, { type: 'join' }>,
    events: GameEvent[],
  ): void {
    if (this.state.phase !== 'waiting') {
      events.push({ type: 'error', message: 'Game already started' });
      return;
    }

    if (this.state.players.some(p => p.id === action.playerId)) {
      events.push({ type: 'error', message: 'Player already joined' });
      return;
    }

    const maxPlayers = this.state.config.mode === 'three-player' ? 3 : 4;
    if (this.state.players.length >= maxPlayers) {
      events.push({ type: 'error', message: 'Game is full' });
      return;
    }

    const position = this.state.players.length;
    const player: Player = {
      id: action.playerId,
      name: action.name,
      position,
      isAI: action.isAI ?? false,
      aiDifficulty: action.aiDifficulty,
    };

    // Assign teams in 4-player mode
    if (this.state.config.mode === 'four-player') {
      player.team = (position % 2) as TeamId; // 0,1,0,1
    }

    this.state.players.push(player);
  }

  private handleStart(events: GameEvent[]): void {
    const maxPlayers = this.state.config.mode === 'three-player' ? 3 : 4;
    if (this.state.players.length !== maxPlayers) {
      events.push({
        type: 'error',
        message: `Need ${maxPlayers} players to start`,
      });
      return;
    }

    events.push({ type: 'game-started', players: [...this.state.players] });
    this.startNewHand(events);
  }

  private handleDeclareTrump(
    action: Extract<GameAction, { type: 'declare-trump' }>,
    events: GameEvent[],
  ): void {
    if (this.state.phase !== 'declaring') {
      events.push({ type: 'error', message: 'Not in trump declaration phase' });
      return;
    }

    // Verify it's the dealer (3p) or caller (4p) declaring
    const declarerIndex = this.state.config.mode === 'three-player'
      ? this.state.dealerIndex
      : (this.state.callerIndex ?? this.state.dealerIndex);
    const declarer = this.state.players[declarerIndex];

    if (action.playerId !== declarer.id) {
      events.push({ type: 'error', message: 'Only the dealer/caller can declare trump' });
      return;
    }

    this.state.trumpSuit = action.suit;

    // Special case: if clubs is trump, trump is already "broken" by the 2♣ lead
    if (action.suit === 'clubs') {
      this.state.trumpBroken = true;
    }

    events.push({
      type: 'trump-declared',
      suit: action.suit,
      declaredBy: action.playerId,
    });

    // Move to playing phase
    this.state.phase = 'playing';

    // Find who has the 2♣ — they lead the first trick
    const leaderIndex = this.findTwoOfClubsHolder();
    this.state.currentPlayerIndex = leaderIndex;

    events.push({
      type: 'trick-started',
      trickNumber: 0,
      leaderId: this.state.players[leaderIndex].id,
    });
  }

  private handlePlayCard(
    action: Extract<GameAction, { type: 'play-card' }>,
    events: GameEvent[],
  ): void {
    if (this.state.phase !== 'playing') {
      events.push({ type: 'error', message: 'Not in playing phase' });
      return;
    }

    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (action.playerId !== currentPlayer.id) {
      events.push({ type: 'error', message: 'Not your turn' });
      return;
    }

    const hand = this.state.hands.get(action.playerId);
    if (!hand) {
      events.push({ type: 'error', message: 'Player has no hand' });
      return;
    }

    if (!isLegalPlay(action.card, hand, this.state)) {
      events.push({ type: 'error', message: 'Illegal play' });
      return;
    }

    // Remove card from hand
    const cardIndex = hand.findIndex(c => cardsEqual(c, action.card));
    hand.splice(cardIndex, 1);

    // Set led suit if first play of trick
    if (this.state.currentTrick.plays.length === 0) {
      this.state.currentTrick.ledSuit = effectiveSuit(
        action.card,
        this.state.trumpSuit!,
      );
    }

    // Check if this breaks trump
    if (
      !this.state.trumpBroken &&
      this.state.currentTrick.ledSuit &&
      doesBreakTrump(action.card, this.state.trumpSuit!, this.state.currentTrick.ledSuit)
    ) {
      this.state.trumpBroken = true;
    }

    // Add play to trick
    this.state.currentTrick.plays.push({
      playerId: action.playerId,
      card: action.card,
    });

    events.push({
      type: 'card-played',
      playerId: action.playerId,
      card: action.card,
    });

    // Check if trick is complete
    const playersInTrick = this.state.config.mode === 'three-player' ? 3 : 4;
    if (this.state.currentTrick.plays.length === playersInTrick) {
      this.completeTrick(events);
    } else {
      // Next player's turn
      this.state.currentPlayerIndex =
        (this.state.currentPlayerIndex + 1) % this.state.players.length;
    }
  }

  private handlePluckGive(
    action: Extract<GameAction, { type: 'pluck-give' }>,
    events: GameEvent[],
  ): void {
    if (this.state.phase !== 'plucking') {
      events.push({ type: 'error', message: 'Not in plucking phase' });
      return;
    }

    const pluck = this.getCurrentPluck();
    if (!pluck || action.playerId !== pluck.pluckerId) {
      events.push({ type: 'error', message: 'Not your turn to pluck' });
      return;
    }

    if (action.card.type === 'joker') {
      events.push({ type: 'error', message: 'Cannot pass jokers during plucking' });
      return;
    }

    const pluckerHand = this.state.hands.get(pluck.pluckerId)!;
    const pluckeeHand = this.state.hands.get(pluck.pluckeeId)!;

    // Remove card from plucker's hand
    const giveIdx = pluckerHand.findIndex(c => cardsEqual(c, action.card));
    if (giveIdx === -1) {
      events.push({ type: 'error', message: 'Card not in hand' });
      return;
    }
    pluckerHand.splice(giveIdx, 1);

    // Add card to pluckee's hand
    pluckeeHand.push(action.card);

    // Determine return card
    const returnCard = getPluckReturn(pluckeeHand, action.card);

    // Remove return card from pluckee's hand
    const returnIdx = pluckeeHand.findIndex(c => cardsEqual(c, returnCard));
    pluckeeHand.splice(returnIdx, 1);

    // Add return card to plucker's hand
    pluckerHand.push(returnCard);

    const pluckAction: PluckAction = {
      pluckerId: pluck.pluckerId,
      pluckeeId: pluck.pluckeeId,
      cardGiven: action.card,
      cardReceived: returnCard,
    };

    events.push({ type: 'pluck-exchanged', action: pluckAction });

    // Track completion
    pluck.completed++;

    // Check if this pluck pair is done
    if (pluck.completed >= pluck.count) {
      this.state.currentPluckIndex++;
    }

    // Check if all plucks are done
    if (this.state.currentPluckIndex >= this.state.pendingPlucks.length) {
      events.push({ type: 'pluck-phase-ended' });
      this.state.phase = 'declaring';
    }
  }

  // ── Internal methods ──

  private startNewHand(events: GameEvent[]): void {
    this.state.handNumber++;
    this.state.trumpSuit = null;
    this.state.trumpBroken = false;
    this.state.trickNumber = 0;
    this.state.currentTrick = { plays: [], ledSuit: null, winnerId: null };
    this.state.tricksWon = new Map();
    this.state.pendingPlucks = [];
    this.state.currentPluckIndex = 0;

    for (const player of this.state.players) {
      this.state.tricksWon.set(player.id, 0);
    }

    // Rotate dealer
    if (this.state.handNumber > 1) {
      this.state.dealerIndex =
        (this.state.dealerIndex + 1) % this.state.players.length;
    }

    const dealer = this.state.players[this.state.dealerIndex];
    events.push({
      type: 'hand-started',
      handNumber: this.state.handNumber,
      dealerId: dealer.id,
    });

    // Deal cards
    const deck = this.state.config.mode === 'three-player'
      ? createThreePlayerDeck()
      : createFourPlayerDeck();

    const hands = deal(deck, this.state.players.length);
    this.state.hands = new Map();
    for (let i = 0; i < this.state.players.length; i++) {
      this.state.hands.set(this.state.players[i].id, hands[i]);
    }

    events.push({ type: 'cards-dealt', hands: new Map(this.state.hands) });

    // 4-player: determine caller
    if (this.state.config.mode === 'four-player') {
      if (this.state.handNumber === 1) {
        // First hand: caller is whoever has 2♣
        this.state.callerIndex = this.findTwoOfClubsHolder();
      } else {
        // Subsequent hands: rotate clockwise
        this.state.callerIndex =
          ((this.state.callerIndex ?? 0) + 1) % this.state.players.length;
      }
    }

    // Calculate plucks from previous hand (hand 2+)
    if (this.state.handNumber > 1 && this.state.handHistory.length > 0) {
      this.calculatePlucks(events);
    }

    if (this.state.pendingPlucks.length > 0) {
      this.state.phase = 'plucking';
      events.push({
        type: 'pluck-phase-started',
        plucks: [...this.state.pendingPlucks],
      });
    } else {
      // Skip straight to trump declaration
      this.state.phase = 'declaring';
    }
  }

  private calculatePlucks(_events: GameEvent[]): void {
    const lastHand = this.state.handHistory[this.state.handHistory.length - 1];

    // Build plucker/pluckee lists
    const pluckers: { playerId: string; count: number }[] = [];
    const pluckees: { playerId: string; count: number }[] = [];

    for (const result of lastHand.playerResults) {
      if (result.plucksEarned > 0) {
        pluckers.push({ playerId: result.playerId, count: result.plucksEarned });
      }
      if (result.plucksOwed > 0) {
        pluckees.push({ playerId: result.playerId, count: result.plucksOwed });
      }
    }

    // Sort pluckers: most plucks first, ties go to dealer-closest
    pluckers.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      // Tie: closest to dealer (clockwise)
      const aPlayer = this.state.players.find(p => p.id === a.playerId)!;
      const bPlayer = this.state.players.find(p => p.id === b.playerId)!;
      const aRelative = ((aPlayer.position - this.state.dealerIndex) +
        this.state.players.length) % this.state.players.length;
      const bRelative = ((bPlayer.position - this.state.dealerIndex) +
        this.state.players.length) % this.state.players.length;
      return aRelative - bRelative;
    });

    // Build pending pluck list
    // Each plucker takes from pluckees (distribute plucks)
    const plucks: PendingPluck[] = [];

    for (const plucker of pluckers) {
      let remaining = plucker.count;
      for (const pluckee of pluckees) {
        if (remaining <= 0) break;
        if (pluckee.count <= 0) continue;

        const count = Math.min(remaining, pluckee.count);
        plucks.push({
          pluckerId: plucker.playerId,
          pluckeeId: pluckee.playerId,
          count,
          completed: 0,
        });
        remaining -= count;
        pluckee.count -= count;
      }
    }

    this.state.pendingPlucks = plucks;
    this.state.currentPluckIndex = 0;
  }

  private completeTrick(events: GameEvent[]): void {
    const trick = this.state.currentTrick;
    const winnerId = determineTrickWinner(trick, this.state.trumpSuit!);
    trick.winnerId = winnerId;

    // Update tricks won
    const current = this.state.tricksWon.get(winnerId) ?? 0;
    this.state.tricksWon.set(winnerId, current + 1);

    events.push({ type: 'trick-won', winnerId, trick: { ...trick } });

    this.state.trickNumber++;

    // Check if hand is over
    const totalTricks = this.state.config.mode === 'three-player' ? 17 : 13;
    if (this.state.trickNumber >= totalTricks) {
      this.completeHand(events);
    } else {
      // Winner leads next trick
      const winnerPlayer = this.state.players.find(p => p.id === winnerId)!;
      this.state.currentPlayerIndex = winnerPlayer.position;
      this.state.currentTrick = { plays: [], ledSuit: null, winnerId: null };

      events.push({
        type: 'trick-started',
        trickNumber: this.state.trickNumber,
        leaderId: winnerId,
      });
    }
  }

  private completeHand(events: GameEvent[]): void {
    this.state.phase = 'scoring';

    const playerResults: HandPlayerResult[] = [];

    for (const player of this.state.players) {
      const tricksWon = this.state.tricksWon.get(player.id) ?? 0;
      const quota = this.getQuota(player.id);
      const over = Math.max(0, tricksWon - quota);
      const under = Math.max(0, quota - tricksWon);

      const result: HandPlayerResult = {
        playerId: player.id,
        tricksWon,
        quota,
        plucksEarned: over,
        plucksOwed: under,
        pointsEarned: over,
      };

      playerResults.push(result);

      // Update cumulative score
      if (this.state.config.mode === 'three-player') {
        const currentScore = this.state.scores.get(player.id) ?? 0;
        this.state.scores.set(player.id, currentScore + over);
      }
    }

    // 4-player team scoring
    if (this.state.config.mode === 'four-player') {
      for (const teamId of [0, 1] as TeamId[]) {
        const teamResults = playerResults.filter(r => {
          const player = this.state.players.find(p => p.id === r.playerId);
          return player?.team === teamId;
        });
        const teamPoints = teamResults.reduce((sum, r) => sum + r.pointsEarned, 0);
        const currentTeamScore = this.state.teamScores?.get(teamId) ?? 0;
        this.state.teamScores?.set(teamId, currentTeamScore + teamPoints);
      }
    }

    const handResult: HandResult = {
      handNumber: this.state.handNumber,
      dealerId: this.state.players[this.state.dealerIndex].id,
      trumpSuit: this.state.trumpSuit!,
      playerResults,
      tricks: [], // Could store full trick history if needed
      pluckActions: [], // Filled during pluck phase
    };

    this.state.handHistory.push(handResult);

    events.push({ type: 'hand-ended', result: handResult });

    // Check for game winner
    if (this.checkForWinner(events)) {
      return;
    }

    // Start next hand
    this.startNewHand(events);
  }

  private checkForWinner(events: GameEvent[]): boolean {
    const { pointsToWin } = this.state.config;

    if (this.state.config.mode === 'three-player') {
      for (const player of this.state.players) {
        const score = this.state.scores.get(player.id) ?? 0;
        if (score >= pointsToWin) {
          this.state.phase = 'finished';
          this.state.winnerId = player.id;
          events.push({
            type: 'game-ended',
            winnerId: player.id,
            winningTeam: null,
          });
          return true;
        }
      }
    } else {
      for (const teamId of [0, 1] as TeamId[]) {
        const teamScore = this.state.teamScores?.get(teamId) ?? 0;
        if (teamScore >= pointsToWin) {
          this.state.phase = 'finished';
          this.state.winningTeam = teamId;
          events.push({
            type: 'game-ended',
            winnerId: null,
            winningTeam: teamId,
          });
          return true;
        }
      }
    }

    return false;
  }

  private findTwoOfClubsHolder(): number {
    for (let i = 0; i < this.state.players.length; i++) {
      const hand = this.state.hands.get(this.state.players[i].id);
      if (hand && hasTwoOfClubs(hand)) return i;
    }
    return 0; // Shouldn't happen
  }
}

// ── Initial state factory ──

function createInitialState(config: GameConfig): GameState {
  return {
    config,
    phase: 'waiting',
    players: [],
    hands: new Map(),
    scores: new Map(),
    teamScores: config.mode === 'four-player' ? new Map([[0, 0], [1, 0]]) : undefined,
    handNumber: 0,
    dealerIndex: 0,
    trumpSuit: null,
    trumpBroken: false,
    currentTrick: { plays: [], ledSuit: null, winnerId: null },
    trickNumber: 0,
    currentPlayerIndex: 0,
    tricksWon: new Map(),
    pendingPlucks: [],
    currentPluckIndex: 0,
    handHistory: [],
    winnerId: null,
    winningTeam: null,
  };
}
