"use client";

import { motion } from "framer-motion";
import { useViewportSize } from "@/hooks/useViewportSize";
import type { GameState, Player } from "@pluck/engine";

interface GameStatusProps {
  state: GameState;
  isMyTurn: boolean;
}

export function GameStatus({ state, isMyTurn }: GameStatusProps) {
  const { phase, trickNumber, config } = state;
  const { isMobile } = useViewportSize();
  const totalTricks = config.mode === "three-player" ? 17 : 13;

  const getStatusText = (): string => {
    switch (phase) {
      case "declaring":
        if (isMyTurn) return isMobile ? "Pick trump!" : "Choose your trump suit!";
        return isMobile ? "Picking trump..." : "Waiting for dealer to choose trump...";
      case "plucking":
        if (isMyTurn) return isMobile ? "Pluck a card!" : "Choose a card to pluck!";
        return isMobile ? "Plucking..." : "Plucking in progress...";
      case "playing":
        if (isMyTurn) return isMobile ? "Your turn" : "Your turn — select a card to play";
        return isMobile ? "Waiting..." : "Waiting for opponent...";
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
    <div className="flex items-center justify-between gap-1">
      <motion.div
        key={getStatusText()}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-base font-medium ${statusColor} whitespace-nowrap`}
      >
        {isMyTurn && phase === "playing" && (
          <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full mr-1.5 sm:mr-2 animate-pulse" />
        )}
        {getStatusText()}
      </motion.div>

      {phase === "playing" && (
        <span className="text-sm text-slate-500 whitespace-nowrap">
          {trickNumber + 1}/{totalTricks}
        </span>
      )}
    </div>
  );
}
