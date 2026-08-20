/**
 * Game room — manages a single multiplayer game instance.
 * Wraps the engine, tracks connected players, handles AI fill-ins.
 */

import {
  PluckGame,
  type Card,
  type Suit,
  type GameConfig,
  type GameEvent,
  type GameState,
  type AIDifficulty,
  getLegalPlays,
  getLegalPluckGives,
  createAI,
} from "@pluck/engine";
import { nanoid } from "nanoid";

export interface RoomPlayer {
  id: string;           // Internal player ID (p0, p1, p2...)
  socketId: string | null; // Socket.io socket ID (null = disconnected)
  name: string;
  isAI: boolean;
  connected: boolean;
}

export interface RoomOptions {
  mode: "three-player" | "four-player";
  pointsToWin: number;
  aiDifficulty: AIDifficulty;
  turnTimeoutSeconds: number;
}

const DEFAULT_ROOM_OPTIONS: RoomOptions = {
  mode: "three-player",
  pointsToWin: 10,
  aiDifficulty: "medium",
  turnTimeoutSeconds: 60,
};

export class GameRoom {
  readonly id: string;
  readonly code: string; // Short join code
  readonly options: RoomOptions;
  readonly createdAt: number;

  private game: PluckGame;
  private players: Map<string, RoomPlayer> = new Map(); // playerId → RoomPlayer
  private hostPlayerId: string | null = null;
  private started = false;
  private aiInstances: Map<string, ReturnType<typeof createAI>> = new Map();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTrickJustWon = false;
  private onEventCallback: ((roomId: string, events: GameEvent[], state: GameState) => void) | null = null;
  private onPlayerUpdateCallback: ((roomId: string, players: RoomPlayer[]) => void) | null = null;

  constructor(options: Partial<RoomOptions> = {}) {
    this.id = nanoid();
    this.code = this.generateCode();
    this.options = { ...DEFAULT_ROOM_OPTIONS, ...options };
    this.createdAt = Date.now();

    this.game = new PluckGame({
      mode: this.options.mode,
      pointsToWin: this.options.pointsToWin,
      turnTimeoutSeconds: this.options.turnTimeoutSeconds,
    });
  }

