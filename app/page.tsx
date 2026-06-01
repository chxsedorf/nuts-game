"use client";

import { useEffect, useRef, useState } from "react";

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

type ResultBanner = {
  id: number;
  text: string;
  score: number;
  combo: number;
  comboNext?: number;
  isBreak?: boolean;
};

type ScreenState = "home" | "game";
type GameMode = "solo" | "duel";
type PlayerId = 1 | 2;
type CellOwner = PlayerId | null;
type OwnerBoard = CellOwner[][];

type DuelState = {
  board: Board;
  owners: OwnerBoard;
  deck: Card[];
  currentCard: Card | null;
  currentPlayer: PlayerId;
  placedCount: number;
  lastResult: string;
  lastHandName: string;
  isGameOver: boolean;
};

type SoundName =
  | "start"
  | "restart"
  | "select"
  | "place"
  | "hit"
  | "miss"
  | "gameover";

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) return null;

  return new AudioContextClass();
}

const BOARD_SIZE = 5;
const HAND_SIZE = 3;
const HIGH_SCORE_KEY = "nuts-high-score";
const MAX_COMBO_WINDOW = 3;

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
  pair: 12,
  three: 55,
  straight: 75,
  flush: 85,
  fullHouse: 190,
};

const comboMilestones = [5, 10, 15, 25, 50, 100];

function getHandCountBonus(handCount: number) {
  if (handCount >= 4) return 2.2;
  if (handCount === 3) return 1.75;
  if (handCount === 2) return 1.35;
  return 1;
}

function getComboMilestoneBonus(combo: number) {
  const hitMilestone = comboMilestones.includes(combo);

  if (!hitMilestone) return 0;

  return combo * 120;
}

function calculateGainedScore(baseScore: number, combo: number, handCount: number) {
  const multiHandBonus = getHandCountBonus(handCount);
  const rawScore = baseScore * combo * multiHandBonus;
  const milestoneBonus = getComboMilestoneBonus(combo);

  return Math.floor(rawScore + milestoneBonus);
}

function getScoreDetailText(baseScore: number, combo: number, handCount: number) {
  const multiHandBonus = getHandCountBonus(handCount);
  const milestoneBonus = getComboMilestoneBonus(combo);

  if (milestoneBonus > 0) {
    return `BASE ${baseScore} ×${combo} ×${multiHandBonus.toFixed(2)} + ${milestoneBonus} BONUS`;
  }

  if (handCount >= 2) {
    return `BASE ${baseScore} ×${combo} ×${multiHandBonus.toFixed(2)}`;
  }

  return `BASE ${baseScore} ×${combo}`;
}

function getComboTier(combo: number) {
  if (combo >= 50) {
    return {
      label: "LIMITLESS",
      tone: "from-[#fff4cf] via-[#f0a536] to-[#d23a2f]",
      glow: "rgba(255, 239, 122, 0.95)",
      text: "text-[#fff4cf]",
      intensity: 4,
    };
  }

  if (combo >= 25) {
    return {
      label: "GOD RUN",
      tone: "from-[#6ee7ff] via-[#ffef7a] to-[#f0a536]",
      glow: "rgba(110, 231, 255, 0.9)",
      text: "text-[#6ee7ff]",
      intensity: 3.4,
    };
  }

  if (combo >= 15) {
    return {
      label: "OVERDRIVE",
      tone: "from-[#f0a536] via-[#ffef7a] to-[#d23a2f]",
      glow: "rgba(240, 165, 54, 0.85)",
      text: "text-[#ffef7a]",
      intensity: 2.8,
    };
  }

  if (combo >= 8) {
    return {
      label: "FEVER",
      tone: "from-[#35b66a] via-[#f5d06f] to-[#f0a536]",
      glow: "rgba(245, 208, 111, 0.78)",
      text: "text-[#f5d06f]",
      intensity: 2.15,
    };
  }

  if (combo >= 4) {
    return {
      label: "HEATING",
      tone: "from-[#123f32] via-[#35b66a] to-[#f5d06f]",
      glow: "rgba(53, 182, 106, 0.62)",
      text: "text-[#8bd8af]",
      intensity: 1.5,
    };
  }

  return {
    label: "CHAIN",
    tone: "from-[#07160f] via-[#123f32] to-[#0b2f27]",
    glow: "rgba(127, 208, 164, 0.38)",
    text: "text-[#d8eadc]",
    intensity: 1,
  };
}

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

