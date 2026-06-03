"use client";

import { useEffect, useState } from "react";

type Suit = "spade" | "heart" | "diamond" | "club";

type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
};

type BoardCell = Card | null;
type Board = BoardCell[][];

type CardPosition = {
  row: number;
  col: number;
};

type LineCard = {
  row: number;
  col: number;
  card: Card;
};

type HandResult = {
  name: string;
  score: number;
  cards: CardPosition[];
  shouldClear: boolean;
};

type GameState = {
  board: Board;
  deck: Card[];
  hand: Card[];
  score: number;
  highScore: number;
  combo: number;
  comboWindow: number;
  selectedHandIndex: number | null;
  lastResult: string;
  lastScore: number;
  isGameOver: boolean;
};

type FloatingScore = {
  id: number;
  value: number;
};

type ScreenState = "home" | "game";

const BOARD_SIZE = 5;
const HAND_SIZE = 3;
const HIGH_SCORE_KEY = "nuts-high-score";
const MAX_COMBO_WINDOW = 3;
const MAX_COMBO = 10;

const suits: Suit[] = ["spade", "heart", "diamond", "club"];

const ranks: { rank: Rank; value: number }[] = [
  { rank: "A", value: 14 },
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 11 },
  { rank: "Q", value: 12 },
  { rank: "K", value: 13 },
];

const suitSymbols: Record<Suit, string> = {
  spade: "♠",
  heart: "♥",
  diamond: "♦",
  club: "♣",
};

const suitNames: Record<Suit, string> = {
  spade: "Spade",
  heart: "Heart",
  diamond: "Diamond",
  club: "Club",
};

const scoreTable = {
  pair: 10,
  three: 40,
  straight: 60,
  flush: 70,
  fullHouse: 150,
  royal: 500,
};


function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

function shuffle<T>(array: T[]): T[] {
  const copied = [...array];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const { rank, value } of ranks) {
      deck.push({
        id: `${rank}-${suit}-${Math.random().toString(36).slice(2)}`,
        suit,
        rank,
        value,
      });
    }
  }

  return shuffle(deck);
}

function drawCards(deck: Card[], count: number): { drawn: Card[]; rest: Card[] } {
  let currentDeck = [...deck];

  if (currentDeck.length < count) {
    currentDeck = [...currentDeck, ...createDeck()];
  }

  return {
    drawn: currentDeck.slice(0, count),
    rest: currentDeck.slice(count),
  };
}

function countFilledCells(board: Board): number {
  return board.flat().filter(Boolean).length;
}

function getCardUsefulness(card: Card, board: Board): number {
  let usefulness = 0;

  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;

      if (cell.value === card.value) {
        usefulness += 3;
      }

      if (cell.suit === card.suit) {
        usefulness += 1;
      }

      if (Math.abs(cell.value - card.value) === 1) {
        usefulness += 2;
      }

      if (
        (card.value === 14 && cell.value === 2) ||
        (card.value === 2 && cell.value === 14)
      ) {
        usefulness += 2;
      }
    }
  }

  return usefulness;
}

function drawCardsForBoard(
  deck: Card[],
  count: number,
  board: Board
): { drawn: Card[]; rest: Card[] } {
  let currentDeck = [...deck];
  const drawn: Card[] = [];

  while (drawn.length < count) {
    if (currentDeck.length < 6) {
      currentDeck = [...currentDeck, ...createDeck()];
    }

    const filledCells = countFilledCells(board);

    const biasChance =
      filledCells >= 18 ? 0.72 : filledCells >= 12 ? 0.52 : 0.32;

    const shouldBias = Math.random() < biasChance;
    const candidateCount = shouldBias ? Math.min(8, currentDeck.length) : 1;
    const candidates = currentDeck.slice(0, candidateCount);

    let selectedIndex = 0;

    if (shouldBias) {
      let lowestUsefulness = Infinity;

      candidates.forEach((candidate, index) => {
        const usefulness = getCardUsefulness(candidate, board);

        if (usefulness < lowestUsefulness) {
          lowestUsefulness = usefulness;
          selectedIndex = index;
        }
      });
    }

    const [selected] = currentDeck.splice(selectedIndex, 1);
    drawn.push(selected);
  }

  return {
    drawn,
    rest: currentDeck,
  };
}

function getSavedHighScore(): number {
  if (typeof window === "undefined") return 0;

  const saved = window.localStorage.getItem(HIGH_SCORE_KEY);
  return saved ? Number(saved) : 0;
}

function saveHighScore(score: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
}

function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

function getCardColor(card: Card): string {
  if (card.suit === "heart" || card.suit === "diamond") {
    return "text-red-600";
  }

  return "text-blue-950";
}

function keyOf(row: number, col: number) {
  return `${row}-${col}`;
}

function toPositions(cards: LineCard[]): CardPosition[] {
  return cards.map(({ row, col }) => ({ row, col }));
}

function getLine(
  board: Board,
  row: number,
  col: number,
  dRow: number,
  dCol: number
): LineCard[] {
  const line: LineCard[] = [];

  let r = row;
  let c = col;

  while (
    r - dRow >= 0 &&
    r - dRow < BOARD_SIZE &&
    c - dCol >= 0 &&
    c - dCol < BOARD_SIZE &&
    board[r - dRow][c - dCol]
  ) {
    r -= dRow;
    c -= dCol;
  }

  while (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r][c]
  ) {
    line.push({
      row: r,
      col: c,
      card: board[r][c] as Card,
    });

    r += dRow;
    c += dCol;
  }

  return line;
}

