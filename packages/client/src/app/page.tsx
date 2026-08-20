"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GameTable } from "@/components/GameTable";
import { MultiplayerLobby } from "@/components/MultiplayerLobby";
import { MultiplayerGame } from "@/components/MultiplayerGame";
import type { MultiplayerClient } from "@/lib/multiplayer-client";

type Screen = "home" | "solo" | "multiplayer-lobby" | "multiplayer-game";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mpClient, setMpClient] = useState<MultiplayerClient | null>(null);

  if (screen === "solo") {
    return <GameTable onBack={() => setScreen("home")} />;
  }

  if (screen === "multiplayer-lobby") {
    return (
      <MultiplayerLobby
        onGameStart={(client) => {
          setMpClient(client);
          setScreen("multiplayer-game");
        }}
        onBack={() => setScreen("home")}
      />
    );
  }

  if (screen === "multiplayer-game" && mpClient) {
    return (
      <MultiplayerGame
        client={mpClient}
        onLeave={() => {
          setMpClient(null);
          setScreen("home");
        }}
      />
    );
  }

  // ── Home screen ──
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">
            PLUCK
          </h1>
          <p className="text-slate-400 text-sm tracking-widest uppercase">
            Trick-Taking Card Game
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-80">
          <motion.button
            onClick={() => setScreen("solo")}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold text-lg hover:from-amber-400 hover:to-orange-400 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🤖 Play vs AI
          </motion.button>

          <motion.button
            onClick={() => setScreen("multiplayer-lobby")}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-lg hover:from-indigo-400 hover:to-purple-400 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🌐 Multiplayer
          </motion.button>

          <p className="text-xs text-slate-500 text-center mt-2">
            3-player trick-taking · First to 10 points wins
          </p>
          <p className="text-[10px] text-slate-700 mt-4">v0.2.0</p>
        </div>
      </motion.div>
    </div>
  );
}
