"use client";

import type { GameState } from "@pluck/engine";
import { getQuota3Player } from "@pluck/engine";
import { useViewportSize } from "@/hooks/useViewportSize";

interface ScoreBoardProps {
  state: GameState;
}

/** Compact inline scoreboard — collapses on mobile */
export function ScoreBoard({ state }: ScoreBoardProps) {
  const { players, scores, tricksWon, handNumber, config, dealerIndex } = state;
  const { isMobile } = useViewportSize();

  if (isMobile) {
    // Ultra-compact: "H2 · You 3 · Bot1 2 · Bot2 1"
    return (
      <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg border border-slate-700/40 px-2.5 py-1.5 overflow-x-auto max-w-[70vw]">
        <span className="text-sm text-slate-500 font-medium whitespace-nowrap">
          H{handNumber}
        </span>
        {players.map((player, i) => {
          const score = scores.get(player.id) ?? 0;
          const tricks = tricksWon.get(player.id) ?? 0;
          const quota =
            config.mode === "three-player"
              ? getQuota3Player(player.position, dealerIndex)
              : 0;
          const isDealer = player.position === dealerIndex;

          return (
            <div key={player.id} className="flex items-center gap-0.5">
              {i > 0 && <span className="text-slate-600">·</span>}
              <span className="text-sm text-slate-300 truncate max-w-[52px] font-medium">
                {player.id === "human" ? "You" : player.name}
              </span>
              {isDealer && (
                <span className="text-xs text-amber-400 font-bold">D</span>
              )}
              <span className="text-base font-bold text-amber-400 tabular-nums">
                {score}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {tricks}/{quota}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop: full scoreboard
  return (
    <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl border border-slate-700/40 px-3 py-2">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium whitespace-nowrap">
        Hand {handNumber}
      </span>
      <div className="w-px h-5 bg-slate-700/50" />
      {players.map((player, i) => {
        const score = scores.get(player.id) ?? 0;
        const tricks = tricksWon.get(player.id) ?? 0;
        const quota =
          config.mode === "three-player"
            ? getQuota3Player(player.position, dealerIndex)
            : 0;
        const isDealer = player.position === dealerIndex;

        return (
          <div key={player.id} className="flex items-center gap-1.5">
            {i > 0 && <div className="w-px h-4 bg-slate-700/30" />}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${
                player.id === "human"
                  ? "bg-indigo-900/30"
                  : "bg-transparent"
              }`}
            >
              <span className="text-xs text-slate-300 font-medium">
                {player.name}
              </span>
              {isDealer && (
                <span className="text-[9px] text-amber-400 font-bold">D</span>
              )}
              <span className="text-sm font-bold text-amber-400 tabular-nums">
                {score}
              </span>
              <span className="text-[10px] text-slate-500 tabular-nums">
                ({tricks}/{quota})
              </span>
            </div>
          </div>
        );
      })}
      <div className="w-px h-5 bg-slate-700/50" />
      <span className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap">
        to {config.pointsToWin}
      </span>
    </div>
  );
}
