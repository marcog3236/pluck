# PLUCK — Card Game App

## Overview

A polished, cross-platform card game app for **PLUCK** — a trick-taking card game with a unique card-exchange mechanic. Supports both **3-player** (original) and **4-player** (team) variants, with **online multiplayer** and **AI opponents**.

No real competition exists. One single-player mobile app ("Pluck Cards" by Niawn Studios) with essentially zero traction. No web version, no multiplayer version anywhere.

---

## Game Rules

### 3-Player Version (Primary)

**Deck:** 51 cards — standard 52 minus three 2s (keep 2♣), plus 2 Jokers (Big & Little).

**Deal:** All 51 cards dealt evenly → 17 cards per player.

**Card Ranking (high to low):** Big Joker → Little Joker → A → K → Q → J → 10 → 9 → 8 → 7 → 6 → 5 → 4 → 3 → (2♣ only in clubs)

**Trick Quotas (fixed per position):**
| Position | Quota |
|---|---|
| Dealer | 7 tricks |
| Left of dealer | 6 tricks |
| Right of dealer | 4 tricks |

Total = 17 (if anyone exceeds, someone else is short).

**Hand Flow:**
1. **Deal** all 51 cards
2. **Plucking phase** (skipped on hand 1) — see below
3. **Dealer declares trump** (any of 4 suits)
4. **Play 17 tricks:**
   - First trick: holder of 2♣ MUST lead it
   - Must follow suit if able; if void, may play any card including trump
   - Trick won by highest trump played, else highest card of led suit
   - Winner leads next trick
   - **Trump cannot be led** until broken (a trump has been played to a previous trick). Exception: if clubs is trump, 2♣ opening breaks it immediately.
5. **Score:** Count tricks per player vs quota → determines plucks for next hand
6. **Dealer rotates clockwise**

**Plucking Mechanic (hands 2+):**
- For each trick WON above quota → earn 1 pluck (right to steal)
- For each trick SHORT of quota → vulnerable to 1 pluck
- Player with most plucks goes first (ties: closest to dealer, clockwise)
- **To pluck:** Pass any card face-down to a pluckee → pluckee MUST return their highest card of that same suit. If the passed card IS their highest, they return it (net zero).
- Jokers cannot be passed (they have no suit pre-trump declaration)
- If two pluckers: they alternate plucks
- Max plucks taken = tricks over quota; max plucks given = tricks under quota

**Winning:** First player to reach **10 points** (variant: 20 points per Denexa rules — make configurable).

### 4-Player Version (Team)

**Deck:** Standard 52 cards, NO Jokers.

**Teams:** 2 teams of 2, partners sit across from each other.

**Deal:** 13 cards each.

**Calling Team:**
- Hand 1: team of the player dealt 2♣
- Subsequent hands: caller rotates clockwise

**Quotas:**
| Team | Quota |
|---|---|
| Calling team | 8 tricks |
| Opposing team | 5 tricks |

**Key Differences from 3-Player:**
- Caller declares trump AND leads first trick (does NOT have to lead 2♣)
- Team members coordinate on who takes/gives plucks
- "Boston" / "Shooting the Moon" = one team wins all 13 tricks

**Winning:** First team to **10 points**.

---

## Tech Stack

### Architecture: Monorepo with Shared Game Engine

```
pluck/
├── packages/
│   ├── engine/          # Pure TypeScript game logic (no DOM/rendering)
│   │   ├── card.ts      # Card, Deck, Suit types
│   │   ├── state.ts     # Game state machine
│   │   ├── rules.ts     # Rule validation, legal moves
│   │   ├── pluck.ts     # Plucking phase logic
│   │   ├── scoring.ts   # Scoring & quota tracking
│   │   ├── ai/          # AI opponent strategies
│   │   └── index.ts
│   ├── server/          # Multiplayer backend
│   │   ├── rooms.ts     # Game room management
│   │   ├── matchmaking.ts
│   │   ├── socket.ts    # WebSocket handlers
│   │   └── db/          # User accounts, stats, leaderboard
│   └── client/          # Web + Mobile (shared codebase)
│       ├── app/         # Next.js app routes
│       ├── components/  # React components
│       ├── game/        # Game UI, card rendering, animations
│       ├── multiplayer/ # Socket.io client
│       └── public/      # Assets (card images, sounds)
├── package.json         # Workspace root
└── capacitor/           # Capacitor config for iOS/Android wrapping
```