function createEmptyOwnerBoard(): OwnerBoard {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

function hasEmptyCell(board: Board) {
  return board.some((row) => row.some((cell) => cell === null));
}

function countOwnedCells(owners: OwnerBoard, player: PlayerId) {
  return owners.flat().filter((owner) => owner === player).length;
}

function createInitialDuelGame(): DuelState {
  const deck = createDeck();
  const [currentCard, ...rest] = deck;

  return {
    board: createEmptyBoard(),
    owners: createEmptyOwnerBoard(),
    deck: rest,
    currentCard: currentCard ?? null,
    currentPlayer: 1,
    placedCount: 0,
    lastResult: "P1 TURN",
    lastHandName: "",
    isGameOver: false,
  };
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

  const cornerSize =
    size === "tiny" ? "text-[10px]" : size === "small" ? "text-xs" : "text-sm";

  const isRed = card.suit === "heart" || card.suit === "diamond";
  const colorClass = isRed ? "text-[#b83224]" : "text-[#10271f]";

  return (
    <div
      className={[
        "nuts-card-paper pixel-hard-sm relative flex h-full w-full flex-col items-center justify-center overflow-hidden border-[2px] border-[#2d2114] font-black",
        colorClass,
      ].join(" ")}
    >
      <div className="absolute left-1 top-1 z-20 flex flex-col items-center leading-none">
        <span className={`${cornerSize} drop-shadow-[1px_1px_0_#fff4cf]`}>
          {card.rank}
        </span>
        <span className="text-sm leading-none drop-shadow-[1px_1px_0_#fff4cf]">
          {suitSymbols[card.suit]}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center drop-shadow-[2px_2px_0_rgba(255,244,207,0.75)]">
        <span className={`${rankSize} leading-none`}>{card.rank}</span>
        <span className={`${suitSize} -mt-1 leading-none`}>
          {suitSymbols[card.suit]}
        </span>
      </div>

      <div className="absolute bottom-1 right-1 z-20 flex rotate-180 flex-col items-center leading-none">
        <span className={`${cornerSize} drop-shadow-[1px_1px_0_#fff4cf]`}>
          {card.rank}
        </span>
        <span className="text-sm leading-none drop-shadow-[1px_1px_0_#fff4cf]">
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
        "pixel-hard-sm relative flex min-h-[48px] flex-col items-center justify-center border-[3px] border-[#07160f] bg-[#071a15] px-1.5 py-1 text-center shadow-[4px_4px_0_#03100b,0_0_0_2px_#154231_inset,0_0_18px_rgba(0,0,0,0.28)_inset] transition sm:min-h-[58px] sm:border-[4px] sm:px-2 sm:py-1.5 sm:shadow-[5px_5px_0_#03100b,0_0_0_2px_#154231_inset,0_0_18px_rgba(0,0,0,0.28)_inset]",
        "[clip-path:polygon(8%_0,92%_0,100%_18%,100%_82%,92%_100%,8%_100%,0_82%,0_18%)]",
        pulse ? "scale-105 bg-[#f0a536]" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-[5px] border-[2px] border-[#184936]/70 [clip-path:polygon(8%_0,92%_0,100%_18%,100%_82%,92%_100%,8%_100%,0_82%,0_18%)]" />

      <p
        className={[
          "relative z-10 text-[11px] font-black leading-none tracking-[0.12em] sm:text-[14px]",
          pulse ? "text-[#3b1604]" : "text-[#f6bd4a]",
        ].join(" ")}
        style={{ textShadow: pulse ? "none" : "2px 2px 0 #2a1603" }}
      >
        {label}
      </p>

      <p
        className={[
          "relative z-10 mt-1 text-xl font-black leading-none sm:text-2xl xl:text-3xl",
          pulse ? "text-[#07160f]" : accent ? "text-[#f5c247]" : "text-[#f2f2eb]",
        ].join(" ")}
        style={{ textShadow: pulse ? "none" : "3px 3px 0 #06100c" }}
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
  },
  {
    name: "Three",
    cards: [
      { rank: "Q", suit: "heart" as Suit },
      { rank: "Q", suit: "diamond" as Suit },
      { rank: "Q", suit: "club" as Suit },
    ],
  },
  {
    name: "Straight",
    cards: [
      { rank: "5", suit: "spade" as Suit },
      { rank: "6", suit: "heart" as Suit },
      { rank: "7", suit: "club" as Suit },
    ],
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
  },
];

function RoleListPanel() {
  const roles = roleExamples;

  function MiniCard({ rank, suit }: { rank: string; suit: Suit }) {
    const isRed = suit === "heart" || suit === "diamond";

    return (
      <div
        className={[
          "flex h-10 w-8 flex-col items-center justify-center rounded-md border-[2px] border-black bg-[#fff4cf] text-[11px] font-black leading-none shadow-[2px_2px_0_#000]",
          isRed ? "text-red-600" : "text-blue-950",
        ].join(" ")}
      >
        <span>{rank}</span>
        <span className="text-base">{suitSymbols[suit]}</span>
      </div>
    );
  }

  return (
    <aside className="hidden h-full min-h-0 overflow-hidden rounded-2xl border-[5px] border-black bg-[#101b3b] p-3 shadow-[6px_6px_0_#000] lg:flex lg:flex-col">
      <div className="mb-2 rounded-xl border-[4px] border-black bg-[#ffef7a] px-3 py-2 text-black shadow-[3px_3px_0_#000] lg:mb-3">
        <p className="text-[11px] font-black tracking-[0.25em]">HANDS</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {roles.map((role) => (
          <div
            key={role.name}
            className="rounded-xl border-[3px] border-black bg-[#2d1850] p-2 shadow-[3px_3px_0_#000]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-black leading-none text-[#ffef7a]">
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
          "flex h-8 w-6 shrink-0 flex-col items-center justify-center rounded-md border-[2px] border-black bg-[#fff4cf] text-[9px] font-black leading-none shadow-[2px_2px_0_#000]",
          isRed ? "text-red-600" : "text-blue-950",
        ].join(" ")}
      >
        <span>{rank}</span>
        <span className="text-sm">{suitSymbols[suit]}</span>
      </div>
    );
  }

  return (
    <aside className="mt-2 hidden rounded-2xl border-[5px] border-black bg-[#101b3b] p-2 shadow-[6px_6px_0_#000] md:block lg:hidden">
      <div className="mb-2 rounded-xl border-[4px] border-black bg-[#ffef7a] px-3 py-2 text-black shadow-[3px_3px_0_#000]">
        <p className="text-[10px] font-black tracking-[0.25em]">HANDS</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {roleExamples.map((role) => (
          <div
            key={role.name}
            className="min-w-[116px] rounded-xl border-[3px] border-black bg-[#2d1850] p-2 shadow-[3px_3px_0_#000]"
          >
            <p className="mb-1 text-xs font-black leading-none text-[#ffef7a]">
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
  onStartDuel,
}: {
  highScore: number;
  onStart: () => void;
  onStartDuel: () => void;
}) {
  const [showHands, setShowHands] = useState(false);

  const titleCards: { rank: string; suit: Suit; tilt: string }[] = [
    { rank: "A", suit: "spade", tilt: "rotate-[-8deg] translate-y-3" },
    { rank: "K", suit: "heart", tilt: "rotate-[-3deg] translate-y-0" },
    { rank: "Q", suit: "club", tilt: "rotate-[4deg] translate-y-4" },
    { rank: "J", suit: "diamond", tilt: "rotate-[9deg] translate-y-1" },
  ];

  const previewCells = [
    "", "", "", "", "",
    "", "7♠", "8♠", "9♠", "",
    "", "", "", "", "",
    "", "Q♥", "Q♣", "", "",
    "", "", "", "", "",
  ];

  function GuideMiniCard({ rank, suit }: { rank: string; suit: Suit }) {
    const isRed = suit === "heart" || suit === "diamond";

    return (
      <div
        className={[
          "relative flex h-12 w-9 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border-[3px] border-[#1c1208] bg-[#fff4cf] text-[12px] font-black leading-none shadow-[3px_3px_0_#06110c]",
          isRed ? "text-[#b83224]" : "text-[#10271f]",
        ].join(" ")}
      >
        <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_5px,rgba(83,59,30,0.12)_6px)]" />
        <span className="relative z-10">{rank}</span>
        <span className="relative z-10 text-xl">{suitSymbols[suit]}</span>
      </div>
    );
  }

  return (
    <main className="nuts-pixel crt-lines felt-bg pixel-dither relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#07120f] text-white lg:h-screen lg:overflow-hidden">
      <style>{`
        @keyframes logoRise {
          0% { transform: translateY(16px) scale(0.96); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        @keyframes menuRise {
          0% { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes titleGlow {
          0%, 100% { filter: drop-shadow(5px 5px 0 #3b1604) drop-shadow(0 0 10px rgba(242,149,48,0.35)); }
          50% { filter: drop-shadow(6px 6px 0 #3b1604) drop-shadow(0 0 22px rgba(255,202,91,0.75)); }
        }

        @keyframes cardFloatSoft {
          0%, 100% { transform: translateY(0) rotate(var(--tilt)); }
          50% { transform: translateY(-10px) rotate(calc(var(--tilt) + 2deg)); }
        }

        @keyframes shineSweep {
          0% { transform: translateX(-120%) skewX(-18deg); }
          45%, 100% { transform: translateX(180%) skewX(-18deg); }
        }

        @keyframes buttonPulseGold {
          0%, 100% { box-shadow: 5px 5px 0 #03100b, 0 0 0 2px #ffcf63 inset, 0 0 12px rgba(242,149,48,0.25); }
          50% { box-shadow: 7px 7px 0 #03100b, 0 0 0 2px #fff0a1 inset, 0 0 28px rgba(255,207,99,0.72); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(240,165,54,0.22),transparent_25%),radial-gradient(circle_at_82%_24%,rgba(28,91,68,0.42),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(7,26,21,0.9),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#f5c247_1px,transparent_1px),linear-gradient(90deg,#f5c247_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#2b1743]/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

      {showHands && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-black/75 px-3 py-4 sm:px-4">
          <div className="pixel-hard relative max-h-[88vh] w-full max-w-3xl overflow-hidden border-[5px] border-[#07160f] bg-[#08241b] p-4 shadow-[10px_10px_0_#020806,0_0_0_2px_#f0a536_inset]">
            <div className="pointer-events-none absolute inset-[10px] border-[2px] border-[#f0a536]/70" />

            <div className="relative z-10 mb-4 flex items-center justify-between gap-3 border-b-[3px] border-[#144431] pb-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.42em] text-[#f0a536]">
                  NUTS GUIDE
                </p>
                <h2 className="text-3xl font-black text-[#fff4cf] drop-shadow-[3px_3px_0_#06100c]">
                  HANDS
                </h2>
              </div>

              <button
                onClick={() => setShowHands(false)}
                className="pixel-hard-sm border-[4px] border-[#06160f] bg-[#f0a536] px-4 py-2 text-sm font-black text-[#2a1603] shadow-[4px_4px_0_#020806] transition hover:-translate-y-1"
              >
                CLOSE
              </button>
            </div>

            <div className="relative z-10 grid max-h-[65vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {roleExamples.map((role) => (
                <div
                  key={role.name}
                  className="rounded-2xl border-[3px] border-[#06160f] bg-[#0c3628] p-3 shadow-[4px_4px_0_#020806,0_0_0_2px_#1e5f47_inset]"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-lg font-black text-[#f5c247]">
                      {role.name}
                    </p>
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#8bd8af]">
                      LINE HIT
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {role.cards.map((card, index) => (
                      <GuideMiniCard
                        key={`${role.name}-${card.rank}-${card.suit}-${index}`}
                        rank={card.rank}
                        suit={card.suit}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-[90] flex items-center justify-center bg-[#07120f] px-6 text-center text-white md:hidden landscape:hidden">
        <div className="rounded-2xl border-[5px] border-black bg-[#0b3a2b] p-6 shadow-[8px_8px_0_#000]">
          <p className="mb-2 text-xs font-black tracking-[0.35em] text-[#f0a536]">
            NUTS
          </p>
          <p className="text-2xl font-black leading-tight">
            Rotate your phone
          </p>
          <p className="mt-3 text-xs font-bold leading-5 text-[#d8eadc]">
            This game is designed for landscape play.
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1180px] items-center justify-center px-3 py-4 sm:px-4 md:px-6 lg:h-screen">
        <section className="grid w-full max-w-[1100px] gap-3 sm:gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            className="pixel-hard relative min-h-[480px] overflow-hidden border-[5px] border-[#06160f] bg-[#08241b] p-4 shadow-[8px_8px_0_#020806,0_0_0_3px_#f0a536_inset] sm:min-h-[540px] sm:border-[6px] sm:p-5 md:p-7 lg:min-h-[560px] lg:shadow-[12px_12px_0_#020806,0_0_0_3px_#f0a536_inset]"
            style={{ animation: "logoRise 520ms ease-out both" }}
          >
            <div className="pointer-events-none absolute inset-[12px] border-[2px] border-[#f0a536]/70" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#145238]/80 to-transparent" />
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#f0a536]/15 blur-2xl" />

            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border-[3px] border-[#06160f] bg-[#0d3a2b] px-4 py-2 shadow-[4px_4px_0_#020806]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f0a536] shadow-[0_0_12px_#f0a536]" />
                  <p className="text-[11px] font-black tracking-[0.32em] text-[#e7d79e]">
                    GRID POKER
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-[1.25rem] border-[4px] border-[#06160f] bg-[#0b3025] px-5 py-5 shadow-[7px_7px_0_#020806,0_0_0_2px_#1f6a4e_inset]">
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/10" style={{ animation: "shineSweep 3.6s ease-in-out infinite" }} />
                  <p className="relative z-10 mb-1 text-[12px] font-black tracking-[0.48em] text-[#f0a536]">
                    CASINO PUZZLE
                  </p>
                  <h1
                    className="relative z-10 text-[clamp(4.5rem,13vw,9rem)] font-black leading-[0.82] text-[#f29530]"
                    style={{
                      WebkitTextStroke: "2px #ffd47a",
                      textShadow: "7px 7px 0 #2a1603, 10px 10px 0 #020806",
                      animation: "titleGlow 2.8s ease-in-out infinite",
                    }}
                  >
                    NUTS
                  </h1>
                  <p className="relative z-10 mt-3 text-sm font-black tracking-[0.38em] text-[#e7d79e] md:text-base">
                    BUILD HANDS. BREAK THE GRID.
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-5 flex items-end justify-center gap-1.5 sm:mt-6 sm:gap-2 md:gap-3">
                {titleCards.map((card, index) => {
                  const isRed = card.suit === "heart" || card.suit === "diamond";

                  return (
                    <div
                      key={`${card.rank}-${card.suit}`}
                      className={`h-24 w-16 rounded-xl border-[4px] border-[#1c1208] bg-[#fff4cf] p-1.5 text-center shadow-[5px_5px_0_#020806] sm:h-32 sm:w-24 sm:p-2 md:h-40 md:w-28 md:shadow-[6px_6px_0_#020806] ${card.tilt}`}
                      style={{
                        "--tilt": `${index * 5 - 8}deg`,
                        animation: `cardFloatSoft ${3 + index * 0.25}s ease-in-out infinite`,
                      } as Record<string, string>}
                    >
                      <div className={["flex h-full flex-col items-center justify-center font-black", isRed ? "text-[#b83224]" : "text-[#10271f]"].join(" ")}>
                        <p className="text-2xl sm:text-3xl md:text-4xl">{card.rank}</p>
                        <p className="text-4xl sm:text-5xl md:text-6xl">{suitSymbols[card.suit]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="relative z-10 mt-5 grid grid-cols-3 gap-1.5 text-center sm:mt-6 sm:gap-2">
                <div className="rounded-xl border-[3px] border-[#06160f] bg-[#0d3a2b] px-3 py-3 shadow-[4px_4px_0_#020806]">
                  <p className="text-[10px] font-black tracking-[0.24em] text-[#8bd8af]">MODE</p>
                  <p className="mt-1 text-sm font-black text-[#fff4cf]">ENDLESS</p>
                </div>
                <div className="rounded-xl border-[3px] border-[#06160f] bg-[#0d3a2b] px-3 py-3 shadow-[4px_4px_0_#020806]">
                  <p className="text-[10px] font-black tracking-[0.24em] text-[#8bd8af]">BOARD</p>
                  <p className="mt-1 text-sm font-black text-[#fff4cf]">5 x 5</p>
                </div>
                <div className="rounded-xl border-[3px] border-[#06160f] bg-[#0d3a2b] px-3 py-3 shadow-[4px_4px_0_#020806]">
                  <p className="text-[10px] font-black tracking-[0.24em] text-[#8bd8af]">CLEAR</p>
                  <p className="mt-1 text-sm font-black text-[#fff4cf]">LINE</p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="grid min-h-0 gap-4 lg:min-h-[560px]"
            style={{ animation: "menuRise 640ms 120ms ease-out both" }}
          >
            <div className="pixel-hard relative overflow-hidden border-[6px] border-[#06160f] bg-[#0a2119] p-4 shadow-[12px_12px_0_#020806,0_0_0_3px_#f0a536_inset]">
              <div className="pointer-events-none absolute inset-[10px] border-[2px] border-[#18533c]" />

              <div className="relative z-10 grid gap-3">
                <button
                  onClick={onStart}
                  className="pixel-hard-sm relative overflow-hidden border-[5px] border-[#06160f] bg-[#f0a536] px-6 py-5 text-3xl font-black text-[#2a1603] shadow-[5px_5px_0_#03100b] transition hover:-translate-y-1 active:translate-y-0"
                  style={{ animation: "buttonPulseGold 1.7s ease-in-out infinite" }}
                >
                  <span className="relative z-10">SOLO PLAY</span>
                  <span className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-white/25" style={{ animation: "shineSweep 2.7s ease-in-out infinite" }} />
                </button>

                <button
                  onClick={onStartDuel}
                  className="pixel-hard-sm relative overflow-hidden border-[5px] border-[#06160f] bg-[#6ee7ff] px-6 py-4 text-2xl font-black text-[#06160f] shadow-[5px_5px_0_#03100b] transition hover:-translate-y-1 active:translate-y-0"
                >
                  DUEL MODE
                </button>

                <div className="grid grid-cols-[1fr_0.85fr] gap-3">
                  <button
                    onClick={() => setShowHands(true)}
                    className="pixel-hard-sm border-[4px] border-[#06160f] bg-[#124733] px-4 py-4 text-xl font-black text-[#fff4cf] shadow-[5px_5px_0_#020806] transition hover:-translate-y-1"
                  >
                    HANDS
                  </button>

                  <div className="pixel-hard-sm border-[4px] border-[#06160f] bg-[#07160f] px-4 py-3 text-left shadow-[5px_5px_0_#020806]">
                    <p className="text-[10px] font-black tracking-[0.28em] text-[#f0a536]">
                      BEST
                    </p>
                    <p className="mt-1 text-3xl font-black leading-none text-[#fff4cf] drop-shadow-[3px_3px_0_#020806]">
                      {highScore}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pixel-hard relative grid gap-4 overflow-hidden border-[6px] border-[#06160f] bg-[#08241b] p-4 shadow-[12px_12px_0_#020806,0_0_0_3px_#1c5b44_inset] md:grid-cols-[0.95fr_1.05fr]">
              <div className="pointer-events-none absolute inset-[10px] border-[2px] border-[#18533c]" />

              <div className="relative z-10">
                <div className="mb-3 rounded-lg border-[3px] border-[#06160f] bg-[#0d3a2b] px-3 py-2 shadow-[3px_3px_0_#020806]">
                  <p className="text-[11px] font-black tracking-[0.34em] text-[#f0a536]">
                    HOW TO PLAY
                  </p>
                </div>

                <div className="space-y-2 text-sm font-bold leading-6 text-[#d8eadc]">
                  <p>
                    <span className="text-[#f5c247]">01</span> Place the visible card on the grid.
                  </p>
                  <p>
                    <span className="text-[#f5c247]">02</span> Make hands vertically or horizontally.
                  </p>
                  <p>
                    <span className="text-[#f5c247]">03</span> Hit cards vanish. Every hit raises the multiplier forever.
                  </p>
                </div>
              </div>

              <div className="relative z-10 rounded-2xl border-[4px] border-[#06160f] bg-[#051610] p-3 shadow-[4px_4px_0_#020806,0_0_0_2px_#123e2e_inset]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black tracking-[0.3em] text-[#8bd8af]">
                    PREVIEW
                  </p>
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#f0a536]">
                    STRAIGHT HIT
                  </p>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {previewCells.map((cell, index) => {
                    const hit = cell === "7♠" || cell === "8♠" || cell === "9♠";

                    return (
                      <div
                        key={`${cell}-${index}`}
                        className={[
                          "flex aspect-square items-center justify-center rounded-md border-[2px] border-[#0d3a2b] bg-[#09251c] text-[12px] font-black shadow-[0_0_0_1px_#06160f_inset]",
                          hit ? "bg-[#f0a536] text-[#2a1603] shadow-[0_0_14px_rgba(240,165,54,0.75)]" : "text-[#366653]",
                        ].join(" ")}
                      >
                        {cell || "♠"}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {["PAIR", "THREE", "STRAIGHT"].map((label) => (
                <div
                  key={label}
                  className="pixel-hard-sm border-[4px] border-[#06160f] bg-[#0d3a2b] px-3 py-3 text-center shadow-[5px_5px_0_#020806]"
                >
                  <p className="text-[11px] font-black tracking-[0.2em] text-[#f5c247]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => createInitialGame(0));
  const [duel, setDuel] = useState<DuelState>(() => createInitialDuelGame());
  const [mode, setMode] = useState<GameMode>("solo");
  const [isLoaded, setIsLoaded] = useState(false);
  const [screen, setScreen] = useState<ScreenState>("home");

  const [placedCell, setPlacedCell] = useState<string | null>(null);
  const [highlightCells, setHighlightCells] = useState<Set<string>>(new Set());
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [scorePulse, setScorePulse] = useState(false);
  const [comboPulse, setComboPulse] = useState(false);
  const [resultPulse, setResultPulse] = useState(false);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [resultBanner, setResultBanner] = useState<ResultBanner | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  function getAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }

    const context = audioContextRef.current;

    if (context?.state === "suspended") {
      void context.resume();
    }

    return context;
  }

  function playNote(
    context: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    gainValue: number,
    type: OscillatorType = "square"
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  function playNoise(
    context: AudioContext,
    startTime: number,
    duration: number,
    gainValue: number
  ) {
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    filter.type = "highpass";
    filter.frequency.setValueAtTime(900, startTime);

    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    source.start(startTime);
    source.stop(startTime + duration);
  }

  function playSound(sound: SoundName) {
    if (!soundEnabled) return;

    const context = getAudioContext();
    if (!context) return;

    const now = context.currentTime;

    if (sound === "place") {
      playNote(context, 220, now, 0.055, 0.055, "square");
      playNote(context, 330, now + 0.045, 0.07, 0.045, "triangle");
      return;
    }

    if (sound === "select") {
      playNote(context, 520, now, 0.045, 0.035, "square");
      playNote(context, 740, now + 0.035, 0.05, 0.03, "square");
      return;
    }

    if (sound === "hit") {
      playNote(context, 392, now, 0.08, 0.055, "square");
      playNote(context, 523.25, now + 0.06, 0.085, 0.055, "square");
      playNote(context, 783.99, now + 0.13, 0.13, 0.06, "triangle");
      playNoise(context, now + 0.02, 0.12, 0.025);
      return;
    }

    if (sound === "miss") {
      playNote(context, 196, now, 0.09, 0.05, "sawtooth");
      playNote(context, 130.81, now + 0.075, 0.13, 0.045, "sawtooth");
      playNoise(context, now, 0.16, 0.018);
      return;
    }

    if (sound === "gameover") {
      playNote(context, 392, now, 0.12, 0.055, "triangle");
      playNote(context, 261.63, now + 0.11, 0.16, 0.052, "triangle");
      playNote(context, 164.81, now + 0.25, 0.24, 0.055, "sawtooth");
      return;
    }

    if (sound === "start") {
      playNote(context, 261.63, now, 0.07, 0.045, "square");
      playNote(context, 329.63, now + 0.06, 0.07, 0.045, "square");
      playNote(context, 523.25, now + 0.13, 0.12, 0.055, "triangle");
      return;
    }

    playNote(context, 180, now, 0.055, 0.04, "square");
    playNote(context, 260, now + 0.05, 0.08, 0.04, "square");
  }

  function toggleSound() {
    const willEnable = !soundEnabled;
    setSoundEnabled(willEnable);

    if (willEnable) {
      const context = getAudioContext();
      if (!context) return;

      const now = context.currentTime;
      playNote(context, 520, now, 0.045, 0.035, "square");
      playNote(context, 780, now + 0.04, 0.06, 0.035, "triangle");
    }
  }

  function resetEffects() {
    setPlacedCell(null);
    setHighlightCells(new Set());
    setClearingCells(new Set());
    setScorePulse(false);
    setComboPulse(false);
    setResultPulse(false);
    setFloatingScores([]);
    setResultBanner(null);
  }

  function restartGame() {
    playSound("restart");
    resetEffects();
    setGame((prev) => createInitialGame(prev.highScore));
  }

  function startGame() {
    playSound("start");
    resetEffects();
    setGame((prev) => createInitialGame(prev.highScore));
    setScreen("game");
  }

  function startDuelGame() {
    playSound("start");
    resetEffects();
    setMode("duel");
    setDuel(createInitialDuelGame());
    setScreen("game");
  }

  function restartDuelGame() {
    playSound("restart");
    resetEffects();
    setDuel(createInitialDuelGame());
  }

  function finishDuel(nextDuel: DuelState, message = "DUEL OVER") {
    window.setTimeout(() => playSound("gameover"), 180);
    return {
      ...nextDuel,
      lastResult: message,
      isGameOver: true,
    };
  }

  function placeDuelCard(row: number, col: number) {
    if (duel.isGameOver) return;
    if (!duel.currentCard) return;
    if (duel.board[row][col]) return;

    playSound("place");

    const selected = duel.currentCard;
    const newBoard = duel.board.map((boardRow) => [...boardRow]);
    const newOwners = duel.owners.map((ownerRow) => [...ownerRow]);
    newBoard[row][col] = selected;

    const results = evaluateBoard(newBoard, row, col);
    const hasHand = results.length > 0;
    const handTargets = new Set<string>();

    for (const result of results) {
      for (const cardPosition of result.cards) {
        const targetKey = keyOf(cardPosition.row, cardPosition.col);
        handTargets.add(targetKey);
        newOwners[cardPosition.row][cardPosition.col] = duel.currentPlayer;
      }
    }

    if (hasHand) {
      for (const targetKey of handTargets) {
        const [targetRow, targetCol] = targetKey.split("-").map(Number);
        newBoard[targetRow][targetCol] = null;
      }
    }

    const [nextCard, ...nextDeck] = duel.deck;
    const nextPlayer: PlayerId = duel.currentPlayer === 1 ? 2 : 1;
    const placedCount = duel.placedCount + 1;
    const p1Owned = countOwnedCells(newOwners, 1);
    const p2Owned = countOwnedCells(newOwners, 2);
    const winnerText =
      p1Owned === p2Owned ? "DRAW" : p1Owned > p2Owned ? "P1 WINS" : "P2 WINS";

    const nextBase: DuelState = {
      board: newBoard,
      owners: newOwners,
      deck: nextDeck,
      currentCard: nextCard ?? null,
      currentPlayer: nextPlayer,
      placedCount,
      lastResult: hasHand
        ? `P${duel.currentPlayer} CLAIMED ${handTargets.size}`
        : `P${nextPlayer} TURN`,
      lastHandName: hasHand ? results.map((result) => result.name).join(" + ") : "",
      isGameOver: false,
    };

    const isDeckDone = !nextCard;
    const isStuck = !hasEmptyCell(newBoard);
    const nextDuel = isDeckDone
      ? finishDuel(nextBase, `52 CARDS DONE · ${winnerText}`)
      : isStuck
      ? finishDuel(nextBase, `BOARD STUCK · ${winnerText}`)
      : nextBase;

    if (hasHand) {
      window.setTimeout(() => playSound("hit"), 90);
    }

    setPlacedCell(keyOf(row, col));
    setHighlightCells(handTargets);
    setClearingCells(hasHand ? handTargets : new Set());
    setResultPulse(hasHand);

    if (hasHand) {
      const bannerId = Date.now() + 1;
      setResultBanner({
        id: bannerId,
        text: nextBase.lastHandName,
        score: handTargets.size,
        combo: duel.currentPlayer,
        comboNext: undefined,
      });
      window.setTimeout(() => {
        setResultBanner((prev) => (prev?.id === bannerId ? null : prev));
      }, 900);
    }

    setDuel(nextDuel);

    window.setTimeout(() => {
      setPlacedCell(null);
      setHighlightCells(new Set());
      setClearingCells(new Set());
      setResultPulse(false);
    }, 720);
  }

  function selectHandCard(index: number) {
    if (game.isGameOver) return;
    if (index !== 0) return;

    playSound("select");

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

    playSound("place");

    const selected = game.hand[0];

    const newBoard = game.board.map((boardRow) => [...boardRow]);
    newBoard[row][col] = selected;

    const results = evaluateBoard(newBoard, row, col);
    const hasHand = results.length > 0;

    const baseScore = results.reduce((sum, result) => sum + result.score, 0);
    const gainedScore = hasHand
      ? calculateGainedScore(baseScore, game.combo, results.length)
      : 0;
    const scoreDetailText = hasHand
      ? getScoreDetailText(baseScore, game.combo, results.length)
      : "";

    let nextCombo = game.combo;
    let nextComboWindow = game.comboWindow;

    if (hasHand) {
      nextCombo = game.combo + 1;
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

    const lastResultText = hasHand
      ? `${resultText} · ${scoreDetailText}`
      : resultText;

    if (hasHand) {
      window.setTimeout(() => playSound("hit"), 90);
    } else if (resultText === "COMBO BROKEN") {
      window.setTimeout(() => playSound("miss"), 90);
    }

    if (nextGameOver) {
      window.setTimeout(() => playSound("gameover"), 220);
    }

    setPlacedCell(keyOf(row, col));
    setHighlightCells(handTargets);
    setClearingCells(clearTargets);
    setResultPulse(hasHand || resultText === "COMBO BROKEN");
    setScorePulse(gainedScore > 0);
    setComboPulse(hasHand || nextCombo === 1);

    if (hasHand || resultText === "COMBO BROKEN") {
      const bannerId = Date.now() + 1;

      setResultBanner({
        id: bannerId,
        text: resultText,
        score: gainedScore,
        combo: game.combo,
        comboNext: hasHand ? nextCombo : undefined,
        isBreak: resultText === "COMBO BROKEN",
      });

      window.setTimeout(() => {
        setResultBanner((prev) => (prev?.id === bannerId ? null : prev));
      }, 980);
    }

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
        lastResult: nextGameOver ? "GAME OVER" : lastResultText,
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
      <main className="flex h-screen items-center justify-center overflow-hidden bg-[#1b0f2e] text-white">
        <div className="rounded-2xl border-[4px] border-black bg-[#d43d4f] px-8 py-5 shadow-[8px_8px_0_#000]">
          <p className="text-2xl font-black tracking-[0.3em] text-[#ffef7a]">
            NUTS
          </p>
        </div>
      </main>
    );
  }

  if (screen === "home") {
    return (
      <HomeScreen
        highScore={game.highScore}
        onStart={() => {
          setMode("solo");
          startGame();
        }}
        onStartDuel={startDuelGame}
      />
    );
  }

  if (mode === "duel") {
    const p1Owned = countOwnedCells(duel.owners, 1);
    const p2Owned = countOwnedCells(duel.owners, 2);
    const emptyCells = duel.board.flat().filter((cell) => cell === null).length;
    const winnerText = p1Owned === p2Owned ? "DRAW" : p1Owned > p2Owned ? "P1 WINS" : "P2 WINS";

    return (
      <main className="relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#170f2c] text-white md:h-screen md:overflow-hidden">
        <style>{`
        @media (orientation: portrait), (max-aspect-ratio: 1/1) {
          .portrait-outer {
            width: 100vw !important;
            max-width: 100vw !important;
            min-height: auto !important;
            margin: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            padding-bottom: 0.5rem !important;
          }

          .portrait-frame {
            width: 100vw !important;
            max-width: 100vw !important;
            min-height: auto !important;
            flex: 0 0 auto !important;
            border-left-width: 0 !important;
            border-right-width: 0 !important;
            border-radius: 0 !important;
            padding-left: 0.35rem !important;
            padding-right: 0.35rem !important;
            padding-bottom: 0.35rem !important;
            box-shadow: none !important;
          }

          .portrait-stack-layout {
            width: 100% !important;
            max-width: 100% !important;
          }

          .portrait-stack-layout > div:first-child {
            width: 100% !important;
            max-width: 100% !important;
          }

          .portrait-board-wrap {
            width: 100% !important;
            max-width: 100% !important;
          }

          .portrait-stack-layout {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: none !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 0.55rem !important;
          }

          .portrait-board {
            width: calc(100vw - 2.2rem) !important;
            max-width: calc(100vw - 2.2rem) !important;
            aspect-ratio: 1 / 1 !important;
            flex: none !important;
            max-height: none !important;
          }

          .portrait-side {
            order: 2 !important;
            width: calc(100vw - 1rem) !important;
            max-width: calc(100vw - 1rem) !important;
            margin-inline: auto !important;
            min-height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0.5rem !important;
            overflow: visible !important;
          }

          .portrait-queue-panel {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr) !important;
            gap: 0.5rem !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          .solo-queue-panel {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .portrait-queue-panel > :first-child {
            grid-column: 1 / -1 !important;
            margin-bottom: 0 !important;
          }

          .portrait-queue-panel .queue-card-well {
            margin-bottom: 0 !important;
            min-height: 160px !important;
            height: 100% !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 {
            min-height: 160px !important;
          }

          .portrait-frame > header {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

        }

        @media (orientation: landscape) and (max-height: 540px) and (max-width: 1100px) {
          .portrait-outer {
            height: 100svh !important;
            min-height: 100svh !important;
            max-height: 100svh !important;
            padding: 0.2rem 0.25rem !important;
            overflow: hidden !important;
          }

          .portrait-frame {
            height: calc(100svh - 0.4rem) !important;
            min-height: 0 !important;
            overflow: hidden !important;
            padding: 0.3rem !important;
          }

          .portrait-frame > header {
            margin-bottom: 0.35rem !important;
            padding: 0.25rem 0.5rem !important;
            min-height: 0 !important;
            grid-template-columns: minmax(150px, 0.8fr) minmax(170px, 0.7fr) minmax(330px, 1.4fr) !important;
            gap: 0.35rem !important;
          }

          .portrait-frame > header h1 {
            font-size: 2.2rem !important;
          }

          .portrait-frame > header p {
            line-height: 1 !important;
          }

          .portrait-frame > header .min-h-\[58px\] {
            min-height: 42px !important;
          }

          .portrait-stack-layout {
            height: calc(100svh - 68px) !important;
            min-height: 0 !important;
            grid-template-columns: minmax(0, 1fr) 230px !important;
            gap: 0.45rem !important;
            align-items: stretch !important;
          }

          .portrait-stack-layout > div:first-child,
          .portrait-board-wrap,
          .portrait-side {
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          .portrait-board-wrap {
            padding: 0.35rem !important;
          }

          .portrait-board-wrap > .mb-2 {
            height: 22px !important;
            margin-bottom: 0.25rem !important;
          }

          .portrait-board-wrap > .mb-2 p {
            padding: 0.15rem 0.55rem !important;
            font-size: 0.62rem !important;
          }

          .portrait-board {
            height: calc(100% - 26px) !important;
            max-height: calc(100% - 26px) !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            flex: 1 1 auto !important;
            gap: 0.25rem !important;
            padding: 0.35rem !important;
          }

          .portrait-side {
            gap: 0 !important;
          }

          .portrait-queue-panel {
            height: 100% !important;
            min-height: 0 !important;
            display: grid !important;
            grid-template-rows: auto minmax(0, 1fr) minmax(0, 0.82fr) !important;
            gap: 0.3rem !important;
            padding: 0.35rem !important;
            overflow: hidden !important;
          }

          .portrait-queue-panel > :first-child {
            margin-bottom: 0 !important;
            padding: 0.2rem 0.5rem !important;
          }

          .portrait-queue-panel > :first-child p {
            font-size: 0.95rem !important;
          }

          .portrait-queue-panel .queue-card-well {
            min-height: 0 !important;
            height: auto !important;
            margin-bottom: 0 !important;
            padding: 0.35rem !important;
            overflow: hidden !important;
          }

          .portrait-queue-panel .queue-card-well > div:first-child {
            width: 56px !important;
          }

          .portrait-queue-panel .queue-card-well p {
            margin-top: 0.15rem !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 {
            min-height: 0 !important;
            height: auto !important;
            overflow: hidden !important;
            padding: 0.35rem !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 > div:first-child {
            display: none !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 > div:nth-child(2) {
            padding: 0.35rem !important;
          }

          .duel-status-kicker,
          .duel-status-message {
            display: none !important;
          }

          .duel-status-title {
            margin-top: 0 !important;
            font-size: 1.15rem !important;
          }

          .duel-status-result {
            margin-top: 0.15rem !important;
            font-size: 0.85rem !important;
          }

          .portrait-queue-panel button {
            padding: 0.35rem 0.5rem !important;
            font-size: 0.9rem !important;
  

          /* Stronger compact layout for mobile landscape duel panel. */
          .portrait-queue-panel {
            grid-template-rows: 24px minmax(0, 1fr) 76px !important;
            gap: 0.18rem !important;
            padding: 0.25rem !important;
          }

          .portrait-queue-panel .queue-card-well {
            padding: 0.2rem !important;
            justify-content: center !important;
          }

          .portrait-queue-panel .queue-card-well > div:first-child {
            width: 44px !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 {
            min-height: 76px !important;
            height: 76px !important;
            padding: 0.18rem !important;
            display: grid !important;
            grid-template-rows: minmax(0, 1fr) 24px !important;
            gap: 0.12rem !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 > div:nth-child(2) {
            padding: 0.1rem !important;
            border-width: 2px !important;
            border-radius: 0.45rem !important;
          }

          .duel-status-title {
            font-size: 1rem !important;
            line-height: 1 !important;
          }

          .duel-status-result {
            display: none !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 > div:last-child {
            margin-top: 0 !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }

          .portrait-queue-panel button {
            display: block !important;
            min-height: 24px !important;
            padding: 0.15rem 0.4rem !important;
            font-size: 0.72rem !important;
            line-height: 1 !important;
            border-width: 3px !important;
            border-radius: 0.5rem !important;
          }
        }


          /* Stronger compact layout for mobile landscape duel panel. */
          .portrait-queue-panel {
            grid-template-rows: 24px minmax(0, 1fr) 76px !important;
            gap: 0.18rem !important;
            padding: 0.25rem !important;
          }

          .portrait-queue-panel .queue-card-well {
            padding: 0.2rem !important;
            justify-content: center !important;
          }

          .portrait-queue-panel .queue-card-well > div:first-child {
            width: 44px !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 {
            min-height: 76px !important;
            height: 76px !important;
            padding: 0.18rem !important;
            display: grid !important;
            grid-template-rows: minmax(0, 1fr) 24px !important;
            gap: 0.12rem !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 > div:nth-child(2) {
            padding: 0.1rem !important;
            border-width: 2px !important;
            border-radius: 0.45rem !important;
          }

          .duel-status-title {
            font-size: 1rem !important;
            line-height: 1 !important;
          }

          .duel-status-result {
            display: none !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 > div:last-child {
            margin-top: 0 !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }

          .portrait-queue-panel button {
            display: block !important;
            min-height: 24px !important;
            padding: 0.15rem 0.4rem !important;
            font-size: 0.72rem !important;
            line-height: 1 !important;
            border-width: 3px !important;
            border-radius: 0.5rem !important;
          }
        }

      `}</style>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(240,179,66,0.12),transparent_28%),radial-gradient(circle_at_20%_70%,rgba(10,74,57,0.45),transparent_36%),radial-gradient(circle_at_80%_62%,rgba(55,10,52,0.55),transparent_38%)]" />

        <div className="portrait-outer relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1920px] flex-col overflow-visible px-1.5 py-1.5 md:h-screen md:overflow-hidden">
          <section className="portrait-frame table-frame pixel-hard relative flex min-h-0 flex-1 flex-col overflow-visible border-[5px] border-[#061811] p-1.5 shadow-[7px_7px_0_#03100b] backdrop-blur-sm sm:border-[6px] sm:p-2 md:overflow-hidden md:shadow-[10px_10px_0_#03100b]">
            <header className="pixel-hard pixel-inner relative z-10 mb-2 grid shrink-0 gap-2 overflow-hidden border-[4px] border-[#07160f] bg-[#0a3329] px-2.5 py-2 shadow-[5px_5px_0_#03100b] sm:px-4 md:grid-cols-[minmax(250px,0.95fr)_minmax(260px,0.8fr)_minmax(360px,1.25fr)] md:items-center md:shadow-[6px_6px_0_#03100b]">
              <div className="pointer-events-none absolute left-3 right-3 top-2 h-[3px] bg-[#f0b342] shadow-[0_2px_0_#4d2a07]" />
              <div className="pointer-events-none absolute bottom-2 left-3 right-3 h-[3px] bg-[#b97828] shadow-[0_2px_0_#03100b]" />
              <div className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-br-xl border-b-[4px] border-r-[4px] border-[#f0b342]" />
              <div className="pointer-events-none absolute right-1 top-1 h-5 w-5 rounded-bl-xl border-b-[4px] border-l-[4px] border-[#f0b342]" />
              <div className="pointer-events-none absolute bottom-1 left-1 h-5 w-5 rounded-tr-xl border-r-[4px] border-t-[4px] border-[#b97828]" />
              <div className="pointer-events-none absolute bottom-1 right-1 h-5 w-5 rounded-tl-xl border-l-[4px] border-t-[4px] border-[#b97828]" />

              <div className="relative z-10 flex min-h-[58px] items-center px-2 sm:min-h-[68px]">
                <div>
                  <h1
                    className="text-4xl font-black leading-[0.82] text-[#f1a22d] sm:text-5xl lg:text-6xl"
                    style={{
                      textShadow:
                        "4px 0 #5a2b05, 0 4px #5a2b05, 5px 5px 0 #1d0c02, -2px -2px 0 #ffd16b",
                    }}
                  >
                    NUTS
                  </h1>
                  <p
                    className="mt-2 text-xs font-black tracking-[0.34em] text-[#7fd0a4]"
                    style={{ textShadow: "2px 2px 0 #03100b" }}
                  >
                    TERRITORY DUEL
                  </p>
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-1.5">
                <div className={[
                  "pixel-hard-sm relative flex min-h-[58px] flex-col justify-center border-[3px] border-[#061811] px-3 py-2 shadow-[4px_4px_0_#03100b,0_0_0_2px_rgba(255,255,255,0.08)_inset] transition",
                  duel.currentPlayer === 1 && !duel.isGameOver ? "bg-[#155e75]" : "bg-[#071a15]",
                ].join(" ")}> 
                  <p className="text-[10px] font-black tracking-[0.2em] text-[#6ee7ff]">PLAYER 1</p>
                  <p className="text-3xl font-black leading-none text-white drop-shadow-[3px_3px_0_#03100b]">{p1Owned}</p>
                </div>
                <div className={[
                  "pixel-hard-sm relative flex min-h-[58px] flex-col justify-center border-[3px] border-[#061811] px-3 py-2 text-right shadow-[4px_4px_0_#03100b,0_0_0_2px_rgba(255,255,255,0.08)_inset] transition",
                  duel.currentPlayer === 2 && !duel.isGameOver ? "bg-[#9f1239]" : "bg-[#071a15]",
                ].join(" ")}> 
                  <p className="text-[10px] font-black tracking-[0.2em] text-[#fb7185]">PLAYER 2</p>
                  <p className="text-3xl font-black leading-none text-white drop-shadow-[3px_3px_0_#03100b]">{p2Owned}</p>
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                <StatBox label="TURN" value={duel.isGameOver ? winnerText : `P${duel.currentPlayer}`} accent pulse={!duel.isGameOver} />
                <StatBox label="CARD" value={`${duel.placedCount}/52`} />
                <StatBox label="DECK" value={duel.deck.length} />
                <StatBox label="EMPTY" value={emptyCells} />
              </div>
            </header>

            <div className="portrait-stack-layout relative z-10 grid min-h-0 flex-1 justify-center gap-2 md:grid-cols-[minmax(420px,1fr)_250px] lg:grid-cols-[minmax(680px,900px)_340px] xl:gap-3 2xl:grid-cols-[minmax(740px,960px)_380px]">
              <div className="flex min-h-0 flex-col overflow-visible md:overflow-hidden">
                <section className="portrait-board-wrap pixel-hard relative flex min-h-0 flex-1 flex-col overflow-hidden border-[5px] border-[#061811] bg-[#0b2f27] p-1.5 shadow-[5px_5px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.35)_inset] sm:border-[6px] sm:p-2 md:shadow-[7px_7px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.35)_inset]">
                  <div className="mb-2 flex h-7 items-center justify-between">
                    <p className="rounded-md border-[3px] border-[#061811] bg-[#123f32] px-3 py-1 text-xs font-black tracking-[0.25em] text-[#f5d06f] shadow-[3px_3px_0_#04120d]">
                      SHARED BOARD
                    </p>
                    <div className="flex gap-1.5 text-[10px] font-black">
                      <span className="rounded-md border-[2px] border-[#061811] bg-[#155e75] px-2 py-1 text-[#dffbff] shadow-[2px_2px_0_#04120d]">P1</span>
                      <span className="rounded-md border-[2px] border-[#061811] bg-[#9f1239] px-2 py-1 text-[#fff1f2] shadow-[2px_2px_0_#04120d]">P2</span>
                    </div>
                  </div>

                  <div className="portrait-board pixel-hard relative mx-auto grid aspect-square min-h-0 w-full max-w-[min(94vw,560px)] flex-none grid-cols-5 grid-rows-5 gap-1 border-[5px] border-[#061811] bg-[#09231d] p-1.5 shadow-[inset_0_0_0_2px_#1a4e3e,inset_0_0_38px_rgba(0,0,0,0.58),5px_5px_0_#04120d] sm:gap-1.5 sm:p-2 md:max-h-full md:max-w-none md:flex-1 lg:aspect-auto lg:max-h-none xl:gap-2 xl:p-3">
                    {resultBanner && (
                      <div className="pointer-events-none absolute right-2 top-2 z-40 max-w-[260px] sm:right-3 sm:top-3">
                        <div
                          className="rounded-xl border-[4px] border-[#061811] bg-[#f5d06f]/92 px-3 py-2 text-right text-[#061811] shadow-[4px_4px_0_#03100b] backdrop-blur-[1px]"
                          style={{ animation: "targetBanner 160ms ease-out" }}
                        >
                          <p className="text-[9px] font-black tracking-[0.22em] opacity-75">CLAIM</p>
                          <p className="mt-0.5 max-w-[220px] truncate text-lg font-black leading-tight">{resultBanner.text}</p>
                        </div>
                      </div>
                    )}

                    {duel.board.map((boardRow, rowIndex) =>
                      boardRow.map((cell, colIndex) => {
                        const cellKey = keyOf(rowIndex, colIndex);
                        const owner = duel.owners[rowIndex][colIndex];
                        const isPlaced = placedCell === cellKey;
                        const isHit = highlightCells.has(cellKey);
                        const isClearing = clearingCells.has(cellKey);
                        const canPlace = !cell && !duel.isGameOver && Boolean(duel.currentCard);
                        const ownerGlow = owner === 1
                          ? "after:absolute after:inset-1 after:border-[3px] after:border-[#6ee7ff]/75 after:content-['']"
                          : owner === 2
                          ? "after:absolute after:inset-1 after:border-[3px] after:border-[#fb7185]/75 after:content-['']"
                          : "";
                        const ownerBadgeClass = owner === 1 ? "bg-[#155e75] text-[#dffbff]" : "bg-[#9f1239] text-[#fff1f2]";

                        return (
                          <button
                            key={cellKey}
                            onClick={() => placeDuelCard(rowIndex, colIndex)}
                            disabled={!canPlace}
                            className={[
                              "pixel-hard-sm relative h-full min-h-0 overflow-hidden border-[3px] transition duration-200",
                              cell
                                ? "rotate-[-1deg] border-[#061811] bg-[#fff4cf] p-1 shadow-[4px_4px_0_#04120d]"
                                : "slot-surface border-[#061811] shadow-[3px_3px_0_#04120d]",
                              canPlace ? "cursor-pointer hover:-translate-y-1 hover:brightness-125" : "",
                              ownerGlow,
                              isPlaced ? "scale-[1.03]" : "",
                              isHit ? "z-20 bg-[#fff4cf] shadow-[0_0_0_2px_#f5d06f,0_0_10px_rgba(255,239,122,0.38),4px_4px_0_#000]" : "",
                              isClearing ? "opacity-80" : "",
                            ].join(" ")}
                            style={{
                              animation: isClearing
                                ? "clearShake 520ms ease-in-out forwards"
                                : isHit
                                ? "handGlow 760ms ease-in-out 2"
                                : isPlaced
                                ? "cardPop 360ms ease-out"
                                : undefined,
                            }}
                          >
                            {owner && (
                              <span className={[
                                "pointer-events-none absolute left-1 top-1 z-30 rounded-md border-[2px] border-[#061811] px-1.5 py-0.5 text-[9px] font-black shadow-[2px_2px_0_#03100b]",
                                ownerBadgeClass,
                              ].join(" ")}>
                                P{owner}
                              </span>
                            )}

                            {cell ? (
                              <>
                                <div className="mx-auto h-full max-h-full aspect-[5/7] max-w-[82%]">
                                  <CardFace card={cell} size="normal" />
                                </div>

                                {isHit && (
                                  <div
                                    className="pointer-events-none absolute right-1 top-1 z-40 rounded-md border-[2px] border-black bg-[#6ee7ff]/90 px-1.5 py-0.5 text-[9px] font-black text-black shadow-[2px_2px_0_#000]"
                                    style={{ animation: "hitBadge 220ms ease-out forwards" }}
                                  >
                                    CLAIM
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className={["relative z-10 text-3xl font-black", canPlace ? "text-[#f5d06f]" : "text-[#7fbfa0]/22"].join(" ")}>
                                ♠
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <aside className="portrait-side flex min-h-0 flex-col gap-2 overflow-visible md:overflow-hidden">
                <div className="portrait-queue-panel queue-panel pixel-hard flex min-h-0 flex-col overflow-hidden border-[5px] border-[#061811] p-1.5 shadow-[5px_5px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.34)_inset] sm:border-[6px] sm:p-2 md:flex-1 md:shadow-[7px_7px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.34)_inset]">
                  <div className="pixel-hard-sm mb-2 shrink-0 border-[3px] border-[#061811] bg-[#123f32] px-3 py-1.5 text-center shadow-[3px_3px_0_#04120d]">
                    <p className="text-lg font-black tracking-[0.08em] text-[#d5d48a] drop-shadow-[2px_2px_0_#03100b]">
                      NOW
                    </p>
                  </div>

                  <div className="queue-card-well mb-2 flex w-full shrink-0 flex-col items-center rounded-xl border-[4px] border-[#061811] p-2 text-center shadow-[4px_4px_0_#04120d,inset_0_0_0_2px_#255d48]">
                    <div
                      className="w-20 shrink-0 rotate-[-2deg] pixel-hard border-[5px] border-[#061811] bg-[#fff8e4] p-1 shadow-[5px_5px_0_#04120d] sm:w-24 lg:w-28 xl:w-32"
                      style={{ aspectRatio: "5 / 7" }}
                    >
                      {duel.currentCard ? (
                        <CardFace card={duel.currentCard} size="small" />
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-lg bg-[#fff8e4] text-center text-xs font-black text-black/50">
                          EMPTY
                        </div>
                      )}
                    </div>

                    <p className="mt-2 text-[10px] font-black tracking-[0.18em] text-[#7fd0a4]">
                      PLACE THIS
                    </p>
                    <p
                      className="mt-1 text-2xl font-black leading-none text-white xl:text-3xl"
                      style={{ textShadow: "3px 3px 0 #03100b" }}
                    >
                      {duel.currentCard ? `${duel.currentCard.rank}${suitSymbols[duel.currentCard.suit]}` : "-"}
                    </p>

                    <div className="mt-2 flex justify-center gap-2">
                      <span className={[
                        "h-3 w-3 rounded-full border-[2px] border-[#061811] shadow-[2px_2px_0_#04120d]",
                        duel.currentPlayer === 1 && !duel.isGameOver ? "bg-[#6ee7ff]" : "bg-[#234338]",
                      ].join(" ")} />
                      <span className={[
                        "h-3 w-3 rounded-full border-[2px] border-[#061811] shadow-[2px_2px_0_#04120d]",
                        duel.currentPlayer === 2 && !duel.isGameOver ? "bg-[#fb7185]" : "bg-[#234338]",
                      ].join(" ")} />
                    </div>
                  </div>

                  <div className="pixel-hard flex min-h-0 flex-1 flex-col border-[4px] border-[#061811] bg-[#081b18] p-2 shadow-[4px_4px_0_#04120d,inset_0_0_0_2px_#255d48]">
                    <div className="mb-2 shrink-0 rounded-lg border-[3px] border-[#061811] bg-[#123f32] px-3 py-1.5 text-center shadow-[3px_3px_0_#04120d]">
                      <p className="text-lg font-black tracking-[0.08em] text-[#d5d48a] drop-shadow-[2px_2px_0_#03100b]">
                        STATUS
                      </p>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col justify-center rounded-xl border-[3px] border-[#061811] bg-[#07160f] p-3 text-center shadow-[inset_0_0_24px_rgba(0,0,0,0.35)]">
                      <p className="duel-status-title text-2xl font-black text-white drop-shadow-[3px_3px_0_#03100b]">
                        {duel.isGameOver ? winnerText : `PLAYER ${duel.currentPlayer}`}
                      </p>
                      {duel.isGameOver && (
                        <p className="duel-status-result mt-3 text-base font-black text-[#fff4cf]">
                          P1 {p1Owned} - P2 {p2Owned}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 grid gap-2">
                      {duel.isGameOver && (
                        <button onClick={restartDuelGame} className="rounded-xl border-[4px] border-[#061811] bg-[#f0a536] px-4 py-3 text-xl font-black text-[#2a1603] shadow-[5px_5px_0_#04120d] transition hover:-translate-y-1">
                          REMATCH
                        </button>
                      )}
                      <button onClick={() => setScreen("home")} className="rounded-xl border-[4px] border-[#061811] bg-[#124733] px-4 py-3 text-lg font-black text-[#fff4cf] shadow-[5px_5px_0_#04120d] transition hover:-translate-y-1">
                        HOME
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const gameOverRank =
    game.score >= 50000
      ? "LIMITLESS"
      : game.score >= 25000
      ? "LEGEND"
      : game.score >= 12000
      ? "SHARK"
      : game.score >= 5000
      ? "HOT STREAK"
      : game.score >= 1500
      ? "GOOD RUN"
      : "TRY AGAIN";

  const gameOverMessage =
    game.score >= game.highScore && game.score > 0
      ? "NEW BEST SCORE"
      : game.score >= 12000
      ? "THE TABLE REMEMBERS"
      : "ONE MORE DEAL";

  const currentComboTier = getComboTier(game.combo);
  const resultComboTier = resultBanner ? getComboTier(resultBanner.combo) : null;
  const isComboAuraVisible = screen === "game" && !game.isGameOver && game.combo >= 4;

  return (
    <main className="relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#1b0f2e] text-white md:h-screen md:overflow-hidden">
      <style>{`
        @keyframes floatScore {
          0% { opacity: 0; transform: translateY(20px) scale(0.8) rotate(-3deg); }
          15% { opacity: 1; transform: translateY(0) scale(1.08) rotate(2deg); }
          100% { opacity: 0; transform: translateY(-80px) scale(1.2) rotate(-2deg); }
        }

        @keyframes comboAuraPulse {
          0%, 100% { opacity: 0.12; transform: scale(1); filter: blur(0px); }
          50% { opacity: 0.24; transform: scale(1.02); filter: blur(0px); }
        }

        @keyframes comboBadgeSlam {
          0% { opacity: 0; transform: translate(-50%, -18px) scale(0.82) rotate(-4deg); }
          36% { opacity: 1; transform: translate(-50%, 4px) scale(1.12) rotate(2deg); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1) rotate(-1deg); }
        }

        @keyframes comboElectric {
          0%, 100% { transform: translateY(0) rotate(-1deg); text-shadow: 4px 4px 0 #03100b, 0 0 12px rgba(245,208,111,0.55); }
          50% { transform: translateY(-2px) rotate(1deg); text-shadow: 5px 5px 0 #03100b, 0 0 24px rgba(245,208,111,0.95), 0 0 38px rgba(110,231,255,0.55); }
        }

        @keyframes comboStripe {
          0% { background-position: 0 0; }
          100% { background-position: 64px 0; }
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

        @media (orientation: portrait), (max-aspect-ratio: 1/1) {
          .portrait-outer {
            width: 100vw !important;
            max-width: 100vw !important;
            min-height: auto !important;
            margin: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            padding-bottom: 0.5rem !important;
          }

          .portrait-frame {
            width: 100vw !important;
            max-width: 100vw !important;
            min-height: auto !important;
            flex: 0 0 auto !important;
            border-left-width: 0 !important;
            border-right-width: 0 !important;
            border-radius: 0 !important;
            padding-left: 0.35rem !important;
            padding-right: 0.35rem !important;
            padding-bottom: 0.35rem !important;
            box-shadow: none !important;
          }

          .portrait-stack-layout {
            width: 100% !important;
            max-width: 100% !important;
          }

          .portrait-stack-layout > div:first-child {
            width: 100% !important;
            max-width: 100% !important;
          }

          .portrait-board-wrap {
            width: 100% !important;
            max-width: 100% !important;
          }

          .portrait-stack-layout {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: none !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 0.55rem !important;
          }

          .portrait-board {
            width: calc(100vw - 2.2rem) !important;
            max-width: calc(100vw - 2.2rem) !important;
            aspect-ratio: 1 / 1 !important;
            flex: none !important;
            max-height: none !important;
          }

          .portrait-side {
            order: 2 !important;
            width: calc(100vw - 1rem) !important;
            max-width: calc(100vw - 1rem) !important;
            margin-inline: auto !important;
            min-height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0.5rem !important;
            overflow: visible !important;
          }

          .portrait-queue-panel {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr) !important;
            gap: 0.5rem !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          .solo-queue-panel {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .portrait-queue-panel > :first-child {
            grid-column: 1 / -1 !important;
            margin-bottom: 0 !important;
          }

          .portrait-queue-panel .queue-card-well {
            margin-bottom: 0 !important;
            min-height: 160px !important;
            height: 100% !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.flex-1 {
            min-height: 160px !important;
          }

          .portrait-frame > header {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

        }

        @keyframes boardKick {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); }
          18% { transform: translate3d(-1px, 1px, 0) rotate(-0.06deg); }
          36% { transform: translate3d(1px, -1px, 0) rotate(0.06deg); }
          54% { transform: translate3d(-1px, 0, 0) rotate(-0.03deg); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        }

        @keyframes resultBurst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.68) rotate(-5deg); filter: brightness(1); }
          22% { opacity: 1; transform: translate(-50%, -50%) scale(1.14) rotate(3deg); filter: brightness(1.35); }
          62% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-1deg); filter: brightness(1.08); }
          100% { opacity: 0; transform: translate(-50%, -62%) scale(0.92) rotate(0deg); filter: brightness(0.9); }
        }

        @keyframes resultRing {
          0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.35); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.75); }
        }

        @keyframes sparklePop {
          0% { opacity: 0; transform: scale(0.3) rotate(0deg); }
          30% { opacity: 1; transform: scale(1.18) rotate(18deg); }
          100% { opacity: 0; transform: scale(0.6) rotate(55deg); }
        }

        @keyframes gameOverDrop {
          0% { opacity: 0; transform: translateY(28px) scale(0.92) rotate(-2deg); filter: brightness(0.75); }
          58% { opacity: 1; transform: translateY(-6px) scale(1.03) rotate(1deg); filter: brightness(1.18); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(-1deg); filter: brightness(1); }
        }

        .gameover-card::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: -45%;
          background: linear-gradient(120deg, transparent 38%, rgba(255,244,207,0.18) 47%, transparent 56%);
          animation: gameOverShine 1800ms ease-in-out infinite;
        }

        @keyframes gameOverShine {
          0%, 28% { transform: translateX(-38%) rotate(0deg); opacity: 0; }
          42% { opacity: 1; }
          70%, 100% { transform: translateX(38%) rotate(0deg); opacity: 0; }
        }

        .nuts-pixel {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          image-rendering: pixelated;
          text-rendering: geometricPrecision;
        }

        .felt-bg {
          background:
            radial-gradient(circle at 16% 14%, rgba(255, 180, 70, 0.12), transparent 27%),
            radial-gradient(circle at 82% 24%, rgba(80, 255, 180, 0.08), transparent 30%),
            radial-gradient(circle at 50% 90%, rgba(0, 0, 0, 0.38), transparent 55%),
            linear-gradient(135deg, rgba(255,255,255,0.025) 0 12%, transparent 12% 24%, rgba(0,0,0,0.045) 24% 36%, transparent 36% 48%),
            #0f4a39;
          background-size: auto, auto, auto, 72px 72px, auto;
        }

        .crt-lines::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.035) 0px,
            rgba(255,255,255,0.035) 1px,
            rgba(0,0,0,0.03) 2px,
            rgba(0,0,0,0.03) 4px
          );
          mix-blend-mode: overlay;
          opacity: 0.36;
        }

        .slot-surface {
          background:
            radial-gradient(circle at 30% 24%, rgba(127, 208, 164, 0.08), transparent 26%),
            linear-gradient(145deg, rgba(255,255,255,0.055), rgba(0,0,0,0.22)),
            #102b24;
        }

        .slot-surface::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 7px;
          border: 2px solid rgba(127, 208, 164, 0.22);
          border-radius: 0.65rem;
          box-shadow: inset 2px 2px 0 rgba(255,255,255,0.05), inset -3px -3px 0 rgba(0,0,0,0.22);
        }

        .slot-surface::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: 0.75rem;
          box-shadow:
            inset 0 0 0 3px #061811,
            inset 0 0 0 6px rgba(41, 91, 77, 0.58),
            inset 0 -12px 20px rgba(0,0,0,0.22);
        }

        .queue-panel {
          background:
            radial-gradient(circle at 28% 18%, rgba(127, 208, 164, 0.09), transparent 28%),
            linear-gradient(145deg, rgba(255,255,255,0.04), rgba(0,0,0,0.26)),
            #0b2f27;
        }

        .queue-card-well {
          background:
            radial-gradient(circle at 30% 18%, rgba(245, 208, 111, 0.08), transparent 24%),
            linear-gradient(145deg, rgba(255,255,255,0.04), rgba(0,0,0,0.28)),
            #102a25;
        }

        .nuts-card-paper {
          background:
            radial-gradient(circle at 22% 18%, rgba(255,255,255,0.9), transparent 25%),
            linear-gradient(145deg, #fff8e4 0%, #f4dfad 100%);
        }

        .nuts-card-paper::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(
              to bottom,
              rgba(0,0,0,0.035) 0px,
              rgba(0,0,0,0.035) 1px,
              transparent 2px,
              transparent 4px
            );
          mix-blend-mode: multiply;
          opacity: 0.55;
        }

        .nuts-card-paper::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 4px;
          border: 2px solid rgba(44, 32, 18, 0.16);
          border-radius: 0.55rem;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45);
        }

        .table-frame {
          background:
            radial-gradient(circle at 18% 15%, rgba(245, 181, 68, 0.08), transparent 24%),
            radial-gradient(circle at 78% 30%, rgba(115, 255, 190, 0.08), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.32)),
            #0b3f31;
        }

        .table-frame::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 7px;
          border: 3px solid rgba(245, 181, 68, 0.74);
          border-radius: 1rem;
          box-shadow:
            0 2px 0 #3b2107,
            inset 0 0 0 2px rgba(6, 24, 17, 0.72);
        }

        .table-frame::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: 0.45rem;
          box-shadow:
            inset 0 0 0 4px rgba(6,24,17,0.72),
            inset 0 0 44px rgba(0,0,0,0.48),
            inset 0 0 0 2px rgba(255,255,255,0.03);
        }

        .pixel-dither {
          background-image:
            radial-gradient(circle, rgba(245, 208, 111, 0.16) 1px, transparent 1px),
            radial-gradient(circle, rgba(0, 0, 0, 0.18) 1px, transparent 1px);
          background-position: 0 0, 4px 4px;
          background-size: 8px 8px;
        }

        .pixel-hard {
          border-radius: 0.45rem !important;
          image-rendering: pixelated;
        }

        .pixel-hard-sm {
          border-radius: 0.28rem !important;
          image-rendering: pixelated;
        }

        .pixel-shadow {
          box-shadow:
            6px 0 0 #03100b,
            0 6px 0 #03100b,
            6px 6px 0 #03100b;
        }

        .pixel-inner {
          box-shadow:
            inset 0 0 0 3px #061811,
            inset 0 0 0 6px rgba(245, 181, 68, 0.18),
            inset 8px 8px 0 rgba(255,255,255,0.025),
            inset -8px -8px 0 rgba(0,0,0,0.22);
        }

        .felt-bg {
          background:
            radial-gradient(circle at 12% 8%, rgba(245, 181, 68, 0.10), transparent 26%),
            radial-gradient(circle at 85% 24%, rgba(72, 210, 160, 0.10), transparent 30%),
            radial-gradient(circle at 50% 98%, rgba(0, 0, 0, 0.48), transparent 55%),
            linear-gradient(135deg, rgba(255,255,255,0.025) 0 12%, transparent 12% 24%, rgba(0,0,0,0.04) 24% 36%, transparent 36% 48%),
            #0b3a2d;
          background-size: auto, auto, auto, 82px 82px, auto;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(245,181,68,0.14),transparent_28%),radial-gradient(circle_at_88%_22%,rgba(90,255,190,0.08),transparent_32%),radial-gradient(circle_at_50%_95%,rgba(0,0,0,0.36),transparent_54%)]" />

      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:18px_18px]" />

      {isComboAuraVisible && (
        <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
          <div
            className="absolute inset-[-18%] opacity-10"
            style={{
              background: `radial-gradient(circle at 50% 35%, ${currentComboTier.glow}, transparent 34%), radial-gradient(circle at 22% 80%, rgba(110,231,255,0.32), transparent 28%), radial-gradient(circle at 82% 74%, rgba(240,165,54,0.36), transparent 30%)`,
              animation: `comboAuraPulse ${Math.max(0.9, 2.6 - currentComboTier.intensity * 0.28)}s ease-in-out infinite`,
              boxShadow: `inset 0 0 ${36 + game.combo * 2}px ${currentComboTier.glow}`,
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-10 opacity-10"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0px, transparent 18px, rgba(255,239,122,0.55) 20px, transparent 24px)",
              animation: "comboStripe 720ms linear infinite",
            }}
          />
        </div>
      )}

      {isComboAuraVisible && (
        <div
          className="pointer-events-none fixed left-1/2 top-[118px] z-[65] rounded-2xl border-[5px] border-[#061811] bg-[#0b2f27]/95 px-5 py-2 text-center shadow-[7px_7px_0_#020806]"
          style={{
            animation: "comboBadgeSlam 360ms cubic-bezier(.2,1.3,.25,1) both",
            boxShadow: `7px 7px 0 #020806, 0 0 ${12 + game.combo * 1.8}px ${currentComboTier.glow}`,
          }}
        >
          <p className={`text-[10px] font-black tracking-[0.35em] ${currentComboTier.text}`}>
            {currentComboTier.label}
          </p>
          <p
            className="mt-0.5 text-4xl font-black leading-none text-[#ffef7a]"
            style={{ animation: "comboElectric 760ms ease-in-out infinite" }}
          >
            x{game.combo}
          </p>
        </div>
      )}

      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07120f] px-6 text-center text-white md:hidden landscape:hidden">
        <div className="rounded-2xl border-[5px] border-black bg-[#0b3a2b] p-6 shadow-[8px_8px_0_#000]">
          <p className="mb-2 text-xs font-black tracking-[0.35em] text-[#f0a536]">
            NUTS
          </p>
          <p className="text-2xl font-black leading-tight">
            Rotate your phone
          </p>
          <p className="mt-3 text-xs font-bold leading-5 text-[#d8eadc]">
            Landscape mode gives the board enough space.
          </p>
        </div>
      </div>

      {floatingScores.map((score) => (
        <div
          key={score.id}
          className="pointer-events-none fixed left-1/2 top-[12%] z-[35] -translate-x-1/2 rounded-xl border-[4px] border-[#061811] bg-[#f5d06f]/95 px-4 py-2 text-3xl font-black text-[#b83224] shadow-[5px_5px_0_#03100b]"
          style={{ animation: "floatScore 900ms ease-out forwards" }}
        >
          +{score.value}
        </div>
      ))}

      {game.isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-4 sm:px-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(245,208,111,0.22),transparent_26%),radial-gradient(circle_at_28%_72%,rgba(32,163,111,0.18),transparent_28%),radial-gradient(circle_at_74%_22%,rgba(210,58,47,0.18),transparent_26%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.11] [background-image:linear-gradient(#f5d06f_1px,transparent_1px),linear-gradient(90deg,#f5d06f_1px,transparent_1px)] [background-size:18px_18px]" />

          <div
            className="gameover-card pixel-hard relative w-full max-w-2xl overflow-hidden border-[5px] border-[#061811] bg-[#0b2f27] p-3 text-center shadow-[9px_9px_0_#020806,0_0_0_3px_#f0a536_inset] sm:border-[6px] sm:p-6 sm:shadow-[14px_14px_0_#020806,0_0_0_3px_#f0a536_inset]"
            style={{ animation: "gameOverDrop 520ms cubic-bezier(.2,1.3,.25,1) both" }}
          >
            <div className="pointer-events-none absolute inset-[10px] border-[2px] border-[#f5d06f]/65" />
            <div className="pointer-events-none absolute -left-16 top-10 h-32 w-32 rotate-12 rounded-[2rem] border-[5px] border-[#061811] bg-[#fff4cf]/10 shadow-[7px_7px_0_#020806]" />
            <div className="pointer-events-none absolute -right-14 bottom-16 h-28 w-24 rotate-[-14deg] rounded-[1.4rem] border-[5px] border-[#061811] bg-[#fff4cf]/10 shadow-[7px_7px_0_#020806]" />

            <div className="relative z-10 mx-auto mb-4 w-fit rotate-[-2deg] rounded-2xl border-[5px] border-[#061811] bg-[#d23a2f] px-5 py-2 shadow-[6px_6px_0_#020806]">
              <p className="text-sm font-black tracking-[0.45em] text-[#ffef7a] drop-shadow-[2px_2px_0_#061811] sm:text-base">
                GAME OVER
              </p>
            </div>

            <div className="relative z-10 grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-stretch">
              <section className="rounded-[1.5rem] border-[5px] border-[#061811] bg-[#123f32] p-4 shadow-[7px_7px_0_#020806,0_0_0_2px_rgba(255,255,255,0.05)_inset]">
                <p className="text-[10px] font-black tracking-[0.34em] text-[#7fd0a4]">
                  FINAL SCORE
                </p>

                <h2
                  className="my-2 text-5xl font-black leading-none text-[#ffef7a] sm:text-7xl"
                  style={{ textShadow: "5px 5px 0 #061811, -2px -2px 0 #fff4cf" }}
                >
                  {game.score}
                </h2>

                <div className="mx-auto mb-3 w-fit rounded-xl border-[4px] border-[#061811] bg-[#f0a536] px-4 py-1.5 shadow-[4px_4px_0_#020806]">
                  <p className="text-sm font-black tracking-[0.16em] text-[#2a1603]">
                    {gameOverRank}
                  </p>
                </div>

                <p className="text-xs font-black tracking-[0.18em] text-[#fff4cf]">
                  {gameOverMessage}
                </p>
              </section>

              <section className="grid gap-3">
                <div className="rounded-[1.25rem] border-[4px] border-[#061811] bg-[#101b3b] p-3 shadow-[5px_5px_0_#020806]">
                  <p className="text-[10px] font-black tracking-[0.24em] text-[#6ee7ff]">
                    BEST SCORE
                  </p>
                  <p className="mt-1 text-4xl font-black leading-none text-[#ffef7a] drop-shadow-[3px_3px_0_#000]">
                    {game.highScore}
                  </p>
                </div>

                <div className="rounded-[1.25rem] border-[4px] border-[#061811] bg-[#08241b] p-3 shadow-[5px_5px_0_#020806]">
                  <p className="text-[9px] font-black tracking-[0.22em] text-[#7fd0a4]">
                    COMBO
                  </p>
                  <p className="mt-1 text-3xl font-black leading-none text-[#f0a536] drop-shadow-[3px_3px_0_#000]">
                    x{game.combo}
                  </p>
                </div>
              </section>
            </div>

            <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={restartGame}
                className="rounded-2xl border-[5px] border-[#061811] bg-[#ffef7a] px-5 py-4 text-xl font-black text-[#061811] shadow-[6px_6px_0_#020806,0_0_0_2px_#fff4cf_inset] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#020806]"
              >
                RETRY
              </button>

              <button
                onClick={() => {
                  playSound("select");
                  setScreen("home");
                }}
                className="rounded-2xl border-[5px] border-[#061811] bg-[#1787d8] px-5 py-4 text-xl font-black text-white shadow-[6px_6px_0_#020806,0_0_0_2px_rgba(255,255,255,0.18)_inset] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#020806]"
                style={{ textShadow: "2px 2px 0 #03100b" }}
              >
                TITLE
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="portrait-outer relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1920px] flex-col overflow-visible px-1.5 py-1.5 md:h-screen md:overflow-hidden">
        <section
          className="portrait-frame table-frame pixel-hard relative flex min-h-0 flex-1 flex-col overflow-visible border-[5px] border-[#061811] p-1.5 shadow-[7px_7px_0_#03100b] backdrop-blur-sm sm:border-[6px] sm:p-2 md:overflow-hidden md:shadow-[10px_10px_0_#03100b]"
          style={{ animation: resultPulse ? "boardKick 360ms ease-out" : undefined }}
        >
          <header className="pixel-hard pixel-inner relative z-10 mb-2 grid shrink-0 gap-2 overflow-hidden border-[4px] border-[#07160f] bg-[#0a3329] px-2.5 py-2 shadow-[5px_5px_0_#03100b] sm:px-4 md:grid-cols-[minmax(230px,0.8fr)_minmax(420px,1.9fr)] md:items-center md:shadow-[6px_6px_0_#03100b]">
            <div className="pointer-events-none absolute left-3 right-3 top-2 h-[3px] bg-[#f0b342] shadow-[0_2px_0_#4d2a07]" />
            <div className="pointer-events-none absolute bottom-2 left-3 right-3 h-[3px] bg-[#b97828] shadow-[0_2px_0_#03100b]" />
            <div className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-br-xl border-b-[4px] border-r-[4px] border-[#f0b342]" />
            <div className="pointer-events-none absolute right-1 top-1 h-5 w-5 rounded-bl-xl border-b-[4px] border-l-[4px] border-[#f0b342]" />
            <div className="pointer-events-none absolute bottom-1 left-1 h-5 w-5 rounded-tr-xl border-r-[4px] border-t-[4px] border-[#b97828]" />
            <div className="pointer-events-none absolute bottom-1 right-1 h-5 w-5 rounded-tl-xl border-l-[4px] border-t-[4px] border-[#b97828]" />

            <div className="relative z-10 flex min-h-[52px] items-center px-2 sm:min-h-[68px]">
              <div>
                <h1
                  className="text-4xl font-black leading-[0.82] text-[#f1a22d] sm:text-5xl lg:text-6xl"
                  style={{
                    textShadow:
                      "4px 0 #5a2b05, 0 4px #5a2b05, 5px 5px 0 #1d0c02, -2px -2px 0 #ffd16b",
                  }}
                >
                  NUTS
                </h1>
                <p
                  className="mt-2 text-xs font-black tracking-[0.38em] text-[#7fd0a4]"
                  style={{ textShadow: "2px 2px 0 #03100b" }}
                >
                  GRID POKER
                </p>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 xl:gap-3">
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

          <div className="portrait-stack-layout relative z-10 grid min-h-0 flex-1 justify-center gap-2 md:grid-cols-[minmax(420px,1fr)_250px] lg:grid-cols-[minmax(680px,900px)_340px] xl:gap-3 2xl:grid-cols-[minmax(740px,960px)_380px]">
<div className="flex min-h-0 flex-col overflow-visible md:overflow-hidden">
              <section className="portrait-board-wrap pixel-hard relative flex min-h-0 flex-1 flex-col overflow-hidden border-[5px] border-[#061811] bg-[#0b2f27] p-1.5 shadow-[5px_5px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.35)_inset] sm:border-[6px] sm:p-2 md:shadow-[7px_7px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.35)_inset]">
                <div className="mb-2 flex h-7 items-center justify-between">
                  <p className="rounded-md border-[3px] border-[#061811] bg-[#123f32] px-3 py-1 text-xs font-black tracking-[0.25em] text-[#f5d06f] shadow-[3px_3px_0_#04120d]">
                    BOARD
                  </p>

                  {isResolvingHand && (
                    <div
                      className="rounded-full border-[3px] border-[#061811] bg-[#f5d06f] px-3 py-1 text-[10px] font-black text-[#061811] shadow-[3px_3px_0_#04120d]"
                      style={{ animation: "targetBanner 180ms ease-out" }}
                    >
                      CLEAR TARGETS
                    </div>
                  )}
                </div>

                <div className="portrait-board pixel-hard relative mx-auto grid aspect-square min-h-0 w-full max-w-[min(94vw,560px)] flex-none grid-cols-5 grid-rows-5 gap-1 border-[5px] border-[#061811] bg-[#09231d] p-1.5 shadow-[inset_0_0_0_2px_#1a4e3e,inset_0_0_38px_rgba(0,0,0,0.58),5px_5px_0_#04120d] sm:gap-1.5 sm:p-2 md:max-h-full md:max-w-none md:flex-1 lg:aspect-auto lg:max-h-none xl:gap-2 xl:p-3">
                  {resultBanner && (
                    <div className="pointer-events-none absolute right-2 top-2 z-40 max-w-[260px] sm:right-3 sm:top-3">
                      <div
                        className={[
                          "rounded-xl border-[4px] px-3 py-2 text-right shadow-[4px_4px_0_#03100b] backdrop-blur-[1px]",
                          resultBanner.isBreak
                            ? "border-[#061811] bg-[#d23a2f]/90 text-white"
                            : `border-[#061811] bg-[#f5d06f]/92 text-[#061811]`,
                        ].join(" ")}
                        style={{ animation: "targetBanner 160ms ease-out" }}
                      >
                        <p className="text-[9px] font-black tracking-[0.22em] opacity-75">
                          {resultBanner.isBreak ? "MISS" : "HAND HIT"}
                        </p>
                        <p className="mt-0.5 max-w-[220px] truncate text-lg font-black leading-tight">
                          {resultBanner.text}
                        </p>
                        {!resultBanner.isBreak && (
                          <div className="mt-1 flex items-center justify-end gap-1.5 text-xs font-black">
                            <span className="rounded-md border-[2px] border-[#061811] bg-[#102a25] px-2 py-0.5 text-[#f5d06f] shadow-[2px_2px_0_#03100b]">
                              +{resultBanner.score}
                            </span>
                            <span className="rounded-md border-[2px] border-[#061811] bg-[#102a25] px-2 py-0.5 text-[#6ee7ff] shadow-[2px_2px_0_#03100b]">
                              x{resultBanner.combo}
                            </span>
                            {resultBanner.comboNext && (
                              <span className="rounded-md border-[2px] border-[#061811] bg-[#07160f] px-2 py-0.5 text-[#ffef7a] shadow-[2px_2px_0_#03100b]">
                                → x{resultBanner.comboNext}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
                            "pixel-hard-sm relative h-full min-h-0 overflow-hidden border-[3px] transition duration-200",
                            cell
                              ? "rotate-[-1deg] border-[#061811] bg-[#fff4cf] p-1 shadow-[4px_4px_0_#04120d]"
                              : "slot-surface border-[#061811] shadow-[3px_3px_0_#04120d]",
                            canPlace
                              ? "cursor-pointer shadow-[0_0_0_3px_#f5d06f,4px_4px_0_#04120d] hover:-translate-y-1 hover:brightness-125"
                              : "",
                            !cell && !canPlace ? "hover:bg-[#1c4639]" : "",
                            isHighlighted
                              ? "z-20 bg-[#fff4cf] shadow-[0_0_0_2px_#f5d06f,0_0_10px_rgba(255,239,122,0.38),4px_4px_0_#000]"
                              : "",
                            shouldDim ? "opacity-70" : "",
                          ].join(" ")}
                          style={{
                            animation: isClearing
                              ? "clearShake 520ms ease-in-out forwards"
                              : isHighlighted
                              ? "handGlow 760ms ease-in-out 2"
                              : isPlaced
                              ? "cardPop 360ms ease-out"
                              : undefined,
                          }}
                        >
                          {cell ? (
                            <>
                              <div className="mx-auto h-full max-h-full aspect-[5/7] max-w-[82%]">
                                <CardFace card={cell} size="normal" />
                              </div>

                              {isHighlighted && (
                                <div
                                  className="pointer-events-none absolute right-1 top-1 z-30 rounded-md border-[2px] border-black bg-[#6ee7ff]/90 px-1.5 py-0.5 text-[9px] font-black text-black shadow-[2px_2px_0_#000]"
                                  style={{
                                    animation: "hitBadge 220ms ease-out forwards",
                                  }}
                                >
                                  HIT
                                </div>
                              )}

                              {isHighlighted && (
                                <>
                                  <div className="pointer-events-none absolute inset-0 z-[-1] rounded-xl bg-[#ffef7a]/25" />
                                  <span
                                    className="pointer-events-none absolute right-2 bottom-2 z-30 text-base font-black text-[#f5d06f] drop-shadow-[2px_2px_0_#061811]"
                                    style={{ animation: "sparklePop 620ms ease-out 1" }}
                                  >
                                    ✦
                                  </span>
                                </>
                              )}
                            </>
                          ) : (
                            <span
                              className={[
                                "relative z-10 text-3xl font-black",
                                canPlace ? "text-[#f5d06f]" : "text-[#7fbfa0]/22",
                              ].join(" ")}
                            >
                              ♠
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              
            </div>

            <aside className="portrait-side flex min-h-0 flex-col gap-2 overflow-visible md:overflow-hidden">
              <div className="portrait-queue-panel solo-queue-panel queue-panel pixel-hard flex min-h-0 flex-col overflow-hidden border-[5px] border-[#061811] p-1.5 shadow-[5px_5px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.34)_inset] sm:border-[6px] sm:p-2 md:flex-1 md:shadow-[7px_7px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.34)_inset]">
                <div className="pixel-hard-sm mb-2 shrink-0 border-[3px] border-[#061811] bg-[#123f32] px-3 py-1.5 text-center shadow-[3px_3px_0_#04120d]">
                  <p className="text-lg font-black tracking-[0.08em] text-[#d5d48a] drop-shadow-[2px_2px_0_#03100b]">
                    NOW
                  </p>
                </div>

                <button
                  onClick={() => selectHandCard(0)}
                  disabled={game.isGameOver || !game.hand[0]}
                  className="queue-card-well mb-0 flex w-full min-h-0 flex-1 flex-col items-center justify-center rounded-xl border-[4px] border-[#061811] p-2 text-center shadow-[4px_4px_0_#04120d,inset_0_0_0_2px_#255d48] transition hover:-translate-y-1 hover:brightness-110 hover:shadow-[6px_6px_0_#04120d]"
                >
                  <div
                    className="w-16 shrink-0 rotate-[-2deg] pixel-hard border-[5px] border-[#061811] bg-[#fff8e4] p-1 shadow-[5px_5px_0_#04120d] sm:w-20 lg:w-24 xl:w-28"
                    style={{ aspectRatio: "5 / 7" }}
                  >
                    {game.hand[0] ? (
                      <CardFace card={game.hand[0]} size="small" />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg bg-[#fff8e4] text-center text-xs font-black text-black/50">
                        EMPTY
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] font-black tracking-[0.18em] text-[#7fd0a4]">
                    PLACE THIS
                  </p>
                  <p
                    className="mt-1 text-2xl font-black leading-none text-white xl:text-3xl"
                    style={{ textShadow: "3px 3px 0 #03100b" }}
                  >
                    {game.hand[0]
                      ? `${game.hand[0].rank}${suitSymbols[game.hand[0].suit]}`
                      : "-"}
                  </p>

                  <div className="mt-2 flex justify-center gap-2">
                    <span className="h-3 w-3 rounded-full border-[2px] border-[#061811] bg-[#35b66a] shadow-[2px_2px_0_#04120d]" />
                    <span className="h-3 w-3 rounded-full border-[2px] border-[#061811] bg-[#234338] shadow-[2px_2px_0_#04120d]" />
                    <span className="h-3 w-3 rounded-full border-[2px] border-[#061811] bg-[#234338] shadow-[2px_2px_0_#04120d]" />
                  </div>
                </button>
              </div>

              <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  onClick={restartGame}
                  className="rounded-xl border-[4px] border-[#061811] bg-[#1787d8] px-2 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#04120d,0_0_0_2px_rgba(255,255,255,0.15)_inset] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_#04120d] sm:border-[5px] sm:px-3 sm:py-3 sm:text-base sm:shadow-[5px_5px_0_#04120d,0_0_0_2px_rgba(255,255,255,0.15)_inset]"
                  style={{ textShadow: "2px 2px 0 #03100b" }}
                >
                  RESTART
                </button>

                <button
                  onClick={toggleSound}
                  className="rounded-xl border-[4px] border-[#061811] bg-[#f5d06f] px-2 py-2.5 text-sm font-black text-[#061811] shadow-[4px_4px_0_#04120d,0_0_0_2px_rgba(255,255,255,0.18)_inset] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_#04120d] sm:border-[5px] sm:px-3 sm:py-3 sm:text-base sm:shadow-[5px_5px_0_#04120d,0_0_0_2px_rgba(255,255,255,0.18)_inset]"
                >
                  {soundEnabled ? "SFX ON" : "SFX OFF"}
                </button>

                <button
                  onClick={() => {
                    playSound("select");
                    setScreen("home");
                  }}
                  className="rounded-xl border-[4px] border-[#061811] bg-[#d23a2f] px-2 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#04120d,0_0_0_2px_rgba(255,255,255,0.14)_inset] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_#04120d] sm:border-[5px] sm:px-3 sm:py-3 sm:text-base sm:shadow-[5px_5px_0_#04120d,0_0_0_2px_rgba(255,255,255,0.14)_inset]"
                  style={{ textShadow: "2px 2px 0 #03100b" }}
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