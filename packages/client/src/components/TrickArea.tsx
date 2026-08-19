"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PlayingCard } from "./PlayingCard";
import type { Trick, Player } from "@pluck/engine";

interface TrickAreaProps {
  trick: Trick;
  players: Player[];
  trickWinner: string | null;
  trumpSuit: string | null;
}

const SUIT_SYMBOLS: Record<string, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  clubs: "text-slate-300",
  diamonds: "text-red-400",
  hearts: "text-red-400",
  spades: "text-slate-300",
};

export function TrickArea({
  trick,
  players,
  trickWinner,
  trumpSuit,
}: TrickAreaProps) {
  // Position cards in a centered cluster (not spread to edges)
  const getOffset = (playerId: string): { x: number; y: number } => {
    const playerIndex = players.findIndex((p) => p.id === playerId);
    const humanIndex = players.findIndex((p) => p.id === "human");
    const relative =
      (playerIndex - humanIndex + players.length) % players.length;

    if (players.length === 3) {
      switch (relative) {
        case 0: return { x: 0, y: 40 };     // Human (bottom-center)
        case 1: return { x: -60, y: -30 };   // Left opponent
        case 2: return { x: 60, y: -30 };    // Right opponent
        default: return { x: 0, y: 0 };
      }
    }
    switch (relative) {
      case 0: return { x: 0, y: 50 };
      case 1: return { x: -70, y: 0 };
      case 2: return { x: 0, y: -50 };
      case 3: return { x: 70, y: 0 };
      default: return { x: 0, y: 0 };
    }
  };

  const getPlayerName = (playerId: string): string =>
    players.find((p) => p.id === playerId)?.name ?? playerId;

  return (
    <div className="relative w-64 h-44 mx-auto">
      {/* Trump indicator */}
      {trumpSuit && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-800/80 rounded-full px-3 py-1 border border-slate-600/50">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Trump</span>
          <span className={`text-lg ${SUIT_COLORS[trumpSuit]}`}>
            {SUIT_SYMBOLS[trumpSuit]}
          </span>
        </div>
      )}

      {/* Played cards */}
      <AnimatePresence>
        {trick.plays.map((play) => {
          const isWinner = trickWinner === play.playerId;
          const offset = getOffset(play.playerId);
          return (
            <motion.div
              key={`trick-${play.playerId}`}
              className="absolute left-1/2 top-1/2"
              style={{ zIndex: isWinner ? 10 : 1 }}
              initial={{ scale: 0.3, opacity: 0, x: offset.x - 25, y: offset.y - 35 }}
              animate={{
                scale: isWinner ? 1.08 : 1,
                opacity: 1,
                x: offset.x - 25,
                y: offset.y - 35,
              }}
              exit={{ scale: 0.3, opacity: 0, y: offset.y - 55 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-slate-500 font-medium">
                  {getPlayerName(play.playerId)}
                </span>
                <div className={isWinner ? "ring-2 ring-amber-400 rounded-md" : ""}>
                  <PlayingCard card={play.card} size="sm" disabled animate={false} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty state */}
      {trick.plays.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[52px] h-[74px] rounded-md border-2 border-dashed border-slate-700/40 flex items-center justify-center">
            <span className="text-slate-700 text-[10px]">Play</span>
          </div>
        </div>
      )}
    </div>
  );
}
