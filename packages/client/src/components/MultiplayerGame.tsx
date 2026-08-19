"use client";

import { useMultiplayerGame } from "@/hooks/useMultiplayerGame";
import { GameTable } from "./GameTable";
import type { MultiplayerClient } from "@/lib/multiplayer-client";

interface MultiplayerGameProps {
  client: MultiplayerClient;
  onLeave: () => void;
}

export function MultiplayerGame({ client, onLeave }: MultiplayerGameProps) {
  const handle = useMultiplayerGame(client);

  if (!handle) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Waiting for game state...</p>
          <button
            onClick={onLeave}
            className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <GameTable
      multiplayerHandle={handle}
      onBack={() => {
        client.disconnect();
        onLeave();
      }}
    />
  );
}
