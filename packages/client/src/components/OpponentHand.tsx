"use client";

import { CardBack } from "./PlayingCard";
import { useViewportSize } from "@/hooks/useViewportSize";

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
  const { isMobile } = useViewportSize();

  // Mobile: compact inline card count; Desktop: fanned cards
  const maxVisible = isMobile ? 3 : 10;
  const visibleCards = Math.min(cardCount, maxVisible);
  const overlapPx = isMobile ? 8 : 14;
  const cardSize = isMobile ? "2xs" as const : "xs" as const;

  return (
    <div className={`flex items-center gap-2 ${isMobile ? "flex-row" : "flex-col"}`}>
      {/* Player info pill */}
      <div
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-full
          ${isCurrentPlayer
            ? "bg-emerald-900/60 border border-emerald-500/40 shadow-emerald-500/10 shadow-sm"
            : "bg-slate-800/70 border border-slate-600/40"}
        `}
      >
        <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
          {name[0]}
        </div>
        <span className="text-sm text-slate-200 font-medium">{name}</span>
        <span className="text-sm text-slate-400 tabular-nums">
          {tricksWon}/{quota}
        </span>
        {isMobile && (
          <span className="text-xs text-slate-500 tabular-nums">
            🃏{cardCount}
          </span>
        )}
      </div>

      {/* Cards fan — compact on mobile, full on desktop */}
      {!isMobile && (
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
              <CardBack size={cardSize} />
            </div>
          ))}
          {cardCount > maxVisible && (
            <span className="text-[9px] text-slate-500 ml-1 self-center">
              +{cardCount - maxVisible}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
