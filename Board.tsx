import { Chessboard, type PositionDataType } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import type { CSSProperties } from "react";
import type { AppMode, PieceMap } from "../types";
import { boardFromFen } from "../lib/chess";
interface Props {
  fen: string;
  mode: AppMode;
  orientation: "white" | "black";
  selected: Square | null;
  lastMove: string | null;
  suggestion: string | null;
  engineBest: string | null;
  onSquare: (square: Square) => void;
  onMove: (from: Square, to: Square | null) => boolean;
  onPaletteDrop: (square: Square, piece: string) => void;
  onRemove: (square: Square) => void;
}
export default function Board(p: Props) {
  const map = boardFromFen(p.fen);
  const position: PositionDataType = Object.fromEntries(
    Object.entries(map).map(([s, piece]) => [
      s,
      { pieceType: `${piece!.color}${piece!.type.toUpperCase()}` },
    ]),
  );
  const styles: Record<string, CSSProperties> = {};
  if (p.lastMove) {
    styles[p.lastMove.slice(0, 2)] = { backgroundColor: "#baa85390" };
    styles[p.lastMove.slice(2, 4)] = { backgroundColor: "#baa853b0" };
  }
  if (p.engineBest) {
    styles[p.engineBest.slice(0, 2)] = { boxShadow: "inset 0 0 0 4px #a5dafa" };
    styles[p.engineBest.slice(2, 4)] = { boxShadow: "inset 0 0 0 4px #a5dafa" };
  }
  if (p.suggestion) {
    styles[p.suggestion.slice(0, 2)] = { backgroundColor: "#b7ef7299" };
    styles[p.suggestion.slice(2, 4)] = {
      backgroundColor: "#b7ef72bf",
      boxShadow: "inset 0 0 0 4px #d8ff9f",
    };
  }
  try {
    const game = new Chess(p.fen);
    if (p.selected && p.mode !== "setup") {
      for (const m of game.moves({ square: p.selected, verbose: true }))
        styles[m.to] = {
          backgroundImage:
            "radial-gradient(circle,#12241760 22%,transparent 24%)",
        };
    }
    if (game.isCheck()) {
      const k = game
        .board()
        .flat()
        .find((x) => x?.type === "k" && x.color === game.turn());
      if (k) styles[k.square] = { backgroundColor: "#db6666" };
    }
  } catch {
    /* Setup intentionally allows invalid boards. */
  }
  if (p.selected)
    styles[p.selected] = {
      backgroundColor: "#c9ee89aa",
      boxShadow: "inset 0 0 0 3px #efffc6",
    };
  const label = (s: string, board: PieceMap) => {
    const piece = board[s as Square];
    const names = {
      k: "king",
      q: "queen",
      r: "rook",
      b: "bishop",
      n: "knight",
      p: "pawn",
    };
    return `${s}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${names[piece.type]}` : ", empty"}`;
  };
  return (
    <div className="chessboard">
      <Chessboard
        options={{
          id: "skill-board",
          position,
          boardOrientation: p.orientation,
          animationDurationInMs: 180,
          allowDragOffBoard: p.mode === "setup",
          allowDrawingArrows: false,
          darkSquareStyle: { backgroundColor: "#66846d" },
          lightSquareStyle: { backgroundColor: "#e3e6d5" },
          darkSquareNotationStyle: { color: "#e3e6d5", fontWeight: 600 },
          lightSquareNotationStyle: { color: "#49634f", fontWeight: 600 },
          squareStyles: styles,
          onSquareClick: ({ square }) => p.onSquare(square as Square),
          onSquareRightClick: ({ square }) => {
            if (p.mode === "setup") p.onRemove(square as Square);
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            p.onMove(sourceSquare as Square, targetSquare as Square | null),
          squareRenderer: ({ square, children }) => (
            <div
              role="button"
              tabIndex={0}
              aria-label={label(square, map)}
              className="board-square"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  p.onSquare(square as Square);
                }
              }}
              onDragOver={(e) => {
                if (p.mode === "setup") e.preventDefault();
              }}
              onDrop={(e) => {
                const piece = e.dataTransfer.getData("chess-piece");
                if (piece && p.mode === "setup") {
                  e.preventDefault();
                  p.onPaletteDrop(square as Square, piece);
                }
              }}
            >
              {children}
            </div>
          ),
        }}
      />
    </div>
  );
}
