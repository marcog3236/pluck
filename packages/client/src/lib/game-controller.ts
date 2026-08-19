/**
 * Game controller — wraps the engine for client-side use.
 * Manages game state, AI turns, and event dispatching.
 */

import {
  PluckGame,
  type Card,
  type Suit,
  type GameState,
  type GameEvent,
  type GameConfig,
  type AIDifficulty,
  getLegalPlays,
  getLegalPluckGives,
  sortHand,
  createAI,
} from "@pluck/engine";

export type GameEventHandler = (events: GameEvent[]) => void;

export class GameController {
  game: PluckGame;
  private eventHandlers: GameEventHandler[] = [];
  private aiDelay = 500; // ms between AI actions
  private aiDifficulty: AIDifficulty = "medium";
  private aiInstances: Map<string, ReturnType<typeof createAI>> = new Map();

  constructor(config: Partial<GameConfig> = {}, aiDifficulty: AIDifficulty = "medium") {
    this.game = new PluckGame(config);
    this.aiDifficulty = aiDifficulty;
  }

  get state(): GameState {
    return this.game.state;
  }

  onEvent(handler: GameEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  private emit(events: GameEvent[]): void {
    for (const handler of this.eventHandlers) {
      handler(events);
    }
  }

  private getAI(playerId: string) {
    if (!this.aiInstances.has(playerId)) {
      this.aiInstances.set(playerId, createAI(this.aiDifficulty));
    }
    return this.aiInstances.get(playerId)!;
  }

  /** Start a new game with the human player and AI opponents */
  startGame(playerName: string): void {
    const is3p = this.game.state.config.mode === "three-player";
    const aiNames = is3p ? ["Bot 1", "Bot 2"] : ["Bot 1", "Bot 2", "Bot 3"];

    this.game.dispatch({
      type: "join",
      playerId: "human",
      name: playerName,
    });

    aiNames.forEach((name, i) => {
      this.game.dispatch({
        type: "join",
        playerId: `ai-${i + 1}`,
        name,
        isAI: true,
        aiDifficulty: this.aiDifficulty,
      });
    });

    const events = this.game.dispatch({ type: "start" });
    this.emit(events);

    this.scheduleAIActions();
  }

  /** Human plays a card */
  playCard(card: Card): void {
    const events = this.game.dispatch({
      type: "play-card",
      playerId: "human",
      card,
    });
    this.emit(events);
    this.scheduleAIActions();
  }

  /** Human declares trump suit */
  declareTrump(suit: Suit): void {
    const events = this.game.dispatch({
      type: "declare-trump",
      playerId: "human",
      suit,
    });
    this.emit(events);
    this.scheduleAIActions();
  }

  /** Human gives a card during plucking */
  pluckGive(card: Card): void {
    const events = this.game.dispatch({
      type: "pluck-give",
      playerId: "human",
      card,
    });
    this.emit(events);
    this.scheduleAIActions();
  }

  /** Get the human player's sorted hand */
  getHumanHand(): Card[] {
    const hand = this.state.hands.get("human") ?? [];
    return sortHand(hand, this.state.trumpSuit ?? undefined);
  }

  /** Get legal moves for the human player */
  getHumanLegalMoves(): Card[] {
    if (this.state.phase === "playing") {
      const currentPlayer =
        this.state.players[this.state.currentPlayerIndex];
      if (currentPlayer.id !== "human") return [];
      const hand = this.state.hands.get("human") ?? [];
      return getLegalPlays(hand, this.state);
    }
    if (this.state.phase === "plucking") {
      const pluck =
        this.state.pendingPlucks[this.state.currentPluckIndex];
      if (!pluck || pluck.pluckerId !== "human") return [];
      const hand = this.state.hands.get("human") ?? [];
      return getLegalPluckGives(hand);
    }
    return [];
  }

  /** Check if it's the human player's turn */
  isHumanTurn(): boolean {
    if (this.state.phase === "playing") {
      return (
        this.state.players[this.state.currentPlayerIndex].id === "human"
      );
    }
    if (this.state.phase === "declaring") {
      const declarer =
        this.state.config.mode === "three-player"
          ? this.state.players[this.state.dealerIndex]
          : this.state.players[this.state.callerIndex ?? 0];
      return declarer.id === "human";
    }
    if (this.state.phase === "plucking") {
      const pluck =
        this.state.pendingPlucks[this.state.currentPluckIndex];
      return pluck?.pluckerId === "human";
    }
    return false;
  }

  // ── AI Logic ──

  private scheduleAIActions(): void {
    setTimeout(() => this.processAIActions(), this.aiDelay);
  }

  private processAIActions(): void {
    if (this.state.phase === "finished") return;

    // AI declares trump
    if (this.state.phase === "declaring" && !this.isHumanTurn()) {
      const declarer =
        this.state.config.mode === "three-player"
          ? this.state.players[this.state.dealerIndex]
          : this.state.players[this.state.callerIndex ?? 0];

      const ai = this.getAI(declarer.id);
      const hand = this.state.hands.get(declarer.id) ?? [];
      const suit = ai.pickTrump(hand, this.state, declarer.id);

      const events = this.game.dispatch({
        type: "declare-trump",
        playerId: declarer.id,
        suit,
      });
      this.emit(events);
      this.scheduleAIActions();
      return;
    }

    // AI plucks
    if (this.state.phase === "plucking" && !this.isHumanTurn()) {
      const pluck =
        this.state.pendingPlucks[this.state.currentPluckIndex];
      if (pluck) {
        const ai = this.getAI(pluck.pluckerId);
        const hand = this.state.hands.get(pluck.pluckerId) ?? [];
        const legal = getLegalPluckGives(hand);
        if (legal.length > 0) {
          const card = ai.pickPluckGive(legal, this.state, pluck.pluckerId, pluck.pluckeeId);
          const events = this.game.dispatch({
            type: "pluck-give",
            playerId: pluck.pluckerId,
            card,
          });
          this.emit(events);
          this.scheduleAIActions();
        }
      }
      return;
    }

    // AI plays card
    if (this.state.phase === "playing" && !this.isHumanTurn()) {
      const currentPlayer =
        this.state.players[this.state.currentPlayerIndex];
      const ai = this.getAI(currentPlayer.id);
      const hand = this.state.hands.get(currentPlayer.id) ?? [];
      const legal = getLegalPlays(hand, this.state);

      if (legal.length > 0) {
        const card = ai.pickCard(legal, this.state, currentPlayer.id);
        const events = this.game.dispatch({
          type: "play-card",
          playerId: currentPlayer.id,
          card,
        });
        this.emit(events);
        this.scheduleAIActions();
      }
      return;
    }
  }
}