  private generateCode(): string {
    // 6-char alphanumeric uppercase code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 for clarity
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // ── Event callbacks ──

  onEvent(cb: (roomId: string, events: GameEvent[], state: GameState) => void): void {
    this.onEventCallback = cb;
  }

  onPlayerUpdate(cb: (roomId: string, players: RoomPlayer[]) => void): void {
    this.onPlayerUpdateCallback = cb;
  }

  private emitEvents(events: GameEvent[]): void {
    if (events.some(e => e.type === "trick-won")) {
      this.lastTrickJustWon = true;
    }
    this.onEventCallback?.(this.id, events, this.game.state);
  }

  private emitPlayerUpdate(): void {
    this.onPlayerUpdateCallback?.(this.id, this.getPlayers());
  }

  // ── Player management ──

  addPlayer(socketId: string, name: string): { playerId: string; error?: string } {
    if (this.started) {
      return { playerId: "", error: "Game already started" };
    }

    const maxPlayers = this.options.mode === "three-player" ? 3 : 4;
    if (this.players.size >= maxPlayers) {
      return { playerId: "", error: "Room is full" };
    }

    const playerId = `p${this.players.size}`;
    const player: RoomPlayer = {
      id: playerId,
      socketId,
      name,
      isAI: false,
      connected: true,
    };

    this.players.set(playerId, player);

    if (!this.hostPlayerId) {
      this.hostPlayerId = playerId;
    }

    this.emitPlayerUpdate();
    return { playerId };
  }

  removePlayer(socketId: string): void {
    const player = this.findPlayerBySocket(socketId);
    if (!player) return;

    if (this.started) {
      // Mark as disconnected, fill with AI
      player.connected = false;
      player.socketId = null;
      this.emitPlayerUpdate();

      // If it's this player's turn, run AI for them
      this.checkAITurn();
    } else {
      this.players.delete(player.id);
      // Reassign host if needed
      if (player.id === this.hostPlayerId) {
        const remaining = [...this.players.values()];
        this.hostPlayerId = remaining.length > 0 ? remaining[0].id : null;
      }
      this.emitPlayerUpdate();
    }
  }

  reconnectPlayer(socketId: string, playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.socketId = socketId;
    player.connected = true;
    this.emitPlayerUpdate();
    return true;
  }

  /** Fill remaining slots with AI players */
  fillWithAI(): void {
    const maxPlayers = this.options.mode === "three-player" ? 3 : 4;
    let aiNum = 1;

    while (this.players.size < maxPlayers) {
      const playerId = `p${this.players.size}`;
      this.players.set(playerId, {
        id: playerId,
        socketId: null,
        name: `Bot ${aiNum}`,
        isAI: true,
        connected: true,
      });
      aiNum++;
    }

    this.emitPlayerUpdate();
  }

  // ── Game lifecycle ──

  startGame(): { error?: string } {
    const maxPlayers = this.options.mode === "three-player" ? 3 : 4;
    if (this.players.size < maxPlayers) {
      return { error: `Need ${maxPlayers} players (have ${this.players.size})` };
    }

    if (this.started) {
      return { error: "Game already started" };
    }

    // Register players with engine
    for (const [playerId, player] of this.players) {
      this.game.dispatch({
        type: "join",
        playerId,
        name: player.name,
        isAI: player.isAI,
        aiDifficulty: this.options.aiDifficulty,
      });
    }

    const events = this.game.dispatch({ type: "start" });
    this.started = true;
    this.emitEvents(events);

    // Check if AI needs to act first
    this.checkAITurn();

    return {};
  }

  // ── Player actions ──

  playCard(socketId: string, card: Card): { error?: string } {
    const player = this.findPlayerBySocket(socketId);
    if (!player) return { error: "Not in this room" };

    const currentPlayer = this.game.state.players[this.game.state.currentPlayerIndex];
    if (currentPlayer.id !== player.id) return { error: "Not your turn" };

    const events = this.game.dispatch({
      type: "play-card",
      playerId: player.id,
      card,
    });

    const errorEvent = events.find((e): e is Extract<GameEvent, { type: 'error' }> => e.type === "error");
    if (errorEvent) {
      return { error: (errorEvent as any).message ?? "Invalid play" };
    }

    this.emitEvents(events);
    this.clearTurnTimer();
    this.checkAITurn();
    return {};
  }

  declareTrump(socketId: string, suit: Suit): { error?: string } {
    const player = this.findPlayerBySocket(socketId);
    if (!player) return { error: "Not in this room" };

    const events = this.game.dispatch({
      type: "declare-trump",
      playerId: player.id,
      suit,
    });

    const errorEvent = events.find((e): e is Extract<GameEvent, { type: 'error' }> => e.type === "error");
    if (errorEvent) {
      return { error: (errorEvent as any).message ?? "Invalid action" };
    }

    this.emitEvents(events);
    this.clearTurnTimer();
    this.checkAITurn();
    return {};
  }

  pluckGive(socketId: string, card: Card): { error?: string } {
    const player = this.findPlayerBySocket(socketId);
    if (!player) return { error: "Not in this room" };

    const events = this.game.dispatch({
      type: "pluck-give",
      playerId: player.id,
      card,
    });

    const errorEvent = events.find((e): e is Extract<GameEvent, { type: 'error' }> => e.type === "error");
    if (errorEvent) {
      return { error: (errorEvent as any).message ?? "Invalid action" };
    }

    this.emitEvents(events);
    this.clearTurnTimer();
    this.checkAITurn();
    return {};
  }

  // ── State queries ──

  getState(): GameState {
    return this.game.state;
  }

  /** Get state sanitized for a specific player (hide other hands) */
  getStateForPlayer(playerId: string): object {
    const state = this.game.state;
    const sanitizedHands: Record<string, number> = {};
    const myHand: Card[] = [];

    for (const [pid, hand] of state.hands) {
      sanitizedHands[pid] = hand.length;
      if (pid === playerId) {
        myHand.push(...hand);
      }
    }

    return {
      config: state.config,
      phase: state.phase,
      players: state.players,
      handCounts: sanitizedHands,
      myHand,
      scores: Object.fromEntries(state.scores),
      teamScores: state.teamScores ? Object.fromEntries(state.teamScores) : undefined,
      handNumber: state.handNumber,
      dealerIndex: state.dealerIndex,
      callerIndex: state.callerIndex,
      trumpSuit: state.trumpSuit,
      trumpBroken: state.trumpBroken,
      currentTrick: state.currentTrick,
      trickNumber: state.trickNumber,
      currentPlayerIndex: state.currentPlayerIndex,
      tricksWon: Object.fromEntries(state.tricksWon),
      pendingPlucks: state.pendingPlucks,
      currentPluckIndex: state.currentPluckIndex,
      winnerId: state.winnerId,
      winningTeam: state.winningTeam,
    };
  }

  getLegalMoves(playerId: string): Card[] {
    const state = this.game.state;
    if (state.phase === "playing") {
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.id !== playerId) return [];
      const hand = state.hands.get(playerId) ?? [];
      return getLegalPlays(hand, state);
    }
    if (state.phase === "plucking") {
      const pluck = state.pendingPlucks[state.currentPluckIndex];
      if (!pluck || pluck.pluckerId !== playerId) return [];
      const hand = state.hands.get(playerId) ?? [];
      return getLegalPluckGives(hand);
    }
    return [];
  }

