import {
  ArrowUpRight,
  ChevronDown,
  Cpu,
  Play,
  Square,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { AnalysisMode } from "../types";
import { presets, profileSummary } from "../data/ratingProfiles";
interface Props {
  elo: number;
  setElo: (n: number) => void;
  type: AnalysisMode;
  setType: (m: AnalysisMode) => void;
  depth: number;
  setDepth: (n: number) => void;
  seconds: number;
  setSeconds: (n: number) => void;
  busy: boolean;
  progress: number;
  disabled: boolean;
  analyze: () => void;
  stop: () => void;
  seed: string;
  setSeed: (s: string) => void;
}
export default function AnalysisControls(p: Props) {
  const name =
    [...presets].reverse().find((r) => p.elo >= r.elo)?.name ?? "Beginner";
  return (
    <section className="card control-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">THE HUMAN PERSPECTIVE</span>
          <h2>Find the next move</h2>
        </div>
        <UserRound className="muted" size={20} />
      </div>
      <div className="rating-top">
        <label htmlFor="rating-number">
          Player rating <span className="tag">{name}</span>
        </label>
        <div className="rating-number">
          <input
            id="rating-number"
            type="number"
            min={400}
            max={3000}
            step={50}
            value={p.elo}
            onChange={(e) =>
              p.setElo(Math.max(400, Math.min(3000, Number(e.target.value))))
            }
          />
          <span>ELO</span>
        </div>
      </div>
      <input
        className="rating-slider"
        aria-label="Player rating slider"
        type="range"
        min={400}
        max={3000}
        step={25}
        value={p.elo}
        onChange={(e) => p.setElo(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right,#c9ee89 ${(p.elo - 400) / 26}%,#363e37 ${(p.elo - 400) / 26}%)`,
        }}
      />
      <div className="range-labels">
        <span>400 · Beginner</span>
        <span>3000 · Master</span>
      </div>
      <div className="presets">
        {presets.map((v) => (
          <button
            title={v.name}
            className={p.elo === v.elo ? "active" : ""}
            key={v.elo}
            onClick={() => p.setElo(v.elo)}
          >
            {v.elo}
          </button>
        ))}
      </div>
      <p className="profile-summary">{profileSummary(p.elo)}</p>
      <label htmlFor="analysis-type">What would you like to explore?</label>
      <div className="select-wrap">
        <Sparkles size={17} />
        <select
          id="analysis-type"
          value={p.type}
          onChange={(e) => p.setType(e.target.value as AnalysisMode)}
        >
          <option value="likely">Likely move at this rating</option>
          <option value="practical">Best practical move for this rating</option>
          <option value="engine">Engine-best move</option>
        </select>
        <ChevronDown size={16} />
      </div>
      <div className="field-grid">
        <label htmlFor="depth">
          Search depth
          <select
            id="depth"
            value={p.depth}
            onChange={(e) => p.setDepth(Number(e.target.value))}
          >
            <option value={12}>Fast · 12</option>
            <option value={16}>Balanced · 16</option>
            <option value={20}>Deep · 20</option>
          </select>
        </label>
        <label htmlFor="time">
          Time limit
          <select
            id="time"
            value={p.seconds}
            onChange={(e) => p.setSeconds(Number(e.target.value))}
          >
            <option value={0}>Until depth reached</option>
            <option value={5}>5 seconds</option>
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </label>
      </div>
      <details className="seed-option">
        <summary>Reproducible simulation</summary>
        <label>
          Random seed
          <input
            value={p.seed}
            onChange={(e) => p.setSeed(e.target.value)}
            placeholder="Optional integer"
            inputMode="numeric"
          />
        </label>
      </details>
      {p.busy ? (
        <div className="analysis-working">
          <div className="progress-caption">
            <span>
              <span className="spinner" />{" "}
              {p.progress ? "Evaluating candidates…" : "Loading Stockfish…"}
            </span>
            <span>
              Depth {p.progress}/{p.depth}
            </span>
          </div>
          <progress max={p.depth} value={p.progress} />
          <button className="analyze-button" onClick={p.stop}>
            <Square size={16} /> Stop analysis
          </button>
        </div>
      ) : (
        <button
          className="analyze-button"
          disabled={p.disabled}
          onClick={p.analyze}
        >
          <Play size={17} fill="currentColor" /> Analyze position
          <ArrowUpRight size={19} />
        </button>
      )}
      <div className="engine-footnote">
        <Cpu size={13} /> Stockfish 17.1 · Runs on your device
      </div>
    </section>
  );
}
