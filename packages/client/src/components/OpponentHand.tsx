"use client";

import { CardBack } from "./PlayingCard";

interface OpponentHandProps {
  name: string;
  cardCount: number;
  tricksWon: number;
  quota: number;
  position: "left" | "right" | "top";
  isCurrentPlayer: boolean;
}

export function OpponentHand({
  name,
  cardCount,
  tricksWon,
  quota,
  position,
  isCurrentPlayer,
}: OpponentHandProps) {
  // Show up to 10 card backs with tight overlap
  const visibleCards = Math.min(cardCount, 10);
  const overlapPx = 14;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Player info pill */}
      <div
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
          ${isCurrentPlayer
            ? "bg-emerald-900/60 border border-emerald-500/40 shadow-emerald-500/10 shadow-sm"
            : "bg-slate-800/70 border border-slate-600/40"}
        `}
      >
        <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300">
          {name[0]}
        </div>
        <span className="text-slate-200 font-medium">{name}</span>
        <span className="text-slate-400 tabular-nums">
          {tricksWon}/{quota}
        </span>
      </div>

      {/* Cards fan */}
      <div className="flex items-end" style={{ height: 56 }}>
        {Array.from({ length: visibleCards }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === visibleCards - 1 ? 40 : overlapPx,
              flexShrink: 0,
              transform: `rotate(${(i - (visibleCards - 1) / 2) * 2.5}deg)`,
              transformOrigin: "bottom center",
              zIndex: i,
              position: "relative",
            }}
          >
            <CardBack size="xs" />
          </div>
        ))}
        {cardCount > 10 && (
          <span className="text-[10px] text-slate-500 ml-1 self-center">
            +{cardCount - 10}
          </span>
        )}
      </div>
    </div>
  );
}