function includesPlaced(cards: LineCard[], row: number, col: number): boolean {
  return cards.some((item) => item.row === row && item.col === col);
}

function isOrderedStraight(values: number[]): boolean {
  const isNormalAscending = values.every(
    (value, index) => index === 0 || value === values[index - 1] + 1
  );

  const isNormalDescending = values.every(
    (value, index) => index === 0 || value === values[index - 1] - 1
  );

  const aceLowValues = values.map((value) => (value === 14 ? 1 : value));

  const isAceLowAscending = aceLowValues.every(
    (value, index) => index === 0 || value === aceLowValues[index - 1] + 1
  );

  const isAceLowDescending = aceLowValues.every(
    (value, index) => index === 0 || value === aceLowValues[index - 1] - 1
  );

  return (
    isNormalAscending ||
    isNormalDescending ||
    isAceLowAscending ||
    isAceLowDescending
  );
}

function isCleanFullHouse(cards: LineCard[]): boolean {
  if (cards.length !== 5) return false;

  const values = cards.map((item) => item.card.value);

  const firstThree =
    values[0] === values[1] &&
    values[1] === values[2] &&
    values[3] === values[4] &&
    values[2] !== values[3];

  const firstTwo =
    values[0] === values[1] &&
    values[2] === values[3] &&
    values[3] === values[4] &&
    values[1] !== values[2];

  return firstThree || firstTwo;
}

function isCleanRoyal(cards: LineCard[]): boolean {
  if (cards.length !== 5) return false;

  const values = cards.map((item) => item.card.value).join("-");

  return values === "10-11-12-13-14" || values === "14-13-12-11-10";
}

function addUniqueResult(results: HandResult[], result: HandResult) {
  const resultKey = result.cards
    .map((cardPosition) => keyOf(cardPosition.row, cardPosition.col))
    .sort()
    .join("|");

  const alreadyExists = results.some((existing) => {
    const existingKey = existing.cards
      .map((cardPosition) => keyOf(cardPosition.row, cardPosition.col))
      .sort()
      .join("|");

    return existing.name === result.name && existingKey === resultKey;
  });

  if (!alreadyExists) {
    results.push(result);
  }
}

function evaluateLine(line: LineCard[], placedRow: number, placedCol: number): HandResult[] {
  if (line.length < 2) return [];

  const results: HandResult[] = [];

  for (let start = 0; start < line.length; start++) {
    const pairCards = line.slice(start, start + 2);

    if (
      pairCards.length === 2 &&
      includesPlaced(pairCards, placedRow, placedCol) &&
      pairCards[0].card.value === pairCards[1].card.value
    ) {
      addUniqueResult(results, {
        name: "Pair",
        score: scoreTable.pair * pairCards.length,
        cards: toPositions(pairCards),
        shouldClear: false,
      });
    }

    const threeCards = line.slice(start, start + 3);

    if (
      threeCards.length === 3 &&
      includesPlaced(threeCards, placedRow, placedCol)
    ) {
      const values = threeCards.map((item) => item.card.value);
      const suitsInThree = threeCards.map((item) => item.card.suit);

      if (values.every((value) => value === values[0])) {
        addUniqueResult(results, {
          name: "Three Card",
          score: scoreTable.three * threeCards.length,
          cards: toPositions(threeCards),
          shouldClear: true,
        });
      }

      if (isOrderedStraight(values)) {
        addUniqueResult(results, {
          name: "Straight",
          score: scoreTable.straight * threeCards.length,
          cards: toPositions(threeCards),
          shouldClear: true,
        });
      }

      if (suitsInThree.every((suit) => suit === suitsInThree[0])) {
        addUniqueResult(results, {
          name: `${suitNames[suitsInThree[0]]} Flush`,
          score: scoreTable.flush * threeCards.length,
          cards: toPositions(threeCards),
          shouldClear: true,
        });
      }
    }

    const fiveCards = line.slice(start, start + 5);

    if (
      fiveCards.length === 5 &&
      includesPlaced(fiveCards, placedRow, placedCol)
    ) {
      if (isCleanFullHouse(fiveCards)) {
        addUniqueResult(results, {
          name: "Full House",
          score: scoreTable.fullHouse * fiveCards.length,
          cards: toPositions(fiveCards),
          shouldClear: true,
        });
      }

      if (isCleanRoyal(fiveCards)) {
        addUniqueResult(results, {
          name: "Royal Line",
          score: scoreTable.royal * fiveCards.length,
          cards: toPositions(fiveCards),
          shouldClear: true,
        });
      }
    }
  }

  return results;
}

function evaluateBoard(board: Board, row: number, col: number): HandResult[] {
  const directions = [
    [0, 1],
    [1, 0],
  ];

  const allResults: HandResult[] = [];

  for (const [dRow, dCol] of directions) {
    const line = getLine(board, row, col, dRow, dCol);
    allResults.push(...evaluateLine(line, row, col));
  }

  return allResults;
}

function createInitialGame(highScore = 0): GameState {
  const deck = createDeck();
  const { drawn, rest } = drawCards(deck, HAND_SIZE);

  return {
    board: createEmptyBoard(),
    deck: rest,
    hand: drawn,
    score: 0,
    highScore,
    combo: 1,
    comboWindow: MAX_COMBO_WINDOW,
    selectedHandIndex: 0,
    lastResult: "PLACE LEFT CARD",
    lastScore: 0,
    isGameOver: false,
  };
}

