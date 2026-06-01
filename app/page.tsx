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


const CARD_ASSET_VERSION = "v10";
const LOGO_ASSET_VERSION = "v2";
const NUTS_LOGO_SRC = `/logo/nuts-logo-sign.png?${LOGO_ASSET_VERSION}`;

const suitCodeMap: Record<Suit, string> = {
  spade: "S",
  heart: "H",
  diamond: "D",
  club: "C",
};

function getCardImagePath(card: Card): string {
  return `/cards/${card.rank}${suitCodeMap[card.suit]}.png?${CARD_ASSET_VERSION}`;
}

function getAllCardImagePaths(): string[] {
  return suits.flatMap((suit) =>
    ranks.map(({ rank }) =>
      `/cards/${rank}${suitCodeMap[suit]}.png?${CARD_ASSET_VERSION}`
    )
  );
}

let didPreloadCardImages = false;

function preloadCardImages() {
  if (typeof window === "undefined" || didPreloadCardImages) return;

  didPreloadCardImages = true;

  for (const src of getAllCardImagePaths()) {
    const image = new Image();
    image.decoding = "sync";
    image.src = src;
  }
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
  return (
    <div
      className="card-image-shell relative grid h-full w-full place-items-center overflow-visible rounded-[10%] bg-transparent p-0 shadow-none"
    >
      <img
        key={`${card.id}-${CARD_ASSET_VERSION}`}
        src={getCardImagePath(card)}
        alt={`${card.rank} of ${card.suit}`}
        draggable={false}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        className="card-image-direct block h-full w-full select-none object-contain"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
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

  const previewCells = [
    "", "", "K♥", "", "",
    "", "10♣", "", "", "",
    "", "", "8♦", "", "",
    "", "A♠", "", "", "",
    "", "", "", "", "",
  ];

  const menuCards: Card[] = [
    { id: "menu-ah", rank: "A", suit: "heart", value: 14 },
    { id: "menu-qs", rank: "Q", suit: "spade", value: 12 },
    { id: "menu-jd", rank: "J", suit: "diamond", value: 11 },
  ];

  return (
    <main className="nuts-pixel home-simple-screen relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#061711] text-white">
      <style>{`
        @keyframes menuPop {
          0% { transform: translateY(18px) scale(0.985); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        @keyframes softGlow {
          0%, 100% { opacity: 0.54; transform: scale(1); }
          50% { opacity: 0.88; transform: scale(1.03); }
        }

        @keyframes cardHoverHome {
          0%, 100% { transform: translateY(0) rotate(var(--rot)); }
          50% { transform: translateY(-8px) rotate(calc(var(--rot) + 1deg)); }
        }

        .home-simple-screen {
          background:
            radial-gradient(circle at 50% 38%, rgba(240, 165, 54, 0.14), transparent 32%),
            radial-gradient(circle at 22% 18%, rgba(44, 165, 105, 0.20), transparent 34%),
            radial-gradient(circle at 78% 72%, rgba(14, 90, 74, 0.24), transparent 35%),
            linear-gradient(180deg, #0b2a20 0%, #061811 54%, #030907 100%);
        }

        .home-simple-screen::before {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(circle, rgba(245, 198, 93, 0.13) 1px, transparent 1.7px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.032) 0 1px, transparent 1px 14px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.026) 0 1px, transparent 1px 14px),
            repeating-linear-gradient(45deg, rgba(240,165,54,0.04) 0 2px, transparent 2px 24px);
          background-size: 10px 10px, 14px 14px, 14px 14px, 48px 48px;
          opacity: 0.95;
          image-rendering: pixelated;
        }

        .home-simple-screen::after {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(90deg, rgba(0,0,0,0.55), transparent 18%, transparent 82%, rgba(0,0,0,0.55)),
            linear-gradient(180deg, rgba(0,0,0,0.24), transparent 25%, rgba(0,0,0,0.56));
        }

        .home-shell {
          animation: menuPop 520ms ease-out both;
          background:
            radial-gradient(circle at 50% 0%, rgba(245, 198, 93, 0.13), transparent 32%),
            linear-gradient(180deg, rgba(12, 66, 48, 0.96), rgba(5, 29, 23, 0.98));
          box-shadow:
            12px 12px 0 #020806,
            0 0 0 4px #06140f,
            0 0 0 7px #d9912c,
            inset 0 0 0 3px rgba(255,220,116,0.20),
            inset 0 0 60px rgba(0,0,0,0.42);
        }

        .home-shell::before {
          content: "♠";
          position: absolute;
          top: -30px;
          left: 50%;
          width: 74px;
          height: 56px;
          transform: translateX(-50%);
          display: grid;
          place-items: center;
          border: 4px solid #d9912c;
          border-bottom: 0;
          border-radius: 36px 36px 0 0;
          background: #0c3b2b;
          color: #f2b84a;
          font-size: 26px;
          text-shadow: 3px 3px 0 #2f1705;
          box-shadow: 0 -3px 0 #07140f inset;
        }

        .home-shell-corner {
          position: absolute;
          width: 24px;
          height: 24px;
          border-color: #f2b84a;
          opacity: 0.9;
        }

        .home-card-panel {
          background:
            radial-gradient(circle at 50% 20%, rgba(245, 198, 93, 0.10), transparent 28%),
            linear-gradient(180deg, #0c3a2b, #061b15);
          box-shadow:
            7px 7px 0 #020806,
            inset 0 0 0 3px rgba(20, 94, 68, 0.92),
            inset 0 0 26px rgba(0,0,0,0.38);
        }

        .home-logo-center {
          max-width: min(96%, 700px);
        }

        .home-wordmark-img {
          image-rendering: pixelated;
          filter:
            drop-shadow(0 7px 0 rgba(2,8,6,0.88))
            drop-shadow(0 14px 22px rgba(0,0,0,0.42))
            drop-shadow(0 0 18px rgba(242,184,74,0.22));
        }

        .home-main-button {
          position: relative;
          overflow: hidden;
          border: 5px solid #06140f;
          box-shadow: 7px 7px 0 #020806, inset 0 0 0 3px rgba(255,255,255,0.18);
          transition: transform 120ms ease, filter 120ms ease;
        }

        .home-main-button:hover { transform: translateY(-3px); filter: brightness(1.08); }
        .home-main-button:active { transform: translateY(0); }

        .home-main-button::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 0 38%, rgba(255,255,255,0.24) 39% 52%, transparent 53% 100%);
          transform: translateX(-110%);
          animation: homeButtonShine 3.2s ease-in-out infinite;
        }

        @keyframes homeButtonShine {
          0%, 38% { transform: translateX(-110%); }
          58%, 100% { transform: translateX(110%); }
        }

        .home-info-box {
          background: linear-gradient(180deg, #0c392b, #061b15);
          box-shadow: 5px 5px 0 #020806, inset 0 0 0 2px rgba(242,184,74,0.16);
        }

        .home-preview-cell {
          background: linear-gradient(180deg, #0b3327, #071d16);
          box-shadow: inset 0 0 0 2px #05140f, 2px 2px 0 #020806;
        }

        .home-preview-cell.hit {
          background: linear-gradient(180deg, #ffc35b, #e68e27);
          color: #2a1504;
          box-shadow: inset 0 0 0 2px #5a2b08, 0 0 18px rgba(242,184,74,0.55), 2px 2px 0 #020806;
        }

        .home-bg-suits {
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          opacity: 0.18;
        }

        .home-bg-suits span {
          position: absolute;
          color: rgba(133, 203, 123, 0.42);
          font-weight: 900;
          text-shadow: 4px 4px 0 rgba(0,0,0,0.22);
          transform: rotate(var(--r));
        }
      `}</style>

      <div className="home-bg-suits" aria-hidden="true">
        <span style={{ left: "9%", top: "18%", fontSize: 72, "--r": "-12deg" } as Record<string, string | number>}>♣</span>
        <span style={{ left: "82%", top: "20%", fontSize: 86, "--r": "9deg" } as Record<string, string | number>}>♦</span>
        <span style={{ left: "17%", top: "66%", fontSize: 54, "--r": "18deg" } as Record<string, string | number>}>♠</span>
        <span style={{ left: "78%", top: "67%", fontSize: 64, "--r": "-18deg" } as Record<string, string | number>}>♣</span>
        <span style={{ left: "50%", top: "10%", fontSize: 36, "--r": "4deg" } as Record<string, string | number>}>♠</span>
      </div>

      <div className="relative z-10 flex min-h-[100svh] items-center justify-center px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <section className="home-shell pixel-hard relative w-full max-w-[900px] rounded-[28px] border-[5px] border-[#d9912c] px-4 py-5 sm:px-7 sm:py-6 lg:px-8">
          <span className="home-shell-corner left-3 top-3 border-l-[4px] border-t-[4px]" />
          <span className="home-shell-corner right-3 top-3 border-r-[4px] border-t-[4px]" />
          <span className="home-shell-corner bottom-3 left-3 border-b-[4px] border-l-[4px]" />
          <span className="home-shell-corner bottom-3 right-3 border-b-[4px] border-r-[4px]" />

          <div className="mx-auto max-w-[760px]">
            <div className="home-logo-center relative mx-auto mb-5 flex justify-center">
              <img
                src={NUTS_LOGO_SRC}
                alt="NUTS GRID POKER"
                draggable={false}
                className="home-wordmark-img h-auto w-full max-w-[660px] select-none object-contain"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div className="home-card-panel relative rounded-[22px] border-[4px] border-[#06140f] p-4 sm:p-5">
                <p className="mb-3 text-center text-[12px] font-black tracking-[0.42em] text-[#f2b84a] sm:text-sm">
                  BUILD HANDS. BREAK THE GRID.
                </p>

                <div className="relative mx-auto flex h-[145px] max-w-[390px] items-center justify-center sm:h-[175px] lg:h-[190px]">
                  <div className="absolute inset-x-10 bottom-2 h-12 rounded-full bg-black/35 blur-xl" />
                  {menuCards.map((card, index) => {
                    const transforms = ["-rotate-[10deg] -translate-x-16 translate-y-3", "rotate-[2deg] translate-y-0", "rotate-[10deg] translate-x-16 translate-y-4"];
                    return (
                      <div
                        key={card.id}
                        className={`absolute h-32 w-[5.15rem] sm:h-40 sm:w-[6.4rem] ${transforms[index]}`}
                        style={{
                          "--rot": `${index === 0 ? -10 : index === 1 ? 2 : 10}deg`,
                          animation: `cardHoverHome ${3.2 + index * 0.2}s ease-in-out infinite`,
                        } as Record<string, string>}
                      >
                        <CardFace card={card} />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border-[3px] border-[#06140f] bg-[#0e402f] px-2 py-2.5 shadow-[4px_4px_0_#020806]">
                    <p className="text-[9px] font-black tracking-[0.22em] text-[#8bd8af]">MODE</p>
                    <p className="mt-1 text-sm font-black text-[#fff4cf]">ENDLESS</p>
                  </div>
                  <div className="rounded-xl border-[3px] border-[#06140f] bg-[#0e402f] px-2 py-2.5 shadow-[4px_4px_0_#020806]">
                    <p className="text-[9px] font-black tracking-[0.22em] text-[#8bd8af]">BOARD</p>
                    <p className="mt-1 text-sm font-black text-[#fff4cf]">5 × 5</p>
                  </div>
                  <div className="rounded-xl border-[3px] border-[#06140f] bg-[#0e402f] px-2 py-2.5 shadow-[4px_4px_0_#020806]">
                    <p className="text-[9px] font-black tracking-[0.22em] text-[#8bd8af]">CLEAR</p>
                    <p className="mt-1 text-sm font-black text-[#fff4cf]">LINE</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3">
                  <button
                    onClick={onStart}
                    className="home-main-button rounded-xl bg-gradient-to-b from-[#ffc35b] to-[#e58d25] px-7 py-5 text-3xl font-black tracking-[0.05em] text-[#2b1503] sm:text-4xl"
                  >
                    <span className="relative z-10">SOLO PLAY</span>
                  </button>

                  <button
                    onClick={onStartDuel}
                    className="home-main-button rounded-xl bg-gradient-to-b from-[#28d6bd] to-[#0f9b84] px-7 py-4 text-2xl font-black tracking-[0.05em] text-[#03140f] sm:text-3xl"
                  >
                    <span className="relative z-10">DUEL MODE</span>
                  </button>
                </div>

                <div className="home-info-box rounded-2xl border-[4px] border-[#06140f] p-4">
                  <p className="mb-3 text-center text-[12px] font-black tracking-[0.24em] text-[#f2b84a]">
                    BEST SCORE
                  </p>
                  <div className="rounded-xl border-[3px] border-[#06140f] bg-[#071812] px-4 py-4 text-center shadow-[3px_3px_0_#020806,inset_0_0_0_2px_rgba(242,184,74,0.12)]">
                    <p className="text-4xl font-black text-[#fff4cf] drop-shadow-[4px_4px_0_#020806]">
                      {highScore}
                    </p>
                  </div>
                  <div className="mt-4 flex justify-center gap-3 text-2xl text-[#6ea764] opacity-80">
                    <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>

      {showHands && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[88svh] w-full max-w-4xl overflow-y-auto rounded-3xl border-[6px] border-[#f0a536] bg-[#061811] p-4 shadow-[12px_12px_0_#020806]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black tracking-[0.12em] text-[#fff4cf]">HANDS</h2>
              <button
                onClick={() => setShowHands(false)}
                className="rounded-xl border-[3px] border-black bg-[#d83b32] px-4 py-2 text-lg font-black text-white shadow-[4px_4px_0_#020806]"
              >
                CLOSE
              </button>
            </div>
            <RoleListPanel />
          </div>
        </div>
      )}
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
    preloadCardImages();

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
      <main className="nuts-pixel crt-lines felt-bg pixel-dither balatro-inspired-bg flex h-screen items-center justify-center overflow-hidden bg-[#07120f] text-white">
        <div className="rounded-2xl border-[4px] border-black bg-[#0b3a2b] px-6 py-4 shadow-[8px_8px_0_#000]">
          <img
            src={NUTS_LOGO_SRC}
            alt="NUTS"
            draggable={false}
            className="nuts-logo-img h-auto w-[250px] select-none object-contain"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
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
      <main className="nuts-pixel crt-lines felt-bg pixel-dither balatro-inspired-bg relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#07120f] text-white md:h-screen md:overflow-hidden">
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


        /* === NUTS LOGO MATCH THEME ===================================== */
        .nuts-logo-img {
          image-rendering: auto;
          filter:
            drop-shadow(0 4px 0 #4a2307)
            drop-shadow(0 8px 0 rgba(2, 8, 6, 0.62))
            drop-shadow(0 0 12px rgba(245, 181, 68, 0.22));
          mix-blend-mode: normal;
        }

        .nuts-wordmark-stack {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          line-height: 1;
        }

        .nuts-wordmark-sub {
          margin-top: -4px;
          margin-left: 8px;
          color: #87c77b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.33em;
          text-shadow: 3px 3px 0 #020806;
        }

        .nuts-pixel .table-frame {
          background:
            radial-gradient(circle at 14% 18%, rgba(255, 211, 103, 0.12), transparent 25%),
            radial-gradient(circle at 82% 22%, rgba(41, 125, 87, 0.18), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.38)),
            #062b22 !important;
          box-shadow:
            9px 9px 0 #020806,
            0 0 0 2px rgba(255, 213, 95, 0.14),
            inset 0 0 46px rgba(0,0,0,0.42) !important;
        }

        .nuts-pixel .table-frame::before {
          border-color: rgba(241, 181, 59, 0.86) !important;
          box-shadow:
            0 2px 0 #3b2107,
            0 0 18px rgba(241, 181, 59, 0.18),
            inset 0 0 0 2px rgba(3, 22, 14, 0.82) !important;
        }

        .nuts-pixel header.pixel-inner {
          background:
            linear-gradient(180deg, rgba(16, 76, 57, 0.94), rgba(3, 38, 30, 0.98)),
            radial-gradient(circle at 15% 35%, rgba(245, 181, 68, 0.14), transparent 28%) !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            inset 0 0 0 3px #05150f,
            inset 0 0 0 6px rgba(241, 181, 59, 0.28),
            inset 0 -18px 26px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel header.pixel-inner::after {
          content: "♣  ♠   ♦  ♠   ♣";
          pointer-events: none;
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 2.4rem;
          color: rgba(99, 178, 104, 0.16);
          font-size: clamp(26px, 3.8vw, 58px);
          font-weight: 900;
          letter-spacing: 0.22em;
          text-shadow: 3px 3px 0 rgba(0,0,0,0.25);
          z-index: 0;
        }

        .nuts-pixel .portrait-board-wrap,
        .nuts-pixel .queue-panel,
        .nuts-pixel .queue-card-well,
        .nuts-pixel .slot-surface {
          background:
            radial-gradient(circle at 22% 18%, rgba(112, 190, 124, 0.10), transparent 26%),
            linear-gradient(145deg, rgba(255,255,255,0.045), rgba(0,0,0,0.30)),
            #06261f !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            0 0 0 2px rgba(241, 181, 59, 0.16) inset,
            0 0 28px rgba(0,0,0,0.38) inset !important;
        }

        .nuts-pixel .balatro-inspired-bg,
        .nuts-pixel.felt-bg,
        .balatro-inspired-bg {
          background:
            radial-gradient(circle at 18% 14%, rgba(241, 181, 59, 0.14), transparent 26%),
            radial-gradient(circle at 82% 18%, rgba(27, 94, 64, 0.28), transparent 32%),
            radial-gradient(circle at 50% 95%, rgba(0,0,0,0.54), transparent 56%),
            linear-gradient(135deg, rgba(255, 218, 111, 0.045) 0 9%, transparent 9% 18%, rgba(0,0,0,0.08) 18% 27%, transparent 27% 36%),
            #041b17 !important;
          background-size: auto, auto, auto, 64px 64px, auto !important;
        }

        .nuts-pixel .bg-felt-symbols {
          opacity: 0.24 !important;
        }

        .nuts-pixel .bg-felt-symbols span {
          color: rgba(102, 177, 101, 0.42) !important;
          text-shadow: 4px 4px 0 rgba(0,0,0,0.30) !important;
        }

        .nuts-pixel button {
          border-color: #05150f !important;
          box-shadow:
            5px 5px 0 #020806,
            inset 0 0 0 2px rgba(255,255,255,0.18),
            inset 0 -8px 12px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel .pixel-hard-sm,
        .nuts-pixel .pixel-hard {
          image-rendering: pixelated;
        }

        .nuts-pixel .card-image-shell {
          filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.58));
        }

        @media (max-width: 640px) {
          .nuts-logo-img {
            max-width: min(44vw, 210px) !important;
          }
        }


        /* === NUTS LOGO MATCH THEME ===================================== */
        .nuts-logo-img {
          image-rendering: auto;
          filter:
            drop-shadow(0 4px 0 #4a2307)
            drop-shadow(0 8px 0 rgba(2, 8, 6, 0.62))
            drop-shadow(0 0 12px rgba(245, 181, 68, 0.22));
          mix-blend-mode: normal;
        }

        .nuts-wordmark-stack {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          line-height: 1;
        }

        .nuts-wordmark-sub {
          margin-top: -4px;
          margin-left: 8px;
          color: #87c77b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.33em;
          text-shadow: 3px 3px 0 #020806;
        }

        .nuts-pixel .table-frame {
          background:
            radial-gradient(circle at 14% 18%, rgba(255, 211, 103, 0.12), transparent 25%),
            radial-gradient(circle at 82% 22%, rgba(41, 125, 87, 0.18), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.38)),
            #062b22 !important;
          box-shadow:
            9px 9px 0 #020806,
            0 0 0 2px rgba(255, 213, 95, 0.14),
            inset 0 0 46px rgba(0,0,0,0.42) !important;
        }

        .nuts-pixel .table-frame::before {
          border-color: rgba(241, 181, 59, 0.86) !important;
          box-shadow:
            0 2px 0 #3b2107,
            0 0 18px rgba(241, 181, 59, 0.18),
            inset 0 0 0 2px rgba(3, 22, 14, 0.82) !important;
        }

        .nuts-pixel header.pixel-inner {
          background:
            linear-gradient(180deg, rgba(16, 76, 57, 0.94), rgba(3, 38, 30, 0.98)),
            radial-gradient(circle at 15% 35%, rgba(245, 181, 68, 0.14), transparent 28%) !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            inset 0 0 0 3px #05150f,
            inset 0 0 0 6px rgba(241, 181, 59, 0.28),
            inset 0 -18px 26px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel header.pixel-inner::after {
          content: "♣  ♠   ♦  ♠   ♣";
          pointer-events: none;
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 2.4rem;
          color: rgba(99, 178, 104, 0.16);
          font-size: clamp(26px, 3.8vw, 58px);
          font-weight: 900;
          letter-spacing: 0.22em;
          text-shadow: 3px 3px 0 rgba(0,0,0,0.25);
          z-index: 0;
        }

        .nuts-pixel .portrait-board-wrap,
        .nuts-pixel .queue-panel,
        .nuts-pixel .queue-card-well,
        .nuts-pixel .slot-surface {
          background:
            radial-gradient(circle at 22% 18%, rgba(112, 190, 124, 0.10), transparent 26%),
            linear-gradient(145deg, rgba(255,255,255,0.045), rgba(0,0,0,0.30)),
            #06261f !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            0 0 0 2px rgba(241, 181, 59, 0.16) inset,
            0 0 28px rgba(0,0,0,0.38) inset !important;
        }

        .nuts-pixel .balatro-inspired-bg,
        .nuts-pixel.felt-bg,
        .balatro-inspired-bg {
          background:
            radial-gradient(circle at 18% 14%, rgba(241, 181, 59, 0.14), transparent 26%),
            radial-gradient(circle at 82% 18%, rgba(27, 94, 64, 0.28), transparent 32%),
            radial-gradient(circle at 50% 95%, rgba(0,0,0,0.54), transparent 56%),
            linear-gradient(135deg, rgba(255, 218, 111, 0.045) 0 9%, transparent 9% 18%, rgba(0,0,0,0.08) 18% 27%, transparent 27% 36%),
            #041b17 !important;
          background-size: auto, auto, auto, 64px 64px, auto !important;
        }

        .nuts-pixel .bg-felt-symbols {
          opacity: 0.24 !important;
        }

        .nuts-pixel .bg-felt-symbols span {
          color: rgba(102, 177, 101, 0.42) !important;
          text-shadow: 4px 4px 0 rgba(0,0,0,0.30) !important;
        }

        .nuts-pixel button {
          border-color: #05150f !important;
          box-shadow:
            5px 5px 0 #020806,
            inset 0 0 0 2px rgba(255,255,255,0.18),
            inset 0 -8px 12px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel .pixel-hard-sm,
        .nuts-pixel .pixel-hard {
          image-rendering: pixelated;
        }

        .nuts-pixel .card-image-shell {
          filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.58));
        }

        @media (max-width: 640px) {
          .nuts-logo-img {
            max-width: min(44vw, 210px) !important;
          }
        }

      `}</style>

      <div className="bg-felt-symbols" aria-hidden="true">
        <span style={{ left: "7%", top: "12%", fontSize: "44px", ["--r" as string]: "-12deg" }}>♠</span>
        <span style={{ left: "86%", top: "15%", fontSize: "38px", ["--r" as string]: "16deg" }}>♦</span>
        <span style={{ left: "14%", top: "78%", fontSize: "36px", ["--r" as string]: "14deg" }}>♣</span>
        <span style={{ left: "78%", top: "80%", fontSize: "46px", ["--r" as string]: "-10deg" }}>♥</span>
        <span style={{ left: "48%", top: "8%", fontSize: "28px", ["--r" as string]: "8deg" }}>A</span>
        <span style={{ left: "54%", top: "86%", fontSize: "30px", ["--r" as string]: "-8deg" }}>K</span>
      </div>
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

              <div className="relative z-10 flex min-h-[58px] items-center px-1.5 sm:min-h-[68px] sm:px-2">
                <img
                  src={NUTS_LOGO_SRC}
                  alt="NUTS"
                  draggable={false}
                  className="nuts-logo-img h-auto max-h-[78px] w-[230px] select-none object-contain sm:max-h-[88px] sm:w-[300px] lg:w-[340px]"
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                />
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
                                ? "border-[#061811] bg-transparent p-0 shadow-[4px_4px_0_#04120d]"
                                : "slot-surface border-[#061811] shadow-[3px_3px_0_#04120d]",
                              canPlace ? "cursor-pointer hover:-translate-y-1 hover:brightness-125" : "",
                              ownerGlow,
                              isPlaced ? "scale-[1.03]" : "",
                              isHit ? "z-20 bg-transparent shadow-[0_0_0_2px_#f5d06f,0_0_10px_rgba(255,239,122,0.38),4px_4px_0_#000]" : "",
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
                                <div className="board-card-inner mx-auto grid h-full max-h-full aspect-[5/7] w-full max-w-[90%] place-items-center bg-transparent">
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
                      className="w-20 shrink-0 rotate-[-2deg] bg-transparent p-0 sm:w-24 lg:w-28 xl:w-32"
                      style={{ aspectRatio: "5 / 7" }}
                    >
                      {duel.currentCard ? (
                        <CardFace card={duel.currentCard} size="small" />
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-lg bg-transparent text-center text-xs font-black text-white/50">
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
    <main className="nuts-pixel crt-lines felt-bg pixel-dither balatro-inspired-bg relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#07120f] text-white md:h-screen md:overflow-hidden">
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



        .balatro-inspired-bg {
          background:
            radial-gradient(circle at 18% 16%, rgba(245, 181, 68, 0.16), transparent 26%),
            radial-gradient(circle at 82% 18%, rgba(82, 210, 159, 0.12), transparent 30%),
            radial-gradient(circle at 50% 96%, rgba(0, 0, 0, 0.50), transparent 56%),
            linear-gradient(135deg, rgba(255, 220, 120, 0.055) 0 8%, transparent 8% 16%, rgba(0, 0, 0, 0.08) 16% 24%, transparent 24% 32%),
            #08291f;
          background-size: auto, auto, auto, 56px 56px, auto;
        }

        .balatro-inspired-bg::before {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(circle, rgba(255, 230, 140, 0.10) 1px, transparent 1.6px),
            radial-gradient(circle, rgba(0, 0, 0, 0.22) 1px, transparent 1.7px),
            repeating-linear-gradient(45deg, rgba(255, 219, 115, 0.045) 0px, rgba(255, 219, 115, 0.045) 2px, transparent 2px, transparent 16px),
            repeating-linear-gradient(-45deg, rgba(95, 255, 190, 0.035) 0px, rgba(95, 255, 190, 0.035) 2px, transparent 2px, transparent 18px);
          background-position: 0 0, 5px 5px, 0 0, 0 0;
          background-size: 10px 10px, 10px 10px, 42px 42px, 46px 46px;
          opacity: 0.78;
          mix-blend-mode: screen;
        }

        .balatro-inspired-bg::after {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(90deg, rgba(0,0,0,0.32), transparent 18%, transparent 82%, rgba(0,0,0,0.32)),
            linear-gradient(180deg, rgba(0,0,0,0.28), transparent 18%, transparent 78%, rgba(0,0,0,0.42));
        }

        .bg-felt-symbols {
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          opacity: 0.18;
        }

        .bg-felt-symbols span {
          position: absolute;
          color: rgba(255, 238, 180, 0.34);
          font-weight: 900;
          line-height: 1;
          text-shadow: 4px 4px 0 rgba(0,0,0,0.22);
          transform: rotate(var(--r));
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

        .card-image-shell {
          transform: none !important;
          line-height: 0;
          background: transparent !important;
          box-shadow: none !important;
        }

        .card-image-direct {
          transform: none !important;
          position: static !important;
          object-position: center center;
          object-fit: contain;
          background: transparent !important;
          image-rendering: auto;
        }

        .board-card-inner {
          transform: none !important;
          overflow: visible;
          background: transparent !important;
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

        /* === NUTS LOGO MATCH THEME ===================================== */
        .nuts-logo-img {
          image-rendering: auto;
          filter:
            drop-shadow(0 4px 0 #4a2307)
            drop-shadow(0 8px 0 rgba(2, 8, 6, 0.62))
            drop-shadow(0 0 12px rgba(245, 181, 68, 0.22));
          mix-blend-mode: normal;
        }

        .nuts-wordmark-stack {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          line-height: 1;
        }

        .nuts-wordmark-sub {
          margin-top: -4px;
          margin-left: 8px;
          color: #87c77b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.33em;
          text-shadow: 3px 3px 0 #020806;
        }

        .nuts-pixel .table-frame {
          background:
            radial-gradient(circle at 14% 18%, rgba(255, 211, 103, 0.12), transparent 25%),
            radial-gradient(circle at 82% 22%, rgba(41, 125, 87, 0.18), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.38)),
            #062b22 !important;
          box-shadow:
            9px 9px 0 #020806,
            0 0 0 2px rgba(255, 213, 95, 0.14),
            inset 0 0 46px rgba(0,0,0,0.42) !important;
        }

        .nuts-pixel .table-frame::before {
          border-color: rgba(241, 181, 59, 0.86) !important;
          box-shadow:
            0 2px 0 #3b2107,
            0 0 18px rgba(241, 181, 59, 0.18),
            inset 0 0 0 2px rgba(3, 22, 14, 0.82) !important;
        }

        .nuts-pixel header.pixel-inner {
          background:
            linear-gradient(180deg, rgba(16, 76, 57, 0.94), rgba(3, 38, 30, 0.98)),
            radial-gradient(circle at 15% 35%, rgba(245, 181, 68, 0.14), transparent 28%) !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            inset 0 0 0 3px #05150f,
            inset 0 0 0 6px rgba(241, 181, 59, 0.28),
            inset 0 -18px 26px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel header.pixel-inner::after {
          content: "♣  ♠   ♦  ♠   ♣";
          pointer-events: none;
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 2.4rem;
          color: rgba(99, 178, 104, 0.16);
          font-size: clamp(26px, 3.8vw, 58px);
          font-weight: 900;
          letter-spacing: 0.22em;
          text-shadow: 3px 3px 0 rgba(0,0,0,0.25);
          z-index: 0;
        }

        .nuts-pixel .portrait-board-wrap,
        .nuts-pixel .queue-panel,
        .nuts-pixel .queue-card-well,
        .nuts-pixel .slot-surface {
          background:
            radial-gradient(circle at 22% 18%, rgba(112, 190, 124, 0.10), transparent 26%),
            linear-gradient(145deg, rgba(255,255,255,0.045), rgba(0,0,0,0.30)),
            #06261f !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            0 0 0 2px rgba(241, 181, 59, 0.16) inset,
            0 0 28px rgba(0,0,0,0.38) inset !important;
        }

        .nuts-pixel .balatro-inspired-bg,
        .nuts-pixel.felt-bg,
        .balatro-inspired-bg {
          background:
            radial-gradient(circle at 18% 14%, rgba(241, 181, 59, 0.14), transparent 26%),
            radial-gradient(circle at 82% 18%, rgba(27, 94, 64, 0.28), transparent 32%),
            radial-gradient(circle at 50% 95%, rgba(0,0,0,0.54), transparent 56%),
            linear-gradient(135deg, rgba(255, 218, 111, 0.045) 0 9%, transparent 9% 18%, rgba(0,0,0,0.08) 18% 27%, transparent 27% 36%),
            #041b17 !important;
          background-size: auto, auto, auto, 64px 64px, auto !important;
        }

        .nuts-pixel .bg-felt-symbols {
          opacity: 0.24 !important;
        }

        .nuts-pixel .bg-felt-symbols span {
          color: rgba(102, 177, 101, 0.42) !important;
          text-shadow: 4px 4px 0 rgba(0,0,0,0.30) !important;
        }

        .nuts-pixel button {
          border-color: #05150f !important;
          box-shadow:
            5px 5px 0 #020806,
            inset 0 0 0 2px rgba(255,255,255,0.18),
            inset 0 -8px 12px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel .pixel-hard-sm,
        .nuts-pixel .pixel-hard {
          image-rendering: pixelated;
        }

        .nuts-pixel .card-image-shell {
          filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.58));
        }

        @media (max-width: 640px) {
          .nuts-logo-img {
            max-width: min(44vw, 210px) !important;
          }
        }


        /* === NUTS LOGO MATCH THEME ===================================== */
        .nuts-logo-img {
          image-rendering: auto;
          filter:
            drop-shadow(0 4px 0 #4a2307)
            drop-shadow(0 8px 0 rgba(2, 8, 6, 0.62))
            drop-shadow(0 0 12px rgba(245, 181, 68, 0.22));
          mix-blend-mode: normal;
        }

        .nuts-wordmark-stack {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          line-height: 1;
        }

        .nuts-wordmark-sub {
          margin-top: -4px;
          margin-left: 8px;
          color: #87c77b;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.33em;
          text-shadow: 3px 3px 0 #020806;
        }

        .nuts-pixel .table-frame {
          background:
            radial-gradient(circle at 14% 18%, rgba(255, 211, 103, 0.12), transparent 25%),
            radial-gradient(circle at 82% 22%, rgba(41, 125, 87, 0.18), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,0.035), rgba(0,0,0,0.38)),
            #062b22 !important;
          box-shadow:
            9px 9px 0 #020806,
            0 0 0 2px rgba(255, 213, 95, 0.14),
            inset 0 0 46px rgba(0,0,0,0.42) !important;
        }

        .nuts-pixel .table-frame::before {
          border-color: rgba(241, 181, 59, 0.86) !important;
          box-shadow:
            0 2px 0 #3b2107,
            0 0 18px rgba(241, 181, 59, 0.18),
            inset 0 0 0 2px rgba(3, 22, 14, 0.82) !important;
        }

        .nuts-pixel header.pixel-inner {
          background:
            linear-gradient(180deg, rgba(16, 76, 57, 0.94), rgba(3, 38, 30, 0.98)),
            radial-gradient(circle at 15% 35%, rgba(245, 181, 68, 0.14), transparent 28%) !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            inset 0 0 0 3px #05150f,
            inset 0 0 0 6px rgba(241, 181, 59, 0.28),
            inset 0 -18px 26px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel header.pixel-inner::after {
          content: "♣  ♠   ♦  ♠   ♣";
          pointer-events: none;
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 2.4rem;
          color: rgba(99, 178, 104, 0.16);
          font-size: clamp(26px, 3.8vw, 58px);
          font-weight: 900;
          letter-spacing: 0.22em;
          text-shadow: 3px 3px 0 rgba(0,0,0,0.25);
          z-index: 0;
        }

        .nuts-pixel .portrait-board-wrap,
        .nuts-pixel .queue-panel,
        .nuts-pixel .queue-card-well,
        .nuts-pixel .slot-surface {
          background:
            radial-gradient(circle at 22% 18%, rgba(112, 190, 124, 0.10), transparent 26%),
            linear-gradient(145deg, rgba(255,255,255,0.045), rgba(0,0,0,0.30)),
            #06261f !important;
          border-color: #05150f !important;
          box-shadow:
            6px 6px 0 #020806,
            0 0 0 2px rgba(241, 181, 59, 0.16) inset,
            0 0 28px rgba(0,0,0,0.38) inset !important;
        }

        .nuts-pixel .balatro-inspired-bg,
        .nuts-pixel.felt-bg,
        .balatro-inspired-bg {
          background:
            radial-gradient(circle at 18% 14%, rgba(241, 181, 59, 0.14), transparent 26%),
            radial-gradient(circle at 82% 18%, rgba(27, 94, 64, 0.28), transparent 32%),
            radial-gradient(circle at 50% 95%, rgba(0,0,0,0.54), transparent 56%),
            linear-gradient(135deg, rgba(255, 218, 111, 0.045) 0 9%, transparent 9% 18%, rgba(0,0,0,0.08) 18% 27%, transparent 27% 36%),
            #041b17 !important;
          background-size: auto, auto, auto, 64px 64px, auto !important;
        }

        .nuts-pixel .bg-felt-symbols {
          opacity: 0.24 !important;
        }

        .nuts-pixel .bg-felt-symbols span {
          color: rgba(102, 177, 101, 0.42) !important;
          text-shadow: 4px 4px 0 rgba(0,0,0,0.30) !important;
        }

        .nuts-pixel button {
          border-color: #05150f !important;
          box-shadow:
            5px 5px 0 #020806,
            inset 0 0 0 2px rgba(255,255,255,0.18),
            inset 0 -8px 12px rgba(0,0,0,0.24) !important;
        }

        .nuts-pixel .pixel-hard-sm,
        .nuts-pixel .pixel-hard {
          image-rendering: pixelated;
        }

        .nuts-pixel .card-image-shell {
          filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.58));
        }

        @media (max-width: 640px) {
          .nuts-logo-img {
            max-width: min(44vw, 210px) !important;
          }
        }

      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(245,181,68,0.14),transparent_28%),radial-gradient(circle_at_88%_22%,rgba(90,255,190,0.08),transparent_32%),radial-gradient(circle_at_50%_95%,rgba(0,0,0,0.36),transparent_54%)]" />

      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="bg-felt-symbols" aria-hidden="true">
        <span style={{ left: "7%", top: "12%", fontSize: "44px", ["--r" as string]: "-12deg" }}>♠</span>
        <span style={{ left: "86%", top: "15%", fontSize: "38px", ["--r" as string]: "16deg" }}>♦</span>
        <span style={{ left: "14%", top: "78%", fontSize: "36px", ["--r" as string]: "14deg" }}>♣</span>
        <span style={{ left: "78%", top: "80%", fontSize: "46px", ["--r" as string]: "-10deg" }}>♥</span>
        <span style={{ left: "48%", top: "8%", fontSize: "28px", ["--r" as string]: "8deg" }}>A</span>
        <span style={{ left: "54%", top: "86%", fontSize: "30px", ["--r" as string]: "-8deg" }}>K</span>
      </div>

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

            <div className="relative z-10 flex min-h-[52px] items-center px-1.5 sm:min-h-[68px] sm:px-2">
              <img
                src={NUTS_LOGO_SRC}
                alt="NUTS GRID POKER"
                draggable={false}
                className="nuts-logo-img h-auto max-h-[78px] w-[230px] select-none object-contain sm:max-h-[88px] sm:w-[300px] lg:w-[340px]"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
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
                              ? "border-[#061811] bg-transparent p-0 shadow-[4px_4px_0_#04120d]"
                              : "slot-surface border-[#061811] shadow-[3px_3px_0_#04120d]",
                            canPlace
                              ? "cursor-pointer shadow-[0_0_0_3px_#f5d06f,4px_4px_0_#04120d] hover:-translate-y-1 hover:brightness-125"
                              : "",
                            !cell && !canPlace ? "hover:bg-[#1c4639]" : "",
                            isHighlighted
                              ? "z-20 bg-transparent shadow-[0_0_0_2px_#f5d06f,0_0_10px_rgba(255,239,122,0.38),4px_4px_0_#000]"
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
                              <div className="board-card-inner mx-auto grid h-full max-h-full aspect-[5/7] w-full max-w-[90%] place-items-center bg-transparent">
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
                    className="w-16 shrink-0 rotate-[-2deg] bg-transparent p-0 sm:w-20 lg:w-24 xl:w-28"
                    style={{ aspectRatio: "5 / 7" }}
                  >
                    {game.hand[0] ? (
                      <CardFace card={game.hand[0]} size="small" />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg bg-transparent text-center text-xs font-black text-white/50">
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