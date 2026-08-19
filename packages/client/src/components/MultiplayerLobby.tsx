"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MultiplayerClient,
  type MultiplayerState,
  type RoomPlayer,
} from "@/lib/multiplayer-client";
import type { AIDifficulty } from "@pluck/engine";

interface MultiplayerLobbyProps {
  onGameStart: (client: MultiplayerClient) => void;
  onBack: () => void;
}

export function MultiplayerLobby({ onGameStart, onBack }: MultiplayerLobbyProps) {
  const clientRef = useRef<MultiplayerClient | null>(null);
  const [mpState, setMpState] = useState<MultiplayerState | null>(null);
  const [screen, setScreen] = useState<"menu" | "create" | "join" | "waiting">("menu");
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const [error, setError] = useState<string | null>(null);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new MultiplayerClient();
      clientRef.current.onChange(setMpState);
    }
    return clientRef.current;
  }, []);

  // Connect eagerly on mount
  useEffect(() => {
    const client = getClient();
    client.connect(); // async, fires connect event when ready
    return () => {
      clientRef.current?.disconnect();
    };
  }, [getClient]);

  // Watch for game start
  useEffect(() => {
    if (mpState?.gameState && mpState.gameState.phase !== "waiting") {
      onGameStart(getClient());
    }
  }, [mpState?.gameState, onGameStart, getClient]);

  const handleCreate = async () => {
    if (!playerName.trim()) { setError("Enter your name"); return; }
    setError(null);
    const client = getClient();
    const code = await client.createRoom(playerName.trim(), { aiDifficulty: difficulty });
    if (code) {
      setScreen("waiting");
    } else {
      setError(client.getState().error ?? "Failed to create room");
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setError("Enter your name"); return; }
    if (!joinCode.trim()) { setError("Enter the room code"); return; }
    setError(null);
    const client = getClient();
    const ok = await client.joinRoom(joinCode.trim(), playerName.trim());
    if (ok) {
      setScreen("waiting");
    } else {
      setError(client.getState().error ?? "Failed to join room");
    }
  };

  const handleStart = async () => {
    const client = getClient();
    const needsAI = (mpState?.players.length ?? 0) < 3;
    await client.startGame(needsAI);
  };

  const isConnected = mpState?.connected ?? false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-6 w-96"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">
            PLUCK
          </h1>
          <p className="text-slate-400 text-xs tracking-widest uppercase">
            Multiplayer
          </p>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
          <span className="text-slate-500">{isConnected ? "Connected" : "Connecting..."}</span>
        </div>

        {/* Error */}
        {(error || mpState?.error) && (
          <div className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg border border-red-500/30 w-full text-center">
            {error || mpState?.error}
          </div>
        )}

        {/* ── Menu screen ── */}
        {screen === "menu" && (
          <div className="flex flex-col gap-3 w-full bg-slate-800/60 backdrop-blur rounded-2xl p-6 border border-slate-600/50">
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-500/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/50 text-center"
              autoFocus
            />
            <motion.button
              onClick={() => setScreen("create")}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold hover:from-amber-400 hover:to-orange-400 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Create Room
            </motion.button>
            <motion.button
              onClick={() => setScreen("join")}
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-500/50 text-slate-200 font-bold hover:bg-slate-600/50 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Join Room
            </motion.button>
            <button
              onClick={onBack}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors cursor-pointer mt-2"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Create room screen ── */}
        {screen === "create" && (
          <div className="flex flex-col gap-3 w-full bg-slate-800/60 backdrop-blur rounded-2xl p-6 border border-slate-600/50">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider">AI Fill Difficulty</span>
              <div className="flex w-full rounded-xl overflow-hidden border border-slate-500/50">
                {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 text-sm font-medium capitalize transition-colors cursor-pointer ${
                      difficulty === d
                        ? d === "easy" ? "bg-emerald-600 text-white"
                          : d === "medium" ? "bg-amber-500 text-slate-900"
                          : "bg-red-600 text-white"
                        : "bg-slate-700/50 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">For empty slots filled with AI</p>
            </div>
            <motion.button
              onClick={handleCreate}
              disabled={!isConnected}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold hover:from-amber-400 hover:to-orange-400 transition-colors cursor-pointer disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Create Room
            </motion.button>
            <button
              onClick={() => setScreen("menu")}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Join room screen ── */}
        {screen === "join" && (
          <div className="flex flex-col gap-3 w-full bg-slate-800/60 backdrop-blur rounded-2xl p-6 border border-slate-600/50">
            <input
              type="text"
              placeholder="Room Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              maxLength={6}
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-500/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/50 text-center text-2xl font-mono tracking-[0.3em]"
              autoFocus
            />
            <motion.button
              onClick={handleJoin}
              disabled={!isConnected}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold hover:from-amber-400 hover:to-orange-400 transition-colors cursor-pointer disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Join
            </motion.button>
            <button
              onClick={() => setScreen("menu")}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Waiting room ── */}
        {screen === "waiting" && mpState && (
          <div className="flex flex-col gap-4 w-full bg-slate-800/60 backdrop-blur rounded-2xl p-6 border border-slate-600/50">
            {/* Room code */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Room Code</span>
              <div className="text-4xl font-mono font-black text-amber-400 tracking-[0.3em]">
                {mpState.roomCode}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(mpState.roomCode ?? "")}
                className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Copy code
              </button>
            </div>

            {/* Player list */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Players ({mpState.players.length}/3)</span>
              {mpState.players.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    p.id === mpState.playerId ? "bg-indigo-900/30 border border-indigo-500/30" : "bg-slate-700/30"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    p.isAI ? "bg-slate-600 text-slate-300" : p.connected ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                  }`}>
                    {p.isAI ? "🤖" : p.name[0]}
                  </div>
                  <span className="text-sm text-slate-200">{p.name}</span>
                  {p.id === mpState.playerId && (
                    <span className="text-[10px] text-amber-400 ml-auto">You</span>
                  )}
                  {i === 0 && (
                    <span className="text-[10px] text-slate-500 ml-auto">Host</span>
                  )}
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: 3 - mpState.players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/20 border border-dashed border-slate-600/30">
                  <div className="w-6 h-6 rounded-full bg-slate-700/50 flex items-center justify-center text-xs text-slate-500">?</div>
                  <span className="text-sm text-slate-500">Waiting...</span>
                </div>
              ))}
            </div>

            {/* Start button (host only) */}
            {mpState.isHost && (
              <motion.button
                onClick={handleStart}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:from-emerald-400 hover:to-teal-400 transition-colors cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {mpState.players.length < 3 ? "Start with AI" : "Start Game"}
              </motion.button>
            )}
            {!mpState.isHost && (
              <p className="text-sm text-slate-500 text-center">Waiting for host to start...</p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