function CardFace({
  card,
  size = "normal",
}: {
  card: Card;
  size?: "tiny" | "small" | "normal" | "large";
}) {
  const rankSize =
    size === "large"
      ? "text-4xl"
      : size === "tiny"
      ? "text-sm"
      : size === "small"
      ? "text-lg"
      : "text-2xl";

  const suitSize =
    size === "large"
      ? "text-7xl"
      : size === "tiny"
      ? "text-2xl"
      : size === "small"
      ? "text-4xl"
      : "text-5xl";

  const cornerTextSize =
    size === "tiny" ? "text-[10px]" : size === "small" ? "text-xs" : "text-sm";

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg font-black ${getCardColor(
        card
      )}`}
    >
      <div className="absolute inset-0 bg-[#fff3cf]" />
      <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.9),transparent_25%),radial-gradient(circle_at_65%_65%,rgba(255,214,129,0.38),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.28),transparent_42%,rgba(0,0,0,0.08))]" />
      <div className="absolute inset-[3px] rounded-md border border-black/10" />

      <div className="absolute left-1 top-1 z-20 flex flex-col items-center leading-none">
        <span className={`${cornerTextSize} tracking-[-0.03em]`}>
          {card.rank}
        </span>
        <span className={size === "tiny" ? "text-xs" : "text-sm"}>
          {suitSymbols[card.suit]}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center drop-shadow-[1px_1px_0_rgba(0,0,0,0.16)]">
        <span className={`${rankSize} leading-none tracking-[-0.04em]`}>
          {card.rank}
        </span>
        <span className={`${suitSize} -mt-1 leading-none`}>
          {suitSymbols[card.suit]}
        </span>
      </div>

      <div className="absolute bottom-1 right-1 z-20 flex rotate-180 flex-col items-center leading-none">
        <span className={`${cornerTextSize} tracking-[-0.03em]`}>
          {card.rank}
        </span>
        <span className={size === "tiny" ? "text-xs" : "text-sm"}>
          {suitSymbols[card.suit]}
        </span>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent = false,
  pulse = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  pulse?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border-[3px] border-black bg-[#0f2146] px-2 py-2 shadow-[4px_4px_0_#000] transition md:px-2 md:py-2 lg:px-4 lg:py-3",
        pulse ? "scale-105 bg-[#ffe975]" : "",
      ].join(" ")}
    >
      <p
        className={[
          "text-[10px] font-black tracking-widest",
          pulse ? "text-[#d43d4f]" : "text-[#ffe975]",
        ].join(" ")}
      >
        {label}
      </p>
      <p
        className={[
          "mt-1 text-xl font-black leading-none lg:text-2xl",
          pulse ? "text-black" : accent ? "text-[#ffe975]" : "text-white",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

const roleExamples = [
    {
      name: "Pair",
      cards: [
        { rank: "7", suit: "heart" as Suit },
        { rank: "7", suit: "spade" as Suit },
      ],
      score: "10 × 2",
      clear: "KEEP",
    },
    {
      name: "Three",
      cards: [
        { rank: "Q", suit: "heart" as Suit },
        { rank: "Q", suit: "diamond" as Suit },
        { rank: "Q", suit: "club" as Suit },
      ],
      score: "40 × 3",
      clear: "CLEAR",
    },
    {
      name: "Straight",
      cards: [
        { rank: "5", suit: "spade" as Suit },
        { rank: "6", suit: "heart" as Suit },
        { rank: "7", suit: "club" as Suit },
      ],
      score: "60 × N",
      clear: "CLEAR",
    },
    {
      name: "Flush",
      cards: [
        { rank: "2", suit: "diamond" as Suit },
        { rank: "5", suit: "diamond" as Suit },
        { rank: "K", suit: "diamond" as Suit },
      ],
      score: "70 × N",
      clear: "CLEAR",
    },
    {
      name: "Full House",
      cards: [
        { rank: "9", suit: "heart" as Suit },
        { rank: "9", suit: "spade" as Suit },
        { rank: "9", suit: "club" as Suit },
        { rank: "K", suit: "diamond" as Suit },
        { rank: "K", suit: "heart" as Suit },
      ],
      score: "150 × 5",
      clear: "CLEAR",
    },
    {
      name: "Royal",
      cards: [
        { rank: "10", suit: "spade" as Suit },
        { rank: "J", suit: "heart" as Suit },
        { rank: "Q", suit: "club" as Suit },
        { rank: "K", suit: "diamond" as Suit },
        { rank: "A", suit: "spade" as Suit },
      ],
      score: "500 × 5",
      clear: "CLEAR",
    },
  ];


function RoleListPanel() {
  const roles = roleExamples;

  function MiniCard({ rank, suit }: { rank: string; suit: Suit }) {
    const isRed = suit === "heart" || suit === "diamond";

    return (
      <div
        className={[
          "flex h-10 w-8 flex-col items-center justify-center rounded-md border-[2px] border-black bg-[#fff3cf] text-[11px] font-black leading-none shadow-[2px_2px_0_#000]",
          isRed ? "text-red-600" : "text-blue-950",
        ].join(" ")}
      >
        <span>{rank}</span>
        <span className="text-base">{suitSymbols[suit]}</span>
      </div>
    );
  }

  return (
    <aside className="hidden h-full min-h-0 overflow-hidden rounded-2xl border-[5px] border-black bg-[#0f2146] p-3 shadow-[6px_6px_0_#000] lg:flex lg:flex-col">
      <div className="mb-2 rounded-xl border-[4px] border-black bg-[#ffe975] px-3 py-2 text-black shadow-[3px_3px_0_#000] lg:mb-3">
        <p className="text-[11px] font-black tracking-[0.25em]">HANDS</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {roles.map((role) => (
          <div
            key={role.name}
            className="rounded-xl border-[3px] border-black bg-[#2b1a4a] p-2 shadow-[3px_3px_0_#000]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-black leading-none text-[#ffe975]">
                {role.name}
              </p>

            </div>

            <div className="mb-1 flex items-center gap-1">
              {role.cards.map((card, index) => (
                <MiniCard
                  key={`${role.name}-${card.rank}-${card.suit}-${index}`}
                  rank={card.rank}
                  suit={card.suit}
                />
              ))}
            </div>

          </div>
        ))}
      </div>
    </aside>
  );
}


function MobileRoleListPanel() {
  function MiniCard({ rank, suit }: { rank: string; suit: Suit }) {
    const isRed = suit === "heart" || suit === "diamond";

    return (
      <div
        className={[
          "flex h-8 w-6 shrink-0 flex-col items-center justify-center rounded-md border-[2px] border-black bg-[#fff3cf] text-[9px] font-black leading-none shadow-[2px_2px_0_#000]",
          isRed ? "text-red-600" : "text-blue-950",
        ].join(" ")}
      >
        <span>{rank}</span>
        <span className="text-sm">{suitSymbols[suit]}</span>
      </div>
    );
  }

  return (
    <aside className="mt-2 hidden rounded-2xl border-[5px] border-black bg-[#0f2146] p-2 shadow-[6px_6px_0_#000] md:block lg:hidden">
      <div className="mb-2 rounded-xl border-[4px] border-black bg-[#ffe975] px-3 py-2 text-black shadow-[3px_3px_0_#000]">
        <p className="text-[10px] font-black tracking-[0.25em]">HANDS</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {roleExamples.map((role) => (
          <div
            key={role.name}
            className="min-w-[116px] rounded-xl border-[3px] border-black bg-[#2b1a4a] p-2 shadow-[3px_3px_0_#000]"
          >
            <p className="mb-1 text-xs font-black leading-none text-[#ffe975]">
              {role.name}
            </p>

            <div className="flex items-center gap-1">
              {role.cards.map((card, index) => (
                <MiniCard
                  key={`${role.name}-${card.rank}-${card.suit}-${index}`}
                  rank={card.rank}
                  suit={card.suit}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function HomeScreen({
  highScore,
  onStart,
}: {
  highScore: number;
  onStart: () => void;
}) {
  return (
    <main className="relative h-screen overflow-hidden bg-[#17102b] text-white">
      <style>{`
        @keyframes titleFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }

        @keyframes cardDriftA {
          0%, 100% { transform: translateY(0) rotate(-12deg); }
          50% { transform: translateY(-14px) rotate(-8deg); }
        }

        @keyframes cardDriftB {
          0%, 100% { transform: translateY(0) rotate(10deg); }
          50% { transform: translateY(12px) rotate(14deg); }
        }

        @keyframes pulseGlow {
          0%, 100% { box-shadow: 8px 8px 0 #000; }
          50% { box-shadow: 0 0 0 4px #ffef7a, 10px 10px 0 #000; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,211,74,0.22),transparent_26%),radial-gradient(circle_at_85%_20%,rgba(64,151,255,0.25),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(255,73,96,0.22),transparent_32%)]" />

      <div className="pointer-events-none absolute inset-0 opacity-[0.075] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="absolute inset-0 z-[90] flex items-center justify-center bg-[#17102b] px-6 text-center text-white md:hidden landscape:hidden">
        <div className="rounded-2xl border-[5px] border-black bg-[#d93555] p-6 shadow-[8px_8px_0_#000]">
          <p className="mb-2 text-xs font-black tracking-[0.35em] text-[#ffe975]">
            NUTS
          </p>
          <p className="text-xl font-black leading-tight">
            Rotate your phone
          </p>
          <p className="mt-3 text-xs font-bold leading-5">
            This game is designed for landscape play.
          </p>
        </div>
      </div>

      <div
        className="pointer-events-none absolute left-[8%] top-[18%] hidden h-40 w-28 rounded-2xl border-[5px] border-black bg-[#fff3cf] shadow-[8px_8px_0_#000] md:block"
        style={{ animation: "cardDriftA 3.4s ease-in-out infinite" }}
      >
        <div className="flex h-full flex-col items-center justify-center text-blue-950">
          <p className="text-4xl font-black">A</p>
          <p className="text-6xl font-black">♠</p>
        </div>
      </div>

      <div
        className="pointer-events-none absolute right-[8%] bottom-[18%] hidden h-40 w-28 rounded-2xl border-[5px] border-black bg-[#fff3cf] shadow-[8px_8px_0_#000] md:block"
        style={{ animation: "cardDriftB 3.8s ease-in-out infinite" }}
      >
        <div className="flex h-full flex-col items-center justify-center text-red-600">
          <p className="text-4xl font-black">K</p>
          <p className="text-6xl font-black">♥</p>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex h-screen max-w-5xl flex-col items-center justify-center px-4">
        <section
          className="w-full max-w-3xl rounded-[2rem] border-[6px] border-black bg-[#2b1a4a] p-5 text-center shadow-[12px_12px_0_#000] md:p-8"
          style={{ animation: "titleFloat 4s ease-in-out infinite" }}
        >
          <div className="mb-5 rounded-[1.5rem] border-[5px] border-black bg-[#d93555] px-5 py-6 shadow-[7px_7px_0_#000]">
            <p className="mb-2 text-sm font-black tracking-[0.55em] text-[#ffe975]">
              GRID POKER
            </p>

            <h1 className="text-5xl font-black leading-none text-white drop-shadow-[5px_5px_0_#000] md:text-8xl">
              CARD
              <br />
              PUZZLE
            </h1>
          </div>

          <div className="mx-auto mb-5 grid max-w-md grid-cols-3 gap-2">
            <div className="rotate-[-4deg] rounded-xl border-[4px] border-black bg-[#fff3cf] p-3 text-blue-950 shadow-[4px_4px_0_#000]">
              <p className="text-2xl font-black">Q</p>
              <p className="text-4xl font-black">♣</p>
            </div>

            <div className="rotate-[2deg] rounded-xl border-[4px] border-black bg-[#fff3cf] p-3 text-red-600 shadow-[4px_4px_0_#000]">
              <p className="text-2xl font-black">10</p>
              <p className="text-4xl font-black">♦</p>
            </div>

            <div className="rotate-[5deg] rounded-xl border-[4px] border-black bg-[#fff3cf] p-3 text-blue-950 shadow-[4px_4px_0_#000]">
              <p className="text-2xl font-black">J</p>
              <p className="text-4xl font-black">♠</p>
            </div>
          </div>

          <div className="mx-auto mb-5 grid max-w-md grid-cols-2 gap-3">
            <button
              onClick={onStart}
              className="rounded-2xl border-[5px] border-black bg-[#ffe975] px-5 py-4 text-2xl font-black text-black shadow-[7px_7px_0_#000] transition hover:-translate-y-1 hover:shadow-[9px_9px_0_#000]"
              style={{ animation: "pulseGlow 1.8s ease-in-out infinite" }}
            >
              PLAY
            </button>

            <div className="rounded-2xl border-[5px] border-black bg-[#0f2146] px-4 py-3 text-left shadow-[7px_7px_0_#000]">
              <p className="text-[10px] font-black tracking-[0.25em] text-[#62e7ff]">
                BEST
              </p>
              <p className="text-3xl font-black text-[#ffe975]">{highScore}</p>
            </div>
          </div>

          <div className="mx-auto max-w-md rounded-2xl border-[4px] border-black bg-[#0f2146] p-4 text-left shadow-[5px_5px_0_#000]">
            <p className="mb-2 text-xs font-black tracking-[0.3em] text-[#ffe975]">
              RULE
            </p>

            <div className="grid gap-2 text-xs font-bold leading-5 text-white">
              <p>Only the left card can be placed.</p>
              <p>The next 2 cards are visible.</p>
              <p>Plan ahead and survive.</p>
                          </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => createInitialGame(0));
  const [isLoaded, setIsLoaded] = useState(false);
  const [screen, setScreen] = useState<ScreenState>("home");

  const [placedCell, setPlacedCell] = useState<string | null>(null);
  const [highlightCells, setHighlightCells] = useState<Set<string>>(new Set());
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [scorePulse, setScorePulse] = useState(false);
  const [comboPulse, setComboPulse] = useState(false);
  const [resultPulse, setResultPulse] = useState(false);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);

  useEffect(() => {
    const savedHighScore = getSavedHighScore();

    setGame((prev) => ({
      ...prev,
      highScore: savedHighScore,
    }));

    setIsLoaded(true);
  }, []);

  const selectedCard = game.hand[0] ?? null;

  const isResolvingHand = highlightCells.size > 0;

  function resetEffects() {
    setPlacedCell(null);
    setHighlightCells(new Set());
    setClearingCells(new Set());
    setScorePulse(false);
    setComboPulse(false);
    setResultPulse(false);
    setFloatingScores([]);
  }

  function restartGame() {
    resetEffects();
    setGame((prev) => createInitialGame(prev.highScore));
  }

  function startGame() {
    resetEffects();
    setGame((prev) => createInitialGame(prev.highScore));
    setScreen("game");
  }

  function selectHandCard(index: number) {
    if (game.isGameOver) return;
    if (index !== 0) return;

    setGame((prev) => ({
      ...prev,
      selectedHandIndex: 0,
      lastResult: `${prev.hand[0].rank}${suitSymbols[prev.hand[0].suit]} READY`,
      lastScore: 0,
    }));
  }

  function placeCard(row: number, col: number) {
    if (game.isGameOver) return;
    if (!game.hand[0]) return;
    if (game.board[row][col]) return;

    const selected = game.hand[0];

    const newBoard = game.board.map((boardRow) => [...boardRow]);
    newBoard[row][col] = selected;

    const results = evaluateBoard(newBoard, row, col);
    const hasHand = results.length > 0;

    const baseScore = results.reduce((sum, result) => sum + result.score, 0);
    const gainedScore = hasHand ? baseScore * game.combo : 0;

    let nextCombo = game.combo;
    let nextComboWindow = game.comboWindow;

    if (hasHand) {
      nextCombo = Math.min(game.combo + 1, MAX_COMBO);
      nextComboWindow = MAX_COMBO_WINDOW;
    } else if (game.combo > 1) {
      nextComboWindow = game.comboWindow - 1;

      if (nextComboWindow <= 0) {
        nextCombo = 1;
        nextComboWindow = MAX_COMBO_WINDOW;
      }
    } else {
      nextCombo = 1;
      nextComboWindow = MAX_COMBO_WINDOW;
    }

    const clearTargets = new Set<string>();
    const handTargets = new Set<string>();

    for (const result of results) {
      for (const cardPosition of result.cards) {
        handTargets.add(keyOf(cardPosition.row, cardPosition.col));
      }

      if (!result.shouldClear) continue;

      for (const cardPosition of result.cards) {
        clearTargets.add(keyOf(cardPosition.row, cardPosition.col));
      }
    }

    const boardBeforeClear = newBoard.map((boardRow) => [...boardRow]);

    if (clearTargets.size > 0) {
      for (const key of clearTargets) {
        const [targetRow, targetCol] = key.split("-").map(Number);
        newBoard[targetRow][targetCol] = null;
      }
    }

    const newHand = [...game.hand];
    newHand.shift();

    const drawResult = drawCardsForBoard(game.deck, 1, newBoard);
    newHand.push(...drawResult.drawn);

    const nextScore = game.score + gainedScore;
    const nextHighScore = Math.max(game.highScore, nextScore);

    if (nextHighScore > game.highScore) {
      saveHighScore(nextHighScore);
    }

    const nextGameOver = isBoardFull(newBoard);

    const resultText = hasHand
      ? `${results.map((result) => result.name).join(" + ")}`
      : game.combo > 1 && nextCombo === 1
      ? "COMBO BROKEN"
      : game.combo > 1
      ? `NO HAND - ${nextComboWindow} LEFT`
      : "NO HAND";

    setPlacedCell(keyOf(row, col));
    setHighlightCells(handTargets);
    setClearingCells(clearTargets);
    setResultPulse(hasHand || resultText === "COMBO BROKEN");
    setScorePulse(gainedScore > 0);
    setComboPulse(hasHand || nextCombo === 1);

    if (gainedScore > 0) {
      const floatingId = Date.now();

      setFloatingScores((prev) => [
        ...prev,
        {
          id: floatingId,
          value: gainedScore,
        },
      ]);

      window.setTimeout(() => {
        setFloatingScores((prev) =>
          prev.filter((score) => score.id !== floatingId)
        );
      }, 900);
    }

    window.setTimeout(() => {
      setGame({
        board: newBoard,
        deck: drawResult.rest,
        hand: newHand,
        score: nextScore,
        highScore: nextHighScore,
        combo: nextCombo,
        comboWindow: nextComboWindow,
        selectedHandIndex: nextGameOver ? null : 0,
        lastResult: nextGameOver ? "GAME OVER" : resultText,
        lastScore: gainedScore,
        isGameOver: nextGameOver,
      });
    }, clearTargets.size > 0 ? 320 : 120);

    window.setTimeout(() => {
      setPlacedCell(null);
      setHighlightCells(new Set());
      setClearingCells(new Set());
      setScorePulse(false);
      setComboPulse(false);
      setResultPulse(false);
    }, 760);

    if (clearTargets.size > 0) {
      setGame((prev) => ({
        ...prev,
        board: boardBeforeClear,
        selectedHandIndex: 0,
      }));
    }
  }

  if (!isLoaded) {
    return (
      <main className="flex h-screen items-center justify-center overflow-hidden bg-[#17102b] text-white">
        <div className="rounded-2xl border-[4px] border-black bg-[#d93555] px-8 py-5 shadow-[8px_8px_0_#000]">
          <p className="text-2xl font-black tracking-[0.3em] text-[#ffe975]">
            NUTS
          </p>
        </div>
      </main>
    );
  }

  if (screen === "home") {
    return <HomeScreen highScore={game.highScore} onStart={startGame} />;
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#17102b] text-white">
      <style>{`
        @keyframes floatScore {
          0% { opacity: 0; transform: translateY(20px) scale(0.8) rotate(-3deg); }
          15% { opacity: 1; transform: translateY(0) scale(1.08) rotate(2deg); }
          100% { opacity: 0; transform: translateY(-80px) scale(1.2) rotate(-2deg); }
        }

        @keyframes cardPop {
          0% { transform: scale(0.88) rotate(-3deg); }
          45% { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1) rotate(-1deg); }
        }

        @keyframes handGlow {
          0%, 100% { box-shadow: 0 0 0 4px #ffef7a, 0 0 22px rgba(110,231,255,0.95), 5px 5px 0 #000; }
          50% { box-shadow: 0 0 0 7px #6ee7ff, 0 0 32px rgba(255,239,122,1), 7px 7px 0 #000; }
        }

        @keyframes clearShake {
          0% { transform: rotate(-2deg) scale(1); opacity: 1; filter: brightness(1); }
          35% { transform: rotate(3deg) scale(1.12); opacity: 1; filter: brightness(1.35); }
          70% { transform: rotate(-4deg) scale(1.04); opacity: 0.85; filter: brightness(1.1); }
          100% { transform: rotate(-2deg) scale(0.78); opacity: 0.25; filter: brightness(0.7); }
        }

        @keyframes resultBounce {
          0% { transform: scale(1) rotate(0deg); }
          35% { transform: scale(1.06) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        @keyframes hitBadge {
          0% { transform: translate(-50%, -50%) scale(0.8) rotate(-8deg); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.15) rotate(4deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(-3deg); opacity: 1; }
        }

        @keyframes targetBanner {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,233,117,0.16),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(98,231,255,0.18),transparent_30%),radial-gradient(circle_at_50%_95%,rgba(217,53,85,0.28),transparent_34%)]" />

      <div className="pointer-events-none absolute inset-0 opacity-[0.075] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:18px_18px]" />

      {floatingScores.map((score) => (
        <div
          key={score.id}
          className="pointer-events-none fixed left-1/2 top-[20%] z-[70] -translate-x-1/2 rounded-2xl border-[5px] border-black bg-[#ffe975] px-6 py-3 text-5xl font-black text-[#d43d4f] shadow-[8px_8px_0_#000]"
          style={{ animation: "floatScore 900ms ease-out forwards" }}
        >
          +{score.value}
        </div>
      ))}

      {game.isGameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-5">
          <div className="w-full max-w-md rotate-[-1deg] rounded-[2rem] border-[5px] border-black bg-[#d93555] p-6 text-center shadow-[12px_12px_0_#000]">
            <p className="mb-2 text-sm font-black tracking-[0.5em] text-[#ffe975]">
              GAME OVER
            </p>

            <h2 className="mb-4 text-5xl font-black text-white drop-shadow-[3px_3px_0_#000]">
              {game.score}
            </h2>

            <div className="mb-5 rounded-2xl border-[4px] border-black bg-[#0f2146] p-4 shadow-[5px_5px_0_#000]">
              <p className="text-xs font-black tracking-widest text-[#62e7ff]">
                BEST SCORE
              </p>
              <p className="mt-1 text-3xl font-black text-[#ffe975]">
                {game.highScore}
              </p>
            </div>

            <button
              onClick={restartGame}
              className="w-full rounded-2xl border-[4px] border-black bg-[#ffe975] px-5 py-4 text-xl font-black text-black shadow-[6px_6px_0_#000] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#000]"
            >
              RESTART
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto flex h-screen w-full max-w-[1920px] flex-col justify-center px-1 py-1">
        <section className="w-full rounded-2xl border-[5px] border-black bg-[#2b1a4a] p-2 shadow-[8px_8px_0_#000]">
          <header className="mb-2 grid gap-2 md:grid-cols-[1fr_360px] md:items-end lg:grid-cols-[1fr_620px]">
            <div className="rounded-2xl border-[5px] border-black bg-[#d93555] px-3 py-2 shadow-[5px_5px_0_#000] lg:px-4">
              <p className="mb-1 text-xs font-black tracking-[0.4em] text-[#ffe975]">
                GRID POKER
              </p>

              <h1 className="text-3xl font-black leading-none text-white drop-shadow-[3px_3px_0_#000] lg:text-5xl">
                NUTS
              </h1>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <StatBox
                label="SCORE"
                value={game.score}
                accent
                pulse={scorePulse}
              />
              <StatBox label="BEST" value={game.highScore} accent />
              <StatBox
                label="COMBO"
                value={`x${game.combo}`}
                pulse={comboPulse}
              />
              <StatBox label="DECK" value={game.deck.length} />
            </div>
          </header>

          <div className="grid h-[calc(100vh-142px)] max-h-[760px] justify-center gap-2 md:h-[calc(100vh-118px)] md:grid-cols-[minmax(360px,1fr)_260px] lg:h-[calc(100vh-142px)] lg:grid-cols-[230px_minmax(620px,840px)_380px] xl:gap-3 2xl:grid-cols-[250px_minmax(660px,920px)_410px]">
            <RoleListPanel />

            <div className="flex min-h-0 flex-col">
              <section className="flex min-h-0 flex-1 flex-col rounded-2xl border-[5px] border-black bg-[#0f2146] p-2 shadow-[6px_6px_0_#000]">
                <div className="mb-1 flex h-5 items-center justify-between">
                  <p className="text-xs font-black tracking-[0.25em] text-[#ffe975]">
                    BOARD
                  </p>

                  {isResolvingHand && (
                    <div
                      className="rounded-full border-[3px] border-black bg-[#ffe975] px-3 py-1 text-[10px] font-black text-black shadow-[3px_3px_0_#000]"
                      style={{ animation: "targetBanner 180ms ease-out" }}
                    >
                      CLEAR TARGETS
                    </div>
                  )}
                </div>

                <div className="mx-auto grid aspect-square min-h-0 w-full max-h-full flex-1 grid-cols-5 grid-rows-5 gap-1.5 rounded-2xl border-[4px] border-black bg-[#081735] p-2 shadow-[inset_0_0_0_2px_rgba(255,233,117,0.08),inset_0_18px_40px_rgba(0,0,0,0.22)] lg:aspect-auto lg:max-h-none">
                  {game.board.map((boardRow, rowIndex) =>
                    boardRow.map((cell, colIndex) => {
                      const cellKey = keyOf(rowIndex, colIndex);

                      const canPlace =
                        !cell &&
                        !game.isGameOver &&
                        game.hand.length > 0;

                      const isPlaced = placedCell === cellKey;
                      const isHighlighted = highlightCells.has(cellKey);
                      const isClearing = clearingCells.has(cellKey);
                      const shouldDim =
                        isResolvingHand && !!cell && !isHighlighted;

                      return (
                        <button
                          key={cellKey}
                          onClick={() => placeCard(rowIndex, colIndex)}
                          disabled={!!cell || game.isGameOver}
                          className={[
                            "relative h-full min-h-0 rounded-xl border-[3px] transition duration-200",
                            cell
                              ? "rotate-[-1deg] border-black bg-[#fff3cf] p-1 shadow-[3px_3px_0_#000]"
                              : "border-black bg-[#122a59] shadow-[2px_2px_0_#000]",
                            canPlace
                              ? "cursor-pointer bg-[#2853a7] shadow-[0_0_0_3px_#ffef7a,4px_4px_0_#000] hover:-translate-y-1 hover:bg-[#3268d4]"
                              : "",
                            !cell && !canPlace ? "hover:bg-[#223b7c]" : "",
                            isHighlighted
                              ? "z-20 bg-[#ffe975] shadow-[0_0_0_4px_#6ee7ff,0_0_24px_rgba(255,239,122,0.85),5px_5px_0_#000]"
                              : "",
                            shouldDim ? "opacity-35 grayscale" : "",
                          ].join(" ")}
                          style={{
                            animation: isClearing
                              ? "clearShake 520ms ease-in-out forwards"
                              : isHighlighted
                              ? "handGlow 580ms ease-in-out infinite"
                              : isPlaced
                              ? "cardPop 360ms ease-out"
                              : undefined,
                          }}
                        >
                          {cell ? (
                            <>
                              <CardFace card={cell} size="normal" />

                              {isHighlighted && (
                                <div
                                  className="pointer-events-none absolute left-1/2 top-1/2 z-30 rounded-full border-[3px] border-black bg-[#62e7ff] px-2 py-1 text-[10px] font-black text-black shadow-[3px_3px_0_#000]"
                                  style={{
                                    animation: "hitBadge 220ms ease-out forwards",
                                  }}
                                >
                                  HIT
                                </div>
                              )}

                              {isHighlighted && (
                                <div className="pointer-events-none absolute inset-[-6px] z-[-1] rounded-2xl bg-[#ffe975] blur-md" />
                              )}
                            </>
                          ) : (
                            <span
                              className={[
                                "text-2xl font-black",
                                canPlace ? "text-[#ffe975]" : "text-white/20",
                              ].join(" ")}
                            >
                              ＋
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              
              <MobileRoleListPanel />
            </div>

            <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
<div className="rounded-2xl border-[5px] border-black bg-[#d93555] p-2 shadow-[6px_6px_0_#000] lg:p-3">
                <div className="mb-3 rounded-xl border-[3px] border-black bg-[#ffe975] px-3 py-2 text-black shadow-[3px_3px_0_#000]">
                  <p className="text-[10px] font-black tracking-[0.25em]">
                    NOW
                  </p>
                </div>

                <button
                  onClick={() => selectHandCard(0)}
                  disabled={game.isGameOver || !game.hand[0]}
                  className="mb-3 flex w-full items-center gap-3 rounded-2xl border-[4px] border-black bg-[#274b96] p-2 text-left shadow-[4px_4px_0_#000] transition hover:-translate-y-1 hover:shadow-[6px_6px_0_#000] lg:mb-4 lg:gap-4 lg:p-3"
                >
                  <div className="w-20 shrink-0 rotate-[-2deg] rounded-xl border-[4px] border-black bg-[#fff3cf] p-1 shadow-[4px_4px_0_#000] lg:w-28" style={{ aspectRatio: "5 / 7" }}>
                    {game.hand[0] ? (
                      <CardFace card={game.hand[0]} size="small" />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl bg-[#fff3cf] text-center text-xs font-black text-black/50">
                        EMPTY
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-black tracking-widest text-[#62e7ff]">
                      PLACE THIS
                    </p>
                    <p className="mt-1 text-2xl font-black text-white drop-shadow-[2px_2px_0_#000]">
                      {game.hand[0]
                        ? `${game.hand[0].rank}${suitSymbols[game.hand[0].suit]}`
                        : "-"}
                    </p>
                  </div>
                </button>

                <div className="rounded-xl border-[3px] border-black bg-[#0f2146] p-3 shadow-[3px_3px_0_#000]">
                  <p className="mb-2 text-[10px] font-black tracking-[0.25em] text-[#ffe975]">
                    NEXT
                  </p>

                  <div className="grid grid-cols-2 items-center justify-items-center gap-2 lg:gap-3">
                    {game.hand.slice(1, 3).map((card, index) => (
                      <div
                        key={card.id}
                        className="relative mx-auto w-20 rounded-xl border-[3px] border-black bg-[#fff3cf] p-1.5 opacity-90 shadow-[3px_3px_0_#000] lg:w-28" style={{ aspectRatio: "5 / 7" }}
                      >
                        <div className="pointer-events-none absolute left-1 top-1 z-20 rounded-md border-[2px] border-black bg-[#0f2146] px-1.5 py-0.5 text-[11px] font-black leading-none text-[#ffe975] shadow-[2px_2px_0_#000]">
                          +{index + 1}
                        </div>
                        <CardFace card={card} size="tiny" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={restartGame}
                  className="rounded-xl border-[4px] border-black bg-[#ffe975] px-3 py-3 text-base font-black text-black shadow-[4px_4px_0_#000] transition hover:-translate-y-1 hover:brightness-105 hover:shadow-[6px_6px_0_#000]"
                >
                  RESTART
                </button>

                <button
                  onClick={() => setScreen("home")}
                  className="rounded-xl border-[4px] border-black bg-[#62e7ff] px-3 py-3 text-base font-black text-black shadow-[4px_4px_0_#000] transition hover:-translate-y-1 hover:brightness-105 hover:shadow-[6px_6px_0_#000]"
                >
                  HOME
                </button>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}