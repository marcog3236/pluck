"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/hooks/useGame";
import type { GameHandle } from "@/hooks/useMultiplayerGame";
import { PlayerHand } from "./PlayerHand";
import { OpponentHand } from "./OpponentHand";
import { TrickArea } from "./TrickArea";
import { TrumpSelector } from "./TrumpSelector";
import { ScoreBoard } from "./ScoreBoard";
import { GameStatus } from "./GameStatus";
import type { Card, AIDifficulty } from "@pluck/engine";
import { getQuota3Player } from "@pluck/engine";

interface GameTableProps {
  /** If provided, uses this handle (multiplayer). Otherwise runs solo. */
  multiplayerHandle?: GameHandle;
  onBack?: () => void;
}

export function GameTable({ multiplayerHandle, onBack }: GameTableProps) {
  const solo = useGame({ mode: "three-player", pointsToWin: 10 });

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");

  // Use multiplayer handle if provided, otherwise solo
  const h = multiplayerHandle ?? solo.handle;
  const isMultiplayer = !!multiplayerHandle;

  // ── Pre-game lobby (solo only) ──
  if (!isMultiplayer && (!solo.state || solo.state.phase === "waiting")) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">
              PLUCK
            </h1>
            <p className="text-slate-400 text-sm tracking-widest uppercase">
              Trick-Taking Card Game
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 bg-slate-800/60 backdrop-blur rounded-2xl p-8 border border-slate-600/50 shadow-2xl w-80">
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && playerName.trim()) {
                  solo.startGame(playerName.trim(), difficulty);
                }
              }}
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-500/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/50 text-center"
              autoFocus
            />

            {/* Difficulty selector */}
            <div className="flex flex-col items-center gap-2 w-full">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Difficulty</span>
              <div className="flex w-full rounded-xl overflow-hidden border border-slate-500/50">
                {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 text-sm font-medium capitalize transition-colors cursor-pointer ${
                      difficulty === d
                        ? d === "easy"
                          ? "bg-emerald-600 text-white"
                          : d === "medium"
                          ? "bg-amber-500 text-slate-900"
                          : "bg-red-600 text-white"
                        : "bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">
                {difficulty === "easy"
                  ? "Relaxed — bots play loosely"
                  : difficulty === "medium"
                  ? "Solid — heuristic trick-taking strategy"
                  : "Ruthless — card counting & strategic play"}
              </p>
            </div>

            <motion.button
              onClick={() => solo.startGame(playerName.trim() || "Player", difficulty)}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold text-lg hover:from-amber-400 hover:to-orange-400 transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Play vs AI
            </motion.button>
            <p className="text-xs text-slate-500 text-center">
              3-player mode · First to 10 points wins
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors cursor-pointer mt-1"
              >
                ← Back
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── No game handle yet ──
  if (!h) return null;

  // ── Active game (works for both solo & multiplayer) ──
  const myId = h.myPlayerId;
  const opponents = h.players.filter((p: any) => p.id !== myId);
  const currentPlayerId = h.players[h.currentPlayerIndex]?.id;
  const humanPlayer = h.players.find((p: any) => p.id === myId);
  const humanQuota = humanPlayer
    ? getQuota3Player(humanPlayer.position, h.dealerIndex)
    : 0;
  const isDealer = humanPlayer?.position === h.dealerIndex;

  // Build a state-like object for ScoreBoard/GameStatus
  const stateProxy = {
    config: h.config,
    phase: h.phase,
    players: h.players,
    scores: new Map(Object.entries(h.scores)),
    tricksWon: new Map(Object.entries(h.tricksWon)),
    handNumber: h.handNumber,
    dealerIndex: h.dealerIndex,
    currentPlayerIndex: h.currentPlayerIndex,
    trickNumber: h.trickNumber,
    currentTrick: h.currentTrick,
    displayTrick: h.displayTrick,
    trumpSuit: h.trumpSuit,
    trumpBroken: h.trumpBroken,
    winnerId: h.winnerId,
    winningTeam: h.winningTeam,
    pointsToWin: h.config.pointsToWin,
  };

  return (
    <div className="h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-900/80 border-b border-slate-700/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 flex-shrink-0">
            PLUCK
          </h1>
          {isMultiplayer && (
            <span className="text-[10px] text-indigo-400 bg-indigo-900/30 px-1.5 py-0.5 rounded-full border border-indigo-500/30">
              LIVE
            </span>
          )}
        </div>
        <ScoreBoard state={stateProxy as any} />
        <div className="flex items-center gap-3 flex-shrink-0">
          <GameStatus state={stateProxy as any} isMyTurn={h.isMyTurn} />
          <button
            onClick={onBack ?? solo.newGame}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-slate-700/50 cursor-pointer whitespace-nowrap"
          >
            {isMultiplayer ? "Leave" : "New Game"}
          </button>
        </div>
      </div>

      {/* ── Game area ── */}
      <div className="flex-1 flex flex-col justify-between min-h-0 px-4">
        {/* Opponents */}
        <div className="flex justify-center gap-16 pt-2 flex-shrink-0">
          {opponents.map((opp: any, i: number) => (
            <OpponentHand
              key={opp.id}
              name={opp.name}
              cardCount={h.handCounts[opp.id] ?? 0}
              tricksWon={h.tricksWon[opp.id] ?? 0}
              quota={getQuota3Player(opp.position, h.dealerIndex)}
              position={i === 0 ? "left" : "right"}
              isCurrentPlayer={currentPlayerId === opp.id}
            />
          ))}
        </div>

        {/* Center */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          {h.phase === "declaring" && h.isMyTurn ? (
            <TrumpSelector onSelect={h.declareTrump} />
          ) : h.phase === "finished" ? (
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="text-5xl">
                {h.winnerId === myId ? "🏆" : "😔"}
              </div>
              <h2 className="text-2xl font-bold text-slate-100">
                {h.winnerId === myId
                  ? "You Won!"
                  : `${h.players.find((p: any) => p.id === h.winnerId)?.name} Won`}
              </h2>
              <div className="text-slate-400 text-sm">
                Final scores:{" "}
                {h.players
                  .map((p: any) => `${p.name}: ${h.scores[p.id] ?? 0}`)
                  .join(" · ")}
              </div>
              <motion.button
                onClick={onBack ?? solo.newGame}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold hover:from-amber-400 hover:to-orange-400 cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isMultiplayer ? "Back to Lobby" : "Play Again"}
              </motion.button>
            </motion.div>
          ) : (
            <TrickArea
              trick={h.displayTrick}
              players={h.players}
              trickWinner={h.trickWinner}
              trumpSuit={h.trumpSuit}
            />
          )}
        </div>

        {/* Player info */}
        <div className="flex justify-center items-center gap-3 flex-shrink-0 pb-1">
          {h.phase === "plucking" && h.isMyTurn && (
            <span className="text-[11px] text-amber-400 font-medium bg-amber-900/30 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              Choose a card to give (pluck)
            </span>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-900/30 border border-indigo-500/20">
            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
              {humanPlayer?.name?.[0] ?? "Y"}
            </div>
            <span className="text-xs text-slate-200 font-medium">
              {humanPlayer?.name ?? "You"}
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">
              {h.tricksWon[myId] ?? 0}/{humanQuota}
            </span>
            {isDealer && (
              <span className="text-[9px] text-amber-400 font-bold">DEALER</span>
            )}
          </div>
        </div>

        {/* Player hand */}
        <div className="flex-shrink-0 pb-4">
          <PlayerHand
            cards={h.hand}
            legalMoves={
              (h.phase === "plucking" || h.phase === "playing") && h.isMyTurn
                ? h.legalMoves
                : []
            }
            isMyTurn={h.isMyTurn}
            onPlayCard={(card) => {
              if (h.phase === "plucking") {
                h.pluckGive(card);
              } else {
                h.playCard(card);
              }
              setSelectedCard(null);
            }}
            selectedCard={selectedCard}
            onSelectCard={setSelectedCard}
          />
        </div>
      </div>
    </div>
  );
}
