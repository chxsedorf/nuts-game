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

type Board = (Card | null)[][];
type Position = { row: number; col: number };
type HitResult = { name: string; score: number; cards: Position[] } | null;
type Screen = "home" | "game" | "over";

const BOARD_SIZE = 5;
const HAND_SIZE = 3;
const HIGH_SCORE_KEY = "nuts-simple-high-score";

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

const suitSymbol: Record<Suit, string> = {
  spade: "♠",
  heart: "♥",
  diamond: "♦",
  club: "♣",
};

const suitColor: Record<Suit, string> = {
  spade: "from-sky-300 to-cyan-500",
  heart: "from-rose-300 to-red-500",
  diamond: "from-amber-200 to-orange-500",
  club: "from-emerald-300 to-green-500",
};

function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function shuffle<T>(source: T[]): T[] {
  const array = [...source];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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

function draw(deck: Card[], count: number): { cards: Card[]; deck: Card[] } {
  let nextDeck = [...deck];
  if (nextDeck.length < count) nextDeck = [...nextDeck, ...createDeck()];
  return { cards: nextDeck.slice(0, count), deck: nextDeck.slice(count) };
}

function filledCount(board: Board): number {
  return board.flat().filter(Boolean).length;
}

function isStraight(values: number[]): boolean {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length < 3) return false;

  for (let i = 0; i <= unique.length - 3; i += 1) {
    const slice = unique.slice(i, i + 3);
    if (slice[1] === slice[0] + 1 && slice[2] === slice[1] + 1) return true;
  }

  const aceLow = values.map((v) => (v === 14 ? 1 : v));
  const aceLowUnique = [...new Set(aceLow)].sort((a, b) => a - b);
  for (let i = 0; i <= aceLowUnique.length - 3; i += 1) {
    const slice = aceLowUnique.slice(i, i + 3);
    if (slice[1] === slice[0] + 1 && slice[2] === slice[1] + 1) return true;
  }

  return false;
}

function judgeLine(cards: { card: Card; row: number; col: number }[]): HitResult {
  if (cards.length < 2) return null;

  const values = cards.map((item) => item.card.value);
  const suitsInLine = cards.map((item) => item.card.suit);
  const valueCounts = new Map<number, number>();
  for (const value of values) valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);

  const maxSame = Math.max(...valueCounts.values());
  const flush = cards.length >= 3 && new Set(suitsInLine).size === 1;
  const straight = cards.length >= 3 && isStraight(values);
  const fullHouse = cards.length >= 5 && [...valueCounts.values()].sort((a, b) => b - a).join(",").startsWith("3,2");

  let name = "";
  let score = 0;

  if (fullHouse) {
    name = "FULL HOUSE";
    score = 900;
  } else if (maxSame >= 4) {
    name = "FOUR";
    score = 700;
  } else if (maxSame >= 3) {
    name = "THREE";
    score = 320;
  } else if (straight && flush) {
    name = "STRAIGHT FLUSH";
    score = 1000;
  } else if (flush) {
    name = "FLUSH";
    score = 420;
  } else if (straight) {
    name = "STRAIGHT";
    score = 360;
  } else if (maxSame >= 2) {
    name = "PAIR";
    score = 120;
  }

  if (!name) return null;

  return {
    name,
    score,
    cards: cards.map(({ row, col }) => ({ row, col })),
  };
}

function findBestHit(board: Board): HitResult {
  const results: HitResult[] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const line = board[row]
      .map((card, col) => (card ? { card, row, col } : null))
      .filter(Boolean) as { card: Card; row: number; col: number }[];
    results.push(judgeLine(line));
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const line = board
      .map((rowCells, row) => (rowCells[col] ? { card: rowCells[col] as Card, row, col } : null))
      .filter(Boolean) as { card: Card; row: number; col: number }[];
    results.push(judgeLine(line));
  }

  const valid = results.filter(Boolean) as NonNullable<HitResult>[];
  if (valid.length === 0) return null;
  return valid.sort((a, b) => b.score - a.score || b.cards.length - a.cards.length)[0];
}

function clearCards(board: Board, cards: Position[]): Board {
  const next = board.map((row) => [...row]);
  for (const { row, col } of cards) next[row][col] = null;
  return next;
}

