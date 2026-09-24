import { Chess, type Square } from "chess.js";
import type { PieceMap, ScoreType } from "../types";
export const START_FEN = new Chess().fen();
export const squares = Array.from(
  { length: 64 },
  (_, i) => `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}` as Square,
);
export function boardFromFen(fen: string): PieceMap {
  const map: PieceMap = {};
  const ranks = fen.split(" ")[0].split("/");
  ranks.forEach((rank, r) => {
    let file = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        const square = `${"abcdefgh"[file]}${8 - r}` as Square;
        if (file < 8 && r < 8 && /[prnbqk]/i.test(ch))
          map[square] = {
            type: ch.toLowerCase() as "p",
            color: ch === ch.toUpperCase() ? "w" : "b",
          };
        file++;
      }
    }
  });
  return map;
}
export function fenFromBoard(board: PieceMap, fields: string[]): string {
  const ranks = Array.from({ length: 8 }, (_, r) => {
    let rank = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const piece = board[`${"abcdefgh"[f]}${8 - r}` as Square];
      if (!piece) empty++;
      else {
        if (empty) rank += empty;
        empty = 0;
        rank += piece.color === "w" ? piece.type.toUpperCase() : piece.type;
      }
    }
    if (empty) rank += empty;
    return rank;
  });
  return [ranks.join("/"), ...fields].join(" ");
}
export function uciToSan(fen: string, uci: string): string | null {
  try {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
    return (
      new Chess(fen).move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      })?.san ?? null
    );
  } catch {
    return null;
  }
}
export function pvToSan(fen: string, moves: string[]): string[] {
  const game = new Chess(fen);
  const result: string[] = [];
  for (const uci of moves) {
    try {
      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
      if (!move) break;
      result.push(move.san);
    } catch {
      break;
    }
  }
  return result;
}
export function formatScore(type: ScoreType, score: number): string {
  return type === "mate"
    ? score > 0
      ? `Mate in ${score}`
      : `Mated in ${Math.abs(score)}`
    : `${score >= 0 ? "+" : ""}${(score / 100).toFixed(2)}`;
}
export function statusText(fen: string): string {
  try {
    const g = new Chess(fen);
    if (g.isCheckmate()) return "Checkmate";
    if (g.isStalemate()) return "Stalemate";
    if (g.isInsufficientMaterial()) return "Draw · insufficient material";
    if (g.isDrawByFiftyMoves()) return "Draw · fifty-move rule";
    return `${g.turn() === "w" ? "White" : "Black"} to move${g.isCheck() ? " · in check" : ""}`;
  } catch {
    return "Custom position";
  }
}
