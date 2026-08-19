"use client";

import { PlayingCard } from "./PlayingCard";
import type { Card } from "@pluck/engine";
import { cardsEqual, cardId } from "@pluck/engine";

interface PlayerHandProps {
  cards: Card[];
  legalMoves: Card[];
  isMyTurn: boolean;
  onPlayCard: (card: Card) => void;
  selectedCard: Card | null;
  onSelectCard: (card: Card | null) => void;
}

export function PlayerHand({
  cards,
  legalMoves,
  isMyTurn,
  onPlayCard,
  selectedCard,
  onSelectCard,
}: PlayerHandProps) {
  const isLegal = (card: Card) =>
    legalMoves.some((c) => cardsEqual(c, card));

  // Dynamic overlap: more cards = tighter overlap
  // Card width is 62px (md size). We want total hand to fit ~900px max.
  const cardWidth = 56;
  const maxHandWidth = 820;
  const totalNaturalWidth = cards.length * cardWidth;
  const overlap =
    totalNaturalWidth > maxHandWidth
      ? Math.max(20, Math.floor(maxHandWidth / cards.length))
      : cardWidth + 3; // small gap when few cards

  // Rotation: subtle fan for large hands
  const maxRotation = cards.length > 10 ? 1.2 : cards.length > 6 ? 0.8 : 0;

  return (
    <div className="flex justify-center items-end px-2">
      <div className="flex items-end" style={{ marginLeft: 0 }}>
        {cards.map((card, i) => {
          const legal = isMyTurn && isLegal(card);
          const selected = selectedCard && cardsEqual(card, selectedCard);
          const mid = (cards.length - 1) / 2;
          const rotation = (i - mid) * maxRotation;

          return (
            <div
              key={cardId(card)}
              style={{
                width: i === cards.length - 1 ? cardWidth : overlap,
                flexShrink: 0,
                transform: maxRotation > 0 ? `rotate(${rotation}deg)` : undefined,
                transformOrigin: "bottom center",
                zIndex: selected ? 100 : i,
                position: "relative",
              }}
            >
              <PlayingCard
                card={card}
                size="md"
                highlighted={legal}
                selected={!!selected}
                disabled={!legal}
                onClick={() => {
                  if (!legal) return;
                  if (selected) {
                    onPlayCard(card);
                    onSelectCard(null);
                  } else {
                    onSelectCard(card);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
