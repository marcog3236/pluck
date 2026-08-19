"use client";

import { motion } from "framer-motion";
import type { GameState, Player } from "@pluck/engine";

interface GameStatusProps {
  state: GameState;
  isMyTurn: boolean;
}

export function GameStatus({ state, isMyTurn }: GameStatusProps) {
  const { phase, trickNumber, config } = state;
  const totalTricks = config.mode === "three-player" ? 17 : 13;

  const getStatusText = (): string => {
    switch (phase) {
      case "declaring":
        if (isMyTurn) return "Choose your trump suit!";
        return "Waiting for dealer to choose trump...";
      case "plucking":
        if (isMyTurn) return "Choose a card to pluck!";
        return "Plucking in progress...";
      case "playing":
        if (isMyTurn) return "Your turn — select a card to play";
        return "Waiting for opponent...";
      case "scoring":
        return "Scoring...";
      case "finished": {
        const winnerId = state.winnerId;
        if (winnerId === "human") return "🎉 You win!";
        const winner = state.players.find((p) => p.id === winnerId);
        return `${winner?.name ?? "Opponent"} wins!`;
      }
      default:
        return "";
    }
  };

  const statusColor = isMyTurn
    ? "text-emerald-400"
    : phase === "finished"
    ? state.winnerId === "human"
      ? "text-amber-400"
      : "text-red-400"
    : "text-slate-400";

  return (
    <div className="flex items-center justify-between">
      <motion.div
        key={getStatusText()}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-sm font-medium ${statusColor}`}
      >
        {isMyTurn && phase === "playing" && (
          <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
        )}
        {getStatusText()}
      </motion.div>

      {phase === "playing" && (
        <span className="text-xs text-slate-500">
          Trick {trickNumber + 1} / {totalTricks}
        </span>
      )}
    </div>
  );
}
