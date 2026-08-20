"use client";

import { PlayingCard, CARD_PX } from "./PlayingCard";
import { useViewportSize } from "@/hooks/useViewportSize";
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
  const { width, isMobile } = useViewportSize();

  const isLegal = (card: Card) =>
    legalMoves.some((c) => cardsEqual(c, card));

  // Responsive card sizing
  const cardSize = isMobile ? "md" as const : "md" as const;
  const cardWidth = CARD_PX[cardSize].w;

  // Available width: viewport minus padding (px-2 on mobile, px-4 on desktop)
  const pad = isMobile ? 16 : 32;
  const availableWidth = Math.max(200, (width || 820) - pad);
  const maxHandWidth = Math.min(availableWidth, 820);

  const totalNaturalWidth = cards.length * cardWidth;
  const overlap =
    totalNaturalWidth > maxHandWidth
      ? Math.max(isMobile ? 16 : 20, Math.floor(maxHandWidth / cards.length))
      : cardWidth + 3;

  // Rotation: subtle fan for large hands, less on mobile
  const maxRotation = isMobile
    ? (cards.length > 12 ? 0.6 : cards.length > 6 ? 0.4 : 0)
    : (cards.length > 10 ? 1.2 : cards.length > 6 ? 0.8 : 0);

  return (
    <div className="flex justify-center items-end px-1 sm:px-2">
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
                size={cardSize}
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
