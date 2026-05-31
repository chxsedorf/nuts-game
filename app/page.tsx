"use client";

import { useEffect, useMemo, useState } from "react";

type Suit = "spade" | "heart" | "diamond" | "club";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
};

type BoardCell = Card | null;
type Board = BoardCell[][];

type CardPosition = { row: number; col: number };
type LineCard = { row: number; col: number; card: Card };

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
  lastResult: string;
  lastScore: number;
  isGameOver: boolean;
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

const scoreTable = {
  pair: 10,
  three: 40,
  straight: 60,
  fullHouse: 150,
};

const handExamples = [
  { name: "Pair", cards: ["7♥", "7♠"] },
  { name: "Three", cards: ["Q♥", "Q♦", "Q♣"] },
  { name: "Straight", cards: ["5♠", "6♥", "7♣"] },
  { name: "Full House", cards: ["9♥", "9♠", "9♣", "K♦", "K♥"] },
];

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
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
      deck.push({ id: `${rank}-${suit}-${crypto.randomUUID()}`, suit, rank, value });
    }
  }
  return shuffle(deck);
}

function drawCards(deck: Card[], count: number): { drawn: Card[]; rest: Card[] } {
  let currentDeck = [...deck];
  if (currentDeck.length < count) currentDeck = [...currentDeck, ...createDeck()];
  return { drawn: currentDeck.slice(0, count), rest: currentDeck.slice(count) };
}

function countFilledCells(board: Board): number {
  return board.flat().filter(Boolean).length;
}

function getCardUsefulness(card: Card, board: Board): number {
  let usefulness = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      if (cell.value === card.value) usefulness += 3;
      if (cell.suit === card.suit) usefulness += 1;
      if (Math.abs(cell.value - card.value) === 1) usefulness += 2;
      if ((card.value === 14 && cell.value === 2) || (card.value === 2 && cell.value === 14)) usefulness += 2;
    }
  }
  return usefulness;
}

function drawCardsForBoard(deck: Card[], count: number, board: Board): { drawn: Card[]; rest: Card[] } {
  let currentDeck = [...deck];
  const drawn: Card[] = [];

  while (drawn.length < count) {
    if (currentDeck.length < 6) currentDeck = [...currentDeck, ...createDeck()];

    const filledCells = countFilledCells(board);
    const biasChance = filledCells >= 18 ? 0.72 : filledCells >= 12 ? 0.52 : 0.32;
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

  return { drawn, rest: currentDeck };
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

function keyOf(row: number, col: number) {
  return `${row}-${col}`;
}

function toPositions(cards: LineCard[]): CardPosition[] {
  return cards.map(({ row, col }) => ({ row, col }));
}

function getLine(board: Board, row: number, col: number, dRow: number, dCol: number): LineCard[] {
  const line: LineCard[] = [];
  let r = row;
  let c = col;

  while (r - dRow >= 0 && r - dRow < BOARD_SIZE && c - dCol >= 0 && c - dCol < BOARD_SIZE && board[r - dRow][c - dCol]) {
    r -= dRow;
    c -= dCol;
  }

  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c]) {
    line.push({ row: r, col: c, card: board[r][c] as Card });
    r += dRow;
    c += dCol;
  }

  return line;
}

function includesPlaced(cards: LineCard[], row: number, col: number): boolean {
  return cards.some((item) => item.row === row && item.col === col);
}

function isOrderedStraight(values: number[]): boolean {
  const ascending = values.every((value, index) => index === 0 || value === values[index - 1] + 1);
  const descending = values.every((value, index) => index === 0 || value === values[index - 1] - 1);
  const aceLow = values.map((value) => (value === 14 ? 1 : value));
  const aceLowAscending = aceLow.every((value, index) => index === 0 || value === aceLow[index - 1] + 1);
  const aceLowDescending = aceLow.every((value, index) => index === 0 || value === aceLow[index - 1] - 1);
  return ascending || descending || aceLowAscending || aceLowDescending;
}

function isCleanFullHouse(cards: LineCard[]): boolean {
  if (cards.length !== 5) return false;
  const values = cards.map((item) => item.card.value);
  const firstThree = values[0] === values[1] && values[1] === values[2] && values[3] === values[4] && values[2] !== values[3];
  const firstTwo = values[0] === values[1] && values[2] === values[3] && values[3] === values[4] && values[1] !== values[2];
  return firstThree || firstTwo;
}

function addUniqueResult(results: HandResult[], result: HandResult) {
  const resultKey = result.cards.map((card) => keyOf(card.row, card.col)).sort().join("|");
  const exists = results.some((existing) => {
    const existingKey = existing.cards.map((card) => keyOf(card.row, card.col)).sort().join("|");
    return existing.name === result.name && existingKey === resultKey;
  });
  if (!exists) results.push(result);
}