### Core Technologies

| Layer | Technology | Why |
|---|---|---|
| **Game Engine** | TypeScript (pure, no deps) | Shared between client/server/AI, fully testable |
| **Web App** | Next.js 15 + React 19 | SSR, fast, great DX |
| **Card Rendering** | Pixi.js 8 or Framer Motion | Smooth 60fps card animations, drag/drop |
| **Real-time** | Socket.io | Reliable WebSocket abstraction, rooms, reconnection |
| **Backend** | Node.js + Express | Pairs with Socket.io, shares engine package |
| **Database** | PostgreSQL + Drizzle ORM | User accounts, game history, stats, leaderboard |
| **Auth** | NextAuth.js | Google, Apple, guest accounts |
| **Mobile** | Capacitor | Wrap web app → native iOS/Android, one codebase |
| **Styling** | Tailwind CSS + custom card CSS | Polished, responsive |
| **Deployment** | Vercel (web) + Railway/Fly.io (server) | Easy, scalable |

### Why Capacitor over React Native?

For a card game, we don't need native UI components — we need smooth animations and canvas rendering. Capacitor wraps the exact same web app into native containers:
- **One codebase** for web + iOS + Android
- Card animations use Canvas/WebGL (same renderer everywhere)
- App Store / Play Store distribution
- Native features (push notifications, haptics) via plugins
- Much faster development than maintaining separate native UI

---

## Features

### MVP (Phase 1)
- [ ] 3-player game vs AI opponents (Easy/Medium/Hard)
- [ ] Full rule implementation (deal, pluck, trump, tricks, scoring)
- [ ] Polished card UI with animations (deal, play, flip, collect)
- [ ] Game state persistence (resume interrupted games)
- [ ] Sound effects + ambient audio
- [ ] Responsive design (mobile-first)

### Multiplayer (Phase 2)
- [ ] User accounts (Google/Apple/guest)
- [ ] Create/join game rooms (invite link or code)
- [ ] Real-time 3-player online matches
- [ ] Chat / emoji reactions during play
- [ ] Spectator mode
- [ ] Reconnection handling (player disconnects)
- [ ] AI fills in for disconnected players

### 4-Player & Polish (Phase 3)
- [ ] 4-player team variant
- [ ] Matchmaking (ranked + casual)
- [ ] Leaderboards & player stats
- [ ] Achievements / unlockables
- [ ] Card deck themes / table skins
- [ ] Tutorial / How-to-Play walkthrough
- [ ] Push notifications (your turn, game invites)

### Mobile Release (Phase 4)
- [ ] Capacitor iOS build + App Store
- [ ] Capacitor Android build + Play Store
- [ ] Haptic feedback on card play
- [ ] Native push notifications

---

## AI Strategy

### Easy
- Random legal play, no trump awareness

### Medium
- Follow basic trick-taking heuristics:
  - Lead strong suits, avoid leading trump early
  - Trump when void in led suit and trick is worth winning
  - Count tricks toward quota
  - Basic pluck strategy (pluck weakest suit)

### Hard
- Card counting (track played cards)
- Probabilistic inference (what cards opponents likely hold)
- Quota-aware strategy (sacrifice low-value tricks, push for quota)
- Advanced pluck optimization (pluck to set up trump dominance)
- Endgame trick counting (guaranteed win paths)

---

## UI/UX Design Goals

- **Dark theme** with rich felt-table aesthetic
- **Smooth card animations** — deal fan-out, play arc, collect sweep
- **Clear game state** — trick count, quota tracker, score display
- **Pluck phase** highlighted as a distinct, dramatic moment
- **Trump suit** prominently displayed
- **Mobile-first** responsive layout
- **Accessibility** — color-blind card suit indicators

---

## Open Questions

1. **Win condition:** 10 points or 20? Make configurable, default 10.
2. **3-player scoring:** Some sources say "no scoring, each hand is standalone." Others give point totals. We'll implement cumulative scoring (more engaging for digital).
3. **Timer per turn?** Probably yes for multiplayer (30s default, configurable).
4. **Spectator chat?** Nice to have.
5. **Name:** "PLUCK" or something branded? Use PLUCK for now.
