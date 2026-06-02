"use client";

import React, { useMemo, useState } from "react";

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

type Card = {
  id: string;
  rank: Rank;
  suit: Suit;
};

type Cell = Card | null;
type Board = Cell[];

type Pos = {
  row: number;
  col: number;
};

type HandKind = "PAIR" | "THREE" | "STRAIGHT" | "FULL_HOUSE";

type HandResult = {
  kind: HandKind;
  label: string;
  score: number;
  remove: boolean;
  cells: number[];
  ranks: number[];
};

type GameStatus = "READY" | "PLAYING" | "GAME_OVER";

type Settings = {
  sound: boolean;
  showDebug: boolean;
  reducedMotion: boolean;
};

const BOARD_SIZE = 5;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const HAND_PRIORITY: Record<HandKind, number> = {
  FULL_HOUSE: 4,
  STRAIGHT: 3,
  THREE: 2,
  PAIR: 1,
};

const HAND_LABEL: Record<HandKind, string> = {
  PAIR: "PAIR",
  THREE: "THREE",
  STRAIGHT: "STRAIGHT",
  FULL_HOUSE: "FULL HOUSE",
};

const HAND_SCORE: Record<HandKind, number> = {
  PAIR: 10,
  THREE: 30,
  STRAIGHT: 50,
  FULL_HOUSE: 120,
};

const HAND_REMOVE: Record<HandKind, boolean> = {
  PAIR: false,
  THREE: true,
  STRAIGHT: true,
  FULL_HOUSE: true,
};

function indexOf(row: number, col: number) {
  return row * BOARD_SIZE + col;
}

function posOf(index: number): Pos {
  return {
    row: Math.floor(index / BOARD_SIZE),
    col: index % BOARD_SIZE,
  };
}

