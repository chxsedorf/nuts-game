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
  priority: number;
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
  // Pair: combo + small score, no clear.
  pair: 10,

  // Three Card: combo + score + clear.
  three: 55,

  // Straight: combo + medium score + clear.
  straight: 85,

  // Full House: combo + large score + clear.
  fullHouse: 220,
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
    return `HAND ${baseScore} × COMBO ${combo} × ${multiHandBonus.toFixed(2)} + ${milestoneBonus} BONUS`;
  }

  if (handCount >= 2) {
    return `HAND ${baseScore} × COMBO ${combo} × ${multiHandBonus.toFixed(2)}`;
  }

  return `HAND ${baseScore} × COMBO ${combo}`;
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

function keepGameViewportAtTop(duration = 900) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const scrollingElement = document.scrollingElement || document.documentElement;
  const endAt = performance.now() + duration;

  const snap = () => {
    window.scrollTo(0, 0);
    scrollingElement.scrollTop = 0;

    if (performance.now() < endAt) {
      window.requestAnimationFrame(snap);
    }
  };

  window.requestAnimationFrame(snap);
}

function getCardColor(card: Card): string {
  if (card.suit === "heart" || card.suit === "diamond") {
    return "text-red-600";
  }

  return "text-blue-950";
}


const CARD_ASSET_VERSION = "v11";
const LOGO_ASSET_VERSION = "v2";
const UI_ASSET_VERSION = "v2";
const NUTS_LOGO_SRC = `/logo/nuts-logo-sign.png?${LOGO_ASSET_VERSION}`;
const SOLO_BUTTON_SRC = `/ui/solo-play-button.png?${UI_ASSET_VERSION}`;
const DUEL_BUTTON_SRC = `/ui/duel-mode-button.png?${UI_ASSET_VERSION}`;
const RESTART_BUTTON_SRC = `/ui/restart-pixel-button-uniform.png?${UI_ASSET_VERSION}`;
const HOME_BUTTON_SRC = `/ui/home-pixel-button-uniform.png?${UI_ASSET_VERSION}`;
const HOME_BGM_SRC = "/audio/home-bgm.mp3";
const PLAY_BGM_SRC = "/audio/play-bgm.mp3";
const GAME_OVER_TITLE_SRC = "/ui/game-over-title.png";
const BGM_OUTPUT_GAIN = 0.62;

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

/**
 * NUTS hand detection rebuilt from scratch.
 *
 * Rules are intentionally small and strict:
 * - Only horizontal and vertical contiguous card runs are checked.
 * - A is normalized to 1. J/Q/K are 11/12/13.
 * - Pair: exactly 2 same ranks, must include the newly placed card, scores only.
 * - Three Card: exactly 3 same ranks, must include the newly placed card, clears.
 * - Straight: exactly 3 consecutive ranks, must include the newly placed card, clears.
 * - Full House: exactly 5 cards with counts 3 + 2, must include the newly placed card, clears.
 *
 * This prevents the old false positives such as:
 * - 1,2 being treated as Pair
 * - 1,3 being treated as Pair
 * - 1,2,2 being treated as Three Card
 */
type ExactHandKind = "Pair" | "Three Card" | "Straight" | "Full House";

type ExactHandCandidate = {
  kind: ExactHandKind;
  cards: LineCard[];
  scorePerCard: number;
  shouldClear: boolean;
  priority: number;
};

const exactHandConfig: Record<
  ExactHandKind,
  {
    scorePerCard: number;
    shouldClear: boolean;
    priority: number;
  }
> = {
  Pair: {
    scorePerCard: scoreTable.pair,
    shouldClear: false,
    priority: 10,
  },
  "Three Card": {
    scorePerCard: scoreTable.three,
    shouldClear: true,
    priority: 30,
  },
  Straight: {
    scorePerCard: scoreTable.straight,
    shouldClear: true,
    priority: 40,
  },
  "Full House": {
    scorePerCard: scoreTable.fullHouse,
    shouldClear: true,
    priority: 70,
  },
};

function normalizeRankValue(card: Card): number {
  const rankText = String(card.rank ?? "").trim().toUpperCase();
  const numericValue = Number(card.value);

  // The game displays Ace as 1. Keep every Ace representation identical.
  if (
    rankText === "A" ||
    rankText === "1" ||
    rankText === "ACE" ||
    numericValue === 14 ||
    numericValue === 1
  ) {
    return 1;
  }

  if (rankText === "J" || rankText === "JACK") return 11;
  if (rankText === "Q" || rankText === "QUEEN") return 12;
  if (rankText === "K" || rankText === "KING") return 13;

  const fromRankText = Number(rankText);
  if (Number.isInteger(fromRankText)) return fromRankText;

  if (Number.isInteger(numericValue)) return numericValue;

  return Number.NaN;
}

function getRankCounts(cards: LineCard[]): Map<number, number> {
  const counts = new Map<number, number>();

  for (const item of cards) {
    const rankValue = normalizeRankValue(item.card);
    if (!Number.isInteger(rankValue)) continue;
    counts.set(rankValue, (counts.get(rankValue) ?? 0) + 1);
  }

  return counts;
}

function isExactPair(cards: LineCard[]): boolean {
  if (cards.length !== 2) return false;

  const counts = getRankCounts(cards);
  return counts.size === 1 && [...counts.values()][0] === 2;
}

function isExactThreeCard(cards: LineCard[]): boolean {
  if (cards.length !== 3) return false;

  const counts = getRankCounts(cards);
  return counts.size === 1 && [...counts.values()][0] === 3;
}

function isExactStraight(cards: LineCard[]): boolean {
  if (cards.length !== 3) return false;

  const values = cards
    .map((item) => normalizeRankValue(item.card))
    .sort((a, b) => a - b);

  if (values.some((value) => !Number.isInteger(value))) return false;
  if (new Set(values).size !== 3) return false;

  return values[1] === values[0] + 1 && values[2] === values[1] + 1;
}

function isExactFullHouse(cards: LineCard[]): boolean {
  if (cards.length !== 5) return false;

  const counts = [...getRankCounts(cards).values()].sort((a, b) => a - b);
  return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

function makeExactCandidate(kind: ExactHandKind, cards: LineCard[]): ExactHandCandidate {
  const config = exactHandConfig[kind];

  return {
    kind,
    cards,
    scorePerCard: config.scorePerCard,
    shouldClear: config.shouldClear,
    priority: config.priority,
  };
}

function classifyExactWindow(cards: LineCard[]): ExactHandCandidate | null {
  if (cards.length === 5 && isExactFullHouse(cards)) {
    return makeExactCandidate("Full House", cards);
  }

  if (cards.length === 3) {
    if (isExactThreeCard(cards)) return makeExactCandidate("Three Card", cards);
    if (isExactStraight(cards)) return makeExactCandidate("Straight", cards);
    return null;
  }

  if (cards.length === 2 && isExactPair(cards)) {
    return makeExactCandidate("Pair", cards);
  }

  return null;
}

function createHandResultFromCandidate(candidate: ExactHandCandidate): HandResult {
  return {
    name: candidate.kind,
    score: candidate.scorePerCard * candidate.cards.length,
    cards: toPositions(candidate.cards),
    shouldClear: candidate.shouldClear,
    priority: candidate.priority,
  };
}

function getResultKey(result: HandResult): string {
  return result.cards
    .map((cardPosition) => keyOf(cardPosition.row, cardPosition.col))
    .sort()
    .join("|");
}

function addUniqueResult(results: HandResult[], result: HandResult) {
  const resultKey = getResultKey(result);

  const alreadyExists = results.some(
    (existing) => existing.name === result.name && getResultKey(existing) === resultKey
  );

  if (!alreadyExists) {
    results.push(result);
  }
}

function resultContains(parent: HandResult, child: HandResult): boolean {
  const parentKeys = new Set(
    parent.cards.map((cardPosition) => keyOf(cardPosition.row, cardPosition.col))
  );

  return child.cards.every((cardPosition) =>
    parentKeys.has(keyOf(cardPosition.row, cardPosition.col))
  );
}

function resultOverlapsBeyondPlacedCell(
  a: HandResult,
  b: HandResult,
  placedRow: number,
  placedCol: number
): boolean {
  const placedKey = keyOf(placedRow, placedCol);
  const aKeys = new Set(a.cards.map((cardPosition) => keyOf(cardPosition.row, cardPosition.col)));

  return b.cards.some((cardPosition) => {
    const cardKey = keyOf(cardPosition.row, cardPosition.col);
    return cardKey !== placedKey && aKeys.has(cardKey);
  });
}

function removeContainedLowerPriorityResults(results: HandResult[]): HandResult[] {
  return results.filter((result) => {
    return !results.some((other) => {
      if (other === result) return false;
      if (other.priority <= result.priority) return false;
      return resultContains(other, result);
    });
  });
}

function keepBestNonOverlappingResults(results: HandResult[], placedRow: number, placedCol: number): HandResult[] {
  const sortedResults = [...removeContainedLowerPriorityResults(results)].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;

    const aTouchesPlaced = a.cards.some(
      (cardPosition) => cardPosition.row === placedRow && cardPosition.col === placedCol
    );
    const bTouchesPlaced = b.cards.some(
      (cardPosition) => cardPosition.row === placedRow && cardPosition.col === placedCol
    );

    if (Number(bTouchesPlaced) !== Number(aTouchesPlaced)) {
      return Number(bTouchesPlaced) - Number(aTouchesPlaced);
    }

    if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length;

    return getResultKey(a).localeCompare(getResultKey(b));
  });

  const accepted: HandResult[] = [];

  for (const result of sortedResults) {
    if (
      accepted.some((existing) =>
        resultOverlapsBeyondPlacedCell(existing, result, placedRow, placedCol)
      )
    ) {
      continue;
    }

    accepted.push(result);
  }

  return accepted.sort((a, b) => b.priority - a.priority || getResultKey(a).localeCompare(getResultKey(b)));
}

function getContiguousSegmentThroughCell(
  board: Board,
  row: number,
  col: number,
  dRow: number,
  dCol: number
): LineCard[] {
  const segment: LineCard[] = [];
  let startRow = row;
  let startCol = col;

  while (
    startRow - dRow >= 0 &&
    startRow - dRow < BOARD_SIZE &&
    startCol - dCol >= 0 &&
    startCol - dCol < BOARD_SIZE &&
    board[startRow - dRow][startCol - dCol]
  ) {
    startRow -= dRow;
    startCol -= dCol;
  }

  let currentRow = startRow;
  let currentCol = startCol;

  while (
    currentRow >= 0 &&
    currentRow < BOARD_SIZE &&
    currentCol >= 0 &&
    currentCol < BOARD_SIZE &&
    board[currentRow][currentCol]
  ) {
    segment.push({
      row: currentRow,
      col: currentCol,
      card: board[currentRow][currentCol] as Card,
    });

    currentRow += dRow;
    currentCol += dCol;
  }

  return segment;
}

function evaluateSegmentThroughPlacedCard(
  segment: LineCard[],
  placedRow: number,
  placedCol: number
): HandResult[] {
  const candidates: HandResult[] = [];
  const windowSizes = [5, 3, 2];

  for (const windowSize of windowSizes) {
    if (segment.length < windowSize) continue;

    for (let startIndex = 0; startIndex + windowSize <= segment.length; startIndex++) {
      const windowCards = segment.slice(startIndex, startIndex + windowSize);

      // A move can only trigger a hand that actually contains the newly placed card.
      // This eliminates repeated scoring from old pairs/triples elsewhere on the line.
      if (!includesPlaced(windowCards, placedRow, placedCol)) continue;

      const candidate = classifyExactWindow(windowCards);
      if (!candidate) continue;

      addUniqueResult(candidates, createHandResultFromCandidate(candidate));
    }
  }

  return keepBestNonOverlappingResults(candidates, placedRow, placedCol);
}

