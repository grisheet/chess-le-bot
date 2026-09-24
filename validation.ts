import { Chess, validateFen, type Square } from "chess.js";
import { boardFromFen } from "./chess";
export interface Validation {
  errors: string[];
  warnings: string[];
  inCheck: boolean;
  terminal: boolean;
  status: string;
}
export function validatePosition(fen: string): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let inCheck = false;
  let terminal = false;
  let status = "Ready to analyze";
  const fields = fen.trim().split(/\s+/);
  const [placement, turn, rights, ep, half, full] = fields;
  if (fields.length !== 6)
    errors.push("FEN must contain six space-separated fields.");
  const ranks = (placement ?? "").split("/");
  if (
    ranks.length !== 8 ||
    ranks.some(
      (r) =>
        !/^([prnbqkPRNBQK1-8])+$/.test(r) ||
        [...r].reduce((n, c) => n + (/\d/.test(c) ? Number(c) : 1), 0) !== 8,
    )
  )
    errors.push(
      "Invalid FEN board: each of eight ranks must contain eight squares.",
    );
  const board = boardFromFen(fen);
  const entries = Object.entries(board);
  const kings = entries.filter(([, p]) => p?.type === "k");
  for (const color of ["w", "b"]) {
    const count = kings.filter(([, p]) => p?.color === color).length;
    const name = color === "w" ? "white" : "black";
    if (count === 0) errors.push(`Missing ${name} king.`);
    if (count > 1) errors.push(`More than one ${name} king.`);
  }
  if (kings.length === 2) {
    const a = kings[0][0],
      b = kings[1][0];
    if (
      Math.max(
        Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
        Math.abs(Number(a[1]) - Number(b[1])),
      ) <= 1
    )
      errors.push("Kings cannot occupy adjacent squares.");
  }
  for (const [square, p] of entries)
    if (p?.type === "p" && /[18]$/.test(square))
      errors.push(
        `Pawn on ${square}: pawns cannot be on the first or eighth rank.`,
      );
  if (turn !== "w" && turn !== "b")
    errors.push("Side to move must be white (w) or black (b).");
  if (!rights || !/^(-|K?Q?k?q?)$/.test(rights))
    errors.push("Invalid castling-rights format.");
  const needed: Record<string, [Square, Square, "w" | "b"]> = {
    K: ["e1", "h1", "w"],
    Q: ["e1", "a1", "w"],
    k: ["e8", "h8", "b"],
    q: ["e8", "a8", "b"],
  };
  for (const flag of rights ?? "") {
    const rule = needed[flag];
    if (rule) {
      const [king, rook, color] = rule;
      if (
        board[king]?.type !== "k" ||
        board[king]?.color !== color ||
        board[rook]?.type !== "r" ||
        board[rook]?.color !== color
      )
        errors.push(
          `Castling right ${flag} requires the matching king and rook on their starting squares.`,
        );
    }
  }
  if (!ep || !/^(-|[a-h][36])$/.test(ep))
    errors.push("En passant must be “-” or a square on rank 3 or 6.");
  else if (ep !== "-") {
    const expected = turn === "w" ? "6" : "3";
    const pawnSquare = `${ep[0]}${turn === "w" ? "5" : "4"}` as Square;
    const origin = `${ep[0]}${turn === "w" ? "7" : "2"}` as Square;
    if (
      ep[1] !== expected ||
      board[ep as Square] ||
      board[origin] ||
      board[pawnSquare]?.type !== "p" ||
      board[pawnSquare]?.color === turn
    )
      errors.push(
        "En passant target does not match a possible previous two-square pawn move.",
      );
    else if (Number(half) !== 0)
      errors.push(
        "En passant requires a zero halfmove clock after a pawn move.",
      );
  }
  if (!/^\d+$/.test(half ?? "") || !Number.isSafeInteger(Number(half)))
    errors.push("Halfmove clock must be a nonnegative integer.");
  if (!/^[1-9]\d*$/.test(full ?? "") || !Number.isSafeInteger(Number(full)))
    errors.push("Fullmove number must be a positive integer.");
  for (const color of ["w", "b"]) {
    const pieces = entries.filter(([, p]) => p?.color === color);
    if (
      pieces.length > 16 ||
      pieces.filter(([, p]) => p?.type === "p").length > 8
    )
      warnings.push(
        `${color === "w" ? "White" : "Black"} has an unusual number of pieces.`,
      );
  }
  if (!errors.length) {
    const result = validateFen(fen);
    if (!result.ok) errors.push(result.error ?? "Invalid FEN.");
  }
  if (!errors.length) {
    try {
      const game = new Chess(fen);
      const other = turn === "w" ? "b" : "w";
      const otherKing = kings.find(
        ([, p]) => p?.color === other,
      )?.[0] as Square;
      if (otherKing && game.isAttacked(otherKing, turn as "w" | "b"))
        errors.push(
          "The non-moving side is in check; this is not a legal game state.",
        );
      inCheck = game.isCheck();
      terminal = game.isGameOver();
      if (game.isCheckmate()) status = "Checkmate — no legal moves.";
      else if (game.isStalemate()) status = "Stalemate — no legal moves.";
      else if (terminal) status = "Drawn position.";
      else if (inCheck) status = "The active side is in check.";
    } catch {
      errors.push("Position could not be loaded safely.");
    }
  }
  return { errors: [...new Set(errors)], warnings, inCheck, terminal, status };
}