function newDeck(): Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${suit}-${rank}-${crypto.randomUUID()}`,
        rank,
        suit,
      });
    }
  }

  return shuffle(cards);
}

function shuffle<T>(items: T[]): T[] {
  const copied = [...items];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function drawCard(deck: Card[]): { card: Card; deck: Card[] } {
  const nextDeck = deck.length > 0 ? deck : newDeck();
  const [card, ...rest] = nextDeck;
  return { card, deck: rest };
}

function rankLabel(rank: Rank) {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

function rankValue(card: Card) {
  // Aは完全に1として扱う。J/Q/Kは11/12/13として扱う。
  return card.rank;
}

function countByRank(cards: Card[]) {
  const counts = new Map<number, number>();

  for (const card of cards) {
    const value = rankValue(card);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function isStraight(cards: Card[]) {
  if (cards.length !== 3) return false;

  const values = cards.map(rankValue).sort((a, b) => a - b);
  const uniqueValues = new Set(values);

  if (uniqueValues.size !== 3) return false;

  return values[1] === values[0] + 1 && values[2] === values[1] + 1;
}

function analyzeExactWindow(cards: Card[], cells: number[]): HandResult | null {
  if (cards.length !== cells.length) return null;

  const ranks = cards.map(rankValue);
  const counts = [...countByRank(cards).values()].sort((a, b) => b - a);
  let kind: HandKind | null = null;

  if (cards.length === 5 && counts.length === 2 && counts[0] === 3 && counts[1] === 2) {
    kind = "FULL_HOUSE";
  } else if (cards.length === 3 && isStraight(cards)) {
    kind = "STRAIGHT";
  } else if (cards.length === 3 && counts.length === 1 && counts[0] === 3) {
    kind = "THREE";
  } else if (cards.length === 2 && counts.length === 1 && counts[0] === 2) {
    kind = "PAIR";
  }

  if (!kind) return null;

  return {
    kind,
    label: HAND_LABEL[kind],
    score: HAND_SCORE[kind],
    remove: HAND_REMOVE[kind],
    cells,
    ranks,
  };
}

function getLineIndexes(row: number, col: number, direction: "H" | "V") {
  const indexes: number[] = [];

  for (let i = 0; i < BOARD_SIZE; i += 1) {
    indexes.push(direction === "H" ? indexOf(row, i) : indexOf(i, col));
  }

  return indexes;
}

function getContiguousOccupiedSegment(board: Board, lineIndexes: number[], placedIndex: number) {
  const placedLinePosition = lineIndexes.indexOf(placedIndex);
  if (placedLinePosition === -1) return [];

  let start = placedLinePosition;
  let end = placedLinePosition;

  while (start > 0 && board[lineIndexes[start - 1]]) {
    start -= 1;
  }

  while (end < lineIndexes.length - 1 && board[lineIndexes[end + 1]]) {
    end += 1;
  }

  return lineIndexes.slice(start, end + 1);
}

function getWindowsIncludingPlaced(segment: number[], placedIndex: number, length: 2 | 3 | 5) {
  const windows: number[][] = [];

  if (segment.length < length) return windows;

  for (let start = 0; start <= segment.length - length; start += 1) {
    const window = segment.slice(start, start + length);

    // 短いsliceを絶対に評価しない。指定長ぴったりの窓だけ判定する。
    if (window.length === length && window.includes(placedIndex)) {
      windows.push(window);
    }
  }

  return windows;
}

function evaluatePlacedCard(board: Board, placedIndex: number): HandResult | null {
  const placedCard = board[placedIndex];
  if (!placedCard) return null;

  const { row, col } = posOf(placedIndex);
  const candidates: HandResult[] = [];

  for (const direction of ["H", "V"] as const) {
    const line = getLineIndexes(row, col, direction);
    const segment = getContiguousOccupiedSegment(board, line, placedIndex);

    for (const length of [5, 3, 2] as const) {
      const windows = getWindowsIncludingPlaced(segment, placedIndex, length);

      for (const window of windows) {
        const cards = window.map((cellIndex) => board[cellIndex]).filter((card): card is Card => card !== null);
        const result = analyzeExactWindow(cards, window);

        if (result) {
          candidates.push(result);
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const priorityDiff = HAND_PRIORITY[b.kind] - HAND_PRIORITY[a.kind];
    if (priorityDiff !== 0) return priorityDiff;
    return b.cells.length - a.cells.length;
  })[0];
}

function removeCells(board: Board, indexes: number[]) {
  const nextBoard = [...board];

  for (const index of indexes) {
    nextBoard[index] = null;
  }

  return nextBoard;
}

function isBoardFull(board: Board) {
  return board.every(Boolean);
}

function comboMultiplier(combo: number) {
  return Math.max(1, combo);
}

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_CELLS }, () => null);
}

function createInitialGame() {
  const deck = newDeck();
  const drawn = drawCard(deck);

  return {
    board: createEmptyBoard(),
    deck: drawn.deck,
    currentCard: drawn.card,
    score: 0,
    combo: 0,
    turnsSinceHand: 0,
    status: "PLAYING" as GameStatus,
    lastHand: null as HandResult | null,
    lastMessage: "Place a card.",
    selectedCells: [] as number[],
  };
}

export default function Page() {
  const [game, setGame] = useState(() => createInitialGame());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    sound: false,
    showDebug: false,
    reducedMotion: false,
  });
  const [screen, setScreen] = useState<"HOME" | "GAME">("HOME");

  const emptyCells = useMemo(() => game.board.filter((cell) => cell === null).length, [game.board]);
  const deckLeft = game.deck.length + 1;

  function startGame() {
    setGame(createInitialGame());
    setSettingsOpen(false);
    setScreen("GAME");
  }

  function restart() {
    setGame(createInitialGame());
    setSettingsOpen(false);
    setScreen("GAME");
  }

  function backToTitle() {
    setSettingsOpen(false);
    setScreen("HOME");
  }

  function placeCard(targetIndex: number) {
    setGame((currentGame) => {
      if (currentGame.status !== "PLAYING") return currentGame;
      if (currentGame.board[targetIndex]) return currentGame;

      const placedBoard = [...currentGame.board];
      placedBoard[targetIndex] = currentGame.currentCard;

      const hand = evaluatePlacedCard(placedBoard, targetIndex);
      const drawn = drawCard(currentGame.deck);

      let nextBoard = placedBoard;
      let nextCombo = currentGame.combo;
      let nextTurnsSinceHand = currentGame.turnsSinceHand + 1;
      let gainedScore = 0;
      let message = "No hand.";
      let selectedCells: number[] = [targetIndex];

      if (hand) {
        const comboContinues = currentGame.combo > 0 && currentGame.turnsSinceHand <= 3;
        nextCombo = comboContinues ? currentGame.combo + 1 : 1;
        nextTurnsSinceHand = 0;
        gainedScore = hand.score * comboMultiplier(nextCombo);
        message = `${hand.label} +${gainedScore}`;
        selectedCells = hand.cells;

        if (hand.remove) {
          nextBoard = removeCells(placedBoard, hand.cells);
        }
      } else if (currentGame.turnsSinceHand >= 3) {
        nextCombo = 0;
      }

      const nextStatus: GameStatus = isBoardFull(nextBoard) ? "GAME_OVER" : "PLAYING";

      return {
        ...currentGame,
        board: nextBoard,
        deck: drawn.deck,
        currentCard: drawn.card,
        score: currentGame.score + gainedScore,
        combo: nextCombo,
        turnsSinceHand: nextTurnsSinceHand,
        status: nextStatus,
        lastHand: hand,
        lastMessage: nextStatus === "GAME_OVER" ? "Game Over" : message,
        selectedCells,
      };
    });
  }

  return (
    <main className={`nuts-root ${settings.reducedMotion ? "motion-off" : ""}`}>
      <div className="bg-grid" />

      <button className="settings-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
        ⚙
      </button>

      {settingsOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="modal-card">
            <div className="modal-head">
              <div>
                <p className="eyebrow">NUTS</p>
                <h2>Settings</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                ×
              </button>
            </div>

            <label className="setting-row">
              <span>Sound</span>
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(event) => setSettings((value) => ({ ...value, sound: event.target.checked }))}
              />
            </label>

            <label className="setting-row">
              <span>Show Debug</span>
              <input
                type="checkbox"
                checked={settings.showDebug}
                onChange={(event) => setSettings((value) => ({ ...value, showDebug: event.target.checked }))}
              />
            </label>

            <label className="setting-row">
              <span>Reduced Motion</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) => setSettings((value) => ({ ...value, reducedMotion: event.target.checked }))}
              />
            </label>
          </div>
        </div>
      )}

      {screen === "HOME" ? (
        <section className="home-shell">
          <div className="home-card">
            <div className="brand-mark" aria-hidden="true">
              <span>N</span>
              <i />
            </div>
            <p className="eyebrow">Stable Rebuild</p>
            <h1>NUTS</h1>
            <p className="home-copy">
              Place cards on a 5×5 board. Make hands only in rows and columns. Keep the combo alive within three turns.
            </p>

            <div className="home-actions">
              <button className="primary-button start-button" type="button" onClick={startGame}>
                Start Game
              </button>
              <button className="secondary-button" type="button" onClick={() => setSettingsOpen(true)}>
                Settings
              </button>
            </div>
          </div>

          <div className="home-rules">
            <RuleCard title="PAIR" score="Small" note="same rank ×2 / combo + small score" cards={[1, 1]} />
            <RuleCard title="THREE" score="Base" note="same rank ×3 / combo + score + clear" cards={[2, 2, 2]} />
            <RuleCard title="STRAIGHT" score="Middle" note="3 consecutive ranks / combo + middle score + clear" cards={[2, 3, 4]} />
            <RuleCard title="FULL HOUSE" score="Big" note="3 + 2 in 5 cards / combo + big score + clear" cards={[3, 3, 3, 5, 5]} />
          </div>
        </section>
      ) : (
      <section className="game-shell">
        <aside className="panel left-panel">
          <p className="eyebrow">Score</p>
          <div className="score">{game.score}</div>

          <div className="metric-grid">
            <div className="metric-card">
              <span>Combo</span>
              <strong>{game.combo}</strong>
            </div>
            <div className="metric-card">
              <span>Empty</span>
              <strong>{emptyCells}</strong>
            </div>
            <div className="metric-card wide">
              <span>Deck</span>
              <strong>{deckLeft}</strong>
            </div>
          </div>

          <div className="next-card-wrap">
            <p className="eyebrow">Next Card</p>
            <CardView card={game.currentCard} large />
            <div className="deck-stack" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="button-stack">
            <button className="primary-button" type="button" onClick={restart}>
              Restart
            </button>
            <button className="secondary-button" type="button" onClick={backToTitle}>
              Title
            </button>
          </div>
        </aside>

        <section className="board-section">
          <header className="title-area">
            <p className="eyebrow">Minimal Stable Build</p>
            <h1>NUTS</h1>
            <div className="status-bar">
              <span className={`hand-badge ${game.lastHand ? "active" : ""}`}>
                {game.lastHand ? game.lastHand.label : "NO HAND"}
              </span>
              <p className="status-text">{game.lastMessage}</p>
            </div>
          </header>

          <div className="board" aria-label="NUTS board">
            {game.board.map((cell, index) => {
              const isHit = game.selectedCells.includes(index);

              return (
                <button
                  key={index}
                  type="button"
                  className={`cell ${cell ? "filled" : "empty"} ${isHit ? "hit" : ""}`}
                  onClick={() => placeCard(index)}
                  disabled={game.status !== "PLAYING" || cell !== null}
                  aria-label={`cell ${index + 1}`}
                >
                  {cell ? <CardView card={cell} /> : <span className="empty-dot" />}
                </button>
              );
            })}
          </div>

          {game.status === "GAME_OVER" && (
            <div className="game-over-card">
              <p className="eyebrow">Result</p>
              <h2>GAME OVER</h2>
              <p>Final Score: {game.score}</p>
              <button className="primary-button" type="button" onClick={restart}>
                Play Again
              </button>
              <button className="secondary-button game-over-secondary" type="button" onClick={backToTitle}>
                Title
              </button>
            </div>
          )}
        </section>

        <aside className="panel right-panel">
          <p className="eyebrow">Hands</p>

          <div className="hand-list">
            <RuleCard title="PAIR" score="Small" note="same rank ×2 / no clear" cards={[1, 1]} />
            <RuleCard title="THREE" score="Base" note="same rank ×3 / clear" cards={[2, 2, 2]} />
            <RuleCard title="STRAIGHT" score="Middle" note="3 consecutive ranks / clear" cards={[2, 3, 4]} />
            <RuleCard title="FULL HOUSE" score="Big" note="3 + 2 in 5 cards / clear" cards={[3, 3, 3, 5, 5]} />
          </div>

          {settings.showDebug && (
            <div className="debug-box">
              <p className="eyebrow">Debug</p>
              <pre>{JSON.stringify(
                {
                  lastHand: game.lastHand?.label ?? null,
                  hitCells: game.lastHand?.cells ?? [],
                  ranks: game.lastHand?.ranks ?? [],
                  turnsSinceHand: game.turnsSinceHand,
                },
                null,
                2,
              )}</pre>
            </div>
          )}
        </aside>
      </section>
      )}

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html),
        :global(body) {
          margin: 0;
          min-height: 100%;
          background: #080706;
          overscroll-behavior: none;
        }

        :global(body) {
          overflow: hidden;
        }

        button,
        input {
          font: inherit;
        }

        .nuts-root {
          position: relative;
          width: 100vw;
          min-height: 100svh;
          height: 100svh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(12px, 2vw, 24px);
          color: #f7efe3;
          background:
            radial-gradient(circle at 50% 15%, rgba(233, 176, 92, 0.18), transparent 34%),
            linear-gradient(145deg, #16110d 0%, #0b0907 54%, #17110c 100%);
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          user-select: none;
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          opacity: 0.18;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black, transparent 76%);
        }

        .home-shell {
          position: relative;
          z-index: 1;
          width: min(1040px, 100%);
          min-height: min(680px, calc(100svh - 24px));
          display: grid;
          grid-template-columns: minmax(320px, 1.1fr) minmax(300px, 0.9fr);
          gap: clamp(14px, 2vw, 26px);
          align-items: stretch;
        }

        .home-card,
        .home-rules {
          border: 1px solid rgba(255, 230, 190, 0.22);
          background: rgba(17, 14, 10, 0.74);
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(18px);
          border-radius: 34px;
          padding: clamp(22px, 3vw, 36px);
        }

        .home-card {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }

        .home-card::after {
          content: "";
          position: absolute;
          inset: auto -70px -90px auto;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(244, 195, 110, 0.22), transparent 68%);
          pointer-events: none;
        }

        .brand-mark {
          width: 74px;
          height: 74px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          color: #201309;
          background: linear-gradient(145deg, #f7d78e, #c9822f);
          box-shadow: 0 18px 48px rgba(201, 130, 47, 0.28);
          font-weight: 1000;
          font-size: 34px;
          letter-spacing: -0.04em;
        }

        .brand-mark i {
          position: absolute;
          width: 22px;
          height: 4px;
          transform: translate(21px, 22px) rotate(-22deg);
          border-radius: 999px;
          background: rgba(32, 19, 9, 0.32);
        }

        .home-card h1 {
          text-align: left;
          font-size: clamp(64px, 11vw, 132px);
          margin-bottom: 18px;
        }

        .home-copy {
          max-width: 560px;
          color: #ead8bd;
          font-size: clamp(16px, 2vw, 20px);
          line-height: 1.7;
          font-weight: 700;
        }

        .home-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr);
          gap: 12px;
          margin-top: 28px;
        }

        .home-rules {
          display: grid;
          align-content: center;
          gap: 12px;
        }

        .game-shell {
          position: relative;
          z-index: 1;
          width: min(1280px, 100%);
          height: min(780px, calc(100svh - 24px));
          display: grid;
          grid-template-columns: minmax(210px, 0.8fr) minmax(360px, 1.45fr) minmax(250px, 0.95fr);
          gap: clamp(12px, 1.6vw, 22px);
          align-items: stretch;
        }

        .panel,
        .board-section,
        .game-over-card,
        .modal-card {
          border: 1px solid rgba(255, 230, 190, 0.22);
          background: rgba(17, 14, 10, 0.74);
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(18px);
        }

        .panel {
          border-radius: 28px;
          padding: clamp(16px, 2vw, 24px);
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
          overflow: hidden;
        }

        .board-section {
          position: relative;
          border-radius: 34px;
          padding: clamp(14px, 1.8vw, 24px);
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 14px;
          overflow: hidden;
        }

        .title-area {
          text-align: center;
        }

        .eyebrow {
          margin: 0 0 6px;
          color: #c89d63;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        h1,
        h2,
        p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 4px;
          font-size: clamp(34px, 5vw, 64px);
          line-height: 0.9;
          letter-spacing: 0.08em;
          text-shadow: 0 10px 36px rgba(230, 164, 72, 0.22);
        }

        h2 {
          margin-bottom: 8px;
        }

        .status-bar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 38px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 230, 190, 0.13);
          background: rgba(255, 255, 255, 0.045);
        }

        .status-text {
          min-height: 1.5em;
          margin-bottom: 0;
          color: #ead8bd;
          font-weight: 800;
        }

        .hand-badge {
          min-width: 78px;
          border-radius: 999px;
          padding: 6px 9px;
          color: #8c7f6a;
          background: rgba(255, 255, 255, 0.06);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .hand-badge.active {
          color: #241507;
          background: linear-gradient(180deg, #f7d78e, #c9822f);
        }

        .score {
          font-size: clamp(40px, 5vw, 72px);
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.04em;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .metric-card {
          border: 1px solid rgba(255, 230, 190, 0.16);
          border-radius: 18px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.045);
        }

        .metric-card span {
          display: block;
          margin-bottom: 4px;
          color: #b7a991;
          font-size: 12px;
          font-weight: 700;
        }

        .metric-card strong {
          font-size: 28px;
        }

        .next-card-wrap {
          position: relative;
          margin-top: auto;
        }

        .deck-stack {
          position: absolute;
          right: 12px;
          bottom: 4px;
          width: 42px;
          height: 56px;
          pointer-events: none;
        }

        .deck-stack span {
          position: absolute;
          inset: 0;
          border-radius: 9px;
          border: 1px solid rgba(255, 230, 190, 0.18);
          background:
            linear-gradient(135deg, rgba(244, 195, 110, 0.22), transparent 45%),
            rgba(255, 255, 255, 0.06);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
        }

        .deck-stack span:nth-child(1) { transform: translate(-8px, 6px) rotate(-8deg); opacity: 0.45; }
        .deck-stack span:nth-child(2) { transform: translate(-3px, 2px) rotate(-3deg); opacity: 0.68; }
        .deck-stack span:nth-child(3) { transform: translate(3px, -3px) rotate(4deg); opacity: 0.9; }

        .primary-button,
        .settings-button,
        .modal-close,
        .cell {
          border: 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .primary-button {
          width: 100%;
          border-radius: 18px;
          padding: 14px 16px;
          color: #1d1309;
          background: linear-gradient(180deg, #f4c36e, #c9822f);
          font-weight: 900;
          box-shadow: 0 10px 28px rgba(193, 117, 40, 0.28);
        }

        .secondary-button {
          width: 100%;
          border: 1px solid rgba(255, 230, 190, 0.2);
          border-radius: 18px;
          padding: 14px 16px;
          color: #f7efe3;
          background: rgba(255, 255, 255, 0.07);
          font-weight: 900;
          cursor: pointer;
        }

        .secondary-button:hover {
          background: rgba(244, 195, 110, 0.13);
          border-color: rgba(244, 195, 110, 0.42);
        }

        .button-stack {
          display: grid;
          gap: 10px;
        }

        .metric-card.wide {
          grid-column: 1 / -1;
        }

        .game-over-secondary {
          margin-top: 10px;
        }

        .settings-button {
          position: fixed;
          top: max(14px, env(safe-area-inset-top));
          right: max(14px, env(safe-area-inset-right));
          z-index: 50;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          color: #f7efe3;
          background: rgba(18, 14, 10, 0.92);
          border: 1px solid rgba(255, 230, 190, 0.24);
          box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45);
        }

        .modal-layer {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0, 0, 0, 0.66);
        }

        .modal-card {
          width: min(420px, 100%);
          border-radius: 28px;
          padding: 22px;
        }

        .modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .modal-close {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          color: #f7efe3;
          background: rgba(255, 255, 255, 0.08);
          font-size: 24px;
          line-height: 1;
        }

        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: #ead8bd;
          font-weight: 800;
        }

        .setting-row input {
          width: 22px;
          height: 22px;
          accent-color: #d28a36;
        }

        .board {
          align-self: center;
          justify-self: center;
          width: min(100%, calc(100svh - 190px), 560px);
          aspect-ratio: 1;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: clamp(7px, 1.2vw, 12px);
          padding: clamp(10px, 1.5vw, 16px);
          border-radius: 28px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.055), transparent),
            rgba(0, 0, 0, 0.32);
          border: 1px solid rgba(255, 230, 190, 0.18);
        }

        .cell {
          position: relative;
          min-width: 0;
          min-height: 0;
          border-radius: clamp(12px, 1.5vw, 20px);
          background:
            radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.12), transparent 56%),
            rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 230, 190, 0.14);
          display: grid;
          place-items: center;
          color: #f7efe3;
          transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
        }

        .cell:not(:disabled):hover {
          transform: translateY(-2px);
          border-color: rgba(244, 195, 110, 0.62);
          background: rgba(244, 195, 110, 0.14);
        }

        .cell:disabled {
          cursor: default;
        }

        .cell.hit {
          border-color: rgba(244, 195, 110, 0.92);
          box-shadow: 0 0 0 2px rgba(244, 195, 110, 0.18), 0 0 30px rgba(244, 195, 110, 0.22);
          animation: hitPulse 520ms ease both;
        }

        @keyframes hitPulse {
          0% { transform: scale(1); }
          42% { transform: scale(1.055); }
          100% { transform: scale(1); }
        }

        .empty-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 230, 190, 0.18);
        }

        .card {
          width: min(80%, 82px);
          aspect-ratio: 0.72;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #f4eadb;
          color: #21170f;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.26);
          border: 1px solid rgba(0, 0, 0, 0.12);
        }

        .card.large {
          width: min(150px, 70%);
          margin-inline: auto;
          border-radius: 18px;
        }

        .card.red {
          color: #b73a2c;
        }

        .card-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          line-height: 1;
        }

        .card-rank {
          font-size: clamp(20px, 3vw, 34px);
        }

        .card.large .card-rank {
          font-size: 48px;
        }

        .card-suit {
          margin-top: 5px;
          font-size: clamp(15px, 2vw, 24px);
        }

        .card.large .card-suit {
          font-size: 34px;
        }

        .hand-list {
          display: grid;
          gap: 10px;
          overflow: auto;
          padding-right: 4px;
        }

        .rule-card {
          border: 1px solid rgba(255, 230, 190, 0.13);
          border-radius: 18px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.045);
        }

        .rule-card-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .rule-card-title {
          font-weight: 950;
          letter-spacing: 0.04em;
        }

        .rule-card-score {
          color: #c89d63;
          font-size: 12px;
          font-weight: 900;
        }

        .rule-cards {
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
        }

        .mini-card {
          width: 24px;
          height: 34px;
          border-radius: 6px;
          display: grid;
          place-items: center;
          background: #f4eadb;
          color: #21170f;
          font-size: 12px;
          font-weight: 950;
        }

        .rule-note {
          margin: 0;
          color: #b7a991;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.45;
        }

        .debug-box {
          margin-top: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 14px;
        }

        .debug-box pre {
          margin: 0;
          max-height: 180px;
          overflow: auto;
          color: #d8c9b1;
          font-size: 11px;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .game-over-card {
          position: absolute;
          inset: auto 24px 24px 24px;
          z-index: 2;
          border-radius: 24px;
          padding: 20px;
          text-align: center;
        }

        @media (max-width: 980px) {
          .home-shell {
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .home-actions {
            grid-template-columns: 1fr;
          }


          :global(body) {
            overflow: auto;
          }

          .nuts-root {
            height: auto;
            min-height: 100svh;
            overflow: visible;
            align-items: flex-start;
          }

          .home-shell {
          position: relative;
          z-index: 1;
          width: min(1040px, 100%);
          min-height: min(680px, calc(100svh - 24px));
          display: grid;
          grid-template-columns: minmax(320px, 1.1fr) minmax(300px, 0.9fr);
          gap: clamp(14px, 2vw, 26px);
          align-items: stretch;
        }

        .home-card,
        .home-rules {
          border: 1px solid rgba(255, 230, 190, 0.22);
          background: rgba(17, 14, 10, 0.74);
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(18px);
          border-radius: 34px;
          padding: clamp(22px, 3vw, 36px);
        }

        .home-card {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }

        .home-card::after {
          content: "";
          position: absolute;
          inset: auto -70px -90px auto;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(244, 195, 110, 0.22), transparent 68%);
          pointer-events: none;
        }

        .brand-mark {
          width: 74px;
          height: 74px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          color: #201309;
          background: linear-gradient(145deg, #f7d78e, #c9822f);
          box-shadow: 0 18px 48px rgba(201, 130, 47, 0.28);
          font-weight: 1000;
          font-size: 34px;
          letter-spacing: -0.04em;
        }

        .brand-mark i {
          position: absolute;
          width: 22px;
          height: 4px;
          transform: translate(21px, 22px) rotate(-22deg);
          border-radius: 999px;
          background: rgba(32, 19, 9, 0.32);
        }

        .home-card h1 {
          text-align: left;
          font-size: clamp(64px, 11vw, 132px);
          margin-bottom: 18px;
        }

        .home-copy {
          max-width: 560px;
          color: #ead8bd;
          font-size: clamp(16px, 2vw, 20px);
          line-height: 1.7;
          font-weight: 700;
        }

        .home-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr);
          gap: 12px;
          margin-top: 28px;
        }

        .home-rules {
          display: grid;
          align-content: center;
          gap: 12px;
        }

        .game-shell {
            height: auto;
            min-height: calc(100svh - 24px);
            grid-template-columns: 1fr;
          }

          .panel {
            order: 2;
          }

          .board-section {
            order: 1;
            min-height: auto;
          }

          .board {
            width: min(100%, 520px);
          }

          .right-panel {
            order: 3;
          }
        }

        @media (max-width: 560px) {
          .nuts-root {
            padding: 10px;
          }

          .home-shell {
          position: relative;
          z-index: 1;
          width: min(1040px, 100%);
          min-height: min(680px, calc(100svh - 24px));
          display: grid;
          grid-template-columns: minmax(320px, 1.1fr) minmax(300px, 0.9fr);
          gap: clamp(14px, 2vw, 26px);
          align-items: stretch;
        }

        .home-card,
        .home-rules {
          border: 1px solid rgba(255, 230, 190, 0.22);
          background: rgba(17, 14, 10, 0.74);
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(18px);
          border-radius: 34px;
          padding: clamp(22px, 3vw, 36px);
        }

        .home-card {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }

        .home-card::after {
          content: "";
          position: absolute;
          inset: auto -70px -90px auto;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(244, 195, 110, 0.22), transparent 68%);
          pointer-events: none;
        }

        .brand-mark {
          width: 74px;
          height: 74px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          color: #201309;
          background: linear-gradient(145deg, #f7d78e, #c9822f);
          box-shadow: 0 18px 48px rgba(201, 130, 47, 0.28);
          font-weight: 1000;
          font-size: 34px;
          letter-spacing: -0.04em;
        }

        .brand-mark i {
          position: absolute;
          width: 22px;
          height: 4px;
          transform: translate(21px, 22px) rotate(-22deg);
          border-radius: 999px;
          background: rgba(32, 19, 9, 0.32);
        }

        .home-card h1 {
          text-align: left;
          font-size: clamp(64px, 11vw, 132px);
          margin-bottom: 18px;
        }

        .home-copy {
          max-width: 560px;
          color: #ead8bd;
          font-size: clamp(16px, 2vw, 20px);
          line-height: 1.7;
          font-weight: 700;
        }

        .home-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.72fr);
          gap: 12px;
          margin-top: 28px;
        }

        .home-rules {
          display: grid;
          align-content: center;
          gap: 12px;
        }

        .game-shell {
            gap: 10px;
          }

          .panel,
          .board-section {
            border-radius: 22px;
            padding: 14px;
          }

          .board {
            gap: 6px;
            padding: 8px;
            border-radius: 20px;
          }

          .cell {
            border-radius: 12px;
          }

          .card {
            border-radius: 8px;
          }

          .settings-button {
            width: 42px;
            height: 42px;
          }
        }

        .motion-off .cell,
        .motion-off .primary-button,
        .motion-off .cell.hit {
          transition: none;
          animation: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .cell,
          .primary-button,
          .cell.hit {
            transition: none;
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}

function CardView({ card, large = false }: { card: Card; large?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <div className={`card ${large ? "large" : ""} ${isRed ? "red" : "black"}`}>
      <div className="card-inner">
        <span className="card-rank">{rankLabel(card.rank)}</span>
        <span className="card-suit">{card.suit}</span>
      </div>
    </div>
  );
}

function RuleCard({ title, score, note, cards }: { title: string; score: string; note: string; cards: number[] }) {
  return (
    <div className="rule-card">
      <div className="rule-card-head">
        <span className="rule-card-title">{title}</span>
        <span className="rule-card-score">{score}</span>
      </div>
      <div className="rule-cards">
        {cards.map((rank, index) => (
          <span key={`${rank}-${index}`} className="mini-card">
            {rank === 1 ? "A" : rank}
          </span>
        ))}
      </div>
      <p className="rule-note">{note}</p>
    </div>
  );
}