function makeInitialState(highScore: number) {
  const deck = createDeck();
  const first = draw(deck, HAND_SIZE);
  return {
    board: emptyBoard(),
    deck: first.deck,
    hand: first.cards,
    score: 0,
    combo: 1,
    highScore,
    selected: 0,
    lastHit: "",
    flashCells: [] as Position[],
  };
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [highScore, setHighScore] = useState(0);
  const [game, setGame] = useState(() => makeInitialState(0));
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
    setHighScore(saved);
    setGame(makeInitialState(saved));
  }, []);

  useEffect(() => {
    if (screen !== "game") return;
    const nextBest = Math.max(highScore, game.score);
    if (nextBest !== highScore) {
      setHighScore(nextBest);
      window.localStorage.setItem(HIGH_SCORE_KEY, String(nextBest));
    }
  }, [game.score, highScore, screen]);

  const emptyCells = useMemo(() => BOARD_SIZE * BOARD_SIZE - filledCount(game.board), [game.board]);

  function startGame() {
    setGame(makeInitialState(highScore));
    setToast("");
    setScreen("game");
  }

  function placeCard(row: number, col: number) {
    if (screen !== "game") return;
    if (game.board[row][col]) return;
    const card = game.hand[game.selected];
    if (!card) return;

    const boardAfterPlace = game.board.map((line) => [...line]);
    boardAfterPlace[row][col] = card;

    const handAfterPlace = game.hand.filter((_, index) => index !== game.selected);
    const hit = findBestHit(boardAfterPlace);

    let nextBoard = boardAfterPlace;
    let nextScore = game.score;
    let nextCombo = Math.max(1, game.combo - 1);
    let flashCells: Position[] = [];
    let message = "";

    if (hit) {
      const gained = hit.score * game.combo;
      nextScore += gained;
      nextCombo = Math.min(9, game.combo + 1);
      flashCells = hit.cards;
      nextBoard = clearCards(boardAfterPlace, hit.cards);
      message = `${hit.name}  +${gained}`;
      setToast(message);
      window.setTimeout(() => setToast(""), 900);
    }

    let nextHand = handAfterPlace;
    let nextDeck = game.deck;
    if (nextHand.length === 0) {
      const drawn = draw(nextDeck, HAND_SIZE);
      nextHand = drawn.cards;
      nextDeck = drawn.deck;
    }

    const nextSelected = Math.min(game.selected, Math.max(0, nextHand.length - 1));
    const isOver = filledCount(nextBoard) >= BOARD_SIZE * BOARD_SIZE;

    setGame({
      ...game,
      board: nextBoard,
      deck: nextDeck,
      hand: nextHand,
      score: nextScore,
      combo: nextCombo,
      selected: nextSelected,
      lastHit: hit?.name ?? "",
      flashCells,
    });

    window.setTimeout(() => {
      setGame((current) => ({ ...current, flashCells: [] }));
    }, 420);

    if (isOver) {
      setScreen("over");
    }
  }

  function isFlashing(row: number, col: number) {
    return game.flashCells.some((cell) => cell.row === row && cell.col === col);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#38548c] text-white">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          background: #38548c;
          overscroll-behavior: none;
        }
        @keyframes pop-hit {
          0% { transform: translate(-50%, -50%) scale(.72); opacity: 0; }
          18% { opacity: 1; }
          100% { transform: translate(-50%, -80%) scale(1.04); opacity: 0; }
        }
        @keyframes cell-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
      `}</style>

      {screen === "home" && (
        <section className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col items-center justify-center px-7 text-center">
          <div className="mb-5 text-[72px] font-black leading-none tracking-tight drop-shadow-[0_6px_0_rgba(0,0,0,.18)]">NUTS</div>
          <p className="mb-10 text-sm font-bold uppercase tracking-[.28em] text-white/70">Grid Poker</p>
          <button
            onClick={startGame}
            className="mb-5 h-16 w-full rounded-3xl bg-white text-2xl font-black text-[#38548c] shadow-[0_9px_0_rgba(0,0,0,.16)] active:translate-y-1 active:shadow-[0_4px_0_rgba(0,0,0,.16)]"
          >
            PLAY
          </button>
          <div className="rounded-2xl bg-black/15 px-6 py-3 text-lg font-black text-amber-300">BEST {highScore}</div>
        </section>
      )}

      {screen === "game" && (
        <section className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-5 pb-6 pt-10">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xl font-black text-amber-300 drop-shadow-[0_3px_0_rgba(0,0,0,.22)]">
              <span className="text-4xl">♛</span>
              <span>{highScore}</span>
            </div>
            <button
              onClick={() => setScreen("home")}
              className="grid h-12 w-12 place-items-center rounded-2xl bg-white/12 text-2xl font-black text-white/75"
              aria-label="Back to title"
            >
              ⚙
            </button>
          </header>

          <div className="relative mb-7 flex h-24 items-center justify-center">
            <div className="absolute h-24 w-24 rounded-[32px] bg-fuchsia-400 blur-xl opacity-70 rotate-45" />
            <div className="relative text-6xl font-black tracking-tight drop-shadow-[0_5px_0_rgba(0,0,0,.23)]">{game.score}</div>
            {game.combo > 1 && (
              <div className="absolute -bottom-2 rounded-full bg-white/15 px-4 py-1 text-sm font-black">x{game.combo}</div>
            )}
          </div>

          <div className="relative mx-auto aspect-square w-full rounded-xl bg-[#182445] p-1.5 shadow-[0_4px_0_rgba(0,0,0,.22),inset_0_0_0_3px_rgba(255,255,255,.05)]">
            {toast && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 rounded-3xl bg-white px-6 py-3 text-xl font-black text-[#38548c] shadow-xl" style={{ animation: "pop-hit .9s ease-out forwards" }}>
                {toast}
              </div>
            )}
            <div className="grid h-full w-full grid-cols-5 gap-1.5">
              {game.board.map((line, row) =>
                line.map((card, col) => (
                  <button
                    key={`${row}-${col}`}
                    onClick={() => placeCard(row, col)}
                    className={`relative overflow-hidden rounded-md bg-[#202b50] shadow-[inset_0_0_0_2px_rgba(0,0,0,.12)] ${!card ? "active:scale-95" : ""}`}
                    aria-label={`cell ${row + 1}-${col + 1}`}
                  >
                    {card && (
                      <div
                        className={`absolute inset-0 rounded-md bg-gradient-to-br ${suitColor[card.suit]} shadow-[inset_5px_5px_0_rgba(255,255,255,.28),inset_-6px_-7px_0_rgba(0,0,0,.2)] ${isFlashing(row, col) ? "ring-4 ring-white/90" : ""}`}
                        style={isFlashing(row, col) ? { animation: "cell-pop .42s ease-out" } : undefined}
                      >
                        <div className="absolute left-1.5 top-1 text-xs font-black text-white/90">{card.rank}</div>
                        <div className="grid h-full place-items-center text-xl font-black text-white/90">{suitSymbol[card.suit]}</div>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-9 flex flex-1 items-start justify-between gap-7 px-5">
            {game.hand.map((card, index) => (
              <button
                key={card.id}
                onClick={() => setGame((current) => ({ ...current, selected: index }))}
                className={`aspect-square w-20 rounded-md bg-gradient-to-br ${suitColor[card.suit]} shadow-[inset_7px_7px_0_rgba(255,255,255,.28),inset_-8px_-9px_0_rgba(0,0,0,.2),0_6px_0_rgba(0,0,0,.18)] transition ${game.selected === index ? "-translate-y-3 scale-110 ring-4 ring-white/80" : "opacity-90"}`}
                aria-label={`select ${card.rank}${suitSymbol[card.suit]}`}
              >
                <div className="text-lg font-black text-white/95">{card.rank}</div>
                <div className="text-3xl font-black text-white/90">{suitSymbol[card.suit]}</div>
              </button>
            ))}
          </div>

          <footer className="flex justify-center gap-4 text-xs font-black uppercase tracking-widest text-white/40">
            <span>Deck {game.deck.length}</span>
            <span>Empty {emptyCells}</span>
          </footer>
        </section>
      )}

      {screen === "over" && (
        <section className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col items-center justify-center px-7 text-center">
          <div className="mb-4 text-5xl font-black tracking-tight">GAME OVER</div>
          <div className="mb-2 text-sm font-black uppercase tracking-[.25em] text-white/50">Score</div>
          <div className="mb-8 text-7xl font-black drop-shadow-[0_6px_0_rgba(0,0,0,.2)]">{game.score}</div>
          <button
            onClick={startGame}
            className="mb-4 h-16 w-full rounded-3xl bg-white text-2xl font-black text-[#38548c] shadow-[0_9px_0_rgba(0,0,0,.16)] active:translate-y-1 active:shadow-[0_4px_0_rgba(0,0,0,.16)]"
          >
            RETRY
          </button>
          <button onClick={() => setScreen("home")} className="h-14 w-full rounded-3xl bg-black/15 text-lg font-black text-white/80">
            TITLE
          </button>
        </section>
      )}
    </main>
  );
}