function evaluateLine(line: LineCard[], placedRow: number, placedCol: number): HandResult[] {
  if (line.length < 2) return [];
  const results: HandResult[] = [];

  for (let start = 0; start < line.length; start++) {
    const pairCards = line.slice(start, start + 2);
    if (pairCards.length === 2 && includesPlaced(pairCards, placedRow, placedCol) && pairCards[0].card.value === pairCards[1].card.value) {
      addUniqueResult(results, { name: "Pair", score: scoreTable.pair * pairCards.length, cards: toPositions(pairCards), shouldClear: false });
    }

    const threeCards = line.slice(start, start + 3);
    if (threeCards.length === 3 && includesPlaced(threeCards, placedRow, placedCol)) {
      const values = threeCards.map((item) => item.card.value);
      if (values.every((value) => value === values[0])) {
        addUniqueResult(results, { name: "Three Card", score: scoreTable.three * threeCards.length, cards: toPositions(threeCards), shouldClear: true });
      }
      if (isOrderedStraight(values)) {
        addUniqueResult(results, { name: "Straight", score: scoreTable.straight * threeCards.length, cards: toPositions(threeCards), shouldClear: true });
      }
    }

    const fiveCards = line.slice(start, start + 5);
    if (fiveCards.length === 5 && includesPlaced(fiveCards, placedRow, placedCol) && isCleanFullHouse(fiveCards)) {
      addUniqueResult(results, { name: "Full House", score: scoreTable.fullHouse * fiveCards.length, cards: toPositions(fiveCards), shouldClear: true });
    }
  }

  return results;
}

function evaluateBoard(board: Board, row: number, col: number): HandResult[] {
  return [
    ...evaluateLine(getLine(board, row, col, 0, 1), row, col),
    ...evaluateLine(getLine(board, row, col, 1, 0), row, col),
  ];
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
    lastResult: "Place the visible card.",
    lastScore: 0,
    isGameOver: false,
  };
}

function AppHeader({ onHome }: { onHome: () => void }) {
  return (
    <header className="flex h-[64px] shrink-0 items-center justify-between bg-[#007c6f] px-5 text-white shadow-sm">
      <div className="flex items-center gap-5">
        <div className="grid grid-cols-3 gap-1" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-white/90" />
          ))}
        </div>
        <button onClick={onHome} className="text-lg font-semibold tracking-[-0.02em]">
          NUTS Safety
        </button>
      </div>

      <div className="flex items-center gap-6 text-2xl">
        <span className="text-white/95">?</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/75 text-base font-medium">N</span>
      </div>
    </header>
  );
}

function SoftBoxIllustration() {
  return (
    <div className="relative h-48 w-56 drop-shadow-[0_30px_42px_rgba(0,0,0,0.13)]" aria-hidden="true">
      <div className="absolute left-10 top-10 h-32 w-40 rounded-[26px] bg-[#b9ebe4] shadow-[inset_10px_14px_18px_rgba(255,255,255,0.45),inset_-12px_-18px_24px_rgba(0,125,111,0.13)]" />
      <div className="absolute left-10 top-[72px] h-[3px] w-40 bg-[#00a794] shadow-[0_1px_0_rgba(255,255,255,0.55)]" />
      <div className="absolute left-[132px] top-[78px] h-10 w-8 rounded-b-xl rounded-t-md bg-[#00b5a3] shadow-[inset_4px_4px_6px_rgba(255,255,255,0.25)]">
        <div className="mx-auto mt-3 h-4 w-1.5 rounded-full bg-[#007c6f]" />
      </div>
      <div className="absolute left-12 top-8 h-8 w-36 rounded-[22px] bg-[#c9f2ed] blur-[1px]" />
    </div>
  );
}

function CardFace({ card, compact = false }: { card: Card; compact?: boolean }) {
  const isRed = card.suit === "heart" || card.suit === "diamond";
  return (
    <div className={["flex h-full w-full flex-col justify-between rounded-xl border border-[#d0d7de] bg-white p-2 shadow-sm", isRed ? "text-[#c92a2a]" : "text-[#1f2937]"].join(" ")}>
      <div className="text-left font-bold leading-none">
        <p className={compact ? "text-sm" : "text-lg"}>{card.rank}</p>
        <p className={compact ? "text-base" : "text-2xl"}>{suitSymbols[card.suit]}</p>
      </div>
      <div className={["text-center font-black leading-none", compact ? "text-3xl" : "text-5xl"].join(" ")}>{suitSymbols[card.suit]}</div>
      <div className="rotate-180 text-left font-bold leading-none">
        <p className={compact ? "text-sm" : "text-lg"}>{card.rank}</p>
        <p className={compact ? "text-base" : "text-2xl"}>{suitSymbols[card.suit]}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#e6e6e6] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#61716f]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#1f2937]">{value}</p>
    </div>
  );
}