function evaluateBoard(board: Board, row: number, col: number): HandResult[] {
  const horizontalSegment = getContiguousSegmentThroughCell(board, row, col, 0, 1);
  const verticalSegment = getContiguousSegmentThroughCell(board, row, col, 1, 0);
  const results: HandResult[] = [];

  for (const result of evaluateSegmentThroughPlacedCard(horizontalSegment, row, col)) {
    addUniqueResult(results, result);
  }

  for (const result of evaluateSegmentThroughPlacedCard(verticalSegment, row, col)) {
    addUniqueResult(results, result);
  }

  return keepBestNonOverlappingResults(results, row, col);
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
          appearance: none;
          border: 0;
          background: transparent;
          padding: 0;
          margin: 0;
          cursor: pointer;
          width: 100%;
          display: block;
          transition: transform 120ms ease, filter 120ms ease;
        }

        .home-main-button:hover {
          transform: translateY(-3px);
          filter: brightness(1.06) saturate(1.05);
        }

        .home-main-button:active {
          transform: translateY(1px) scale(0.995);
          filter: brightness(0.98);
        }

        .home-mode-button-img {
          display: block;
          width: 100%;
          height: auto;
          max-height: 118px;
          object-fit: contain;
          image-rendering: pixelated;
          filter:
            drop-shadow(8px 8px 0 #020806)
            drop-shadow(0 0 14px rgba(242,184,74,0.16));
          user-select: none;
          pointer-events: none;
        }

        @media (max-width: 640px) {
          .home-mode-button-img {
            max-height: 94px;
          }
        }

        .home-info-box {
          background: linear-gradient(180deg, #0c392b, #061b15);
          box-shadow: 5px 5px 0 #020806, inset 0 0 0 2px rgba(242,184,74,0.16);
        }

        .home-privacy-button {
          position: relative;
          overflow: hidden;
          border: 3px solid #06140f;
          background: linear-gradient(180deg, #125442, #0a3027);
          color: #f7d17a;
          box-shadow:
            4px 4px 0 #020806,
            inset 0 0 0 2px rgba(242,184,74,0.18);
          transition: transform 120ms ease, filter 120ms ease;
        }

        .home-privacy-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .privacy-modal-panel {
          background:
            radial-gradient(circle at 50% 0%, rgba(242,184,74,0.12), transparent 34%),
            linear-gradient(180deg, #0d3e30, #061b15);
          box-shadow:
            10px 10px 0 #020806,
            inset 0 0 0 3px rgba(242,184,74,0.18),
            inset 0 0 38px rgba(0,0,0,0.40);
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
      
        /* NUTS unified pixel-art polish: stronger dot texture, chunky borders, casino-gold highlights. */
        .nuts-pixel,
        .nuts-pixel * {
          image-rendering: pixelated;
        }

        .home-simple-screen,
        .balatro-inspired-bg {
          background-image:
            radial-gradient(circle at 12px 12px, rgba(245,208,111,0.075) 1px, transparent 2px),
            radial-gradient(circle at 32px 28px, rgba(53,182,106,0.055) 1px, transparent 2px),
            repeating-linear-gradient(45deg, rgba(255,226,128,0.035) 0 2px, transparent 2px 14px),
            linear-gradient(180deg, rgba(5,25,20,0.25), rgba(0,0,0,0.18));
          background-size: 44px 44px, 52px 52px, 32px 32px, auto;
        }

        .home-simple-screen::after,
        .balatro-inspired-bg::after {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 1;
          opacity: 0.16;
          background:
            linear-gradient(rgba(255,244,207,0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,244,207,0.10) 1px, transparent 1px);
          background-size: 6px 6px;
          mix-blend-mode: overlay;
        }

        .home-simple-screen > *,
        .balatro-inspired-bg > * {
          position: relative;
          z-index: 2;
        }

        .pixel-hard,
        .pixel-hard-sm,
        .table-frame,
        .home-card-panel,
        .queue-panel,
        .gameover-card,
        .result-score-panel,
        .result-score-window {
          border-style: solid !important;
          image-rendering: pixelated;
        }

        .table-frame,
        .home-card-panel,
        .queue-panel,
        .gameover-card,
        .result-score-panel {
          background-image:
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            radial-gradient(circle at 50% 0%, rgba(240,165,54,0.10), transparent 34%) !important;
          background-size: 8px 8px, 8px 8px, auto !important;
        }

        .table-frame::before,
        .home-card-panel::before,
        .queue-panel::before,
        .gameover-card::before,
        .result-score-panel::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 6px;
          border: 2px dashed rgba(240,165,54,0.30);
          opacity: 0.72;
        }

        .portrait-board {
          background-image:
            linear-gradient(90deg, rgba(245,208,111,0.07) 1px, transparent 1px),
            linear-gradient(rgba(245,208,111,0.055) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(11,72,55,0.72), rgba(3,16,12,0.98)) !important;
          background-size: 10px 10px, 10px 10px, auto !important;
          box-shadow:
            inset 0 0 0 3px #1a4e3e,
            inset 0 0 0 7px rgba(6,24,17,0.72),
            inset 0 0 48px rgba(0,0,0,0.62),
            7px 7px 0 #020806 !important;
        }

        .portrait-board > button,
        .portrait-board > div {
          image-rendering: pixelated;
        }

        .card-image-direct,
        .card-image-shell,
        .now-card-display img,
        .control-image-button img,
        .nuts-logo-img,
        .home-wordmark-img {
          image-rendering: pixelated !important;
        }

        .control-image-button img,
        .home-main-button img,
        .nuts-logo-img,
        .home-wordmark-img,
        .result-score-number {
          filter:
            drop-shadow(4px 4px 0 rgba(2,8,6,0.78))
            drop-shadow(0 0 10px rgba(240,165,54,0.14));
        }

        .stat-score-pop,
        .result-banner,
        .combo-badge,
        .duel-status-title,
        .pixel-score-number {
          text-rendering: geometricPrecision;
          image-rendering: pixelated;
        }

        @media (max-width: 700px) {
          .home-simple-screen::after,
          .balatro-inspired-bg::after {
            opacity: 0.10;
            background-size: 7px 7px;
          }

          .table-frame::before,
          .home-card-panel::before,
          .queue-panel::before,
          .gameover-card::before,
          .result-score-panel::before {
            inset: 5px;
            border-width: 1px;
            opacity: 0.52;
          }

          .portrait-board {
            box-shadow:
              inset 0 0 0 2px #1a4e3e,
              inset 0 0 0 5px rgba(6,24,17,0.72),
              inset 0 0 36px rgba(0,0,0,0.58),
              5px 5px 0 #020806 !important;
          }
        }

        /* Keep GAME OVER as an overlay above the play screen. */
        .balatro-inspired-bg > .gameover-overlay,
        .home-simple-screen > .gameover-overlay,
        .gameover-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 9999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow-y: auto !important;
        }

        .gameover-overlay > * {
          position: absolute;
        }

        .gameover-overlay > .gameover-card {
          position: relative !important;
          z-index: 3 !important;
        }

        /* Normal gameplay stability reset:
           no result element may push/scroll the page, and board cells cannot move the layout. */
        @media (min-width: 768px) {
          html,
          body {
            overflow: hidden !important;
            height: 100% !important;
          }

          .balatro-inspired-bg {
            height: 100dvh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
          }
        }

        html,
        body,
        .balatro-inspired-bg,
        .portrait-frame,
        .portrait-layout-grid,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-queue-panel {
          overflow-anchor: none !important;
          scroll-behavior: auto !important;
        }

        .portrait-frame,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-layout-grid {
          transform: none !important;
          animation: none !important;
        }

        .portrait-board button,
        .portrait-board button:focus,
        .portrait-board button:focus-visible {
          outline: none !important;
          scroll-margin: 0 !important;
        }

        .pixel-hit-cell,
        .pixel-hit-cell *,
        .pixel-hit-cell::before,
        .pixel-hit-cell::after {
          transform: none !important;
        }

        @keyframes boardKick {
          0%, 100% { transform: none; }
        }

        @keyframes clearShake {
          0% { opacity: 1; filter: brightness(1); transform: none; }
          35% { opacity: 1; filter: brightness(1.2); transform: none; }
          70% { opacity: 0.85; filter: brightness(1.05); transform: none; }
          100% { opacity: 0.25; filter: brightness(0.7); transform: none; }
        }

        /* Gameplay viewport pin: prevents the entire game from sliding down during play. */
        @media (min-width: 768px) {
          html,
          body,
          #__next,
          [data-nextjs-scroll-focus-boundary] {
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            overscroll-behavior: none !important;
            scroll-behavior: auto !important;
          }

          .game-fixed-viewport,
          .balatro-inspired-bg {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            transform: none !important;
            translate: none !important;
          }

          .portrait-frame {
            height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }
        }

        .portrait-frame,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-layout-grid,
        .portrait-stack-layout {
          scroll-margin-top: 0 !important;
          scroll-padding-top: 0 !important;
        }

        .portrait-board button,
        .portrait-board button:focus,
        .portrait-board button:focus-visible {
          outline: none !important;
          scroll-margin: 0 !important;
        }

        /* Safe micro shake: visual overlay only, never the game layout or board. */
        .micro-shake-overlay {
          contain: strict;
          transform: translateZ(0);
          animation: microShakeLayer 420ms steps(2, end) both;
        }

        .micro-shake-scan {
          opacity: 0.18;
          background:
            linear-gradient(90deg, transparent, rgba(255,239,122,0.15), transparent),
            repeating-linear-gradient(0deg, rgba(245,208,111,0.18) 0 1px, transparent 1px 7px);
          mix-blend-mode: screen;
          animation: microShakeScan 420ms steps(2, end) both;
        }

        .micro-shake-flash {
          opacity: 0;
          background:
            radial-gradient(circle at 50% 42%, rgba(245,208,111,0.18), transparent 30%),
            radial-gradient(circle at 48% 50%, rgba(110,231,255,0.10), transparent 38%);
          animation: microShakeFlash 420ms ease-out both;
        }

        @keyframes microShakeLayer {
          0% { transform: translate3d(0, 0, 0); }
          16% { transform: translate3d(1px, 0, 0); }
          32% { transform: translate3d(-1px, 0, 0); }
          48% { transform: translate3d(1px, 0, 0); }
          64% { transform: translate3d(-1px, 0, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }

        @keyframes microShakeScan {
          0% { transform: translateX(-2px); opacity: 0; }
          20% { opacity: 0.18; }
          70% { opacity: 0.10; }
          100% { transform: translateX(2px); opacity: 0; }
        }

        @keyframes microShakeFlash {
          0% { opacity: 0; }
          18% { opacity: 1; }
          100% { opacity: 0; }
        }

        .game-fixed-viewport,
        .balatro-inspired-bg,
        .portrait-frame,
        .portrait-layout-grid,
        .portrait-stack-layout,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-queue-panel {
          transform: none !important;
          translate: none !important;
        }

        .portrait-frame,
        .portrait-layout-grid,
        .portrait-stack-layout,
        .portrait-board-wrap,
        .portrait-board {
          animation-name: none !important;
        }

        @keyframes boardKick {
          0%, 100% { transform: none; }
        }

        /* Anti-stuck fix: never lock the BODY with position: fixed; pin only the game root. */
        body {
          position: static !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          width: auto !important;
        }

        .game-fixed-viewport {
          position: fixed !important;
          inset: 0 !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-height: 100dvh !important;
          overflow: hidden !important;
          transform: none !important;
          translate: none !important;
          margin: 0 !important;
        }

        .micro-shake-overlay {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
        }


        /* Settings/Privacy must stay above the fixed game layer. */
        .settings-floating-button,
        .settings-modal-layer,
        .privacy-modal-layer {
          pointer-events: auto !important;
        }

        .settings-floating-button {
          position: fixed !important;
          left: 12px !important;
          bottom: 12px !important;
          z-index: 10000 !important;
          transform: translateZ(0) !important;
        }

        .settings-modal-layer,
        .privacy-modal-layer {
          position: fixed !important;
          inset: 0 !important;
          z-index: 10001 !important;
        }

        /* Stable play viewport: prevents mobile browser chrome/focus from pushing the board down. */
        .game-fixed-viewport {
          position: fixed !important;
          inset: 0 !important;
          height: 100svh !important;
          min-height: 100svh !important;
          max-height: 100svh !important;
          overflow: hidden !important;
          overscroll-behavior: none !important;
          touch-action: manipulation;
        }

        .portrait-board button,
        .queue-card-well,
        .control-image-button {
          touch-action: manipulation;
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
                <div className="relative mx-auto flex h-[220px] max-w-[390px] items-center justify-center sm:h-[245px] lg:h-[275px]">
                  <div className="absolute inset-x-8 bottom-4 h-16 rounded-full bg-black/40 blur-xl" />
                  {menuCards.map((card, index) => {
                    const transforms = ["-rotate-[10deg] -translate-x-20 translate-y-3", "rotate-[2deg] translate-y-0", "rotate-[10deg] translate-x-20 translate-y-4"];
                    return (
                      <div
                        key={card.id}
                        className={`absolute h-40 w-[6.35rem] sm:h-48 sm:w-[7.6rem] ${transforms[index]}`}
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
              </div>

              <div className="grid gap-4">
                <div className="grid gap-3">
                  <button
                    onClick={onStart}
                    className="home-main-button"
                    aria-label="SOLO PLAY"
                  >
                    <img
                      src={SOLO_BUTTON_SRC}
                      alt="SOLO PLAY"
                      draggable={false}
                      className="home-mode-button-img"
                      loading="eager"
                      decoding="sync"
                      fetchPriority="high"
                    />
                  </button>

                  <button
                    onClick={onStartDuel}
                    className="home-main-button"
                    aria-label="DUEL MODE"
                  >
                    <img
                      src={DUEL_BUTTON_SRC}
                      alt="DUEL MODE"
                      draggable={false}
                      className="home-mode-button-img"
                      loading="eager"
                      decoding="sync"
                      fetchPriority="high"
                    />
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(0.65);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.18);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmTrackRef = useRef<string>("");

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    if (screen !== "game") return;

    const html = document.documentElement;
    const body = document.body;
    const scrollingElement = document.scrollingElement || html;

    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlHeight = html.style.height;
    const previousBodyHeight = body.style.height;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    // Always start gameplay at the very top.
    // Do NOT use body position: fixed here. It can visually freeze the page at a shifted offset.
    window.scrollTo(0, 0);
    scrollingElement.scrollTop = 0;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.height = previousHtmlHeight;
      body.style.height = previousBodyHeight;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [screen]);

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

  function getSafeSfxGain(gainValue: number) {
    if (!soundEnabled || sfxVolume <= 0) return 0;
    return Math.max(0.0001, gainValue * sfxVolume);
  }

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
    const safeGain = getSafeSfxGain(gainValue);
    if (safeGain <= 0) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(safeGain, startTime + 0.012);
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
    gainValue: number,
    filterFrequency = 900
  ) {
    const safeGain = getSafeSfxGain(gainValue);
    if (safeGain <= 0) return;

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
    filter.frequency.setValueAtTime(filterFrequency, startTime);

    gain.gain.setValueAtTime(safeGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    source.start(startTime);
    source.stop(startTime + duration);
  }

  function playChord(
    context: AudioContext,
    frequencies: number[],
    startTime: number,
    duration: number,
    gainValue: number,
    type: OscillatorType = "square"
  ) {
    frequencies.forEach((frequency, index) => {
      playNote(
        context,
        frequency,
        startTime + index * 0.018,
        duration + index * 0.015,
        gainValue,
        type
      );
    });
  }

  function playCardSnap(context: AudioContext, startTime: number) {
    playNoise(context, startTime, 0.045, 0.028, 2400);
    playNote(context, 210, startTime, 0.045, 0.028, "square");
    playNote(context, 420, startTime + 0.025, 0.035, 0.018, "triangle");
  }

  function playUiClick(context: AudioContext, startTime: number) {
    playNote(context, 620, startTime, 0.028, 0.025, "square");
    playNote(context, 920, startTime + 0.018, 0.032, 0.018, "triangle");
  }

  function playSuccessJingle(context: AudioContext, startTime: number) {
    playChord(context, [392, 523.25, 659.25], startTime, 0.08, 0.03, "square");
    playChord(context, [523.25, 659.25, 783.99], startTime + 0.08, 0.09, 0.032, "triangle");
    playNote(context, 1046.5, startTime + 0.18, 0.13, 0.038, "triangle");
    playNoise(context, startTime + 0.02, 0.10, 0.018, 3200);
  }

  function playComboUp(context: AudioContext, startTime: number) {
    playNote(context, 440, startTime, 0.055, 0.026, "square");
    playNote(context, 554.37, startTime + 0.045, 0.06, 0.028, "square");
    playNote(context, 659.25, startTime + 0.095, 0.08, 0.032, "triangle");
    playNoise(context, startTime + 0.075, 0.06, 0.010, 2800);
  }

  function playErrorDrop(context: AudioContext, startTime: number) {
    playNote(context, 220, startTime, 0.09, 0.035, "sawtooth");
    playNote(context, 164.81, startTime + 0.07, 0.11, 0.032, "sawtooth");
    playNote(context, 110, startTime + 0.145, 0.13, 0.024, "square");
    playNoise(context, startTime + 0.02, 0.13, 0.012, 700);
  }

  function playGameOverJingle(context: AudioContext, startTime: number) {
    playChord(context, [392, 493.88, 587.33], startTime, 0.11, 0.03, "triangle");
    playChord(context, [329.63, 392, 493.88], startTime + 0.13, 0.13, 0.028, "triangle");
    playNote(context, 196, startTime + 0.30, 0.22, 0.032, "sawtooth");
    playNoise(context, startTime + 0.30, 0.20, 0.012, 520);
  }

  function playSound(sound: SoundName) {
    if (!soundEnabled || sfxVolume <= 0) return;

    const context = getAudioContext();
    if (!context) return;

    const now = context.currentTime;

    if (sound === "place") {
      playCardSnap(context, now);
      return;
    }

    if (sound === "select") {
      playUiClick(context, now);
      return;
    }

    if (sound === "hit") {
      playSuccessJingle(context, now);
      playComboUp(context, now + 0.18);
      return;
    }

    if (sound === "miss") {
      playErrorDrop(context, now);
      return;
    }

    if (sound === "gameover") {
      playGameOverJingle(context, now);
      return;
    }

    if (sound === "start") {
      playChord(context, [261.63, 329.63, 392], now, 0.075, 0.026, "square");
      playChord(context, [329.63, 415.3, 523.25], now + 0.105, 0.10, 0.028, "triangle");
      playNoise(context, now + 0.04, 0.08, 0.012, 2600);
      return;
    }

    if (sound === "restart") {
      playNote(context, 300, now, 0.045, 0.024, "square");
      playNote(context, 420, now + 0.04, 0.045, 0.024, "square");
      playNote(context, 600, now + 0.08, 0.055, 0.024, "triangle");
      return;
    }

    playUiClick(context, now);
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

  function getBgmSource() {
    return screen === "home" ? HOME_BGM_SRC : PLAY_BGM_SRC;
  }

  function getEffectiveBgmVolume() {
    return Math.min(1, Math.max(0, bgmVolume * BGM_OUTPUT_GAIN));
  }

  function pauseBgm(reset = false) {
    if (!bgmAudioRef.current) return;

    bgmAudioRef.current.pause();

    if (reset) {
      bgmAudioRef.current.currentTime = 0;
    }
  }

  function stopBgm() {
    pauseBgm(true);
  }

  function startBgm(nextSource = getBgmSource()) {
    if (typeof window === "undefined") return;
    if (bgmVolume <= 0) return;

    let audio = bgmAudioRef.current;

    if (!audio) {
      audio = new Audio(nextSource);
      audio.loop = true;
      audio.preload = "auto";
      bgmAudioRef.current = audio;
      bgmTrackRef.current = nextSource;
    }

    if (bgmTrackRef.current !== nextSource) {
      audio.pause();
      audio.src = nextSource;
      audio.load();
      bgmTrackRef.current = nextSource;
    }

    audio.loop = true;
    audio.volume = getEffectiveBgmVolume();

    void audio.play().catch(() => {
      // Browser autoplay rules may block playback until the next user gesture.
    });
  }

  useEffect(() => {
    const source = getBgmSource();
    const audio = bgmAudioRef.current;

    if (bgmVolume <= 0 || !bgmEnabled) {
      stopBgm();
      return;
    }

    if (!audio || bgmTrackRef.current !== source) {
      startBgm(source);
      return;
    }

    audio.volume = getEffectiveBgmVolume();
  }, [screen, mode, bgmEnabled, bgmVolume]);

  useEffect(() => {
    function handlePageHidden() {
      pauseBgm(false);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        pauseBgm(false);
        return;
      }

      if (bgmEnabled && bgmVolume > 0) {
        window.setTimeout(() => startBgm(getBgmSource()), 0);
      }
    }

    function handlePageShow() {
      if (bgmEnabled && bgmVolume > 0 && !document.hidden) {
        window.setTimeout(() => startBgm(getBgmSource()), 0);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHidden);
    window.addEventListener("beforeunload", handlePageHidden);
    window.addEventListener("blur", handlePageHidden);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHidden);
      window.removeEventListener("beforeunload", handlePageHidden);
      window.removeEventListener("blur", handlePageHidden);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [bgmEnabled, bgmVolume, screen, mode]);

  useEffect(() => {
    return () => {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current = null;
      }
    };
  }, []);

  function renderPrivacyModal() {
    if (!privacyOpen) return null;

    return (
      <div
        className="privacy-modal-layer fixed inset-0 z-[10001] flex items-center justify-center bg-black/72 p-4"
        style={{ position: "fixed", inset: 0, zIndex: 10001, pointerEvents: "auto" }}
      >
        <div className="max-h-[88svh] w-full max-w-2xl overflow-y-auto rounded-3xl border-[5px] border-[#d9912c] bg-[#09281f] p-5 text-[#fff4cf] shadow-[10px_10px_0_#020806,inset_0_0_0_3px_rgba(242,184,74,0.18)] sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black tracking-[0.18em] text-[#f2b84a] sm:text-2xl">
              PRIVACY POLICY
            </h2>
            <button
              type="button"
              onClick={() => setPrivacyOpen(false)}
              className="rounded-xl border-[3px] border-[#06140f] bg-[#f0a536] px-4 py-2 text-sm font-black text-[#2b1503] shadow-[4px_4px_0_#020806]"
            >
              CLOSE
            </button>
          </div>

          <div className="space-y-4 text-sm leading-7 text-[#d9efe4] sm:text-base">
            <section>
              <h3 className="mb-1 font-black tracking-[0.12em] text-[#f7d17a]">1. DATA COLLECTION</h3>
              <p>NUTS stores gameplay data such as score, best score, sound settings, and game progress in your browser when needed for gameplay.</p>
            </section>
            <section>
              <h3 className="mb-1 font-black tracking-[0.12em] text-[#f7d17a]">2. LOCAL STORAGE</h3>
              <p>Best score and settings may be saved using browser local storage. This data is kept on your device and is used only to improve the game experience.</p>
            </section>
            <section>
              <h3 className="mb-1 font-black tracking-[0.12em] text-[#f7d17a]">3. PERSONAL INFORMATION</h3>
              <p>This game does not require account registration and does not intentionally collect names, email addresses, or other directly identifying information.</p>
            </section>
            <section>
              <h3 className="mb-1 font-black tracking-[0.12em] text-[#f7d17a]">4. CONTACT</h3>
              <p>If this policy is updated, the latest version will be shown from the settings menu.</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  function renderSettingsButtonAndModal() {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            playSound("select");
            setSettingsOpen(true);
          }}
          aria-label="Open settings"
          title="Settings"
          className="settings-floating-button fixed bottom-3 left-3 z-[10000] grid h-12 w-12 place-items-center rounded-xl border-[3px] border-[#06140f] bg-[#0e4a3a] text-2xl font-black text-[#f7d17a] shadow-[5px_5px_0_#020806,inset_0_0_0_2px_rgba(242,184,74,0.18)] transition hover:-translate-y-1 hover:brightness-110 sm:bottom-4 sm:left-4 sm:h-14 sm:w-14 sm:text-3xl"
          style={{ position: "fixed", left: 12, bottom: 12, zIndex: 10000, pointerEvents: "auto", touchAction: "manipulation" }}
        >
          <span aria-hidden="true" className="drop-shadow-[2px_2px_0_#020806]">⚙</span>
        </button>

        {settingsOpen && (
          <div
            className="settings-modal-layer fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4"
            style={{ position: "fixed", inset: 0, zIndex: 10001, pointerEvents: "auto" }}
          >
            <div className="max-h-[88svh] w-full max-w-2xl overflow-y-auto rounded-3xl border-[5px] border-[#d9912c] bg-[#08251d] p-5 text-[#fff4cf] shadow-[10px_10px_0_#020806,inset_0_0_0_3px_rgba(242,184,74,0.16)]">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-xl font-black tracking-[0.18em] text-[#f2b84a]">SETTINGS</h2>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-xl border-[3px] border-[#06140f] bg-[#f0a536] px-4 py-2 text-sm font-black text-[#2b1503] shadow-[4px_4px_0_#020806]"
                >
                  CLOSE
                </button>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-sm font-black tracking-[0.12em] text-[#f7d17a]">
                    <span>SFX VOLUME</span>
                    <span>{Math.round(sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={sfxVolume}
                    onInput={(event) => setSfxVolume(Number(event.currentTarget.value))}
                    className="w-full touch-pan-x accent-[#f0a536]"
                  />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => playSound("place")}
                      className="rounded-lg border-[2px] border-[#06140f] bg-[#123f32] px-2 py-2 text-[10px] font-black tracking-[0.08em] text-[#f7d17a] shadow-[3px_3px_0_#020806]"
                    >
                      PLACE
                    </button>
                    <button
                      type="button"
                      onClick={() => playSound("hit")}
                      className="rounded-lg border-[2px] border-[#06140f] bg-[#123f32] px-2 py-2 text-[10px] font-black tracking-[0.08em] text-[#f7d17a] shadow-[3px_3px_0_#020806]"
                    >
                      HIT
                    </button>
                    <button
                      type="button"
                      onClick={() => playSound("miss")}
                      className="rounded-lg border-[2px] border-[#06140f] bg-[#123f32] px-2 py-2 text-[10px] font-black tracking-[0.08em] text-[#f7d17a] shadow-[3px_3px_0_#020806]"
                    >
                      MISS
                    </button>
                  </div>
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-sm font-black tracking-[0.12em] text-[#f7d17a]">
                    <span>BGM VOLUME</span>
                    <span>{bgmVolume <= 0 ? "OFF" : `${Math.round(bgmVolume * 100)}%`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={bgmVolume}
                    onInput={(event) => {
                      const nextVolume = Number(event.currentTarget.value);
                      setBgmVolume(nextVolume);
                      setBgmEnabled(nextVolume > 0);

                      if (nextVolume > 0) {
                        window.setTimeout(() => startBgm(getBgmSource()), 0);
                      } else {
                        stopBgm();
                      }
                    }}
                    className="w-full touch-pan-x accent-[#20d0b5]"
                  />
                </label>

                <div className="rounded-2xl border-[3px] border-[#06140f] bg-[#0b3328] p-4 shadow-[4px_4px_0_#020806,inset_0_0_0_2px_rgba(242,184,74,0.10)]">
                  <h3 className="mb-3 text-sm font-black tracking-[0.18em] text-[#f2b84a]">
                    HOW TO PLAY
                  </h3>

                  <div className="grid gap-2 text-sm text-[#d9efe4]">
                    <div className="rounded-xl border-[2px] border-[#06140f] bg-[#071b15] p-3 shadow-[3px_3px_0_#020806]">
                      <p className="font-black tracking-[0.12em] text-[#f7d17a]">01 PLACE A CARD</p>
                      <p className="mt-1 text-xs leading-5">空いているマスに、表示されたカードを1枚置きます。</p>
                    </div>
                    <div className="rounded-xl border-[2px] border-[#06140f] bg-[#071b15] p-3 shadow-[3px_3px_0_#020806]">
                      <p className="font-black tracking-[0.12em] text-[#f7d17a]">02 MAKE A HAND</p>
                      <p className="mt-1 text-xs leading-5">縦・横のみで役を作ります。斜めは無効です。</p>
                    </div>
                    <div className="rounded-xl border-[2px] border-[#06140f] bg-[#071b15] p-3 shadow-[3px_3px_0_#020806]">
                      <p className="font-black tracking-[0.12em] text-[#f7d17a]">03 CLEAR & COMBO</p>
                      <p className="mt-1 text-xs leading-5">Three以上の役は消えます。Pairは消えずにコンボをつなぎます。</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border-[3px] border-[#06140f] bg-[#0b3328] p-4 shadow-[4px_4px_0_#020806,inset_0_0_0_2px_rgba(242,184,74,0.10)]">
                  <h3 className="mb-3 text-sm font-black tracking-[0.18em] text-[#f2b84a]">
                    HAND LIST
                  </h3>

                  <div className="grid gap-2 text-xs text-[#d9efe4]">
                    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border-[2px] border-[#06140f] bg-[#071b15] p-3 shadow-[3px_3px_0_#020806]">
                      <div>
                        <p className="font-black tracking-[0.12em] text-[#fff4cf]">PAIR</p>
                        <p className="mt-1 leading-5">同じ数字2枚。消えない。コンボ継続用。</p>
                      </div>
                      <p className="font-black text-[#f7d17a]">+{scoreTable.pair * 2}</p>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border-[2px] border-[#06140f] bg-[#071b15] p-3 shadow-[3px_3px_0_#020806]">
                      <div>
                        <p className="font-black tracking-[0.12em] text-[#fff4cf]">THREE CARD</p>
                        <p className="mt-1 leading-5">同じ数字3枚。役カードが消える。</p>
                      </div>
                      <p className="font-black text-[#f7d17a]">+{scoreTable.three * 3}</p>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border-[2px] border-[#06140f] bg-[#071b15] p-3 shadow-[3px_3px_0_#020806]">
                      <div>
                        <p className="font-black tracking-[0.12em] text-[#fff4cf]">STRAIGHT</p>
                        <p className="mt-1 leading-5">連続した数字3枚。Aは1としても使えます。</p>
                      </div>
                      <p className="font-black text-[#f7d17a]">+{scoreTable.straight * 3}</p>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border-[2px] border-[#06140f] bg-[#071b15] p-3 shadow-[3px_3px_0_#020806]">
                      <div>
                        <p className="font-black tracking-[0.12em] text-[#fff4cf]">FULL HOUSE</p>
                        <p className="mt-1 leading-5">3枚同数字 + 2枚同数字。高得点。</p>
                      </div>
                      <p className="font-black text-[#f7d17a]">+{scoreTable.fullHouse * 5}</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setPrivacyOpen(true);
                  }}
                  className="w-full rounded-xl border-[3px] border-[#06140f] bg-[#125442] px-4 py-3 text-sm font-black tracking-[0.16em] text-[#f7d17a] shadow-[4px_4px_0_#020806]"
                >
                  PRIVACY POLICY
                </button>
              </div>
            </div>
          </div>
        )}

        {renderPrivacyModal()}
      </>
    );
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
    keepGameViewportAtTop();

    if (bgmVolume > 0) {
      setBgmEnabled(true);
      window.setTimeout(() => startBgm(PLAY_BGM_SRC), 0);
    }
  }

  function startDuelGame() {
    playSound("start");
    resetEffects();
    setMode("duel");
    setDuel(createInitialDuelGame());
    setScreen("game");
    keepGameViewportAtTop();

    if (bgmVolume > 0) {
      setBgmEnabled(true);
      window.setTimeout(() => startBgm(PLAY_BGM_SRC), 0);
    }
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

    keepGameViewportAtTop();
    playSound("place");

    const selected = duel.currentCard;
    const newBoard = duel.board.map((boardRow) => [...boardRow]);
    const newOwners = duel.owners.map((ownerRow) => [...ownerRow]);
    newBoard[row][col] = selected;

    // Hand rules:
    // Pair = combo + small score, no clear, newly placed card only.
    // Three/Straight/Full House = combo + score + clear, with board safety scan.
    const results = evaluateBoard(newBoard, row, col);
    const hasHand = results.length > 0;
    const claimResults = results.filter((result) => result.shouldClear);
    const hasClaim = claimResults.length > 0;
    const handTargets = new Set<string>();
    const claimTargets = new Set<string>();

    for (const result of results) {
      for (const cardPosition of result.cards) {
        handTargets.add(keyOf(cardPosition.row, cardPosition.col));
      }
    }

    // DUEL claims follow the same rule as SOLO clearing:
    // Pair gives feedback only. Three Card / Straight / Full House claim cells.
    for (const result of claimResults) {
      for (const cardPosition of result.cards) {
        const targetKey = keyOf(cardPosition.row, cardPosition.col);
        claimTargets.add(targetKey);
        newOwners[cardPosition.row][cardPosition.col] = duel.currentPlayer;
      }
    }

    if (hasClaim) {
      for (const targetKey of claimTargets) {
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
    const handNameText = hasHand ? results.map((result) => result.name).join(" + ") : "";

    const nextBase: DuelState = {
      board: newBoard,
      owners: newOwners,
      deck: nextDeck,
      currentCard: nextCard ?? null,
      currentPlayer: nextPlayer,
      placedCount,
      lastResult: hasClaim
        ? `P${duel.currentPlayer} CLAIMED ${claimTargets.size}`
        : hasHand
        ? `${handNameText} · NO CLAIM`
        : `P${nextPlayer} TURN`,
      lastHandName: handNameText,
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
    setClearingCells(hasClaim ? claimTargets : new Set());
    setResultPulse(hasHand);

    if (hasHand) {
      const bannerId = Date.now() + 1;
      setResultBanner({
        id: bannerId,
        text: hasClaim ? nextBase.lastHandName : `${nextBase.lastHandName} · NO CLAIM`,
        score: hasClaim ? claimTargets.size : 0,
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

    keepGameViewportAtTop();
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

    const nextGameState: GameState = {
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
    };

    if (clearTargets.size > 0) {
      setGame((prev) => ({
        ...prev,
        board: boardBeforeClear,
        selectedHandIndex: 0,
      }));

      window.setTimeout(() => {
        setGame(nextGameState);
      }, 320);
    } else {
      // Pair is a valid hand but does not clear.
      // Update immediately so Pair highlights, score, combo, and banner all appear reliably.
      setGame(nextGameState);
    }

    window.setTimeout(() => {
      setPlacedCell(null);
      setHighlightCells(new Set());
      setClearingCells(new Set());
      setScorePulse(false);
      setComboPulse(false);
      setResultPulse(false);
    }, 760);
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
      <>
        <HomeScreen
          highScore={game.highScore}
          onStart={() => {
            setMode("solo");
            startGame();
          }}
          onStartDuel={startDuelGame}
        />
        {renderSettingsButtonAndModal()}
      </>
    );
  }

  if (mode === "duel") {
    const p1Owned = countOwnedCells(duel.owners, 1);
    const p2Owned = countOwnedCells(duel.owners, 2);
    const emptyCells = duel.board.flat().filter((cell) => cell === null).length;
    const winnerText = p1Owned === p2Owned ? "DRAW" : p1Owned > p2Owned ? "P1 WINS" : "P2 WINS";

    return (
      <main className="nuts-pixel crt-lines felt-bg pixel-dither balatro-inspired-bg game-fixed-viewport fixed inset-0 h-[100svh] min-h-[100svh] w-screen overflow-hidden bg-[#07120f] text-white">
        <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");
        
        
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

      
        @media (min-width: 900px) {
          .duel-shift-up {
            transform: translateY(-58px) !important;
            min-height: calc(100svh + 58px) !important;
            height: calc(100svh + 58px) !important;
          }

          .duel-shift-up .portrait-frame {
            min-height: 0 !important;
            height: calc(100svh + 46px) !important;
          }
        }

        @media (min-width: 900px) and (max-height: 760px) {
          .duel-shift-up {
            transform: translateY(-72px) !important;
            min-height: calc(100svh + 72px) !important;
            height: calc(100svh + 72px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 60px) !important;
          }
        }


        @media (min-width: 900px) {
          .portrait-board-wrap {
            padding-top: 0.45rem !important;
          }

          .portrait-board {
            height: 100% !important;
            max-height: 100% !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 {
            min-height: 0 !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 .duel-status-title {
            font-size: 1.25rem !important;
            line-height: 1 !important;
          }

          .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 button {
            padding-block: 0.45rem !important;
          }
        }


        @media (min-width: 900px) {
          .duel-shift-up {
            transform: translateY(-48px) !important;
            min-height: calc(100svh + 48px) !important;
            height: calc(100svh + 48px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 34px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 106px) !important;
            max-height: calc(100svh - 106px) !important;
            align-items: stretch !important;
          }

          .duel-shift-up .portrait-board-wrap {
            padding: 0.45rem !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .duel-shift-up .portrait-board {
            width: auto !important;
            height: min(calc(100svh - 150px), 100%) !important;
            max-height: calc(100svh - 150px) !important;
            max-width: 100% !important;
            aspect-ratio: 1 / 1 !important;
            flex: 0 0 auto !important;
            margin-inline: auto !important;
          }

          .duel-shift-up .portrait-queue-panel {
            gap: 0.45rem !important;
          }

          .duel-shift-up .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 {
            height: 150px !important;
            max-height: 150px !important;
          }

          .duel-shift-up .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 .duel-status-title {
            font-size: 1.05rem !important;
          }

          .duel-control-buttons button {
            min-height: 38px !important;
            padding-block: 0.55rem !important;
            font-size: 0.9rem !important;
            line-height: 1 !important;
          }
        }

        @media (min-width: 900px) and (max-height: 760px) {
          .duel-shift-up {
            transform: translateY(-58px) !important;
            min-height: calc(100svh + 58px) !important;
            height: calc(100svh + 58px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 44px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 92px) !important;
            max-height: calc(100svh - 92px) !important;
          }

          .duel-shift-up .portrait-board {
            height: min(calc(100svh - 132px), 100%) !important;
            max-height: calc(100svh - 132px) !important;
            gap: 0.25rem !important;
            padding: 0.35rem !important;
          }

          .duel-shift-up .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 {
            height: 124px !important;
            max-height: 124px !important;
          }

          .duel-control-buttons button {
            min-height: 30px !important;
            padding-block: 0.36rem !important;
            font-size: 0.78rem !important;
            border-width: 3px !important;
          }
        }


        /* Final DUEL board fit: show the full bottom frame like SOLO. */
        @media (min-width: 900px) {
          .duel-shift-up {
            transform: translateY(-42px) !important;
            min-height: calc(100svh + 42px) !important;
            height: calc(100svh + 42px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 28px) !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 126px) !important;
            max-height: calc(100svh - 126px) !important;
            min-height: 0 !important;
            align-items: stretch !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-board-wrap {
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            padding: 0.45rem !important;
            overflow: hidden !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .duel-shift-up .portrait-board {
            width: auto !important;
            height: min(calc(100svh - 176px), 100%) !important;
            max-height: calc(100svh - 176px) !important;
            max-width: 100% !important;
            aspect-ratio: 1 / 1 !important;
            flex: 0 0 auto !important;
            margin: 0 auto !important;
            gap: 0.28rem !important;
            padding: 0.42rem !important;
            border-width: 5px !important;
          }

          .duel-shift-up .portrait-side,
          .duel-shift-up .portrait-queue-panel {
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
        }

        @media (min-width: 900px) and (max-height: 760px) {
          .duel-shift-up {
            transform: translateY(-50px) !important;
            min-height: calc(100svh + 50px) !important;
            height: calc(100svh + 50px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 36px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 112px) !important;
            max-height: calc(100svh - 112px) !important;
          }

          .duel-shift-up .portrait-board {
            height: min(calc(100svh - 154px), 100%) !important;
            max-height: calc(100svh - 154px) !important;
            gap: 0.22rem !important;
            padding: 0.34rem !important;
            border-width: 4px !important;
          }
        }

        @media (min-width: 900px) and (max-height: 690px) {
          .duel-shift-up {
            transform: translateY(-54px) !important;
            min-height: calc(100svh + 54px) !important;
            height: calc(100svh + 54px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 102px) !important;
            max-height: calc(100svh - 102px) !important;
          }

          .duel-shift-up .portrait-board {
            height: min(calc(100svh - 142px), 100%) !important;
            max-height: calc(100svh - 142px) !important;
            gap: 0.18rem !important;
            padding: 0.28rem !important;
          }
        }


        /* DUEL: show the entire 5x5 board frame like SOLO. */
        @media (min-width: 900px) {
          .duel-shift-up {
            transform: translateY(-38px) !important;
            min-height: calc(100svh + 38px) !important;
            height: calc(100svh + 38px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 24px) !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-frame > header {
            margin-bottom: 0.45rem !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 122px) !important;
            max-height: calc(100svh - 122px) !important;
            min-height: 0 !important;
            align-items: center !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-stack-layout > div:first-child {
            height: 100% !important;
            min-height: 0 !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-board-wrap {
            height: 100% !important;
            min-height: 0 !important;
            max-height: 100% !important;
            padding: 0.55rem !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
          }

          .duel-shift-up .duel-board-solo-fit {
            width: min(100%, calc(100svh - 218px), 620px) !important;
            height: min(100%, calc(100svh - 218px), 620px) !important;
            max-width: min(100%, calc(100svh - 218px), 620px) !important;
            max-height: min(100%, calc(100svh - 218px), 620px) !important;
            min-width: 0 !important;
            min-height: 0 !important;
            aspect-ratio: 1 / 1 !important;
            flex: 0 0 auto !important;
            margin: auto !important;
            gap: 0.35rem !important;
            padding: 0.55rem !important;
            border-width: 5px !important;
          }

          .duel-shift-up .portrait-side,
          .duel-shift-up .portrait-queue-panel {
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
        }

        @media (min-width: 900px) and (max-height: 760px) {
          .duel-shift-up {
            transform: translateY(-46px) !important;
            min-height: calc(100svh + 46px) !important;
            height: calc(100svh + 46px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 32px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 106px) !important;
            max-height: calc(100svh - 106px) !important;
          }

          .duel-shift-up .duel-board-solo-fit {
            width: min(100%, calc(100svh - 196px), 560px) !important;
            height: min(100%, calc(100svh - 196px), 560px) !important;
            max-width: min(100%, calc(100svh - 196px), 560px) !important;
            max-height: min(100%, calc(100svh - 196px), 560px) !important;
            gap: 0.28rem !important;
            padding: 0.45rem !important;
            border-width: 5px !important;
          }
        }

        @media (min-width: 900px) and (max-height: 690px) {
          .duel-shift-up {
            transform: translateY(-50px) !important;
            min-height: calc(100svh + 50px) !important;
            height: calc(100svh + 50px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            height: calc(100svh - 96px) !important;
            max-height: calc(100svh - 96px) !important;
          }

          .duel-shift-up .duel-board-solo-fit {
            width: min(100%, calc(100svh - 182px), 520px) !important;
            height: min(100%, calc(100svh - 182px), 520px) !important;
            max-width: min(100%, calc(100svh - 182px), 520px) !important;
            max-height: min(100%, calc(100svh - 182px), 520px) !important;
            gap: 0.22rem !important;
            padding: 0.36rem !important;
            border-width: 4px !important;
          }
        }


        /* DUEL: use more horizontal space while keeping the board frame fully visible. */
        @media (min-width: 900px) {
          .duel-shift-up .portrait-stack-layout {
            grid-template-columns: minmax(700px, 1fr) 320px !important;
            gap: 0.65rem !important;
          }

          .duel-shift-up .portrait-board-wrap {
            padding: 0.35rem !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .duel-shift-up .duel-board-solo-fit {
            width: min(100%, calc(100svh - 188px), 690px) !important;
            height: min(100%, calc(100svh - 202px), 640px) !important;
            max-width: min(100%, calc(100svh - 188px), 690px) !important;
            max-height: min(100%, calc(100svh - 202px), 640px) !important;
            aspect-ratio: 1.06 / 1 !important;
            gap: 0.34rem !important;
            padding: 0.45rem !important;
            margin: auto !important;
          }
        }

        @media (min-width: 900px) and (max-height: 760px) {
          .duel-shift-up .portrait-stack-layout {
            grid-template-columns: minmax(660px, 1fr) 305px !important;
            gap: 0.55rem !important;
          }

          .duel-shift-up .duel-board-solo-fit {
            width: min(100%, calc(100svh - 172px), 640px) !important;
            height: min(100%, calc(100svh - 186px), 600px) !important;
            max-width: min(100%, calc(100svh - 172px), 640px) !important;
            max-height: min(100%, calc(100svh - 186px), 600px) !important;
            aspect-ratio: 1.055 / 1 !important;
            gap: 0.26rem !important;
            padding: 0.38rem !important;
          }
        }

        @media (min-width: 900px) and (max-height: 690px) {
          .duel-shift-up .portrait-stack-layout {
            grid-template-columns: minmax(610px, 1fr) 292px !important;
            gap: 0.45rem !important;
          }

          .duel-shift-up .duel-board-solo-fit {
            width: min(100%, calc(100svh - 160px), 600px) !important;
            height: min(100%, calc(100svh - 174px), 560px) !important;
            max-width: min(100%, calc(100svh - 160px), 600px) !important;
            max-height: min(100%, calc(100svh - 174px), 560px) !important;
            aspect-ratio: 1.05 / 1 !important;
            gap: 0.2rem !important;
            padding: 0.3rem !important;
          }
        }


        /* Make the NOW card easier to read in DUEL too. */
        .now-card-display {
          filter: drop-shadow(5px 5px 0 rgba(0,0,0,0.62));
        }

        @media (orientation: portrait), (max-width: 700px) {
          .portrait-queue-panel .queue-card-well {
            min-height: 240px !important;
            padding: 0.85rem !important;
            justify-content: center !important;
          }

          .portrait-queue-panel .queue-card-well .now-card-display {
            width: clamp(92px, 20vw, 128px) !important;
          }

          .portrait-queue-panel .queue-card-well p:nth-of-type(2) {
            font-size: 1.8rem !important;
          }
        }


        /* PC only: make DUEL board larger and easier to read. */
        @media (min-width: 1024px) and (pointer: fine) {
          .duel-shift-up {
            transform: translateY(-34px) !important;
            min-height: calc(100svh + 34px) !important;
            height: calc(100svh + 34px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 20px) !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-frame > header {
            margin-bottom: 0.35rem !important;
          }

          .duel-shift-up .portrait-stack-layout {
            grid-template-columns: minmax(780px, 1fr) 300px !important;
            gap: 0.55rem !important;
            height: calc(100svh - 108px) !important;
            max-height: calc(100svh - 108px) !important;
            align-items: stretch !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-board-wrap {
            padding: 0.35rem !important;
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            justify-content: center !important;
            align-items: center !important;
            overflow: hidden !important;
          }

          .duel-shift-up .duel-board-solo-fit,
          .duel-shift-up .portrait-board {
            width: min(100%, calc(100svh - 136px), 760px) !important;
            height: min(100%, calc(100svh - 148px), 720px) !important;
            max-width: min(100%, calc(100svh - 136px), 760px) !important;
            max-height: min(100%, calc(100svh - 148px), 720px) !important;
            aspect-ratio: 1.06 / 1 !important;
            flex: 0 0 auto !important;
            margin: auto !important;
            gap: 0.38rem !important;
            padding: 0.48rem !important;
            border-width: 5px !important;
          }

          .duel-shift-up .portrait-side,
          .duel-shift-up .portrait-queue-panel {
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-queue-panel {
            gap: 0.4rem !important;
          }

          .duel-shift-up .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 {
            height: 146px !important;
            max-height: 146px !important;
          }
        }

        @media (min-width: 1024px) and (pointer: fine) and (max-height: 760px) {
          .duel-shift-up {
            transform: translateY(-42px) !important;
            min-height: calc(100svh + 42px) !important;
            height: calc(100svh + 42px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 28px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            grid-template-columns: minmax(720px, 1fr) 285px !important;
            height: calc(100svh - 94px) !important;
            max-height: calc(100svh - 94px) !important;
          }

          .duel-shift-up .duel-board-solo-fit,
          .duel-shift-up .portrait-board {
            width: min(100%, calc(100svh - 118px), 700px) !important;
            height: min(100%, calc(100svh - 132px), 660px) !important;
            max-width: min(100%, calc(100svh - 118px), 700px) !important;
            max-height: min(100%, calc(100svh - 132px), 660px) !important;
            gap: 0.28rem !important;
            padding: 0.38rem !important;
          }

          .duel-shift-up .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 {
            height: 124px !important;
            max-height: 124px !important;
          }
        }


        /* PC DUEL stronger board scale: larger, but keep all 4 corners visible. */
        @media (min-width: 1024px) and (pointer: fine) {
          .duel-shift-up {
            transform: translateY(-30px) !important;
            min-height: calc(100svh + 30px) !important;
            height: calc(100svh + 30px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 16px) !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-frame > header {
            margin-bottom: 0.24rem !important;
            padding-block: 0.34rem !important;
          }

          .duel-shift-up .portrait-stack-layout {
            grid-template-columns: minmax(860px, 1fr) 280px !important;
            gap: 0.45rem !important;
            height: calc(100svh - 94px) !important;
            max-height: calc(100svh - 94px) !important;
            align-items: stretch !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-board-wrap {
            padding: 0.25rem !important;
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
          }

          .duel-shift-up .duel-board-solo-fit,
          .duel-shift-up .portrait-board {
            width: min(100%, calc(100svh - 104px), 820px) !important;
            height: min(100%, calc(100svh - 116px), 774px) !important;
            max-width: min(100%, calc(100svh - 104px), 820px) !important;
            max-height: min(100%, calc(100svh - 116px), 774px) !important;
            aspect-ratio: 1.06 / 1 !important;
            flex: 0 0 auto !important;
            margin: auto !important;
            gap: 0.4rem !important;
            padding: 0.42rem !important;
            border-width: 5px !important;
          }

          .duel-shift-up .portrait-side,
          .duel-shift-up .portrait-queue-panel {
            height: 100% !important;
            max-height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }

          .duel-shift-up .portrait-queue-panel {
            gap: 0.34rem !important;
            padding: 0.35rem !important;
          }

          .duel-shift-up .queue-card-well {
            padding: 0.35rem !important;
          }

          .duel-shift-up .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 {
            height: 132px !important;
            max-height: 132px !important;
          }
        }

        @media (min-width: 1024px) and (pointer: fine) and (max-height: 760px) {
          .duel-shift-up {
            transform: translateY(-36px) !important;
            min-height: calc(100svh + 36px) !important;
            height: calc(100svh + 36px) !important;
          }

          .duel-shift-up .portrait-frame {
            height: calc(100svh + 22px) !important;
          }

          .duel-shift-up .portrait-stack-layout {
            grid-template-columns: minmax(800px, 1fr) 268px !important;
            height: calc(100svh - 82px) !important;
            max-height: calc(100svh - 82px) !important;
          }

          .duel-shift-up .duel-board-solo-fit,
          .duel-shift-up .portrait-board {
            width: min(100%, calc(100svh - 90px), 760px) !important;
            height: min(100%, calc(100svh - 104px), 716px) !important;
            max-width: min(100%, calc(100svh - 90px), 760px) !important;
            max-height: min(100%, calc(100svh - 104px), 716px) !important;
            gap: 0.3rem !important;
            padding: 0.34rem !important;
          }

          .duel-shift-up .portrait-queue-panel > .pixel-hard.flex.min-h-0.shrink-0 {
            height: 112px !important;
            max-height: 112px !important;
          }
        }


        /* Image-based casino buttons. */
        .control-image-button {
          display: grid !important;
          place-items: center !important;
          width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: none !important;
          background-color: transparent !important;
          box-shadow: none !important;
          outline: none !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          overflow: visible !important;
          image-rendering: pixelated !important;
        }

        .control-image-button::before,
        .control-image-button::after {
          display: none !important;
          content: none !important;
        }

        .control-image-button img {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
          pointer-events: none !important;
          user-select: none !important;
          image-rendering: pixelated !important;
          background: transparent !important;
          filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.62)) !important;
        }

        .duel-control-buttons,
        .solo-control-buttons {
          align-items: center !important;
        }

        .duel-control-buttons .restart-image-button,
        .solo-control-buttons .restart-image-button,
        .duel-control-buttons .home-image-button,
        .solo-control-buttons .home-image-button {
          aspect-ratio: 2084 / 577 !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        

        @media (orientation: portrait), (max-width: 700px) {
          .solo-control-buttons .control-image-button {
            align-self: center !important;
            width: 100% !important;
          }

          .solo-control-buttons .control-image-button img {
            width: 100% !important;
            max-width: 100% !important;
            max-height: 64px !important;
          }
        }


        /* Final fix: remove every visible frame/background around image buttons. */
        .control-image-button,
        .control-image-button:hover,
        .control-image-button:active,
        .control-image-button:focus,
        .control-image-button:focus-visible {
          appearance: none !important;
          -webkit-appearance: none !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
          line-height: 0 !important;
        }

        .control-image-button img {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
        }

        .duel-control-buttons,
        .solo-control-buttons {
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
          overflow: visible !important;
        }

        .duel-control-buttons .control-image-button,
        .solo-control-buttons .control-image-button {
          width: 100% !important;
          max-width: 100% !important;
        }

        /* FINAL: keep image buttons frameless even before hover/focus. */
        .duel-control-buttons button.control-image-button,
        .solo-control-buttons button.control-image-button,
        .duel-control-buttons button.control-image-button:hover,
        .solo-control-buttons button.control-image-button:hover,
        .duel-control-buttons button.control-image-button:active,
        .solo-control-buttons button.control-image-button:active,
        .duel-control-buttons button.control-image-button:focus,
        .solo-control-buttons button.control-image-button:focus,
        .duel-control-buttons button.control-image-button:focus-visible,
        .solo-control-buttons button.control-image-button:focus-visible {
          appearance: none !important;
          -webkit-appearance: none !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-width: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
          height: auto !important;
          line-height: 0 !important;
          overflow: visible !important;
        }

        .duel-control-buttons button.control-image-button img,
        .solo-control-buttons button.control-image-button img {
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          display: block !important;
        }

        .duel-control-buttons,
        .solo-control-buttons {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-width: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
        }

        /* NUTS unified pixel-art polish: stronger dot texture, chunky borders, casino-gold highlights. */
        .nuts-pixel,
        .nuts-pixel * {
          image-rendering: pixelated;
        }

        .home-simple-screen,
        .balatro-inspired-bg {
          background-image:
            radial-gradient(circle at 12px 12px, rgba(245,208,111,0.075) 1px, transparent 2px),
            radial-gradient(circle at 32px 28px, rgba(53,182,106,0.055) 1px, transparent 2px),
            repeating-linear-gradient(45deg, rgba(255,226,128,0.035) 0 2px, transparent 2px 14px),
            linear-gradient(180deg, rgba(5,25,20,0.25), rgba(0,0,0,0.18));
          background-size: 44px 44px, 52px 52px, 32px 32px, auto;
        }

        .home-simple-screen::after,
        .balatro-inspired-bg::after {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 1;
          opacity: 0.16;
          background:
            linear-gradient(rgba(255,244,207,0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,244,207,0.10) 1px, transparent 1px);
          background-size: 6px 6px;
          mix-blend-mode: overlay;
        }

        .home-simple-screen > *,
        .balatro-inspired-bg > * {
          position: relative;
          z-index: 2;
        }

        .pixel-hard,
        .pixel-hard-sm,
        .table-frame,
        .home-card-panel,
        .queue-panel,
        .gameover-card,
        .result-score-panel,
        .result-score-window {
          border-style: solid !important;
          image-rendering: pixelated;
        }

        .table-frame,
        .home-card-panel,
        .queue-panel,
        .gameover-card,
        .result-score-panel {
          background-image:
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            radial-gradient(circle at 50% 0%, rgba(240,165,54,0.10), transparent 34%) !important;
          background-size: 8px 8px, 8px 8px, auto !important;
        }

        .table-frame::before,
        .home-card-panel::before,
        .queue-panel::before,
        .gameover-card::before,
        .result-score-panel::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 6px;
          border: 2px dashed rgba(240,165,54,0.30);
          opacity: 0.72;
        }

        .portrait-board {
          background-image:
            linear-gradient(90deg, rgba(245,208,111,0.07) 1px, transparent 1px),
            linear-gradient(rgba(245,208,111,0.055) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(11,72,55,0.72), rgba(3,16,12,0.98)) !important;
          background-size: 10px 10px, 10px 10px, auto !important;
          box-shadow:
            inset 0 0 0 3px #1a4e3e,
            inset 0 0 0 7px rgba(6,24,17,0.72),
            inset 0 0 48px rgba(0,0,0,0.62),
            7px 7px 0 #020806 !important;
        }

        .portrait-board > button,
        .portrait-board > div {
          image-rendering: pixelated;
        }

        .card-image-direct,
        .card-image-shell,
        .now-card-display img,
        .control-image-button img,
        .nuts-logo-img,
        .home-wordmark-img {
          image-rendering: pixelated !important;
        }

        .control-image-button img,
        .home-main-button img,
        .nuts-logo-img,
        .home-wordmark-img,
        .result-score-number {
          filter:
            drop-shadow(4px 4px 0 rgba(2,8,6,0.78))
            drop-shadow(0 0 10px rgba(240,165,54,0.14));
        }

        .stat-score-pop,
        .result-banner,
        .combo-badge,
        .duel-status-title,
        .pixel-score-number {
          text-rendering: geometricPrecision;
          image-rendering: pixelated;
        }

        @media (max-width: 700px) {
          .home-simple-screen::after,
          .balatro-inspired-bg::after {
            opacity: 0.10;
            background-size: 7px 7px;
          }

          .table-frame::before,
          .home-card-panel::before,
          .queue-panel::before,
          .gameover-card::before,
          .result-score-panel::before {
            inset: 5px;
            border-width: 1px;
            opacity: 0.52;
          }

          .portrait-board {
            box-shadow:
              inset 0 0 0 2px #1a4e3e,
              inset 0 0 0 5px rgba(6,24,17,0.72),
              inset 0 0 36px rgba(0,0,0,0.58),
              5px 5px 0 #020806 !important;
          }
        }

        /* Keep GAME OVER as an overlay above the play screen. */
        .balatro-inspired-bg > .gameover-overlay,
        .home-simple-screen > .gameover-overlay,
        .gameover-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 9999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow-y: auto !important;
        }

        .gameover-overlay > * {
          position: absolute;
        }

        .gameover-overlay > .gameover-card {
          position: relative !important;
          z-index: 3 !important;
        }

        /* Normal gameplay stability reset:
           no result element may push/scroll the page, and board cells cannot move the layout. */
        @media (min-width: 768px) {
          html,
          body {
            overflow: hidden !important;
            height: 100% !important;
          }

          .balatro-inspired-bg {
            height: 100dvh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
          }
        }

        html,
        body,
        .balatro-inspired-bg,
        .portrait-frame,
        .portrait-layout-grid,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-queue-panel {
          overflow-anchor: none !important;
          scroll-behavior: auto !important;
        }

        .portrait-frame,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-layout-grid {
          transform: none !important;
          animation: none !important;
        }

        .portrait-board button,
        .portrait-board button:focus,
        .portrait-board button:focus-visible {
          outline: none !important;
          scroll-margin: 0 !important;
        }

        .pixel-hit-cell,
        .pixel-hit-cell *,
        .pixel-hit-cell::before,
        .pixel-hit-cell::after {
          transform: none !important;
        }

        @keyframes boardKick {
          0%, 100% { transform: none; }
        }

        @keyframes clearShake {
          0% { opacity: 1; filter: brightness(1); transform: none; }
          35% { opacity: 1; filter: brightness(1.2); transform: none; }
          70% { opacity: 0.85; filter: brightness(1.05); transform: none; }
          100% { opacity: 0.25; filter: brightness(0.7); transform: none; }
        }

        /* Gameplay viewport pin: prevents the entire game from sliding down during play. */
        @media (min-width: 768px) {
          html,
          body,
          #__next,
          [data-nextjs-scroll-focus-boundary] {
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            overscroll-behavior: none !important;
            scroll-behavior: auto !important;
          }

          .game-fixed-viewport,
          .balatro-inspired-bg {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            transform: none !important;
            translate: none !important;
          }

          .portrait-frame {
            height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }
        }

        .portrait-frame,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-layout-grid,
        .portrait-stack-layout {
          scroll-margin-top: 0 !important;
          scroll-padding-top: 0 !important;
        }

        .portrait-board button,
        .portrait-board button:focus,
        .portrait-board button:focus-visible {
          outline: none !important;
          scroll-margin: 0 !important;
        }

        /* Safe micro shake: visual overlay only, never the game layout or board. */
        .micro-shake-overlay {
          contain: strict;
          transform: translateZ(0);
          animation: microShakeLayer 420ms steps(2, end) both;
        }

        .micro-shake-scan {
          opacity: 0.18;
          background:
            linear-gradient(90deg, transparent, rgba(255,239,122,0.15), transparent),
            repeating-linear-gradient(0deg, rgba(245,208,111,0.18) 0 1px, transparent 1px 7px);
          mix-blend-mode: screen;
          animation: microShakeScan 420ms steps(2, end) both;
        }

        .micro-shake-flash {
          opacity: 0;
          background:
            radial-gradient(circle at 50% 42%, rgba(245,208,111,0.18), transparent 30%),
            radial-gradient(circle at 48% 50%, rgba(110,231,255,0.10), transparent 38%);
          animation: microShakeFlash 420ms ease-out both;
        }

        @keyframes microShakeLayer {
          0% { transform: translate3d(0, 0, 0); }
          16% { transform: translate3d(1px, 0, 0); }
          32% { transform: translate3d(-1px, 0, 0); }
          48% { transform: translate3d(1px, 0, 0); }
          64% { transform: translate3d(-1px, 0, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }

        @keyframes microShakeScan {
          0% { transform: translateX(-2px); opacity: 0; }
          20% { opacity: 0.18; }
          70% { opacity: 0.10; }
          100% { transform: translateX(2px); opacity: 0; }
        }

        @keyframes microShakeFlash {
          0% { opacity: 0; }
          18% { opacity: 1; }
          100% { opacity: 0; }
        }

        .game-fixed-viewport,
        .balatro-inspired-bg,
        .portrait-frame,
        .portrait-layout-grid,
        .portrait-stack-layout,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-queue-panel {
          transform: none !important;
          translate: none !important;
        }

        .portrait-frame,
        .portrait-layout-grid,
        .portrait-stack-layout,
        .portrait-board-wrap,
        .portrait-board {
          animation-name: none !important;
        }

        @keyframes boardKick {
          0%, 100% { transform: none; }
        }

        /* Anti-stuck fix: never lock the BODY with position: fixed; pin only the game root. */
        body {
          position: static !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          width: auto !important;
        }

        .game-fixed-viewport {
          position: fixed !important;
          inset: 0 !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-height: 100dvh !important;
          overflow: hidden !important;
          transform: none !important;
          translate: none !important;
          margin: 0 !important;
        }

        .micro-shake-overlay {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
        }


        /* Settings/Privacy must stay above the fixed game layer. */
        .settings-floating-button,
        .settings-modal-layer,
        .privacy-modal-layer {
          pointer-events: auto !important;
        }

        .settings-floating-button {
          position: fixed !important;
          left: 12px !important;
          bottom: 12px !important;
          z-index: 10000 !important;
          transform: translateZ(0) !important;
        }

        .settings-modal-layer,
        .privacy-modal-layer {
          position: fixed !important;
          inset: 0 !important;
          z-index: 10001 !important;
        }

        /* Stable play viewport: prevents mobile browser chrome/focus from pushing the board down. */
        .game-fixed-viewport {
          position: fixed !important;
          inset: 0 !important;
          height: 100svh !important;
          min-height: 100svh !important;
          max-height: 100svh !important;
          overflow: hidden !important;
          overscroll-behavior: none !important;
          touch-action: manipulation;
        }

        .portrait-board button,
        .queue-card-well,
        .control-image-button {
          touch-action: manipulation;
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

        <div className="portrait-outer duel-shift-up relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1920px] flex-col overflow-visible px-1.5 py-1.5 md:h-screen md:overflow-hidden">
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
                  <div className="portrait-board duel-board-solo-fit pixel-hard relative mx-auto grid aspect-square min-h-0 w-full max-w-[min(94vw,560px)] flex-none grid-cols-5 grid-rows-5 gap-1 border-[5px] border-[#061811] bg-[#09231d] p-1.5 shadow-[inset_0_0_0_2px_#1a4e3e,inset_0_0_38px_rgba(0,0,0,0.58),5px_5px_0_#04120d] sm:gap-1.5 sm:p-2 md:max-h-full md:max-w-none md:flex-1 lg:aspect-auto lg:max-h-none xl:gap-2 xl:p-3">


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
                            tabIndex={-1}
                            onMouseDown={(event) => event.preventDefault()}
                            className={[
                              "pixel-hard-sm relative h-full min-h-0 overflow-hidden border-[3px] transition duration-200",
                              cell
                                ? "border-[#061811] bg-transparent p-0 shadow-[4px_4px_0_#04120d]"
                                : "slot-surface border-[#061811] shadow-[3px_3px_0_#04120d]",
                              canPlace ? "cursor-pointer hover:-translate-y-1 hover:brightness-125" : "",
                              ownerGlow,
                              isPlaced ? "" : "",
                              isHit ? "pixel-hit-cell z-20 bg-transparent shadow-[0_0_0_2px_#f5d06f,0_0_10px_rgba(255,239,122,0.38),4px_4px_0_#000]" : "",
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

              <aside className="portrait-side solo-side flex min-h-0 flex-col gap-2 overflow-visible md:overflow-hidden">
                <div className="portrait-queue-panel queue-panel pixel-hard flex min-h-0 flex-col overflow-hidden border-[5px] border-[#061811] p-1.5 shadow-[5px_5px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.34)_inset] sm:border-[6px] sm:p-2 md:flex-1 md:shadow-[7px_7px_0_#04120d,0_0_0_2px_#255d48_inset,0_0_24px_rgba(0,0,0,0.34)_inset]">
                  <div className="pixel-hard-sm mb-2 shrink-0 border-[3px] border-[#061811] bg-[#123f32] px-3 py-1.5 text-center shadow-[3px_3px_0_#04120d]">
                    <p className="text-lg font-black tracking-[0.08em] text-[#d5d48a] drop-shadow-[2px_2px_0_#03100b]">
                      NOW
                    </p>
                  </div>

                  <div className="queue-card-well mb-2 flex w-full shrink-0 flex-col items-center rounded-xl border-[4px] border-[#061811] p-2 text-center shadow-[4px_4px_0_#04120d,inset_0_0_0_2px_#255d48]">
                    <div
                      className="now-card-display w-24 shrink-0 rotate-[-2deg] bg-transparent p-0 sm:w-28 lg:w-32 xl:w-36"
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

                  <div className="pixel-hard flex min-h-0 shrink-0 flex-col border-[4px] border-[#061811] bg-[#081b18] p-1.5 shadow-[4px_4px_0_#04120d,inset_0_0_0_2px_#255d48] md:h-[168px] lg:h-[190px] xl:h-[210px]">
                    <div className="flex min-h-0 flex-1 flex-col justify-center rounded-xl border-[3px] border-[#061811] bg-[#07160f] p-2 text-center shadow-[inset_0_0_24px_rgba(0,0,0,0.35)]">
                      <p className="duel-status-title text-2xl font-black text-white drop-shadow-[3px_3px_0_#03100b]">
                        {duel.isGameOver ? winnerText : `PLAYER ${duel.currentPlayer}`}
                      </p>
                      {duel.isGameOver && (
                        <p className="duel-status-result mt-3 text-base font-black text-[#fff4cf]">
                          P1 {p1Owned} - P2 {p2Owned}
                        </p>
                      )}
                    </div>

                    <div className="duel-control-buttons mt-1.5 grid shrink-0 grid-cols-2 gap-1.5">
                      <button
                        onClick={restartDuelGame}
                        className="control-image-button restart-image-button transition hover:-translate-y-0.5 active:translate-y-0"
                        aria-label="Restart duel game"
                      >
                        <img src={RESTART_BUTTON_SRC} alt="RESTART" draggable={false} />
                      </button>

                      <button
                        onClick={() => {
                          playSound("select");
                          setScreen("home");

                          if (bgmVolume > 0) {
                            setBgmEnabled(true);
                            window.setTimeout(() => startBgm(HOME_BGM_SRC), 0);
                          }
                        }}
                        className="control-image-button home-image-button transition hover:-translate-y-0.5 active:translate-y-0"
                        aria-label="Go home"
                      >
                        <img src={HOME_BUTTON_SRC} alt="HOME" draggable={false} />
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
        {renderSettingsButtonAndModal()}
      </main>
    );
  }

  const currentComboTier = getComboTier(game.combo);
  const resultComboTier = resultBanner ? getComboTier(resultBanner.combo) : null;
  const isComboAuraVisible = screen === "game" && !game.isGameOver && game.combo >= 4;

  return (
    <main className="nuts-pixel crt-lines felt-bg pixel-dither balatro-inspired-bg game-fixed-viewport relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#07120f] text-white md:fixed md:inset-0 md:h-[100svh] md:overflow-hidden">
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");
        
        
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

        @keyframes pixelSparkle {
          0%, 100% { opacity: 0.16; transform: translateY(0); }
          50% { opacity: 0.34; transform: translateY(-1px); }
        }

        @keyframes pixelHitPulse {
          0% {
            box-shadow:
              inset 0 0 0 2px #f5d06f,
              0 0 0 0 rgba(245,208,111,0.58),
              4px 4px 0 #000;
          }
          50% {
            box-shadow:
              inset 0 0 0 4px #6ee7ff,
              0 0 0 5px rgba(110,231,255,0.26),
              6px 6px 0 #000;
          }
          100% {
            box-shadow:
              inset 0 0 0 2px #f5d06f,
              0 0 0 0 rgba(245,208,111,0.58),
              4px 4px 0 #000;
          }
        }

        .table-frame {
          background:
            radial-gradient(circle at 50% 0%, rgba(245,208,111,0.12), transparent 34%),
            linear-gradient(180deg, rgba(10,68,51,0.96), rgba(4,27,22,0.98)) !important;
          box-shadow:
            10px 10px 0 #020806,
            0 0 0 4px #06140f,
            0 0 0 7px #d9912c,
            inset 0 0 0 3px rgba(255,220,116,0.16),
            inset 0 0 54px rgba(0,0,0,0.48) !important;
        }

        .table-frame::before,
        .table-frame::after {
          content: "";
          pointer-events: none;
          position: absolute;
          z-index: 1;
          width: 34px;
          height: 34px;
          border-color: #f2b84a;
          opacity: 0.92;
        }

        .table-frame::before {
          left: 8px;
          top: 8px;
          border-left: 5px solid #f2b84a;
          border-top: 5px solid #f2b84a;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.36) inset;
        }

        .table-frame::after {
          right: 8px;
          bottom: 8px;
          border-right: 5px solid #f2b84a;
          border-bottom: 5px solid #f2b84a;
          box-shadow: -4px -4px 0 rgba(0,0,0,0.36) inset;
        }

        .portrait-board-wrap {
          clip-path: polygon(
            14px 0,
            calc(100% - 14px) 0,
            100% 14px,
            100% calc(100% - 14px),
            calc(100% - 14px) 100%,
            14px 100%,
            0 calc(100% - 14px),
            0 14px
          );
          background:
            radial-gradient(circle at 50% 0%, rgba(245,208,111,0.12), transparent 28%),
            linear-gradient(180deg, #0d4334, #061d17) !important;
          box-shadow:
            7px 7px 0 #020806,
            inset 0 0 0 3px #255d48,
            inset 0 0 0 7px rgba(6,24,17,0.78),
            inset 0 0 28px rgba(0,0,0,0.48) !important;
        }

        .portrait-board-wrap::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 8px;
          z-index: 0;
          border: 2px solid rgba(242,184,74,0.22);
          clip-path: inherit;
        }

        .portrait-board {
          background:
            radial-gradient(circle, rgba(245,208,111,0.12) 1px, transparent 1.8px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 10px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.026) 0 1px, transparent 1px 10px),
            linear-gradient(180deg, #092d24, #061b16) !important;
          background-size: 10px 10px, 10px 10px, 10px 10px, auto !important;
          image-rendering: pixelated;
          box-shadow:
            inset 0 0 0 3px #1a4e3e,
            inset 0 0 0 7px #06140f,
            inset 0 0 38px rgba(0,0,0,0.62),
            5px 5px 0 #04120d !important;
        }

        .portrait-board > button {
          image-rendering: pixelated;
          clip-path: polygon(
            7px 0,
            calc(100% - 7px) 0,
            100% 7px,
            100% calc(100% - 7px),
            calc(100% - 7px) 100%,
            7px 100%,
            0 calc(100% - 7px),
            0 7px
          );
        }

        .portrait-board > button::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(circle, rgba(245,208,111,0.16) 1px, transparent 1.8px),
            linear-gradient(135deg, rgba(255,255,255,0.025), transparent 36%);
          background-size: 9px 9px, auto;
          opacity: 0.32;
          image-rendering: pixelated;
        }

        .portrait-board > button > * {
          position: relative;
          z-index: 1;
        }

        .slot-surface {
          background:
            radial-gradient(circle at 50% 50%, rgba(245,208,111,0.10), transparent 42%),
            repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 8px),
            linear-gradient(180deg, #123d31, #09231d) !important;
        }

        .slot-surface:hover {
          background:
            radial-gradient(circle at 50% 50%, rgba(245,208,111,0.18), transparent 42%),
            repeating-linear-gradient(45deg, rgba(255,255,255,0.048) 0 2px, transparent 2px 8px),
            linear-gradient(180deg, #185443, #0d3027) !important;
        }

        .pixel-hit-cell {
          animation: pixelHitPulse 520ms steps(4) infinite !important;
        }

        .pixel-hit-cell::before {
          opacity: 0.62 !important;
          background:
            radial-gradient(circle, rgba(255,239,122,0.78) 0 2px, transparent 2.5px),
            radial-gradient(circle, rgba(110,231,255,0.72) 0 2px, transparent 2.5px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 8px) !important;
          background-position: 0 0, 5px 5px, 0 0 !important;
          background-size: 10px 10px, 10px 10px, 8px 8px !important;
          animation: pixelSparkle 260ms steps(2) infinite !important;
        }

        .queue-panel,
        .portrait-queue-panel,
        .solo-queue-panel {
          clip-path: polygon(
            12px 0,
            calc(100% - 12px) 0,
            100% 12px,
            100% calc(100% - 12px),
            calc(100% - 12px) 100%,
            12px 100%,
            0 calc(100% - 12px),
            0 12px
          );
          background:
            radial-gradient(circle at 50% 0%, rgba(245,208,111,0.12), transparent 32%),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.030) 0 1px, transparent 1px 9px),
            linear-gradient(180deg, #0e3d31, #061b15) !important;
          box-shadow:
            7px 7px 0 #020806,
            inset 0 0 0 3px #255d48,
            inset 0 0 0 7px rgba(6,24,17,0.72),
            inset 0 0 24px rgba(0,0,0,0.42) !important;
        }

        .queue-card-well {
          background:
            radial-gradient(circle, rgba(245,208,111,0.10) 1px, transparent 1.8px),
            linear-gradient(180deg, #0b2f27, #061811) !important;
          background-size: 10px 10px, auto !important;
          clip-path: polygon(
            10px 0,
            calc(100% - 10px) 0,
            100% 10px,
            100% calc(100% - 10px),
            calc(100% - 10px) 100%,
            10px 100%,
            0 calc(100% - 10px),
            0 10px
          );
        }

        .pixel-inner,
        .pixel-hard-sm {
          image-rendering: pixelated;
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
          0%, 100% { transform: none; }
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

      
        /* Make the NOW card easier to read, especially on mobile. */
        .now-card-display {
          filter: drop-shadow(5px 5px 0 rgba(0,0,0,0.62));
        }

        @media (orientation: portrait), (max-width: 700px) {
          .portrait-queue-panel .queue-card-well {
            min-height: 240px !important;
            padding: 0.85rem !important;
            justify-content: center !important;
          }

          .portrait-queue-panel .queue-card-well .now-card-display {
            width: clamp(92px, 20vw, 128px) !important;
          }

          .portrait-queue-panel .queue-card-well p {
            margin-top: 0.45rem !important;
          }

          .portrait-queue-panel .queue-card-well p:nth-of-type(2) {
            font-size: 1.8rem !important;
          }
        }

        @media (max-width: 480px) {
          .portrait-queue-panel .queue-card-well {
            min-height: 255px !important;
          }

          .portrait-queue-panel .queue-card-well .now-card-display {
            width: clamp(96px, 24vw, 136px) !important;
          }
        }

        @media (orientation: landscape) and (max-height: 540px) and (max-width: 1100px) {
          .portrait-queue-panel .queue-card-well .now-card-display {
            width: 58px !important;
          }
        }


        /* Mobile SOLO: match DUEL-style lower layout and enlarge the NOW card. */
        @media (orientation: portrait), (max-width: 700px) {
          .solo-side {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            align-items: stretch !important;
            gap: 0.5rem !important;
            width: calc(100vw - 1rem) !important;
            max-width: calc(100vw - 1rem) !important;
          }

          .solo-side .solo-queue-panel {
            grid-column: 1 / 2 !important;
            min-height: 260px !important;
            height: 100% !important;
            display: grid !important;
            grid-template-rows: auto minmax(0, 1fr) !important;
            gap: 0.5rem !important;
            padding: 0.55rem !important;
          }

          .solo-side .solo-queue-panel > .pixel-hard-sm {
            margin-bottom: 0 !important;
          }

          .solo-side .queue-card-well {
            min-height: 0 !important;
            height: 100% !important;
            padding: 0.75rem !important;
            justify-content: center !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(118px, 30vw, 158px) !important;
          }

          .solo-side .queue-card-well p {
            margin-top: 0.5rem !important;
          }

          .solo-side .queue-card-well p:nth-of-type(2) {
            font-size: 2rem !important;
          }

          .solo-control-buttons {
            grid-column: 2 / 3 !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            grid-template-rows: 1fr 1fr !important;
            height: 100% !important;
            min-height: 260px !important;
            gap: 0.55rem !important;
          }

          .solo-control-buttons button {
            min-height: 0 !important;
            height: 100% !important;
            padding: 0.75rem 0.65rem !important;
            font-size: 1rem !important;
          }
        }

        @media (max-width: 430px) {
          .solo-side .solo-queue-panel,
          .solo-control-buttons {
            min-height: 238px !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(104px, 28vw, 138px) !important;
          }

          .solo-side .queue-card-well p:nth-of-type(2) {
            font-size: 1.75rem !important;
          }
        }


        /* Final mobile SOLO lower panel: left = NOW card, right = RESTART/HOME. */
        @media (orientation: portrait), (max-width: 700px) {
          .solo-side {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            grid-template-rows: auto !important;
            align-items: stretch !important;
            gap: 0.55rem !important;
            width: calc(100vw - 1rem) !important;
            max-width: calc(100vw - 1rem) !important;
            margin-inline: auto !important;
          }

          .solo-side .solo-queue-panel {
            grid-column: 1 / 2 !important;
            grid-row: 1 !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 258px !important;
            height: 258px !important;
            display: grid !important;
            grid-template-rows: 42px minmax(0, 1fr) !important;
            gap: 0.45rem !important;
            padding: 0.55rem !important;
            overflow: hidden !important;
          }

          .solo-side .solo-queue-panel > .pixel-hard-sm {
            margin-bottom: 0 !important;
            padding-block: 0.35rem !important;
          }

          .solo-side .solo-queue-panel > .pixel-hard-sm p {
            font-size: 1.05rem !important;
            line-height: 1 !important;
          }

          .solo-side .queue-card-well {
            min-height: 0 !important;
            height: 100% !important;
            width: 100% !important;
            margin-bottom: 0 !important;
            padding: 0.65rem 0.35rem !important;
            justify-content: center !important;
            overflow: hidden !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(112px, 30vw, 148px) !important;
            max-width: 78% !important;
          }

          .solo-side .queue-card-well p {
            margin-top: 0.35rem !important;
          }

          .solo-side .queue-card-well p:nth-of-type(2) {
            font-size: 1.85rem !important;
            line-height: 1 !important;
          }

          .solo-control-buttons {
            grid-column: 2 / 3 !important;
            grid-row: 1 !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            grid-template-rows: 1fr 1fr !important;
            gap: 0.55rem !important;
            width: 100% !important;
            height: 258px !important;
            min-height: 258px !important;
            align-self: stretch !important;
          }

          .solo-control-buttons button {
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            padding: 0.75rem 0.5rem !important;
            font-size: 1.05rem !important;
            line-height: 1 !important;
            border-width: 4px !important;
          }
        }

        @media (max-width: 430px) {
          .solo-side .solo-queue-panel,
          .solo-control-buttons {
            height: 236px !important;
            min-height: 236px !important;
          }

          .solo-side .solo-queue-panel {
            grid-template-rows: 38px minmax(0, 1fr) !important;
            padding: 0.45rem !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(100px, 28vw, 132px) !important;
            max-width: 78% !important;
          }

          .solo-side .queue-card-well p:nth-of-type(2) {
            font-size: 1.65rem !important;
          }

          .solo-control-buttons button {
            font-size: 0.95rem !important;
          }
        }

        @media (max-width: 380px) {
          .solo-side .solo-queue-panel,
          .solo-control-buttons {
            height: 220px !important;
            min-height: 220px !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(90px, 26vw, 120px) !important;
          }
        }


        /* Mobile SOLO NOW safety: never crop the current card. */
        @media (orientation: portrait), (max-width: 700px) {
          .solo-side .solo-queue-panel {
            height: 272px !important;
            min-height: 272px !important;
            grid-template-rows: 38px minmax(0, 1fr) !important;
            overflow: visible !important;
          }

          .solo-side .queue-card-well {
            overflow: visible !important;
            padding: 0.45rem 0.35rem 0.35rem !important;
            justify-content: center !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(86px, 23vw, 112px) !important;
            max-width: 70% !important;
            transform: translateY(0) !important;
          }

          .solo-side .queue-card-well p {
            margin-top: 0.25rem !important;
          }

          .solo-side .queue-card-well p:nth-of-type(1) {
            font-size: 0.55rem !important;
            line-height: 1 !important;
          }

          .solo-side .queue-card-well p:nth-of-type(2) {
            font-size: 1.45rem !important;
            line-height: 1 !important;
          }

          .solo-side .queue-card-well .mt-2.flex {
            margin-top: 0.35rem !important;
          }

          .solo-control-buttons {
            height: 272px !important;
            min-height: 272px !important;
          }
        }

        @media (max-width: 430px) {
          .solo-side .solo-queue-panel,
          .solo-control-buttons {
            height: 252px !important;
            min-height: 252px !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(78px, 22vw, 98px) !important;
            max-width: 68% !important;
          }

          .solo-side .queue-card-well p:nth-of-type(2) {
            font-size: 1.32rem !important;
          }
        }

        @media (max-width: 380px) {
          .solo-side .solo-queue-panel,
          .solo-control-buttons {
            height: 238px !important;
            min-height: 238px !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(70px, 20vw, 88px) !important;
          }
        }


        /* Mobile SOLO polish: hide NOW label and reduce button emphasis. */
        @media (orientation: portrait), (max-width: 700px) {
          .solo-side .solo-queue-panel {
            grid-template-rows: minmax(0, 1fr) !important;
            height: 248px !important;
            min-height: 248px !important;
          }

          .solo-side .solo-queue-panel > .pixel-hard-sm {
            display: none !important;
          }

          .solo-side .queue-card-well {
            padding: 0.55rem 0.35rem 0.4rem !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(88px, 23vw, 116px) !important;
            max-width: 72% !important;
          }

          .solo-control-buttons {
            height: 248px !important;
            min-height: 248px !important;
            gap: 0.45rem !important;
            align-content: center !important;
          }

          .solo-control-buttons button {
            height: auto !important;
            min-height: 76px !important;
            align-self: center !important;
            padding: 0.52rem 0.5rem !important;
            font-size: 0.86rem !important;
            border-width: 3px !important;
            box-shadow:
              3px 3px 0 #04120d,
              0 0 0 1px rgba(255,255,255,0.12) inset !important;
          }
        }

        @media (max-width: 430px) {
          .solo-side .solo-queue-panel,
          .solo-control-buttons {
            height: 226px !important;
            min-height: 226px !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(80px, 22vw, 102px) !important;
            max-width: 70% !important;
          }

          .solo-control-buttons button {
            min-height: 66px !important;
            font-size: 0.78rem !important;
            padding-block: 0.42rem !important;
          }
        }

        @media (max-width: 380px) {
          .solo-side .solo-queue-panel,
          .solo-control-buttons {
            height: 212px !important;
            min-height: 212px !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(72px, 20vw, 92px) !important;
          }

          .solo-control-buttons button {
            min-height: 60px !important;
          }
        }



        /* Mobile SOLO NOW card uncropped fix */
        @media (orientation: portrait), (max-width: 700px) {
          .solo-side .queue-card-well {
            justify-content: flex-start !important;
            padding-top: 0.7rem !important;
            padding-bottom: 0.45rem !important;
            overflow: visible !important;
          }

          .solo-side .solo-now-card-display {
            width: clamp(76px, 19vw, 96px) !important;
            max-width: 64% !important;
            margin-top: 0.18rem !important;
            transform: rotate(-2deg) translateY(4px) !important;
            transform-origin: center center !important;
          }

          .solo-side .queue-card-well > p:first-of-type {
            margin-top: 0.3rem !important;
          }

          .solo-side .queue-card-well > p:nth-of-type(2) {
            margin-top: 0.1rem !important;
            font-size: 1.85rem !important;
          }

          .solo-side .queue-card-well > div:last-child {
            margin-top: 0.32rem !important;
          }
        }

        @media (max-width: 430px) {
          .solo-side .solo-now-card-display {
            width: clamp(72px, 18vw, 88px) !important;
            max-width: 60% !important;
            transform: rotate(-2deg) translateY(5px) !important;
          }
        }

        /* Image-based casino buttons. */
        .control-image-button {
          display: grid !important;
          place-items: center !important;
          width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: none !important;
          background-color: transparent !important;
          box-shadow: none !important;
          outline: none !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          overflow: visible !important;
          image-rendering: pixelated !important;
        }

        .control-image-button::before,
        .control-image-button::after {
          display: none !important;
          content: none !important;
        }

        .control-image-button img {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
          pointer-events: none !important;
          user-select: none !important;
          image-rendering: pixelated !important;
          background: transparent !important;
          filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.62)) !important;
        }

        .duel-control-buttons,
        .solo-control-buttons {
          align-items: center !important;
        }

        .duel-control-buttons .restart-image-button,
        .solo-control-buttons .restart-image-button,
        .duel-control-buttons .home-image-button,
        .solo-control-buttons .home-image-button {
          aspect-ratio: 2084 / 577 !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        

        @media (orientation: portrait), (max-width: 700px) {
          .solo-control-buttons .control-image-button {
            align-self: center !important;
            width: 100% !important;
          }

          .solo-control-buttons .control-image-button img {
            width: 100% !important;
            max-width: 100% !important;
            max-height: 64px !important;
          }
        }


        /* Final fix: remove every visible frame/background around image buttons. */
        .control-image-button,
        .control-image-button:hover,
        .control-image-button:active,
        .control-image-button:focus,
        .control-image-button:focus-visible {
          appearance: none !important;
          -webkit-appearance: none !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
          line-height: 0 !important;
        }

        .control-image-button img {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
        }

        .duel-control-buttons,
        .solo-control-buttons {
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
          overflow: visible !important;
        }

        .duel-control-buttons .control-image-button,
        .solo-control-buttons .control-image-button {
          width: 100% !important;
          max-width: 100% !important;
        }

        /* FINAL: keep image buttons frameless even before hover/focus. */
        .duel-control-buttons button.control-image-button,
        .solo-control-buttons button.control-image-button,
        .duel-control-buttons button.control-image-button:hover,
        .solo-control-buttons button.control-image-button:hover,
        .duel-control-buttons button.control-image-button:active,
        .solo-control-buttons button.control-image-button:active,
        .duel-control-buttons button.control-image-button:focus,
        .solo-control-buttons button.control-image-button:focus,
        .duel-control-buttons button.control-image-button:focus-visible,
        .solo-control-buttons button.control-image-button:focus-visible {
          appearance: none !important;
          -webkit-appearance: none !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-width: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
          height: auto !important;
          line-height: 0 !important;
          overflow: visible !important;
        }

        .duel-control-buttons button.control-image-button img,
        .solo-control-buttons button.control-image-button img {
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          display: block !important;
        }

        .duel-control-buttons,
        .solo-control-buttons {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-width: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
        }

        /* Result screen uses the same image buttons as play screen. */
        .result-image-buttons {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .result-image-buttons .control-image-button {
          display: grid !important;
          place-items: center !important;
          width: 100% !important;
          max-width: 100% !important;
          aspect-ratio: 2084 / 577 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          outline: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          overflow: visible !important;
          line-height: 0 !important;
          image-rendering: pixelated !important;
        }

        .result-image-buttons .control-image-button img {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
          pointer-events: none !important;
          user-select: none !important;
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          image-rendering: pixelated !important;
          filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.62)) !important;
        }

        .result-image-buttons .restart-image-button,
        .result-image-buttons .home-image-button {
          aspect-ratio: 2084 / 577 !important;
        }

        /* NUTS-style result score panel. */
        .result-score-panel {
          border: 5px solid #061811;
          border-radius: 1.65rem;
          background:
            radial-gradient(circle at 50% 0%, rgba(245,208,111,0.12), transparent 38%),
            linear-gradient(180deg, #14503d 0%, #0a2f26 56%, #061d17 100%);
          box-shadow:
            8px 8px 0 #020806,
            0 0 0 2px rgba(240,165,54,0.90) inset,
            0 0 0 7px rgba(6,24,17,0.86) inset,
            inset 0 0 42px rgba(0,0,0,0.36);
        }

        .result-score-label {
          min-width: min(78%, 310px);
          border: 4px solid #061811;
          border-radius: 0.9rem;
          background:
            linear-gradient(180deg, #0f5a43 0%, #0c3a2e 52%, #072119 100%);
          box-shadow:
            5px 5px 0 #020806,
            0 0 0 2px #f0a536 inset,
            0 0 0 5px rgba(6,24,17,0.82) inset;
          clip-path: polygon(7% 0, 93% 0, 100% 20%, 100% 80%, 93% 100%, 7% 100%, 0 80%, 0 20%);
        }

        .result-score-window {
          border: 5px solid #061811;
          border-radius: 1.35rem;
          background: #071c16;
          box-shadow:
            inset 0 0 0 2px #1f6b50,
            inset 0 0 46px rgba(0,0,0,0.58),
            6px 6px 0 #020806;
        }

        .result-score-number {
          letter-spacing: -0.045em;
          image-rendering: pixelated;
        }

        @media (max-width: 640px) {
          .result-score-panel {
            border-width: 4px;
            border-radius: 1.25rem;
          }

          .result-score-label {
            min-width: min(82%, 260px);
            border-width: 3px;
          }

          .result-score-window {
            min-height: 132px !important;
            border-width: 4px;
          }

          .result-score-number {
            font-size: clamp(4.4rem, 18vw, 6rem) !important;
          }
        }

        /* Luxury FINAL SCORE image banner and gold score typography. */
        .result-score-label-image {
          width: min(82%, 500px);
          filter: drop-shadow(5px 5px 0 #020806) drop-shadow(0 0 10px rgba(240,165,54,0.30));
          image-rendering: pixelated;
        }

        .result-score-label-image img {
          display: block;
          background: transparent;
          image-rendering: pixelated;
        }

        .result-score-number {
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 900;
          color: transparent;
          background:
            linear-gradient(180deg, #fff9d9 0%, #fff0a8 22%, #f6c75a 47%, #d98720 70%, #fff0a8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-stroke: 2px #fff7c9;
          letter-spacing: -0.065em;
          filter: drop-shadow(0 4px 0 #9b5415) drop-shadow(8px 8px 0 #061811) drop-shadow(13px 13px 0 #020806);
          text-shadow: none !important;
        }

        @media (max-width: 640px) {
          .result-score-label-image {
            width: min(88%, 390px);
          }

          .result-score-number {
            -webkit-text-stroke: 1px #fff7c9;
            letter-spacing: -0.055em;
          }
        }

        /* FINAL SCORE banner size fix: keep the score number fully visible. */
        .result-score-label-image {
          width: min(54%, 330px) !important;
          top: -6px !important;
          filter: drop-shadow(4px 4px 0 #020806) drop-shadow(0 0 8px rgba(240,165,54,0.24)) !important;
        }

        .result-score-label-image img {
          max-height: 92px !important;
          object-fit: contain !important;
        }

        .result-score-window {
          margin-top: 0.15rem !important;
        }

        @media (max-width: 640px) {
          .result-score-label-image {
            width: min(62%, 280px) !important;
            top: -4px !important;
          }

          .result-score-label-image img {
            max-height: 74px !important;
          }

          .result-score-panel {
            padding-top: 4.75rem !important;
          }
        }

        /* Result screen: remove FINAL SCORE label and make the score number more pixel-art. */
        .result-score-label-image,
        .result-score-label {
          display: none !important;
        }

        .result-score-panel-no-label {
          padding-top: 1.1rem !important;
          padding-bottom: 1.1rem !important;
        }

        .result-score-panel-no-label .result-score-window {
          min-height: 190px !important;
          margin-top: 0 !important;
          padding: 1.15rem 1rem !important;
          border-radius: 1.2rem !important;
          background:
            radial-gradient(circle at 50% 28%, rgba(245,208,111,0.12), transparent 38%),
            linear-gradient(180deg, rgba(15,84,65,0.98), rgba(4,25,20,0.99)) !important;
          box-shadow:
            inset 0 0 0 3px #1f6b50,
            inset 0 0 0 8px #062017,
            inset 0 0 48px rgba(0,0,0,0.62),
            7px 7px 0 #020806 !important;
        }

        .pixel-score-number {
          font-family: "Courier New", "Consolas", "Menlo", monospace !important;
          font-size: clamp(5.6rem, 11vw, 10.5rem) !important;
          font-weight: 900 !important;
          line-height: 0.9 !important;
          letter-spacing: -0.08em !important;
          color: #ffe88f !important;
          -webkit-text-stroke: 0 !important;
          background: none !important;
          -webkit-background-clip: initial !important;
          background-clip: initial !important;
          image-rendering: pixelated !important;
          text-rendering: geometricPrecision !important;
          filter: none !important;
          text-shadow:
            0 -4px 0 #fff7cc,
            4px 0 0 #fff7cc,
            -4px 0 0 #7b3f0b,
            0 4px 0 #8d4a10,
            4px 4px 0 #c77718,
            8px 8px 0 #061811,
            13px 13px 0 #020806 !important;
        }

        @media (max-width: 640px) {
          .result-score-panel-no-label {
            padding-top: 0.85rem !important;
            padding-bottom: 0.85rem !important;
          }

          .result-score-panel-no-label .result-score-window {
            min-height: 142px !important;
            padding: 0.85rem 0.65rem !important;
          }

          .pixel-score-number {
            font-size: clamp(4rem, 18vw, 6.4rem) !important;
            letter-spacing: -0.07em !important;
            text-shadow:
              0 -2px 0 #fff7cc,
              2px 0 0 #fff7cc,
              -2px 0 0 #7b3f0b,
              0 2px 0 #8d4a10,
              3px 3px 0 #c77718,
              6px 6px 0 #061811,
              9px 9px 0 #020806 !important;
          }
        }

        /* Balatro-style score font.
           Optional: if you legally add /public/fonts/m6x11plus.ttf, it will be used first. */
        @font-face {
          font-family: "NutsBalatroScore";
          src: url("/fonts/m6x11plus.ttf") format("truetype");
          font-weight: 400 900;
          font-style: normal;
          font-display: swap;
        }

        .pixel-score-number {
          font-family:
            "NutsBalatroScore",
            "m6x11plus",
            "m6x11",
            "Arial Black",
            "Impact",
            "Courier New",
            monospace !important;
          font-size: clamp(5.8rem, 11.5vw, 10.9rem) !important;
          font-weight: 900 !important;
          letter-spacing: 0.01em !important;
          transform: scaleX(0.9) !important;
          color: #fff2a8 !important;
          -webkit-text-stroke: 0 !important;
          background: none !important;
          -webkit-background-clip: initial !important;
          background-clip: initial !important;
          text-rendering: geometricPrecision !important;
          image-rendering: pixelated !important;
          filter: none !important;
          text-shadow:
            0 -3px 0 #fff8d6,
            3px 0 0 #fff8d6,
            -3px 0 0 #6f3b0b,
            0 3px 0 #8a4b10,
            3px 3px 0 #d28a23,
            7px 7px 0 #061811,
            11px 11px 0 #020806 !important;
        }

        @media (max-width: 640px) {
          .pixel-score-number {
            font-size: clamp(4.25rem, 18vw, 6.7rem) !important;
            letter-spacing: 0 !important;
            transform: scaleX(0.9) !important;
            text-shadow:
              0 -2px 0 #fff8d6,
              2px 0 0 #fff8d6,
              -2px 0 0 #6f3b0b,
              0 2px 0 #8a4b10,
              3px 3px 0 #d28a23,
              6px 6px 0 #061811,
              9px 9px 0 #020806 !important;
          }
        }

        /* External pixel font for result score. */
        .pixel-score-number {
          font-family:
            "Press Start 2P",
            "NutsBalatroScore",
            "m6x11plus",
            "m6x11",
            "Courier New",
            monospace !important;
          font-size: clamp(4.2rem, 8.6vw, 8.6rem) !important;
          font-weight: 400 !important;
          letter-spacing: -0.03em !important;
          transform: scaleX(0.96) !important;
          color: #fff2a8 !important;
          -webkit-text-stroke: 0 !important;
          background: none !important;
          -webkit-background-clip: initial !important;
          background-clip: initial !important;
          text-rendering: geometricPrecision !important;
          image-rendering: pixelated !important;
          filter: none !important;
          text-shadow:
            0 -3px 0 #fff8d6,
            3px 0 0 #fff8d6,
            -3px 0 0 #6f3b0b,
            0 3px 0 #8a4b10,
            3px 3px 0 #d28a23,
            7px 7px 0 #061811,
            11px 11px 0 #020806 !important;
        }

        @media (max-width: 640px) {
          .pixel-score-number {
            font-size: clamp(3rem, 13.5vw, 5rem) !important;
            letter-spacing: -0.04em !important;
            transform: scaleX(0.96) !important;
            text-shadow:
              0 -2px 0 #fff8d6,
              2px 0 0 #fff8d6,
              -2px 0 0 #6f3b0b,
              0 2px 0 #8a4b10,
              3px 3px 0 #d28a23,
              6px 6px 0 #061811,
              9px 9px 0 #020806 !important;
          }
        }

        /* NUTS unified pixel-art polish: stronger dot texture, chunky borders, casino-gold highlights. */
        .nuts-pixel,
        .nuts-pixel * {
          image-rendering: pixelated;
        }

        .home-simple-screen,
        .balatro-inspired-bg {
          background-image:
            radial-gradient(circle at 12px 12px, rgba(245,208,111,0.075) 1px, transparent 2px),
            radial-gradient(circle at 32px 28px, rgba(53,182,106,0.055) 1px, transparent 2px),
            repeating-linear-gradient(45deg, rgba(255,226,128,0.035) 0 2px, transparent 2px 14px),
            linear-gradient(180deg, rgba(5,25,20,0.25), rgba(0,0,0,0.18));
          background-size: 44px 44px, 52px 52px, 32px 32px, auto;
        }

        .home-simple-screen::after,
        .balatro-inspired-bg::after {
          content: "";
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 1;
          opacity: 0.16;
          background:
            linear-gradient(rgba(255,244,207,0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,244,207,0.10) 1px, transparent 1px);
          background-size: 6px 6px;
          mix-blend-mode: overlay;
        }

        .home-simple-screen > *,
        .balatro-inspired-bg > * {
          position: relative;
          z-index: 2;
        }

        .pixel-hard,
        .pixel-hard-sm,
        .table-frame,
        .home-card-panel,
        .queue-panel,
        .gameover-card,
        .result-score-panel,
        .result-score-window {
          border-style: solid !important;
          image-rendering: pixelated;
        }

        .table-frame,
        .home-card-panel,
        .queue-panel,
        .gameover-card,
        .result-score-panel {
          background-image:
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            radial-gradient(circle at 50% 0%, rgba(240,165,54,0.10), transparent 34%) !important;
          background-size: 8px 8px, 8px 8px, auto !important;
        }

        .table-frame::before,
        .home-card-panel::before,
        .queue-panel::before,
        .gameover-card::before,
        .result-score-panel::before {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 6px;
          border: 2px dashed rgba(240,165,54,0.30);
          opacity: 0.72;
        }

        .portrait-board {
          background-image:
            linear-gradient(90deg, rgba(245,208,111,0.07) 1px, transparent 1px),
            linear-gradient(rgba(245,208,111,0.055) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(11,72,55,0.72), rgba(3,16,12,0.98)) !important;
          background-size: 10px 10px, 10px 10px, auto !important;
          box-shadow:
            inset 0 0 0 3px #1a4e3e,
            inset 0 0 0 7px rgba(6,24,17,0.72),
            inset 0 0 48px rgba(0,0,0,0.62),
            7px 7px 0 #020806 !important;
        }

        .portrait-board > button,
        .portrait-board > div {
          image-rendering: pixelated;
        }

        .card-image-direct,
        .card-image-shell,
        .now-card-display img,
        .control-image-button img,
        .nuts-logo-img,
        .home-wordmark-img {
          image-rendering: pixelated !important;
        }

        .control-image-button img,
        .home-main-button img,
        .nuts-logo-img,
        .home-wordmark-img,
        .result-score-number {
          filter:
            drop-shadow(4px 4px 0 rgba(2,8,6,0.78))
            drop-shadow(0 0 10px rgba(240,165,54,0.14));
        }

        .stat-score-pop,
        .result-banner,
        .combo-badge,
        .duel-status-title,
        .pixel-score-number {
          text-rendering: geometricPrecision;
          image-rendering: pixelated;
        }

        @media (max-width: 700px) {
          .home-simple-screen::after,
          .balatro-inspired-bg::after {
            opacity: 0.10;
            background-size: 7px 7px;
          }

          .table-frame::before,
          .home-card-panel::before,
          .queue-panel::before,
          .gameover-card::before,
          .result-score-panel::before {
            inset: 5px;
            border-width: 1px;
            opacity: 0.52;
          }

          .portrait-board {
            box-shadow:
              inset 0 0 0 2px #1a4e3e,
              inset 0 0 0 5px rgba(6,24,17,0.72),
              inset 0 0 36px rgba(0,0,0,0.58),
              5px 5px 0 #020806 !important;
          }
        }

        /* Keep GAME OVER as an overlay above the play screen. */
        .balatro-inspired-bg > .gameover-overlay,
        .home-simple-screen > .gameover-overlay,
        .gameover-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 9999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow-y: auto !important;
        }

        .gameover-overlay > * {
          position: absolute;
        }

        .gameover-overlay > .gameover-card {
          position: relative !important;
          z-index: 3 !important;
        }

        /* Normal gameplay stability reset:
           no result element may push/scroll the page, and board cells cannot move the layout. */
        @media (min-width: 768px) {
          html,
          body {
            overflow: hidden !important;
            height: 100% !important;
          }

          .balatro-inspired-bg {
            height: 100dvh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
          }
        }

        html,
        body,
        .balatro-inspired-bg,
        .portrait-frame,
        .portrait-layout-grid,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-queue-panel {
          overflow-anchor: none !important;
          scroll-behavior: auto !important;
        }

        .portrait-frame,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-layout-grid {
          transform: none !important;
          animation: none !important;
        }

        .portrait-board button,
        .portrait-board button:focus,
        .portrait-board button:focus-visible {
          outline: none !important;
          scroll-margin: 0 !important;
        }

        .pixel-hit-cell,
        .pixel-hit-cell *,
        .pixel-hit-cell::before,
        .pixel-hit-cell::after {
          transform: none !important;
        }

        @keyframes boardKick {
          0%, 100% { transform: none; }
        }

        @keyframes clearShake {
          0% { opacity: 1; filter: brightness(1); transform: none; }
          35% { opacity: 1; filter: brightness(1.2); transform: none; }
          70% { opacity: 0.85; filter: brightness(1.05); transform: none; }
          100% { opacity: 0.25; filter: brightness(0.7); transform: none; }
        }

        /* Gameplay viewport pin: prevents the entire game from sliding down during play. */
        @media (min-width: 768px) {
          html,
          body,
          #__next,
          [data-nextjs-scroll-focus-boundary] {
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            overscroll-behavior: none !important;
            scroll-behavior: auto !important;
          }

          .game-fixed-viewport,
          .balatro-inspired-bg {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            transform: none !important;
            translate: none !important;
          }

          .portrait-frame {
            height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }
        }

        .portrait-frame,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-layout-grid,
        .portrait-stack-layout {
          scroll-margin-top: 0 !important;
          scroll-padding-top: 0 !important;
        }

        .portrait-board button,
        .portrait-board button:focus,
        .portrait-board button:focus-visible {
          outline: none !important;
          scroll-margin: 0 !important;
        }

        /* Safe micro shake: visual overlay only, never the game layout or board. */
        .micro-shake-overlay {
          contain: strict;
          transform: translateZ(0);
          animation: microShakeLayer 420ms steps(2, end) both;
        }

        .micro-shake-scan {
          opacity: 0.18;
          background:
            linear-gradient(90deg, transparent, rgba(255,239,122,0.15), transparent),
            repeating-linear-gradient(0deg, rgba(245,208,111,0.18) 0 1px, transparent 1px 7px);
          mix-blend-mode: screen;
          animation: microShakeScan 420ms steps(2, end) both;
        }

        .micro-shake-flash {
          opacity: 0;
          background:
            radial-gradient(circle at 50% 42%, rgba(245,208,111,0.18), transparent 30%),
            radial-gradient(circle at 48% 50%, rgba(110,231,255,0.10), transparent 38%);
          animation: microShakeFlash 420ms ease-out both;
        }

        @keyframes microShakeLayer {
          0% { transform: translate3d(0, 0, 0); }
          16% { transform: translate3d(1px, 0, 0); }
          32% { transform: translate3d(-1px, 0, 0); }
          48% { transform: translate3d(1px, 0, 0); }
          64% { transform: translate3d(-1px, 0, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }

        @keyframes microShakeScan {
          0% { transform: translateX(-2px); opacity: 0; }
          20% { opacity: 0.18; }
          70% { opacity: 0.10; }
          100% { transform: translateX(2px); opacity: 0; }
        }

        @keyframes microShakeFlash {
          0% { opacity: 0; }
          18% { opacity: 1; }
          100% { opacity: 0; }
        }

        .game-fixed-viewport,
        .balatro-inspired-bg,
        .portrait-frame,
        .portrait-layout-grid,
        .portrait-stack-layout,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-queue-panel {
          transform: none !important;
          translate: none !important;
        }

        .portrait-frame,
        .portrait-layout-grid,
        .portrait-stack-layout,
        .portrait-board-wrap,
        .portrait-board {
          animation-name: none !important;
        }

        @keyframes boardKick {
          0%, 100% { transform: none; }
        }

        /* Anti-stuck fix: never lock the BODY with position: fixed; pin only the game root. */
        body {
          position: static !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          width: auto !important;
        }

        .game-fixed-viewport {
          position: fixed !important;
          inset: 0 !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-height: 100dvh !important;
          overflow: hidden !important;
          transform: none !important;
          translate: none !important;
          margin: 0 !important;
        }

        .micro-shake-overlay {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
        }

        /* Position stability only: keep gameplay from being re-anchored by browser scroll correction. */
        .game-fixed-viewport,
        .balatro-inspired-bg,
        .portrait-outer,
        .portrait-frame,
        .portrait-board-wrap,
        .portrait-board,
        .portrait-queue-panel {
          overflow-anchor: none !important;
          scroll-behavior: auto !important;
        }

        .portrait-board button,
        .portrait-board button:focus,
        .portrait-board button:focus-visible {
          outline: none !important;
          scroll-margin: 0 !important;
        }


        /* Settings/Privacy must stay above the fixed game layer. */
        .settings-floating-button,
        .settings-modal-layer,
        .privacy-modal-layer {
          pointer-events: auto !important;
        }

        .settings-floating-button {
          position: fixed !important;
          left: 12px !important;
          bottom: 12px !important;
          z-index: 10000 !important;
          transform: translateZ(0) !important;
        }

        .settings-modal-layer,
        .privacy-modal-layer {
          position: fixed !important;
          inset: 0 !important;
          z-index: 10001 !important;
        }

        /* Stable play viewport: prevents mobile browser chrome/focus from pushing the board down. */
        .game-fixed-viewport {
          position: fixed !important;
          inset: 0 !important;
          height: 100svh !important;
          min-height: 100svh !important;
          max-height: 100svh !important;
          overflow: hidden !important;
          overscroll-behavior: none !important;
          touch-action: manipulation;
        }

        .portrait-board button,
        .queue-card-well,
        .control-image-button {
          touch-action: manipulation;
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

      {resultPulse && (
        <div className="micro-shake-overlay pointer-events-none fixed inset-0 z-[34] overflow-hidden" aria-hidden="true">
          <div className="micro-shake-scan absolute inset-0" />
          <div className="micro-shake-flash absolute inset-0" />
        </div>
      )}

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


      {game.isGameOver && (
        <div className="gameover-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/82 px-3 py-4 sm:px-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(245,208,111,0.22),transparent_26%),radial-gradient(circle_at_28%_72%,rgba(32,163,111,0.18),transparent_28%),radial-gradient(circle_at_74%_22%,rgba(210,58,47,0.18),transparent_26%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(#f5d06f_1px,transparent_1px),linear-gradient(90deg,#f5d06f_1px,transparent_1px)] [background-size:18px_18px]" />

          <div
            className="gameover-card pixel-hard relative w-full max-w-2xl overflow-hidden border-[5px] border-[#061811] bg-[#0b2f27] p-4 text-center shadow-[10px_10px_0_#020806,0_0_0_3px_#f0a536_inset,0_0_0_7px_rgba(6,24,17,0.85)_inset] sm:border-[6px] sm:p-7 sm:shadow-[15px_15px_0_#020806,0_0_0_3px_#f0a536_inset,0_0_0_7px_rgba(6,24,17,0.85)_inset]"
            style={{ animation: "gameOverEnter 360ms ease-out" }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,208,111,0.16),transparent_34%),linear-gradient(180deg,rgba(13,72,55,0.98),rgba(4,28,22,0.98))]" />
            <div className="pointer-events-none absolute inset-3 border-[3px] border-[#f0a536]/80" />
            <div className="pointer-events-none absolute left-3 top-3 h-9 w-9 border-l-[5px] border-t-[5px] border-[#f0a536]" />
            <div className="pointer-events-none absolute right-3 top-3 h-9 w-9 border-r-[5px] border-t-[5px] border-[#f0a536]" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-9 w-9 border-b-[5px] border-l-[5px] border-[#f0a536]" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-9 w-9 border-b-[5px] border-r-[5px] border-[#f0a536]" />

            <div className="relative z-10 mb-4 flex items-center justify-center">
              <img
                src={GAME_OVER_TITLE_SRC}
                alt="GAME OVER"
                draggable={false}
                className="h-auto w-[min(92%,720px)] select-none object-contain drop-shadow-[8px_8px_0_#020806]"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
            </div>

            <div className="relative z-10 mx-auto mb-5 h-[3px] max-w-lg bg-[#f0a536] shadow-[0_3px_0_#3c2108]">
              <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-[3px] border-[#f0a536] bg-[#0b2f27]" />
            </div>

            <section className="result-score-panel result-score-panel-no-label relative z-10 mx-auto max-w-xl px-3 py-4 sm:px-5 sm:py-5">
              <div className="pointer-events-none absolute left-5 right-5 top-8 h-[3px] bg-[#f0a536] shadow-[0_2px_0_#3c2108]" />
              <div className="pointer-events-none absolute left-1/2 top-8 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-[3px] border-[#f0a536] bg-[#0b2f27]" />

              <div className="result-score-window relative mx-auto flex min-h-[150px] items-center justify-center overflow-hidden px-4 py-6 sm:min-h-[190px] sm:px-7 sm:py-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(245,208,111,0.10),transparent_38%),linear-gradient(180deg,rgba(19,76,58,0.95),rgba(4,24,18,0.98))]" />
                <div className="pointer-events-none absolute inset-2 rounded-[1.25rem] border-[3px] border-[#1e634b]/75 shadow-[inset_0_0_34px_rgba(0,0,0,0.46)]" />
                <div className="pointer-events-none absolute left-3 top-3 h-8 w-8 rounded-br-xl border-b-[4px] border-r-[4px] border-[#f0a536]" />
                <div className="pointer-events-none absolute right-3 top-3 h-8 w-8 rounded-bl-xl border-b-[4px] border-l-[4px] border-[#f0a536]" />
                <div className="pointer-events-none absolute bottom-3 left-3 h-8 w-8 rounded-tr-xl border-r-[4px] border-t-[4px] border-[#f0a536]" />
                <div className="pointer-events-none absolute bottom-3 right-3 h-8 w-8 rounded-tl-xl border-l-[4px] border-t-[4px] border-[#f0a536]" />

                <h3
                  className="result-score-number pixel-score-number relative z-10 font-black leading-none"
                  style={{
                    textShadow:
                      "0 4px 0 #f0a536, 8px 8px 0 #061811, 13px 13px 0 #020806, -2px -2px 0 #fff8d8",
                  }}
                >
                  {game.score}
                </h3>
              </div>
            </section>

            <div className="result-image-buttons relative z-10 mt-5 grid items-center gap-4 px-3 sm:grid-cols-2 sm:px-4">
              <button
                onClick={restartGame}
                className="control-image-button restart-image-button transition hover:-translate-y-0.5 active:translate-y-0"
                aria-label="Replay"
              >
                <img src={RESTART_BUTTON_SRC} alt="RESTART" draggable={false} />
              </button>

              <button
                onClick={() => {
                  playSound("select");
                  setScreen("home");

                  if (bgmVolume > 0) {
                    setBgmEnabled(true);
                    window.setTimeout(() => startBgm(HOME_BGM_SRC), 0);
                  }
                }}
                className="control-image-button home-image-button transition hover:-translate-y-0.5 active:translate-y-0"
                aria-label="Home"
              >
                <img src={HOME_BUTTON_SRC} alt="HOME" draggable={false} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="portrait-outer relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1920px] flex-col overflow-visible px-1.5 py-1.5 md:h-screen md:overflow-hidden">
        <section
          className="portrait-frame table-frame pixel-hard relative flex min-h-0 flex-1 flex-col overflow-visible border-[5px] border-[#061811] p-1.5 shadow-[7px_7px_0_#03100b] backdrop-blur-sm sm:border-[6px] sm:p-2 md:overflow-hidden md:shadow-[10px_10px_0_#03100b]"
          
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

                  <div
                    className={[
                      "rounded-full border-[3px] border-[#061811] bg-[#f5d06f] px-3 py-1 text-[10px] font-black text-[#061811] shadow-[3px_3px_0_#04120d] transition-opacity duration-100",
                      isResolvingHand ? "opacity-100" : "opacity-0",
                    ].join(" ")}
                    style={{ animation: isResolvingHand ? "targetBanner 180ms ease-out" : undefined }}
                    aria-hidden={!isResolvingHand}
                  >
                    CLEAR TARGETS
                  </div>
                </div>

                <div className="portrait-board pixel-hard relative mx-auto grid aspect-square min-h-0 w-full max-w-[min(94vw,560px)] flex-none grid-cols-5 grid-rows-5 gap-1 border-[5px] border-[#061811] bg-[#09231d] p-1.5 shadow-[inset_0_0_0_2px_#1a4e3e,inset_0_0_38px_rgba(0,0,0,0.58),5px_5px_0_#04120d] sm:gap-1.5 sm:p-2 md:max-h-full md:max-w-none md:flex-1 lg:aspect-auto lg:max-h-none xl:gap-2 xl:p-3">
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
                          tabIndex={-1}
                          onMouseDown={(event) => event.preventDefault()}
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
                              ? "pixel-hit-cell z-20 bg-transparent shadow-[0_0_0_2px_#f5d06f,0_0_10px_rgba(255,239,122,0.38),4px_4px_0_#000]"
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

            <aside className="portrait-side solo-side flex min-h-0 flex-col gap-2 overflow-visible md:overflow-hidden">
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
                    className="now-card-display solo-now-card-display w-24 shrink-0 rotate-[-2deg] bg-transparent p-0 sm:w-28 lg:w-32 xl:w-36"
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

              <div className="solo-control-buttons grid shrink-0 grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  onClick={restartGame}
                  className="control-image-button restart-image-button transition hover:-translate-y-0.5 active:translate-y-0"
                  aria-label="Restart game"
                >
                  <img src={RESTART_BUTTON_SRC} alt="RESTART" draggable={false} />
                </button>

                <button
                  onClick={() => {
                    playSound("select");
                    setScreen("home");

                    if (bgmVolume > 0) {
                      setBgmEnabled(true);
                      window.setTimeout(() => startBgm(HOME_BGM_SRC), 0);
                    }
                  }}
                  className="control-image-button home-image-button transition hover:-translate-y-0.5 active:translate-y-0"
                  aria-label="Go home"
                >
                  <img src={HOME_BUTTON_SRC} alt="HOME" draggable={false} />
                </button>
              </div>
            </aside>
          </div>
        </section>
      </div>
        {renderSettingsButtonAndModal()}
    </main>
  );
}
