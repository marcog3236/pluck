"use client";

import { motion } from "framer-motion";
import type { Suit } from "@pluck/engine";

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
}

const SUITS: { suit: Suit; symbol: string; color: string; label: string }[] = [
  { suit: "spades", symbol: "♠", color: "text-slate-200", label: "Spades" },
  { suit: "hearts", symbol: "♥", color: "text-red-400", label: "Hearts" },
  { suit: "diamonds", symbol: "♦", color: "text-red-400", label: "Diamonds" },
  { suit: "clubs", symbol: "♣", color: "text-slate-200", label: "Clubs" },
];

export function TrumpSelector({ onSelect }: TrumpSelectorProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4 bg-slate-800/90 backdrop-blur rounded-2xl p-6 border border-slate-600 shadow-2xl"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <h3 className="text-lg font-bold text-slate-100">Choose Trump Suit</h3>
      <p className="text-sm text-slate-400">You&apos;re the dealer — pick your strongest suit</p>
      <div className="flex gap-3">
        {SUITS.map(({ suit, symbol, color, label }) => (
          <motion.button
            key={suit}
            onClick={() => onSelect(suit)}
            className={`
              flex flex-col items-center gap-1 px-4 py-3 rounded-xl
              bg-slate-700/50 border border-slate-500/50
              hover:bg-slate-600/50 hover:border-slate-400
              transition-colors cursor-pointer
            `}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className={`text-4xl ${color}`}>{symbol}</span>
            <span className="text-xs text-slate-300">{label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
