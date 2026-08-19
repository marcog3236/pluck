"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  MultiplayerClient,
  type MultiplayerState,
} from "@/lib/multiplayer-client";
import type { Card, Suit, GameEvent } from "@pluck/engine";
import { sortHand, cardsEqual } from "@pluck/engine";

/**
 * Shared game interface — both solo and multiplayer
 * return the same shape so GameTable works with either.
 */
export interface GameHandle {
  // State
  phase: string;
  players: any[];
  hand: Card[];
  legalMoves: Card[];
  isMyTurn: boolean;
  myPlayerId: string;
  trumpSuit: string | null;
  trumpBroken: boolean;
  currentTrick: any;
  trickNumber: number;
  currentPlayerIndex: number;
  dealerIndex: number;
  callerIndex?: number;
  handNumber: number;
  tricksWon: Record<string, number>;
  scores: Record<string, number>;
  config: any;
  winnerId: string | null;
  winningTeam: number | null;
  handCounts: Record<string, number>;
  pendingPlucks: any[];
  currentPluckIndex: number;

  // UI state
  trickWinner: string | null;

  // Actions
  playCard: (card: Card) => void;
  declareTrump: (suit: Suit) => void;
  pluckGive: (card: Card) => void;
}

export function useMultiplayerGame(client: MultiplayerClient): GameHandle | null {
  const [mpState, setMpState] = useState<MultiplayerState>(client.getState());
  const [trickWinner, setTrickWinner] = useState<string | null>(null);
  const prevTrickRef = useRef<number>(-1);

  useEffect(() => {
    const unsub = client.onChange((state) => {
      setMpState(state);

      // Detect trick winner from state changes
      if (state.gameState) {
        const tn = state.gameState.trickNumber ?? 0;
        if (tn > prevTrickRef.current && prevTrickRef.current >= 0) {
          // A trick just completed — the last trick's winner isn't directly
          // in the server state, but we can infer from trick count change
          // For now, clear after a delay
          setTrickWinner(null);
        }
        prevTrickRef.current = tn;
      }
    });
    return unsub;
  }, [client]);

  const gs = mpState.gameState;
  if (!gs || !mpState.playerId) return null;

  const myPlayerId = mpState.playerId;

  // Determine if it's my turn
  const isMyTurn = (() => {
    if (gs.phase === "playing") {
      return gs.players[gs.currentPlayerIndex]?.id === myPlayerId;
    }
    if (gs.phase === "declaring") {
      const declarerIdx = gs.config.mode === "three-player"
        ? gs.dealerIndex
        : (gs.callerIndex ?? 0);
      return gs.players[declarerIdx]?.id === myPlayerId;
    }
    if (gs.phase === "plucking") {
      const pluck = gs.pendingPlucks?.[gs.currentPluckIndex];
      return pluck?.pluckerId === myPlayerId;
    }
    return false;
  })();

  const hand = sortHand(mpState.myHand ?? [], gs.trumpSuit ?? undefined);

  // Build hand counts from server state
  const handCounts: Record<string, number> = gs.handCounts ?? {};

  // Scores and tricks as plain objects (server sends them serialized)
  const scores: Record<string, number> = gs.scores ?? {};
  const tricksWon: Record<string, number> = gs.tricksWon ?? {};

  return {
    phase: gs.phase,
    players: gs.players,
    hand,
    legalMoves: mpState.legalMoves ?? [],
    isMyTurn,
    myPlayerId,
    trumpSuit: gs.trumpSuit,
    trumpBroken: gs.trumpBroken,
    currentTrick: gs.currentTrick ?? { plays: [], ledSuit: null, winnerId: null },
    trickNumber: gs.trickNumber ?? 0,
    currentPlayerIndex: gs.currentPlayerIndex ?? 0,
    dealerIndex: gs.dealerIndex ?? 0,
    callerIndex: gs.callerIndex,
    handNumber: gs.handNumber ?? 0,
    tricksWon,
    scores,
    config: gs.config,
    winnerId: gs.winnerId ?? null,
    winningTeam: gs.winningTeam ?? null,
    handCounts,
    pendingPlucks: gs.pendingPlucks ?? [],
    currentPluckIndex: gs.currentPluckIndex ?? 0,
    trickWinner,

    playCard: (card: Card) => client.playCard(card),
    declareTrump: (suit: Suit) => client.declareTrump(suit),
    pluckGive: (card: Card) => client.pluckGive(card),
  };
}
