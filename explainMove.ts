import type { Candidate, AnalysisMode } from "../types";
export function explainMove(
  chosen: Candidate,
  best: Candidate,
  mode: AnalysisMode,
  elo: number,
) {
  const f = chosen.features;
  const reasons: string[] = [];
  if (f.development)
    reasons.push("Develops a minor piece from its starting square.");
  if (f.castle) reasons.push("Castles to bring the king away from the center.");
  if (f.capture)
    reasons.push("An immediate capture makes the move easy to notice.");
  if (f.check) reasons.push("Gives check and limits the opponent’s replies.");
  if (f.queenEarly)
    reasons.push(
      "An early queen move can look active but cost development time.",
    );
  if (f.kingPawn)
    reasons.push("Pushes a pawn near the king, which may weaken its shelter.");
  if (f.repeat)
    reasons.push("Moves a recently moved piece again in the opening.");
  if (!reasons.length && /^[de][34]$/.test(chosen.line.bestMoveSan))
    reasons.push("Advances a central pawn and opens lines for development.");
  if (!reasons.length)
    reasons.push("A legal positional option evaluated by Stockfish.");
  const missed = f.allowsMateOne
    ? "This move allows an immediate checkmate."
    : f.hanging
      ? "The moved piece can be captured on the next turn; check the continuation for compensation."
      : f.missesCapture
        ? "Another legal move offers a favorable-looking capture; whether it works needs calculation."
        : (chosen.loss ?? 0) > 120
          ? `Stockfish prefers ${best.line.bestMoveSan}; this move gives up ${chosen.loss} centipawns at the searched depth.`
          : null;
  const intro =
    mode === "engine"
      ? "Stockfish’s top evaluated move at this search depth."
      : mode === "practical"
        ? `A strong, relatively straightforward option for the ${elo} rating profile.`
        : `A plausible choice for the ${elo} rating profile, based on move features and evaluation loss.`;
  return {
    reasons: reasons.slice(0, 4),
    missed,
    explanation: `${intro} ${reasons[0]}`,
  };
}