  getPlayers(): RoomPlayer[] {
    return [...this.players.values()];
  }

  isStarted(): boolean {
    return this.started;
  }

  isHost(socketId: string): boolean {
    const player = this.findPlayerBySocket(socketId);
    return player?.id === this.hostPlayerId;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getMaxPlayers(): number {
    return this.options.mode === "three-player" ? 3 : 4;
  }

  // ── AI handling ──

  private checkAITurn(): void {
    if (!this.started) return;
    if (this.game.state.phase === "finished") return;

    const currentPlayerId = this.getCurrentPlayerId();
    if (!currentPlayerId) return;

    const player = this.players.get(currentPlayerId);
    if (!player) return;

    // AI players or disconnected players get AI moves
    if (player.isAI || !player.connected) {
      // Check if a trick just completed — if so, delay so clients can see all cards
      const delay = this.lastTrickJustWon ? 2000 : 600;
      this.lastTrickJustWon = false;
      setTimeout(() => this.runAITurn(currentPlayerId), delay);
    } else {
      // Start turn timer for human players
      this.startTurnTimer(currentPlayerId);
    }
  }

  private getCurrentPlayerId(): string | null {
    const state = this.game.state;

    if (state.phase === "declaring") {
      return state.config.mode === "three-player"
        ? state.players[state.dealerIndex].id
        : state.players[state.callerIndex ?? 0].id;
    }

    if (state.phase === "playing") {
      return state.players[state.currentPlayerIndex].id;
    }

    if (state.phase === "plucking") {
      const pluck = state.pendingPlucks[state.currentPluckIndex];
      return pluck?.pluckerId ?? null;
    }

    return null;
  }

  private runAITurn(playerId: string): void {
    const ai = this.getAI(playerId);
    const state = this.game.state;

    if (state.phase === "declaring") {
      const hand = state.hands.get(playerId) ?? [];
      const suit = ai.pickTrump(hand, state, playerId);
      const events = this.game.dispatch({ type: "declare-trump", playerId, suit });
      this.emitEvents(events);
      this.checkAITurn();
      return;
    }

    if (state.phase === "plucking") {
      const hand = state.hands.get(playerId) ?? [];
      const legal = getLegalPluckGives(hand);
      const pluck = state.pendingPlucks[state.currentPluckIndex];
      if (legal.length > 0 && pluck) {
        const card = ai.pickPluckGive(legal, state, playerId, pluck.pluckeeId);
        const events = this.game.dispatch({ type: "pluck-give", playerId, card });
        this.emitEvents(events);
        this.checkAITurn();
      }
      return;
    }

    if (state.phase === "playing") {
      const hand = state.hands.get(playerId) ?? [];
      const legal = getLegalPlays(hand, state);
      if (legal.length > 0) {
        const card = ai.pickCard(legal, state, playerId);
        const events = this.game.dispatch({ type: "play-card", playerId, card });
        this.emitEvents(events);
        this.checkAITurn();
      }
      return;
    }
  }

  private getAI(playerId: string) {
    if (!this.aiInstances.has(playerId)) {
      this.aiInstances.set(playerId, createAI(this.options.aiDifficulty));
    }
    return this.aiInstances.get(playerId)!;
  }

  // ── Turn timer ──

  private startTurnTimer(playerId: string): void {
    if (this.options.turnTimeoutSeconds <= 0) return;
    this.clearTurnTimer();

    this.turnTimer = setTimeout(() => {
      // Auto-play for timed-out player
      this.runAITurn(playerId);
    }, this.options.turnTimeoutSeconds * 1000);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  // ── Helpers ──

  private findPlayerBySocket(socketId: string): RoomPlayer | undefined {
    return [...this.players.values()].find(p => p.socketId === socketId);
  }

  destroy(): void {
    this.clearTurnTimer();
  }
}
