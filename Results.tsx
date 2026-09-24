import {
  ArrowRight,
  Check,
  ChevronRight,
  Lightbulb,
  Play,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { Simulation, EngineAnalysis, AnalysisMode } from "../types";
import { formatScore } from "../lib/chess";
const qualityClass = (s: string) => s.toLowerCase();
export default function Results({
  result,
  analysis,
  mode,
  elo,
  onPreview,
  onPlay,
  onNext,
}: {
  result: Simulation | null;
  analysis: EngineAnalysis | null;
  mode: AnalysisMode;
  elo: number;
  onPreview: (uci: string) => void;
  onPlay: () => void;
  onNext: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  if (!result || !analysis)
    return (
      <section className="card empty-result">
        <div className="empty-icon">
          <Sparkles size={27} />
        </div>
        <h2>One position. Different perspectives.</h2>
        <p>
          Set a rating and analyze the board to explore a plausible human move
          alongside Stockfish’s best idea.
        </p>
        <div className="empty-steps">
          <span>
            01 <b>Set a position</b>
          </span>
          <ChevronRight size={15} />
          <span>
            02 <b>Choose a rating</b>
          </span>
          <ChevronRight size={15} />
          <span>
            03 <b>Explore</b>
          </span>
        </div>
      </section>
    );
  const { chosen, best } = result;
  const line = chosen.line;
  const side = analysis.fen.split(" ")[1] === "w" ? "White" : "Black";
  return (
    <>
      <section className="card result-card">
        <div className="card-heading">
          <span className="eyebrow">
            {mode === "likely"
              ? `PLAUSIBLE MOVE · ${elo} ELO`
              : mode === "practical"
                ? "PRACTICAL RECOMMENDATION"
                : "ENGINE RECOMMENDATION"}
          </span>
          <span className={`quality ${qualityClass(chosen.quality)}`}>
            {chosen.quality}
          </span>
        </div>
        <div className="move-title">
          <h2>{line.bestMoveSan}</h2>
          <span className="uci">{line.bestMoveUci}</span>
          <span className="score">
            {formatScore(line.scoreType, line.score)}
          </span>
        </div>
        <p>{result.explanation}</p>
        <div className="eval-grid">
          <div>
            <span>Before · best play</span>
            <strong>{formatScore(best.line.scoreType, best.line.score)}</strong>
          </div>
          <div>
            <span>After · chosen move</span>
            <strong>{formatScore(line.scoreType, line.score)}</strong>
          </div>
          <div>
            <span>Centipawn loss</span>
            <strong>
              {chosen.loss === null ? "Mate score" : `${chosen.loss} cp`}
            </strong>
          </div>
        </div>
        <p className="small muted">
          Evaluations favor {side} when positive. “After” is the root search’s
          estimate for this move, not a new search.{" "}
          {analysis.completed
            ? `Search reached depth ${analysis.depth}.`
            : `Partial search · depth ${analysis.depth}.`}
        </p>
        <details className="why" open>
          <summary>
            <Lightbulb size={15} /> Why this move?
          </summary>
          <ul>
            {result.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {result.missed && (
            <p>
              <strong>What may be missed:</strong> {result.missed}
            </p>
          )}
        </details>
        <div className="best-comparison">
          <span>
            <Check size={16} />{" "}
            {chosen === best ? "Stockfish agrees" : "Better idea · Stockfish"}
          </span>
          <button
            onClick={() =>
              onPreview(analysis.bestMoveUci ?? best.line.bestMoveUci)
            }
          >
            {analysis.bestMoveSan ?? best.line.bestMoveSan}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="continuation">
          <span className="eyebrow">SAMPLE CONTINUATION</span>
          <p>
            {line.pvSan.slice(0, 10).map((move, i) => (
              <span key={i}>{move}</span>
            ))}
          </p>
        </div>
        <div className="button-row">
          <button className="primary-soft" onClick={onPlay}>
            <Play size={15} /> Play {line.bestMoveSan}
          </button>
          <button onClick={onNext}>
            Play & analyze next
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
      <section className="card candidates">
        <div className="card-heading">
          <h2>
            Candidate moves{" "}
            <span className="tag">{result.candidates.length}</span>
          </h2>
          <label className="check-label">
            <input
              type="checkbox"
              checked={advanced}
              onChange={(e) => setAdvanced(e.target.checked)}
            />{" "}
            Advanced details
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Move</th>
                <th>Eval</th>
                <th>Loss</th>
                <th>Quality</th>
                <th>Model weight</th>
                <th>Idea</th>
                {advanced && (
                  <>
                    <th>UCI / Depth</th>
                    <th>Raw PV</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {result.candidates.map((c, i) => (
                <tr
                  key={c.line.bestMoveUci}
                  className={c === chosen ? "chosen-row" : ""}
                >
                  <td>{i + 1}</td>
                  <td>
                    <button onClick={() => onPreview(c.line.bestMoveUci)}>
                      {c.line.bestMoveSan}
                      {c === best && <span title="Engine best"> ★</span>}
                      {c === chosen && <span title="Selected move"> ✓</span>}
                    </button>
                  </td>
                  <td>{formatScore(c.line.scoreType, c.line.score)}</td>
                  <td>{c.loss === null ? "—" : c.loss}</td>
                  <td>
                    <span className={`quality ${qualityClass(c.quality)}`}>
                      {c.quality}
                    </span>
                  </td>
                  <td>{Math.round(c.plausibility * 100)}%</td>
                  <td className="muted">{c.note}</td>
                  {advanced && (
                    <>
                      <td>
                        {c.line.bestMoveUci} / {c.line.depth}
                      </td>
                      <td className="raw-pv">{c.line.pvUci.join(" ")}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          ★ Engine best · ✓ Selected · Click a move to preview. Model weights
          are heuristic selection weights, not calibrated probabilities.
        </p>
        {result.limitation && (
          <p className="small limitation">{result.limitation}</p>
        )}
        <p className="small muted">
          Quality uses loss bands of ≤10, 25, 60, 120 and 250 cp; mate outcomes
          are handled separately. Stopped searches use the last complete MultiPV
          depth where available; an updated final engine-best line can be
          deeper.
        </p>
      </section>
    </>
  );
}
