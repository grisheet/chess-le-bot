import type { EngineLine, Quality } from "../types";
import { QUALITY_THRESHOLDS } from "../data/ratingProfiles";
export function centipawnLoss(
  best: EngineLine,
  line: EngineLine,
): number | null {
  return best.scoreType === "cp" && line.scoreType === "cp"
    ? Math.max(0, best.score - line.score)
    : null;
}
export function classifyLoss(loss: number): Quality {
  return QUALITY_THRESHOLDS.find(([, max]) => loss <= max)?.[0] ?? "Blunder";
}
export function qualityFor(best: EngineLine, line: EngineLine): Quality {
  if (best.bestMoveUci === line.bestMoveUci) return "Best";
  if (
    best.scoreType === "mate" &&
    line.scoreType === "mate" &&
    Math.sign(best.score) === Math.sign(line.score)
  )
    return "Good";
  if (line.scoreType === "mate") return line.score > 0 ? "Best" : "Blunder";
  if (best.scoreType === "mate") return best.score > 0 ? "Mistake" : "Good";
  return classifyLoss(centipawnLoss(best, line) ?? 0);
}
