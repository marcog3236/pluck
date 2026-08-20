"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GameController } from "@/lib/game-controller";
import type { Card, Suit, GameState, GameEvent, GameConfig, AIDifficulty } from "@pluck/engine";
import type { GameHandle } from "./useMultiplayerGame";

export interface UseGameReturn {
  state: GameState | null;
  handle: GameHandle | null;
  hand: Card[];
  legalMoves: Card[];
  isMyTurn: boolean;
  lastEvents: GameEvent[];
  trickWinner: string | null;
  startGame: (name: string, difficulty?: AIDifficulty) => void;
  playCard: (card: Card) => void;
  declareTrump: (suit: Suit) => void;
  pluckGive: (card: Card) => void;
  newGame: () => void;
}

export function useGame(config: Partial<GameConfig> = {}): UseGameReturn {
  const controllerRef = useRef<GameController | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [trickWinner, setTrickWinner] = useState<string | null>(null);
  const [completedTrick, setCompletedTrick] = useState<any>(null);
  const completedTrickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getController = useCallback((difficulty?: AIDifficulty) => {
    if (!controllerRef.current) {
      controllerRef.current = new GameController(config, difficulty);
    }
    return controllerRef.current;
  }, []);

  const handleEvents = useCallback((events: GameEvent[], ctrl: GameController) => {
    setLastEvents(events);

    const trickWon = events.find((e) => e.type === "trick-won");
    if (trickWon && trickWon.type === "trick-won") {
      setCompletedTrick((trickWon as any).trick);
      setTrickWinner(trickWon.winnerId);

      if (completedTrickTimer.current) clearTimeout(completedTrickTimer.current);
      completedTrickTimer.current = setTimeout(() => {
        setCompletedTrick(null);
        setTrickWinner(null);
      }, 1800);
    }

    setState({ ...ctrl.state });
  }, []);

  // Set up event handler
  useEffect(() => {
    const ctrl = getController();
    const unsub = ctrl.onEvent((events) => handleEvents(events, ctrl));
    return unsub;
  }, [getController, handleEvents]);

  const startGame = useCallback(
    (name: string, difficulty?: AIDifficulty) => {
      if (difficulty) {
        controllerRef.current = new GameController(config, difficulty);
      }
      const ctrl = controllerRef.current ?? getController(difficulty);
      ctrl.onEvent((events) => handleEvents(events, ctrl));
      ctrl.startGame(name);
      setState({ ...ctrl.state });
    },
    [getController, config, handleEvents]
  );

  const playCard = useCallback(
    (card: Card) => {
      const ctrl = getController();
      ctrl.playCard(card);
    },
    [getController]
  );

  const declareTrump = useCallback(
    (suit: Suit) => {
      const ctrl = getController();
      ctrl.declareTrump(suit);
    },
    [getController]
  );

  const pluckGive = useCallback(
    (card: Card) => {
      const ctrl = getController();
      ctrl.pluckGive(card);
    },
    [getController]
  );

  const newGame = useCallback(() => {
    controllerRef.current = new GameController(config);
    const ctrl = controllerRef.current;
    ctrl.onEvent((events) => handleEvents(events, ctrl));
    setState(null);
    setLastEvents([]);
    setTrickWinner(null);
    setCompletedTrick(null);
  }, [config]);

  const ctrl = controllerRef.current;
  const hand = ctrl?.getHumanHand() ?? [];
  const legalMoves = ctrl?.getHumanLegalMoves() ?? [];
  const isMyTurn = ctrl?.isHumanTurn() ?? false;

  // Build GameHandle from solo state for unified interface
  const displayTrick = completedTrick ?? state?.currentTrick ?? { plays: [], ledSuit: null, winnerId: null };

  const handle: GameHandle | null = state ? {
    phase: state.phase,
    players: state.players,
    hand,
    legalMoves,
    isMyTurn,
    myPlayerId: "human",
    trumpSuit: state.trumpSuit,
    trumpBroken: state.trumpBroken,
    currentTrick: state.currentTrick,
    displayTrick,
    trickNumber: state.trickNumber,
    currentPlayerIndex: state.currentPlayerIndex,
    dealerIndex: state.dealerIndex,
    callerIndex: state.callerIndex,
    handNumber: state.handNumber,
    tricksWon: Object.fromEntries(state.tricksWon),
    scores: Object.fromEntries(state.scores),
    config: state.config,
    winnerId: state.winnerId,
    winningTeam: state.winningTeam,
    handCounts: Object.fromEntries(
      [...state.hands.entries()].map(([k, v]) => [k, v.length])
    ),
    pendingPlucks: state.pendingPlucks,
    currentPluckIndex: state.currentPluckIndex,
    trickWinner,
    playCard,
    declareTrump,
    pluckGive,
  } : null;

  return {
    state,
    handle,
    hand,
    legalMoves,
    isMyTurn,
    lastEvents,
    trickWinner,
    startGame,
    playCard,
    declareTrump,
    pluckGive,
    newGame,
  };
}
