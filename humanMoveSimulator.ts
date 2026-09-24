import { Chess, type Move, type Square } from "chess.js";
import type {
  AnalysisMode,
  Candidate,
  EngineLine,
  Features,
  Simulation,
} from "../types";
import { ratingProfile } from "../data/ratingProfiles";
import { centipawnLoss, qualityFor } from "./quality";
import { explainMove } from "./explainMove";
import { uciToSan } from "./chess";
const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
export function seededRandom(seed: number): () => number {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function weightedPick<T>(
  items: T[],
  weights: number[],
  random: () => number,
): T {
  const sum = weights.reduce((a, b) => a + b, 0);
  let roll = random() * sum;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}
export function moveFeatures(
  fen: string,
  uci: string,
  history: Move[] = [],
): Features {
  const game = new Chess(fen),
    before = game.moves({ verbose: true });
  const color = game.turn();
  const board = game
    .board()
    .flat()
    .filter((p) => p?.color === color);
  const king = board.find((p) => p?.type === "k")?.square;
  const opening = Number(fen.split(" ")[5]) <= 12 && board.length >= 12;
  const move = game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  });
  const replies = game.moves({ verbose: true });
  const hanging = replies.some(
    (r) =>
      r.to === move.to &&
      r.captured &&
      values[r.piece] < values[move.promotion ?? move.piece],
  );
  const allowsMateOne = replies.some((r) => r.san.endsWith("#"));
  const development =
    opening &&
    ["n", "b"].includes(move.piece) &&
    move.from[1] === (color === "w" ? "1" : "8");
  const castle = move.isKingsideCastle() || move.isQueensideCastle();
  const capture = move.isCapture() || move.isEnPassant();
  const check = /[+#]/.test(move.san);
  const queenEarly = opening && move.piece === "q";
  const kingPawn =
    move.piece === "p" &&
    !!king &&
    !["d", "e"].includes(king[0]) &&
    Math.abs(king.charCodeAt(0) - move.from.charCodeAt(0)) <= 1 &&
    Math.abs(Number(king[1]) - Number(move.from[1])) <= 2;
  const repeat =
    opening &&
    history.slice(-4).some((m) => m.color === color && m.to === move.from);
  const kingCentral = !!king && ["d", "e"].includes(king[0]) && !castle;
  const missesCapture =
    !capture &&
    before.some((m) => m.captured && values[m.captured] > values[m.piece]);
  const sacrifice = capture && hanging;
  return {
    capture,
    check,
    development,
    castle,
    queenEarly,
    kingPawn,
    repeat,
    hanging,
    allowsMateOne,
    missesCapture,
    kingCentral,
    naturalness:
      1 +
      Number(capture) * 0.8 +
      Number(check) * 0.7 +
      Number(development) * 0.65 +
      Number(castle) * 0.7 +
      Number(queenEarly) * 0.25,
    complexity:
      1 +
      Number(sacrifice) * 2 +
      Number(!capture && !check && !development && !castle) * 0.7 +
      Number(hanging) * 1.3,
  };
}
export function normalizeCandidates(
  fen: string,
  lines: EngineLine[],
): EngineLine[] {
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const san = uciToSan(fen, line.bestMoveUci);
      if (
        !san ||
        seen.has(line.bestMoveUci) ||
        !Number.isFinite(line.score) ||
        !Number.isFinite(line.depth) ||
        line.depth < 1 ||
        !["cp", "mate"].includes(line.scoreType)
      )
        return false;
      seen.add(line.bestMoveUci);
      return true;
    })
    .sort((a, b) => b.normalizedScore - a.normalizedScore);
}
export function chooseHumanLikeMove(
  fen: string,
  lines: EngineLine[],
  elo: number,
  mode: AnalysisMode,
  random: () => number = Math.random,
  history: Move[] = [],
  engineBestUci?: string | null,
): Simulation {
  const normalized = normalizeCandidates(fen, lines);
  if (!normalized.length)
    throw new Error(
      "Stockfish did not return usable legal candidates. Try analyzing again.",
    );
  if (engineBestUci) {
    const index = normalized.findIndex((l) => l.bestMoveUci === engineBestUci);
    if (index > 0) normalized.unshift(...normalized.splice(index, 1));
  }
  const bestLine = normalized[0],
    profile = ratingProfile(elo);
  const target =
    random() < profile.topChance ? 0 : profile.loss * (0.35 + random() * 1.4);
  const candidates: Candidate[] = normalized.map((line) => {
    const features = moveFeatures(fen, line.bestMoveUci, history);
    const loss = centipawnLoss(bestLine, line);
    return {
      line,
      loss,
      features,
      quality: qualityFor(bestLine, line),
      weight: 0,
      plausibility: 0,
      note: features.castle
        ? "King safety"
        : features.development
          ? "Development"
          : features.check
            ? "Forcing check"
            : features.capture
              ? "Capture"
              : features.queenEarly
                ? "Early queen move"
                : "Positional move",
    };
  });
  const best = candidates[0];
  const nonMating = candidates.some(
    (c) =>
      !(c.line.scoreType === "mate" && c.line.score < 0) &&
      !c.features.allowsMateOne,
  );
  for (const c of candidates) {
    const f = c.features;
    const loss =
      c.loss ??
      (c.line.scoreType === bestLine.scoreType &&
      Math.sign(c.line.score) === Math.sign(bestLine.score)
        ? 10
        : 1200);
    const forcedLoss = c.line.scoreType === "mate" && c.line.score < 0;
    if (mode === "engine") {
      c.weight = c === best ? 1 : 0;
      continue;
    }
    if ((f.allowsMateOne || forcedLoss) && nonMating) {
      c.weight = 0;
      continue;
    }
    if (mode === "practical") {
      // Practical mode cannot intentionally choose a large error to mimic the rating.
      const tolerance = 15 + (1 - profile.awareness) * 35;
      if (loss > tolerance && c !== best) {
        c.weight = 0;
        continue;
      }
      c.weight =
        (Math.exp(-loss / 22) *
          (1 +
            Number(f.development) +
            Number(f.castle) +
            Number(f.capture) * 0.3)) /
        (1 + f.complexity * (1 - profile.awareness) * 1.8);
    } else {
      const distance = Math.abs(loss - target);
      const natural =
        f.naturalness +
        (1 - profile.awareness) *
          (Number(f.queenEarly) * 0.6 + Number(f.kingPawn) * 0.3);
      c.weight = Math.exp(-distance / Math.max(5, profile.spread)) * natural;
      if (f.hanging) c.weight *= Math.max(0.01, 1 - profile.awareness);
      if (f.repeat || f.kingCentral) c.weight *= 1 - profile.awareness * 0.13;
      if (elo >= 2000 && loss > 100) c.weight *= 0.001;
    }
  }
  let total = candidates.reduce((s, c) => s + c.weight, 0);
  if (!total) {
    best.weight = 1;
    total = 1;
  }
  candidates.forEach((c) => (c.plausibility = c.weight / total));
  const chosen =
    mode === "engine"
      ? best
      : mode === "practical"
        ? candidates.reduce((a, b) => (a.weight >= b.weight ? a : b))
        : weightedPick(
            candidates,
            candidates.map((c) => c.weight),
            random,
          );
  const count = new Chess(fen).moves().length;
  return {
    chosen,
    best,
    candidates,
    ...explainMove(chosen, best, mode, elo),
    limitation:
      normalized.length < count
        ? `Selection uses ${normalized.length} of ${count} legal moves returned by MultiPV. Lower-rated errors outside this pool are not modeled.`
        : normalized.length < 3
          ? "Very few legal candidates are available; rating variation is limited."
          : null,
  };
}
export function uciSquares(uci: string): [Square, Square] {
  return [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square];
}
