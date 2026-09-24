import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { START_FEN, uciToSan, boardFromFen, fenFromBoard } from "./chess";
import { validatePosition } from "./validation";
import { classifyLoss, qualityFor, centipawnLoss } from "./quality";
import {
  chooseHumanLikeMove,
  normalizeCandidates,
  seededRandom,
  weightedPick,
} from "./humanMoveSimulator";
import { parseInfo } from "../services/stockfishEngine";
import { ratingProfile } from "../data/ratingProfiles";
const line = (uci: string, score: number, rank = 1) =>
  parseInfo(
    `info depth 12 multipv ${rank} score cp ${score} pv ${uci}`,
    START_FEN,
  )!;
describe("position validation", () => {
  it("accepts and round-trips starting position", () => {
    expect(validatePosition(START_FEN).errors).toEqual([]);
    expect(
      fenFromBoard(boardFromFen(START_FEN), START_FEN.split(" ").slice(1)),
    ).toBe(START_FEN);
  });
  it.each([
    ["8/8/8/8/8/8/8/4K3 w - - 0 1", "Missing black king"],
    ["4k3/8/8/8/8/8/8/8 w - - 0 1", "Missing white king"],
    ["4k3/8/8/8/8/8/8/3KK3 w - - 0 1", "More than one white king"],
    ["8/8/8/8/8/8/4k3/4K3 w - - 0 1", "adjacent"],
    ["4k3/8/8/8/8/8/8/P3K3 w - - 0 1", "Pawn on a1"],
    ["P3k3/8/8/8/8/8/8/4K3 w - - 0 1", "Pawn on a8"],
    ["hello", "FEN"],
    ["4k3/8/8/8/8/8/8/4K3 x - - 0 1", "Side to move"],
    ["4k3/8/8/8/8/8/8/4K3 w K - 0 1", "Castling right"],
    ["4k3/8/8/8/8/8/8/4K3 w - e4 0 1", "En passant"],
    ["4k3/8/8/8/8/8/8/4K3 w - e6 0 1", "En passant target"],
    ["4k3/8/8/8/8/8/4R3/4K3 w - - 0 1", "non-moving side"],
  ])("rejects unsafe position %s", (fen, message) =>
    expect(validatePosition(fen).errors.join(" ")).toContain(message),
  );
  it("reports check, checkmate and stalemate", () => {
    expect(validatePosition("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1").inCheck).toBe(
      true,
    );
    expect(validatePosition("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1").status).toContain(
      "Checkmate",
    );
    expect(validatePosition("7k/5K2/6Q1/8/8/8/8/8 b - - 0 1").status).toContain(
      "Stalemate",
    );
  });
});
describe("UCI to SAN", () => {
  it("converts normal moves", () =>
    expect(uciToSan(START_FEN, "g1f3")).toBe("Nf3"));
  it("converts captures", () => {
    const g = new Chess();
    g.move("e4");
    g.move("d5");
    expect(uciToSan(g.fen(), "e4d5")).toBe("exd5");
  });
  it("converts castling", () =>
    expect(uciToSan("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1")).toBe(
      "O-O",
    ));
  it("converts promotions with check", () =>
    expect(uciToSan("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8q")).toBe("a8=Q+"));
  it("converts checkmate", () => {
    const g = new Chess();
    ["f3", "e5", "g4"].forEach((m) => g.move(m));
    expect(uciToSan(g.fen(), "d8h4")).toBe("Qh4#");
  });
  it("rejects illegal and malformed moves", () => {
    expect(uciToSan(START_FEN, "e2e5")).toBeNull();
    expect(uciToSan(START_FEN, "garbage")).toBeNull();
  });
});
describe("quality", () => {
  it.each([
    [0, "Best"],
    [10, "Best"],
    [11, "Excellent"],
    [25, "Excellent"],
    [60, "Good"],
    [61, "Inaccuracy"],
    [120, "Inaccuracy"],
    [121, "Mistake"],
    [250, "Mistake"],
    [251, "Blunder"],
  ])("classifies %s cp", (cp, quality) =>
    expect(classifyLoss(Number(cp))).toBe(quality),
  );
  it("handles mates without fabricated cp loss", () => {
    const best = { ...line("e2e4", 10), scoreType: "mate" as const, score: 3 };
    const other = { ...line("d2d4", 0), scoreType: "mate" as const, score: 6 };
    expect(qualityFor(best, other)).toBe("Good");
    expect(centipawnLoss(best, other)).toBeNull();
    expect(qualityFor(best, { ...other, score: -1 })).toBe("Blunder");
    expect(qualityFor({ ...best, score: -4 }, { ...other, score: -2 })).toBe(
      "Good",
    );
  });
});
describe("human simulation", () => {
  const candidates = [
    line("e2e4", 50),
    line("g1f3", 40, 2),
    line("b1c3", -40, 3),
    line("f2f3", -230, 4),
  ];
  it("smoothly interpolates profiles", () => {
    expect(
      Math.abs(ratingProfile(1000).loss - ratingProfile(1001).loss),
    ).toBeLessThan(1);
  });
  it("normalizes, removes duplicates and rejects invalid candidates", () => {
    expect(
      normalizeCandidates(START_FEN, [
        candidates[1],
        candidates[0],
        candidates[0],
        { ...candidates[0], bestMoveUci: "e2e5" },
      ]),
    ).toHaveLength(2);
    expect(
      normalizeCandidates(START_FEN, [...candidates].reverse())[0].bestMoveUci,
    ).toBe("e2e4");
  });
  it("seeded weighted randomness is repeatable and varied", () => {
    const a = seededRandom(42),
      b = seededRandom(42);
    const first = Array.from({ length: 30 }, () =>
      weightedPick(["a", "b"], [1, 1], a),
    );
    expect(first).toEqual(
      Array.from({ length: 30 }, () => weightedPick(["a", "b"], [1, 1], b)),
    );
    expect(new Set(first).size).toBe(2);
  });
  it("high Elo strongly favors low-loss moves, low Elo varies", () => {
    const random = seededRandom(190);
    let highLoss = 0,
      lowLoss = 0,
      nonBest = 0;
    for (let i = 0; i < 100; i++) {
      const high = chooseHumanLikeMove(
        START_FEN,
        candidates,
        2800,
        "likely",
        random,
      );
      const low = chooseHumanLikeMove(
        START_FEN,
        candidates,
        500,
        "likely",
        random,
      );
      highLoss += high.chosen.loss ?? 0;
      lowLoss += low.chosen.loss ?? 0;
      if (low.chosen !== low.best) nonBest++;
      expect(new Chess(START_FEN).moves()).toContain(
        low.chosen.line.bestMoveSan,
      );
    }
    expect(highLoss / 100).toBeLessThan(15);
    expect(lowLoss).toBeGreaterThan(highLoss * 3);
    expect(nonBest).toBeGreaterThan(30);
  });
  it("practical stays near best and engine selects best", () => {
    expect(
      chooseHumanLikeMove(
        START_FEN,
        candidates,
        500,
        "practical",
        seededRandom(1),
      ).chosen.loss,
    ).toBeLessThanOrEqual(50);
    expect(
      chooseHumanLikeMove(START_FEN, candidates, 500, "engine").chosen.line
        .bestMoveUci,
    ).toBe("e2e4");
  });
  it("never chooses a malformed candidate", () => {
    const result = chooseHumanLikeMove(
      START_FEN,
      [{ ...candidates[0], bestMoveUci: "a1h8" }, ...candidates],
      500,
      "likely",
      seededRandom(1),
    );
    expect(result.candidates).toHaveLength(4);
  });
});
describe("UCI parser", () => {
  it("parses MultiPV and legal continuation", () => {
    const r = parseInfo(
      "info depth 16 multipv 2 score cp 38 pv g1f3 b8c6",
      START_FEN,
    )!;
    expect(r.depth).toBe(16);
    expect(r.rank).toBe(2);
    expect(r.pvSan).toEqual(["Nf3", "Nc6"]);
  });
  it("parses mate and rejects bounds or malformed messages", () => {
    expect(
      parseInfo("info depth 5 score mate -2 pv g1f3", START_FEN)?.scoreType,
    ).toBe("mate");
    expect(
      parseInfo("info depth 5 score cp 20 upperbound pv g1f3", START_FEN),
    ).toBeNull();
    expect(parseInfo("info nodes 500", START_FEN)).toBeNull();
  });
});