function HomeScreen({ highScore, onStart }: { highScore: number; onStart: () => void }) {
  return (
    <main className="flex min-h-screen flex-col bg-[#f4f4f4] text-[#1f2937]">
      <AppHeader onHome={() => {}} />

      <section className="flex flex-1 items-center px-6 py-10 md:px-16">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 md:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#007c6f]">Grid Poker</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#202124] md:text-6xl">
              NUTSへようこそ
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#3f4a4a]">
              5×5のボードにカードを置き、縦・横だけでポーカー役を作るシンプルなカードパズルです。画面は参考画像のように、余白を広く取ったクリーンな構成に変更しています。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={onStart}
                className="rounded-md bg-[#007c6f] px-7 py-3 text-base font-semibold text-white shadow-[0_12px_24px_rgba(0,124,111,0.22)] transition hover:bg-[#006b60]"
              >
                ゲームを開始
              </button>
              <div className="rounded-md border border-[#d9d9d9] bg-white px-5 py-3 text-sm text-[#3f4a4a]">
                Best Score: <span className="font-semibold text-[#202124]">{highScore}</span>
              </div>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
              {handExamples.map((hand) => (
                <div key={hand.name} className="rounded-2xl border border-[#e3e3e3] bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
                  <p className="mb-2 text-sm font-semibold text-[#202124]">{hand.name}</p>
                  <div className="flex gap-1.5">
                    {hand.cards.map((card, index) => (
                      <span key={`${hand.name}-${card}-${index}`} className="rounded-md border border-[#d0d7de] bg-[#fafafa] px-2 py-1 text-sm font-bold text-[#3f4a4a]">
                        {card}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden justify-center md:flex">
            <SoftBoxIllustration />
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => createInitialGame(0));
  const [screen, setScreen] = useState<ScreenState>("home");
  const [isLoaded, setIsLoaded] = useState(false);
  const [placedCell, setPlacedCell] = useState<string | null>(null);
  const [highlightCells, setHighlightCells] = useState<Set<string>>(new Set());
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    setGame((prev) => ({ ...prev, highScore: getSavedHighScore() }));
    setIsLoaded(true);
  }, []);

  const selectedCard = game.hand[0] ?? null;
  const filledCount = useMemo(() => countFilledCells(game.board), [game.board]);

  function resetEffects() {
    setPlacedCell(null);
    setHighlightCells(new Set());
    setClearingCells(new Set());
  }

  function startGame() {
    resetEffects();
    setGame((prev) => createInitialGame(prev.highScore));
    setScreen("game");
  }

  function restartGame() {
    resetEffects();
    setGame((prev) => createInitialGame(prev.highScore));
  }

  function placeCard(row: number, col: number) {
    if (game.isGameOver || !game.hand[0] || game.board[row][col]) return;

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
      for (const cardPosition of result.cards) handTargets.add(keyOf(cardPosition.row, cardPosition.col));
      if (!result.shouldClear) continue;
      for (const cardPosition of result.cards) clearTargets.add(keyOf(cardPosition.row, cardPosition.col));
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
    if (nextHighScore > game.highScore) saveHighScore(nextHighScore);

    const nextGameOver = isBoardFull(newBoard);
    const resultText = hasHand
      ? results.map((result) => result.name).join(" + ")
      : game.combo > 1 && nextCombo === 1
        ? "Combo broken"
        : game.combo > 1
          ? `No hand - ${nextComboWindow} left`
          : "No hand";

    setPlacedCell(keyOf(row, col));
    setHighlightCells(handTargets);
    setClearingCells(clearTargets);

    if (clearTargets.size > 0) {
      setGame((prev) => ({ ...prev, board: boardBeforeClear }));
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
        lastResult: nextGameOver ? "Game over" : resultText,
        lastScore: gainedScore,
        isGameOver: nextGameOver,
      });
    }, clearTargets.size > 0 ? 320 : 120);

    window.setTimeout(resetEffects, 760);
  }

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f4f4] text-[#007c6f]">
        <p className="text-xl font-semibold">NUTS</p>
      </main>
    );
  }

  if (screen === "home") {
    return <HomeScreen highScore={game.highScore} onStart={startGame} />;
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f4f4] text-[#1f2937]">
      <AppHeader onHome={() => setScreen("home")} />

      <section className="relative flex flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[1fr_340px]">
          <div className="rounded-[2rem] bg-white px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] md:px-8 md:py-8">
            <div className="grid items-start gap-8 lg:grid-cols-[1fr_220px]">
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#202124] md:text-5xl">
                  {game.isGameOver ? "ボードがいっぱいです" : "カードを配置してください"}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#3f4a4a]">
                  左のカードだけをボードに置けます。縦・横に Pair / Three / Straight / Full House を作るとスコアが入ります。
                </p>
              </div>

              <div className="hidden justify-end lg:flex">
                <SoftBoxIllustration />
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <Stat label="Score" value={game.score} />
              <Stat label="Best" value={game.highScore} />
              <Stat label="Combo" value={`x${game.combo}`} />
              <Stat label="Filled" value={`${filledCount}/25`} />
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(420px,620px)_1fr] lg:items-start">
              <div className="rounded-3xl border border-[#dfe5e3] bg-[#f8fbfa] p-3 shadow-inner">
                <div className="grid aspect-square grid-cols-5 gap-2">
                  {game.board.map((boardRow, rowIndex) =>
                    boardRow.map((cell, colIndex) => {
                      const cellKey = keyOf(rowIndex, colIndex);
                      const canPlace = !cell && !game.isGameOver && game.hand.length > 0;
                      const isPlaced = placedCell === cellKey;
                      const isHighlighted = highlightCells.has(cellKey);
                      const isClearing = clearingCells.has(cellKey);

                      return (
                        <button
                          key={cellKey}
                          onClick={() => placeCard(rowIndex, colIndex)}
                          disabled={!canPlace}
                          className={[
                            "relative overflow-hidden rounded-2xl border transition duration-200",
                            cell ? "border-[#d0d7de] bg-white p-1.5 shadow-sm" : "border-[#dfe5e3] bg-white/70 hover:bg-[#e8f4f1]",
                            canPlace ? "cursor-pointer hover:-translate-y-0.5 hover:border-[#007c6f]" : "",
                            isHighlighted ? "ring-4 ring-[#00a794]/30" : "",
                            isClearing ? "opacity-40 scale-95" : "",
                            isPlaced ? "ring-4 ring-[#007c6f]/20" : "",
                          ].join(" ")}
                        >
                          {cell ? (
                            <CardFace card={cell} compact />
                          ) : (
                            <span className="text-2xl text-[#c7d5d2]">+</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-[#e3e3e3] bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#61716f]">Current card</p>
                  <div className="mt-4 flex items-center gap-5">
                    <div className="h-40 w-28 shrink-0">
                      {selectedCard ? <CardFace card={selectedCard} /> : <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#d0d7de] text-sm text-[#61716f]">Empty</div>}
                    </div>
                    <div>
                      <p className="text-4xl font-semibold tracking-[-0.04em] text-[#202124]">
                        {selectedCard ? `${selectedCard.rank}${suitSymbols[selectedCard.suit]}` : "-"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#61716f]">このカードを空きマスに配置します。次のカードはデッキとして伏せたままです。</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#e3e3e3] bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#61716f]">Status</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#202124]">{game.lastResult}</p>
                  <p className="mt-2 text-sm text-[#61716f]">Last score: {game.lastScore}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={restartGame} className="rounded-md border border-[#d0d7de] bg-white px-4 py-3 font-semibold text-[#202124] transition hover:bg-[#f2f2f2]">
                    Restart
                  </button>
                  <button onClick={() => setScreen("home")} className="rounded-md bg-[#007c6f] px-4 py-3 font-semibold text-white transition hover:bg-[#006b60]">
                    Home
                  </button>
                </div>
              </aside>
            </div>
          </div>

          <aside className="rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.08)] xl:block">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#61716f]">Hands</p>
            <div className="mt-4 space-y-3">
              {handExamples.map((hand) => (
                <div key={hand.name} className="rounded-2xl border border-[#e3e3e3] bg-[#fbfbfb] p-4">
                  <p className="font-semibold text-[#202124]">{hand.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hand.cards.map((card, index) => (
                      <span key={`${hand.name}-${card}-${index}`} className="rounded-md border border-[#d0d7de] bg-white px-2 py-1 text-sm font-bold text-[#3f4a4a]">
                        {card}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-[#eef8f6] p-4 text-sm leading-6 text-[#3f4a4a]">
              参考画像のように、上部の濃いティールバー、広い余白、白いカード型コンテンツ、右側の柔らかいボックスイラストで統一しています。
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
