import { describe, it, expect } from 'vitest';
import { PluckGame } from '../game.js';
import { suited, joker, hasTwoOfClubs, cardId, cardsEqual } from '../card.js';
import type { Card, Suit } from '../card.js';
import type { GameEvent } from '../types.js';

function setupThreePlayerGame(): PluckGame {
  const game = new PluckGame({ mode: 'three-player', pointsToWin: 10 });
  game.dispatch({ type: 'join', playerId: 'p1', name: 'Alice' });
  game.dispatch({ type: 'join', playerId: 'p2', name: 'Bob' });
  game.dispatch({ type: 'join', playerId: 'p3', name: 'Charlie' });
  return game;
}

function findTwoOfClubsHolder(game: PluckGame): string {
  for (const [playerId, hand] of game.state.hands) {
    if (hasTwoOfClubs(hand)) return playerId;
  }
  throw new Error('No player has 2♣');
}

function findTrumpDeclarer(game: PluckGame): string {
  return game.state.players[game.state.dealerIndex].id;
}

describe('Game setup', () => {
  it('starts in waiting phase', () => {
    const game = new PluckGame();
    expect(game.state.phase).toBe('waiting');
  });

  it('allows 3 players to join', () => {
    const game = setupThreePlayerGame();
    expect(game.state.players).toHaveLength(3);
  });

  it('rejects 4th player in 3-player mode', () => {
    const game = setupThreePlayerGame();
    const events = game.dispatch({
      type: 'join',
      playerId: 'p4',
      name: 'Dave',
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'error', message: 'Game is full' })
    );
  });

  it('rejects duplicate player', () => {
    const game = setupThreePlayerGame();
    const events = game.dispatch({
      type: 'join',
      playerId: 'p1',
      name: 'Alice Again',
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'error', message: 'Player already joined' })
    );
  });
});

describe('Game start', () => {
  it('deals 17 cards to each player', () => {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });

    for (const player of game.state.players) {
      const hand = game.state.hands.get(player.id);
      expect(hand).toHaveLength(17);
    }
  });

  it('enters declaring phase on hand 1 (no plucks)', () => {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });
    expect(game.state.phase).toBe('declaring');
  });

  it('emits game-started and cards-dealt events', () => {
    const game = setupThreePlayerGame();
    const events = game.dispatch({ type: 'start' });

    expect(events.some(e => e.type === 'game-started')).toBe(true);
    expect(events.some(e => e.type === 'cards-dealt')).toBe(true);
  });
});

describe('Trump declaration', () => {
  it('only dealer can declare trump', () => {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });

    const dealerId = findTrumpDeclarer(game);
    const nonDealerId = game.state.players.find(p => p.id !== dealerId)!.id;

    const events = game.dispatch({
      type: 'declare-trump',
      playerId: nonDealerId,
      suit: 'hearts',
    });

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'error' })
    );
  });

  it('sets trump and moves to playing phase', () => {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });

    const dealerId = findTrumpDeclarer(game);
    const events = game.dispatch({
      type: 'declare-trump',
      playerId: dealerId,
      suit: 'hearts',
    });

    expect(game.state.trumpSuit).toBe('hearts');
    expect(game.state.phase).toBe('playing');
    expect(events.some(e => e.type === 'trump-declared')).toBe(true);
  });

  it('clubs as trump breaks trump immediately', () => {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });

    const dealerId = findTrumpDeclarer(game);
    game.dispatch({
      type: 'declare-trump',
      playerId: dealerId,
      suit: 'clubs',
    });

    expect(game.state.trumpBroken).toBe(true);
  });
});

