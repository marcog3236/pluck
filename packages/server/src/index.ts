/**
 * PLUCK multiplayer server
 * Express + Socket.io for real-time game rooms.
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { GameRoom, type RoomPlayer, type RoomOptions } from "./room.js";
import type { Card, Suit, GameEvent, GameState, AIDifficulty } from "@pluck/engine";

const PORT = parseInt(process.env.PORT ?? "3334", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Room registry ──

const rooms: Map<string, GameRoom> = new Map();
const roomsByCode: Map<string, string> = new Map(); // code → roomId
const socketToRoom: Map<string, { roomId: string; playerId: string }> = new Map();

function findRoomByCode(code: string): GameRoom | undefined {
  const roomId = roomsByCode.get(code.toUpperCase());
  return roomId ? rooms.get(roomId) : undefined;
}

function cleanupRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.destroy();
  roomsByCode.delete(room.code);
  rooms.delete(roomId);
  console.log(`Room ${room.code} destroyed`);
}

// ── REST endpoints ──

app.get("/health", (_req, res) => {
  res.json({ status: "ok", rooms: rooms.size });
});

app.get("/rooms/:code", (req, res) => {
  const room = findRoomByCode(req.params.code);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({
    id: room.id,
    code: room.code,
    players: room.getPlayers(),
    started: room.isStarted(),
    playerCount: room.getPlayerCount(),
    maxPlayers: room.getMaxPlayers(),
  });
});

// ── Socket.io handlers ──

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // ── Create room ──
  socket.on("create-room", (
    data: { name: string; options?: Partial<RoomOptions> },
    callback: (res: { roomId: string; code: string; playerId: string } | { error: string }) => void,
  ) => {
    const room = new GameRoom(data.options);

    // Wire up event broadcasting
    room.onEvent((roomId, events, state) => {
      // Send events to all players in the room
      for (const player of room.getPlayers()) {
        if (player.socketId) {
          io.to(player.socketId).emit("game-events", {
            events,
            state: room.getStateForPlayer(player.id),
            legalMoves: room.getLegalMoves(player.id),
          });
        }
      }
      // Also broadcast to spectators
      io.to(`spectate:${roomId}`).emit("game-events", {
        events,
        state: room.getStateForPlayer("__spectator__"),
      });
    });

    room.onPlayerUpdate((roomId, players) => {
      io.to(`room:${roomId}`).emit("player-update", { players });
    });

    // Add the creating player
    const { playerId, error } = room.addPlayer(socket.id, data.name);
    if (error) {
      callback({ error });
      return;
    }

    rooms.set(room.id, room);
    roomsByCode.set(room.code, room.id);
    socketToRoom.set(socket.id, { roomId: room.id, playerId });

    socket.join(`room:${room.id}`);

    console.log(`Room ${room.code} created by ${data.name}`);
    callback({ roomId: room.id, code: room.code, playerId });
  });

  // ── Join room ──
  socket.on("join-room", (
    data: { code: string; name: string },
    callback: (res: { roomId: string; playerId: string; players: RoomPlayer[] } | { error: string }) => void,
  ) => {
    const room = findRoomByCode(data.code);
    if (!room) {
      callback({ error: "Room not found" });
      return;
    }

    const { playerId, error } = room.addPlayer(socket.id, data.name);
    if (error) {
      callback({ error });
      return;
    }

    socketToRoom.set(socket.id, { roomId: room.id, playerId });
    socket.join(`room:${room.id}`);

    console.log(`${data.name} joined room ${room.code}`);
    callback({ roomId: room.id, playerId, players: room.getPlayers() });
  });

  // ── Start game (host only) ──
  socket.on("start-game", (
    data: { fillAI?: boolean },
    callback: (res: { ok: boolean } | { error: string }) => void,
  ) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ error: "Not in a room" }); return; }

    const room = rooms.get(info.roomId);
    if (!room) { callback({ error: "Room not found" }); return; }

    if (!room.isHost(socket.id)) {
      callback({ error: "Only the host can start" });
      return;
    }

    // Optionally fill empty slots with AI
    if (data.fillAI) {
      room.fillWithAI();
    }

    const result = room.startGame();
    if (result.error) {
      callback({ error: result.error });
      return;
    }

    console.log(`Game started in room ${room.code}`);
    callback({ ok: true });
  });

  // ── Play card ──
  socket.on("play-card", (
    data: { card: Card },
    callback: (res: { ok: boolean } | { error: string }) => void,
  ) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ error: "Not in a room" }); return; }

    const room = rooms.get(info.roomId);
    if (!room) { callback({ error: "Room not found" }); return; }

    const result = room.playCard(socket.id, data.card);
    if (result.error) {
      callback({ error: result.error });
      return;
    }
    callback({ ok: true });
  });

  // ── Declare trump ──
  socket.on("declare-trump", (
    data: { suit: Suit },
    callback: (res: { ok: boolean } | { error: string }) => void,
  ) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ error: "Not in a room" }); return; }

    const room = rooms.get(info.roomId);
    if (!room) { callback({ error: "Room not found" }); return; }

    const result = room.declareTrump(socket.id, data.suit);
    if (result.error) {
      callback({ error: result.error });
      return;
    }
    callback({ ok: true });
  });

  // ── Pluck give ──
  socket.on("pluck-give", (
    data: { card: Card },
    callback: (res: { ok: boolean } | { error: string }) => void,
  ) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ error: "Not in a room" }); return; }

    const room = rooms.get(info.roomId);
    if (!room) { callback({ error: "Room not found" }); return; }

    const result = room.pluckGive(socket.id, data.card);
    if (result.error) {
      callback({ error: result.error });
      return;
    }
    callback({ ok: true });
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    const info = socketToRoom.get(socket.id);
    if (info) {
      const room = rooms.get(info.roomId);
      if (room) {
        room.removePlayer(socket.id);

        // Clean up empty rooms
        const players = room.getPlayers();
        const humanPlayers = players.filter(p => !p.isAI && p.connected);
        if (humanPlayers.length === 0 && room.isStarted()) {
          cleanupRoom(info.roomId);
        }
      }
      socketToRoom.delete(socket.id);
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ── Start server ──

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🃏 PLUCK multiplayer server running on 0.0.0.0:${PORT}`);
});
