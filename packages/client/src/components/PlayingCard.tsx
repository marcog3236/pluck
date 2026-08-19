"use client";

import { motion } from "framer-motion";
import type { Card } from "@pluck/engine";

const SUIT_SYMBOLS: Record<string, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  clubs: "#1a1a2e",
  diamonds: "#dc2626",
  hearts: "#dc2626",
  spades: "#1a1a2e",
};

interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
  layoutId?: string;
}

const SIZE_CONFIG = {
  xs: { w: "w-10", h: "h-14", rank: "text-[9px]", suit: "text-xs", center: "text-lg", corner: "top-px left-0.5", cornerB: "bottom-px right-0.5", gap: "-mt-px", radius: "rounded" },
  sm: { w: "w-[50px]", h: "h-[70px]", rank: "text-[11px]", suit: "text-sm", center: "text-xl", corner: "top-0.5 left-1", cornerB: "bottom-0.5 right-1", gap: "-mt-px", radius: "rounded" },
  md: { w: "w-[56px]", h: "h-[80px]", rank: "text-xs", suit: "text-base", center: "text-2xl", corner: "top-0.5 left-1", cornerB: "bottom-0.5 right-1", gap: "-mt-px", radius: "rounded" },
  lg: { w: "w-[72px]", h: "h-[104px]", rank: "text-sm", suit: "text-lg", center: "text-3xl", corner: "top-1 left-1.5", cornerB: "bottom-1 right-1.5", gap: "-mt-0.5", radius: "rounded-md" },
};

export function PlayingCard({
  card,
  onClick,
  disabled = false,
  highlighted = false,
  selected = false,
  faceDown = false,
  size = "md",
  className = "",
  animate = true,
  layoutId,
}: PlayingCardProps) {
  const s = SIZE_CONFIG[size];

  if (faceDown) {
    return (
      <motion.div
        layoutId={layoutId}
        className={`
          ${s.w} ${s.h} ${s.radius} border border-slate-500/60
          bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950
          shadow-md flex items-center justify-center select-none
          ${className}
        `}
        initial={animate ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className={`w-3/4 h-3/4 rounded-sm border border-amber-500/30 bg-gradient-to-br from-amber-900/10 to-purple-900/10 flex items-center justify-center`}>
          <span className="text-amber-500/50 font-black text-xs">P</span>
        </div>
      </motion.div>
    );
  }

  if (card.type === "joker") {
    const isBig = card.kind === "big";
    return (
      <motion.button
        layoutId={layoutId}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`
          ${s.w} ${s.h} ${s.radius} border relative overflow-hidden select-none
          ${selected ? "border-amber-400 shadow-amber-400/40 shadow-md ring-1 ring-amber-400/50" : "border-slate-300/80"}
          ${highlighted && !disabled ? "border-emerald-400 shadow-emerald-400/20 shadow-sm cursor-pointer" : ""}
          ${disabled && !selected ? "opacity-40 cursor-not-allowed" : ""}
          bg-white shadow-sm flex flex-col items-center justify-center gap-0
          ${className}
        `}
        initial={animate ? { scale: 0.9, opacity: 0, y: 10 } : false}
        animate={{ scale: 1, opacity: 1, y: selected ? -14 : 0 }}
        whileHover={!disabled ? { y: -6, transition: { duration: 0.15 } } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <span className={`${s.center}`}>{isBig ? "🃏" : "🂿"}</span>
        <span className={`text-[8px] font-black tracking-tight ${isBig ? "text-red-600" : "text-blue-800"}`}>
          {isBig ? "BIG" : "LIL"}
        </span>
      </motion.button>
    );
  }

  const suit = card.suit;
  const rank = card.rank;
  const color = SUIT_COLORS[suit];
  const symbol = SUIT_SYMBOLS[suit];

  return (
    <motion.button
      layoutId={layoutId}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        ${s.w} ${s.h} ${s.radius} border relative overflow-hidden select-none
        ${selected ? "border-amber-400 shadow-amber-400/40 shadow-md ring-1 ring-amber-400/50" : "border-slate-300/80"}
        ${highlighted && !disabled ? "border-emerald-400 shadow-emerald-400/20 shadow-sm cursor-pointer" : ""}
        ${disabled && !selected ? "opacity-40 cursor-not-allowed" : ""}
        bg-white shadow-sm
        ${className}
      `}
      style={{ color }}
      initial={animate ? { scale: 0.9, opacity: 0, y: 10 } : false}
      animate={{ scale: 1, opacity: 1, y: selected ? -14 : 0 }}
      whileHover={!disabled ? { y: -6, transition: { duration: 0.15 } } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      {/* Top-left corner */}
      <div className={`absolute ${s.corner} flex flex-col items-center leading-none`}>
        <span className={`${s.rank} font-black`}>{rank}</span>
        <span className={`${s.suit} ${s.gap} leading-none`}>{symbol}</span>
      </div>

      {/* Center suit watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${s.center} opacity-20`}>{symbol}</span>
      </div>

      {/* Bottom-right corner (inverted) */}
      <div className={`absolute ${s.cornerB} flex flex-col items-center leading-none rotate-180`}>
        <span className={`${s.rank} font-black`}>{rank}</span>
        <span className={`${s.suit} ${s.gap} leading-none`}>{symbol}</span>
      </div>
    </motion.button>
  );
}

/** Card back for opponent hands */
export function CardBack({
  size = "xs",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const s = SIZE_CONFIG[size];
  return (
    <div
      className={`
        ${s.w} ${s.h} ${s.radius} border border-slate-600/60
        bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950
        shadow-sm select-none
        ${className}
      `}
    />
  );
}