describe('Trick play', () => {
  function startPlayingGame(trumpSuit: Suit = 'hearts'): PluckGame {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });
    const dealerId = findTrumpDeclarer(game);
    game.dispatch({ type: 'declare-trump', playerId: dealerId, suit: trumpSuit });
    return game;
  }

  it('first trick must be led with 2♣', () => {
    const game = startPlayingGame();
    const currentPlayerId = game.state.players[game.state.currentPlayerIndex].id;
    const hand = game.state.hands.get(currentPlayerId)!;

    // Verify current player has 2♣
    expect(hasTwoOfClubs(hand)).toBe(true);

    // Legal moves should only be 2♣
    const legal = game.getLegalMoves();
    expect(legal).toHaveLength(1);
    expect(legal[0]).toEqual(suited('clubs', '2'));
  });

  it('rejects play from wrong player', () => {
    const game = startPlayingGame();
    const currentPlayer = game.state.players[game.state.currentPlayerIndex];
    const otherPlayer = game.state.players.find(
      p => p.id !== currentPlayer.id
    )!;

    const events = game.dispatch({
      type: 'play-card',
      playerId: otherPlayer.id,
      card: suited('clubs', '2'),
    });

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'error', message: 'Not your turn' })
    );
  });

  it('plays a full trick and determines winner', () => {
    const game = startPlayingGame();

    // Play 2♣ first
    const leaderId = game.state.players[game.state.currentPlayerIndex].id;
    game.dispatch({
      type: 'play-card',
      playerId: leaderId,
      card: suited('clubs', '2'),
    });

    // Next two players play
    for (let i = 0; i < 2; i++) {
      const pid = game.state.players[game.state.currentPlayerIndex].id;
      const hand = game.state.hands.get(pid)!;
      const legal = game.getLegalMoves();
      expect(legal.length).toBeGreaterThan(0);

      game.dispatch({
        type: 'play-card',
        playerId: pid,
        card: legal[0],
      });
    }

    // After 3 plays, trick should be won and trick number incremented
    expect(game.state.trickNumber).toBe(1);
  });
});

describe('Quotas', () => {
  it('returns correct quotas for 3-player game', () => {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });

    const dealerId = game.state.players[game.state.dealerIndex].id;
    const leftId = game.state.players[(game.state.dealerIndex + 1) % 3].id;
    const rightId = game.state.players[(game.state.dealerIndex + 2) % 3].id;

    expect(game.getQuota(dealerId)).toBe(7);
    expect(game.getQuota(leftId)).toBe(6);
    expect(game.getQuota(rightId)).toBe(4);
  });
});

describe('4-player mode', () => {
  it('sets up teams correctly', () => {
    const game = new PluckGame({ mode: 'four-player' });
    game.dispatch({ type: 'join', playerId: 'p1', name: 'Alice' });
    game.dispatch({ type: 'join', playerId: 'p2', name: 'Bob' });
    game.dispatch({ type: 'join', playerId: 'p3', name: 'Charlie' });
    game.dispatch({ type: 'join', playerId: 'p4', name: 'Dave' });

    expect(game.state.players[0].team).toBe(0);
    expect(game.state.players[1].team).toBe(1);
    expect(game.state.players[2].team).toBe(0);
    expect(game.state.players[3].team).toBe(1);
  });

  it('deals 13 cards each', () => {
    const game = new PluckGame({ mode: 'four-player' });
    game.dispatch({ type: 'join', playerId: 'p1', name: 'Alice' });
    game.dispatch({ type: 'join', playerId: 'p2', name: 'Bob' });
    game.dispatch({ type: 'join', playerId: 'p3', name: 'Charlie' });
    game.dispatch({ type: 'join', playerId: 'p4', name: 'Dave' });
    game.dispatch({ type: 'start' });

    for (const player of game.state.players) {
      expect(game.state.hands.get(player.id)).toHaveLength(13);
    }
  });
});

describe('Full hand simulation', () => {
  it('plays through an entire 3-player hand without errors', () => {
    const game = setupThreePlayerGame();
    game.dispatch({ type: 'start' });

    // Declare trump
    const dealerId = findTrumpDeclarer(game);
    game.dispatch({
      type: 'declare-trump',
      playerId: dealerId,
      suit: 'spades',
    });

    // Play all 17 tricks
    let trickCount = 0;
    while (game.state.phase === 'playing' && trickCount < 20) {
      const pid = game.state.players[game.state.currentPlayerIndex].id;
      const legal = game.getLegalMoves();
      expect(legal.length).toBeGreaterThan(0);

      const events = game.dispatch({
        type: 'play-card',
        playerId: pid,
        card: legal[0],
      });

      // Count trick completions
      if (events.some(e => e.type === 'trick-won')) {
        trickCount++;
      }
    }

    expect(trickCount).toBe(17);

    // Verify the completed hand is in history
    // Note: tricksWon map gets reset when a new hand starts,
    // so we check the hand history instead
    const lastHand = game.state.handHistory[game.state.handHistory.length - 1];
    expect(lastHand).toBeDefined();
    const totalTricks = lastHand.playerResults.reduce(
      (sum, r) => sum + r.tricksWon, 0
    );
    expect(totalTricks).toBe(17);
  });
});
