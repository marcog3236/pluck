"use client";

import type { Socket } from "socket.io-client";
import type { Card, Suit, GameEvent, AIDifficulty } from "@pluck/engine";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3334";

export interface RoomPlayer {
  id: string;
  socketId: string | null;
  name: string;
  isAI: boolean;
  connected: boolean;
}

export interface MultiplayerState {
  roomId: string | null;
  roomCode: string | null;
  playerId: string | null;
  players: RoomPlayer[];
  isHost: boolean;
  connected: boolean;
  gameState: any | null;
  myHand: Card[];
  legalMoves: Card[];
  error: string | null;
}

export type MultiplayerEventHandler = (state: MultiplayerState) => void;

export class MultiplayerClient {
  private socket: Socket | null = null;
  private state: MultiplayerState = {
    roomId: null,
    roomCode: null,
    playerId: null,
    players: [],
    isHost: false,
    connected: false,
    gameState: null,
    myHand: [],
    legalMoves: [],
    error: null,
  };
  private handlers: MultiplayerEventHandler[] = [];

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    // Dynamic import avoids Next.js SSR bundling issues
    const { io } = await import("socket.io-client");

    this.socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on("connect", () => {
      console.log("[PLUCK] Connected:", this.socket?.id);
      this.updateState({ connected: true, error: null });
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[PLUCK] Disconnected:", reason);
      this.updateState({ connected: false });
    });

    this.socket.on("connect_error", (err) => {
      console.error("[PLUCK] Connect error:", err.message);
      this.updateState({ connected: false, error: `Connection failed: ${err.message}` });
    });

    this.socket.on("player-update", (data: { players: RoomPlayer[] }) => {
      this.updateState({ players: data.players });
    });

    this.socket.on("game-events", (data: {
      events: GameEvent[];
      state: any;
      legalMoves?: Card[];
    }) => {
      this.updateState({
        gameState: data.state,
        myHand: data.state?.myHand ?? [],
        legalMoves: data.legalMoves ?? [],
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.state = {
      roomId: null,
      roomCode: null,
      playerId: null,
      players: [],
      isHost: false,
      connected: false,
      gameState: null,
      myHand: [],
      legalMoves: [],
      error: null,
    };
    this.emit();
  }

  onChange(handler: MultiplayerEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  private updateState(partial: Partial<MultiplayerState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private emit(): void {
    for (const handler of this.handlers) {
      handler({ ...this.state });
    }
  }

  getState(): MultiplayerState {
    return { ...this.state };
  }

  // ── Room actions ──

  async createRoom(name: string, options?: { mode?: "three-player" | "four-player"; aiDifficulty?: AIDifficulty }): Promise<string | null> {
    if (!this.socket) return null;

    return new Promise((resolve) => {
      this.socket!.emit("create-room", { name, options }, (res: any) => {
        if (res.error) {
          this.updateState({ error: res.error });
          resolve(null);
        } else {
          this.updateState({
            roomId: res.roomId,
            roomCode: res.code,
            playerId: res.playerId,
            isHost: true,
            error: null,
          });
          resolve(res.code);
        }
      });
    });
  }

  async joinRoom(code: string, name: string): Promise<boolean> {
    if (!this.socket) return false;

    return new Promise((resolve) => {
      this.socket!.emit("join-room", { code, name }, (res: any) => {
        if (res.error) {
          this.updateState({ error: res.error });
          resolve(false);
        } else {
          this.updateState({
            roomId: res.roomId,
            roomCode: code.toUpperCase(),
            playerId: res.playerId,
            players: res.players,
            isHost: false,
            error: null,
          });
          resolve(true);
        }
      });
    });
  }

  async startGame(fillAI: boolean = false): Promise<boolean> {
    if (!this.socket) return false;

    return new Promise((resolve) => {
      this.socket!.emit("start-game", { fillAI }, (res: any) => {
        if (res.error) {
          this.updateState({ error: res.error });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // ── Game actions ──

  playCard(card: Card): void {
    this.socket?.emit("play-card", { card }, (res: any) => {
      if (res.error) this.updateState({ error: res.error });
    });
  }

  declareTrump(suit: Suit): void {
    this.socket?.emit("declare-trump", { suit }, (res: any) => {
      if (res.error) this.updateState({ error: res.error });
    });
  }

  pluckGive(card: Card): void {
    this.socket?.emit("pluck-give", { card }, (res: any) => {
      if (res.error) this.updateState({ error: res.error });
    });
  }
}
