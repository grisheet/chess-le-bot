import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol } from "chess.js";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  FlaskConical,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import Board from "./components/Board";
import Modal from "./components/Modal";
import SetupControls from "./components/SetupControls";
import AnalysisControls from "./components/AnalysisControls";
import Results from "./components/Results";
import SavedPositions from "./components/SavedPositions";
import { boardFromFen, fenFromBoard, START_FEN, statusText } from "./lib/chess";
import { validatePosition } from "./lib/validation";
import { chooseHumanLikeMove, seededRandom } from "./lib/humanMoveSimulator";
import { useChessTools } from "./lib/webmcp";
import {
  createId,
  downloadText,
  loadSaved,
  loadSettings,
  loadTimeline,
  store,
} from "./lib/storage";
import { StockfishEngine } from "./services/stockfishEngine";
import type {
  AnalysisMode,
  AppMode,
  EngineAnalysis,
  Simulation,
} from "./types";
const initial = loadSettings();
const timeline = loadTimeline(initial.fen);
try {
  const g = new Chess(timeline.rootFen);
  timeline.moves
    .slice(0, timeline.cursor)
    .forEach((m) =>
      g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }),
    );
  if (g.fen() !== new Chess(initial.fen).fen()) throw new Error();
} catch {
  timeline.rootFen = initial.fen;
  timeline.moves = [];
  timeline.cursor = 0;
}
export default function App() {
  const [fen, setFen] = useState(initial.fen);
  const [mode, setMode] = useState<AppMode>(initial.mode);
  const [orientation, setOrientation] = useState(initial.orientation);
  const [elo, setElo] = useState(initial.elo);
  const [depth, setDepth] = useState(initial.depth);
  const [type, setType] = useState<AnalysisMode>("likely");
  const [seconds, setSeconds] = useState(15);
  const [seed, setSeed] = useState("");
  const [palette, setPalette] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rootFen, setRootFen] = useState(timeline.rootFen);
  const [moves, setMoves] = useState<string[]>(timeline.moves);
  const [cursor, setCursor] = useState(timeline.cursor);
  const [analysis, setAnalysis] = useState<EngineAnalysis | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [resultConfig, setResultConfig] = useState({ elo, type });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fenInput, setFenInput] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState(loadSaved);
  const [help, setHelp] = useState(false);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [keyboardMove, setKeyboardMove] = useState("");
  const engine = useRef(new StockfishEngine());
  const request = useRef(0);
  const validation = useMemo(() => validatePosition(fen), [fen]);
  const game = useMemo(() => {
    try {
      const g = new Chess(rootFen);
      moves
        .slice(0, cursor)
        .forEach((m) =>
          g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }),
        );
      return g;
    } catch {
      return null;
    }
  }, [rootFen, moves, cursor]);
  useEffect(() => {
    if (!store("chess-lab-settings", { fen, elo, mode, depth, orientation }))
      setNotice(
        "Browser storage is unavailable; changes will last for this session only.",
      );
  }, [fen, elo, mode, depth, orientation]);
  useEffect(() => {
    if (!store("chess-lab-positions", saved))
      setNotice(
        "Saved positions could not be stored. Export JSON to keep a backup.",
      );
  }, [saved]);
  useEffect(() => {
    store("chess-lab-history", { rootFen, moves, cursor });
  }, [rootFen, moves, cursor]);
  useEffect(() => () => engine.current.dispose(), []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 5500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const invalidate = useCallback(() => {
    request.current++;
    engine.current.dispose();
    setBusy(false);
    setAnalysis(null);
    setSimulation(null);
    setPreview(null);
    setSelected(null);
    setPromotion(null);
    setError("");
  }, []);
  const setPosition = (next: string) => {
    invalidate();
    setFen(next);
    setRootFen(next);
    setMoves([]);
    setCursor(0);
    setLastMove(null);
  };
  useChessTools(fen, setPosition);
  const changeMode = (next: AppMode) => {
    setMode(next);
    setSelected(null);
    setPalette(null);
  };
  const analyze = async (
    nextFen = fen,
    history = game?.history({ verbose: true }) ?? [],
  ) => {
    const valid = validatePosition(nextFen);
    if (valid.errors.length || valid.terminal) {
      setError(valid.errors[0] ?? valid.status);
      return;
    }
    if (seed && !/^-?\d+$/.test(seed)) {
      setError("Use an integer for the random seed, or leave it empty.");
      return;
    }
    const id = ++request.current;
    setBusy(true);
    setProgress(0);
    setError("");
    setAnalysis(null);
    setSimulation(null);
    setPreview(null);
    try {
      const output = await engine.current.analyze(
        nextFen,
        depth,
        (d) => {
          if (request.current === id) setProgress(d);
        },
        seconds,
      );
      if (request.current !== id) return;
      const result = chooseHumanLikeMove(
        nextFen,
        output.lines,
        elo,
        type,
        seed ? seededRandom(Number(seed)) : Math.random,
        history,
        output.bestMoveUci,
      );
      setAnalysis(output);
      setSimulation(result);
      setResultConfig({ elo, type });
      setPreview(result.chosen.line.bestMoveUci);
    } catch (err) {
      if (request.current === id)
        setError(
          err instanceof Error
            ? err.message
            : "Analysis could not be completed.",
        );
    } finally {
      if (request.current === id) setBusy(false);
    }
  };
  const playMove = (from: Square, to: Square, promote?: string) => {
    if (validation.errors.length) {
      setError("Fix the position in Setup before making legal moves.");
      return false;
    }
    if (game?.isGameOver()) {
      setError("This game has ended. Reset or load a position to continue.");
      return false;
    }
    try {
      const current =
        game && game.fen() === new Chess(fen).fen()
          ? new Chess(rootFen)
          : new Chess(fen);
      if (game && game.fen() === new Chess(fen).fen())
        moves
          .slice(0, cursor)
          .forEach((m) =>
            current.move({
              from: m.slice(0, 2),
              to: m.slice(2, 4),
              promotion: m[4],
            }),
          );
      const legal = current
        .moves({ verbose: true })
        .filter((m) => m.from === from && m.to === to);
      if (!legal.length) return false;
      if (legal.some((m) => m.promotion) && !promote) {
        setPromotion({ from, to });
        return false;
      }
      const move = current.move({ from, to, promotion: promote });
      invalidate();
      const uci = move.from + move.to + (move.promotion ?? "");
      setFen(current.fen());
      setMoves([...moves.slice(0, cursor), uci]);
      setCursor(cursor + 1);
      setLastMove(uci);
      return true;
    } catch {
      return false;
    }
  };
  const editPiece = (square: Square, code: string) => {
    const board = boardFromFen(fen);
    if (code === "erase") delete board[square];
    else if (/^[wb][kqrbnp]$/.test(code))
      board[square] = {
        color: code[0] as "w" | "b",
        type: code[1] as PieceSymbol,
      };
    setPosition(fenFromBoard(board, fen.split(" ").slice(1)));
  };
  const onSquare = (square: Square) => {
    if (mode === "setup") {
      if (palette) {
        editPiece(square, palette);
        return;
      }
      if (selected && selected !== square) {
        const board = boardFromFen(fen);
        if (board[selected]) {
          board[square] = board[selected];
          delete board[selected];
          setPosition(fenFromBoard(board, fen.split(" ").slice(1)));
          return;
        }
      }
      setSelected(selected === square ? null : square);
      return;
    }
    if (selected && selected !== square && playMove(selected, square)) return;
    setSelected(square === selected ? null : square);
  };
  const onMove = (from: Square, to: Square | null) => {
    if (mode === "setup") {
      const board = boardFromFen(fen);
      const piece = board[from];
      if (!piece) return false;
      delete board[from];
      if (to) board[to] = piece;
      setPosition(fenFromBoard(board, fen.split(" ").slice(1)));
      return true;
    }
    return to ? playMove(from, to) : false;
  };
  const travel = (nextCursor: number) => {
    try {
      const g = new Chess(rootFen);
      moves
        .slice(0, nextCursor)
        .forEach((m) =>
          g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }),
        );
      invalidate();
      setFen(g.fen());
      setCursor(nextCursor);
      setLastMove(nextCursor ? moves[nextCursor - 1] : null);
    } catch {
      setError("Could not restore this move.");
    }
  };
  const applySuggestion = (next = false) => {
    if (!simulation) return;
    const uci = simulation.chosen.line.bestMoveUci;
    const g = new Chess(fen);
    const move = g.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    });
    if (playMove(move.from, move.to, move.promotion) && next) {
      setMode("analyze");
      void analyze(g.fen(), [
        ...(game?.history({ verbose: true }) ?? []),
        move,
      ]);
    }
  };
  const copyFen = async () => {
    try {
      await navigator.clipboard.writeText(fen);
      setNotice("FEN copied to clipboard.");
    } catch {
      setNotice("Clipboard unavailable. Select and copy the FEN below.");
    }
  };
  const loadFen = () => {
    const next = fenInput.trim();
    const valid = validatePosition(next);
    if (valid.errors.length) {
      setError(valid.errors.join(" "));
      return;
    }
    setPosition(next);
    setImportOpen(false);
    setNotice("Position loaded.");
  };
  const moveHistory = game?.history({ verbose: true }) ?? [];
  return (
    <div className="app-shell">
      <header className="header">
        <a className="brand" href="./">
          <span className="brand-mark">♞</span>
          <span>
            chess<span className="brand-light">perspective</span>
            <small>SKILL-LEVEL MOVE CALCULATOR</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="private-label">
            <ShieldCheck size={15} /> Private. On your device.
          </span>
          <button onClick={() => setSavedOpen(true)}>
            <Bookmark size={16} /> <span>Saved positions</span>
            {saved.length > 0 && <span className="count">{saved.length}</span>}
          </button>
          <button
            aria-label="About the rating model"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <main>
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">YOUR CHESS LAB</span>
            <h1>
              A new perspective on every move<span>.</span>
            </h1>
          </div>
          <span className="workspace-badge">
            <FlaskConical size={14} /> Human-like simulation
          </span>
        </div>
        <div className="workspace">
          <div className="board-column">
            <div className="board-toolbar">
              <nav className="mode-tabs" aria-label="Workspace mode">
                {(
                  [
                    { id: "analyze", label: "Analyze", Icon: Sparkles },
                    { id: "setup", label: "Setup", Icon: Settings2 },
                    { id: "play", label: "Play", Icon: Swords },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    className={mode === m.id ? "active" : ""}
                    aria-pressed={mode === m.id}
                    onClick={() => changeMode(m.id)}
                  >
                    <m.Icon size={16} />
                    {m.label}
                  </button>
                ))}
              </nav>
              <button
                className="icon-button"
                aria-label="Flip board"
                title="Flip board"
                onClick={() =>
                  setOrientation((o) => (o === "white" ? "black" : "white"))
                }
              >
                <ArrowDownUp size={18} />
              </button>
            </div>
            <div className="board-player">
              <span
                className={`player-icon ${orientation === "white" ? "black" : "white"}`}
              >
                {orientation === "white" ? "♚" : "♔"}
              </span>
              <span>
                {orientation === "white" ? "Black" : "White"}
                <small>
                  {fen.split(" ")[1] === (orientation === "white" ? "b" : "w")
                    ? "To move"
                    : "Waiting"}
                </small>
              </span>
              <span className="player-caption">
                {mode === "setup" ? "Position setup" : "Current position"}
              </span>
            </div>
            <Board
              fen={fen}
              mode={mode}
              orientation={orientation}
              selected={selected}
              lastMove={lastMove}
              suggestion={preview}
              engineBest={analysis?.bestMoveUci ?? null}
              onSquare={onSquare}
              onMove={onMove}
              onPaletteDrop={editPiece}
              onRemove={(s) => editPiece(s, "erase")}
            />
            <div className="board-player bottom-player">
              <span className={`player-icon ${orientation}`}>
                {orientation === "white" ? "♔" : "♚"}
              </span>
              <span>
                {orientation === "white" ? "White" : "Black"}
                <small>
                  {fen.split(" ")[1] === (orientation === "white" ? "w" : "b")
                    ? "To move"
                    : "Waiting"}
                </small>
              </span>
              <div className="move-nav">
                <button
                  aria-label="Undo move"
                  disabled={cursor === 0}
                  onClick={() => travel(cursor - 1)}
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  aria-label="Redo move"
                  disabled={cursor >= moves.length}
                  onClick={() => travel(cursor + 1)}
                >
                  <ArrowRight size={17} />
                </button>
                <button
                  aria-label="Reset to starting position"
                  title="Reset to starting position"
                  onClick={() => setPosition(START_FEN)}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
            <div className="position-status">
              <span>
                <span
                  className={`turn-disc ${fen.split(" ")[1] === "w" ? "white" : ""}`}
                />
                {game?.isThreefoldRepetition()
                  ? "Draw · threefold repetition"
                  : statusText(fen)}
              </span>
              <button
                onClick={() => {
                  setFenInput(fen);
                  setImportOpen((o) => !o);
                }}
              >
                Load FEN
                <ChevronDown size={14} />
              </button>
            </div>
            {importOpen && (
              <form
                className="fen-import"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadFen();
                }}
              >
                <label htmlFor="fen-input">Import a position</label>
                <textarea
                  id="fen-input"
                  value={fenInput}
                  onChange={(e) => setFenInput(e.target.value)}
                  spellCheck={false}
                />
                <button type="submit" className="primary-soft">
                  Load position
                </button>
              </form>
            )}
            <div className="fen-display">
              <div>
                <span className="eyebrow">FEN</span>
                <button
                  aria-label="Copy FEN"
                  title="Copy FEN"
                  onClick={() => void copyFen()}
                >
                  <Copy size={14} />
                </button>
              </div>
              <code>{fen}</code>
            </div>
            {validation.errors.length > 0 ? (
              <div className="validation errors" role="alert">
                <strong>Position needs attention</strong>
                <ul>
                  {validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="validation">
                <Check size={14} />
                <span>{validation.status}</span>
              </div>
            )}
            {validation.warnings.map((w) => (
              <p className="warning" key={w}>
                {w}
              </p>
            ))}
            <details className="keyboard-controls">
              <summary>Keyboard move entry</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const uci = keyboardMove.trim().toLowerCase();
                  if (
                    /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) &&
                    playMove(
                      uci.slice(0, 2) as Square,
                      uci.slice(2, 4) as Square,
                      uci[4],
                    )
                  )
                    setKeyboardMove("");
                  else
                    setError(
                      "Enter a legal UCI move, for example e2e4 or a7a8q.",
                    );
                }}
              >
                <label>
                  UCI move
                  <input
                    placeholder="e2e4"
                    value={keyboardMove}
                    onChange={(e) => setKeyboardMove(e.target.value)}
                  />
                </label>
                <button type="submit">Play move</button>
              </form>
            </details>
            <div className="board-legend">
              <span>
                <i className="legend-sim" /> Suggested
              </span>
              <span>
                <i className="legend-engine" /> Engine best
              </span>
              <span>
                <i className="legend-last" /> Last move
              </span>
            </div>
          </div>
          <div className="controls-column">
            {mode === "setup" ? (
              <SetupControls
                fen={fen}
                palette={palette}
                onPalette={setPalette}
                onChange={setPosition}
              />
            ) : mode === "play" ? (
              <section className="card">
                <span className="eyebrow">PLAY IT OUT</span>
                <h2>Follow your idea</h2>
                <p className="muted">
                  Drag a piece or select its square, then a legal destination.
                  Explore the position one move at a time.
                </p>
                <div className="button-row">
                  <button disabled={!cursor} onClick={() => travel(cursor - 1)}>
                    <ArrowLeft size={16} />
                    Undo
                  </button>
                  <button
                    disabled={cursor >= moves.length}
                    onClick={() => travel(cursor + 1)}
                  >
                    Redo
                    <ArrowRight size={16} />
                  </button>
                  <button onClick={() => travel(0)}>
                    <RotateCcw size={16} />
                    Reset game
                  </button>
                </div>
                <button
                  className="analyze-button"
                  onClick={() => setMode("analyze")}
                >
                  <Sparkles size={16} /> Analyze this position
                </button>
              </section>
            ) : (
              <AnalysisControls
                elo={elo}
                setElo={setElo}
                type={type}
                setType={setType}
                depth={depth}
                setDepth={setDepth}
                seconds={seconds}
                setSeconds={setSeconds}
                busy={busy}
                progress={progress}
                disabled={
                  validation.errors.length > 0 ||
                  validation.terminal ||
                  Boolean(game?.isGameOver())
                }
                analyze={() => void analyze()}
                stop={() => engine.current.stop()}
                seed={seed}
                setSeed={setSeed}
              />
            )}
            {mode !== "analyze" && (
              <section className="card history-card">
                <div className="card-heading">
                  <h2>Move history</h2>
                  <button
                    disabled={!moveHistory.length}
                    aria-label="Export PGN"
                    title="Export PGN"
                    onClick={() => {
                      if (game) downloadText("chess-game.pgn", game.pgn());
                    }}
                  >
                    <Download size={16} />
                  </button>
                </div>
                {moveHistory.length ? (
                  <div className="history">
                    {moveHistory.map((m, i) => (
                      <button key={i} onClick={() => travel(i + 1)}>
                        <span>{i + 1}.</span>
                        {m.san}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Moves you play will appear here.</p>
                )}
              </section>
            )}
            <div className="model-notice">
              <FlaskConical size={18} />
              <p>
                <strong>A perspective, not a prediction.</strong> Elo simulation
                uses approximate heuristics. It doesn’t predict an individual
                player or match a specific rating system.
              </p>
            </div>
            {error && (
              <div role="alert" className="error-banner">
                <span>{error}</span>
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
            {mode === "analyze" && (
              <Results
                result={simulation}
                analysis={analysis}
                mode={resultConfig.type}
                elo={resultConfig.elo}
                onPreview={setPreview}
                onPlay={() => applySuggestion()}
                onNext={() => applySuggestion(true)}
              />
            )}
          </div>
        </div>
        <footer>
          <span>Chess Skill-Level Move Calculator</span>
          <span>
            Powered by Stockfish & chess.js{" "}
            <span className="footer-divider">/</span> Made for the way humans
            play.
          </span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {savedOpen && (
        <SavedPositions
          positions={saved}
          onSave={(name, notes) => {
            setSaved((p) => [
              {
                id: createId(),
                name,
                notes,
                fen,
                date: new Date().toISOString(),
              },
              ...p,
            ]);
            setNotice("Position saved.");
          }}
          onLoad={setPosition}
          onDelete={(id) => setSaved((p) => p.filter((x) => x.id !== id))}
          onRename={(id, name) =>
            setSaved((p) => p.map((x) => (x.id === id ? { ...x, name } : x)))
          }
          onImport={(items) => {
            setSaved((p) => [...items, ...p]);
            setNotice(`${items.length} positions imported.`);
          }}
          onClose={() => setSavedOpen(false)}
        />
      )}{" "}
      {promotion && (
        <Modal
          labelledBy="promotion-title"
          onClose={() => setPromotion(null)}
          small
        >
          <h2 id="promotion-title">Choose your promotion</h2>
          <div className="button-row">
            {[
              ["q", "Queen"],
              ["r", "Rook"],
              ["b", "Bishop"],
              ["n", "Knight"],
            ].map(([piece, name]) => (
              <button
                key={piece}
                onClick={() => playMove(promotion.from, promotion.to, piece)}
              >
                {name}
              </button>
            ))}
          </div>
          <button onClick={() => setPromotion(null)}>Cancel</button>
        </Modal>
      )}
      {help && (
        <Modal labelledBy="about-title" onClose={() => setHelp(false)}>
          <div className="card-heading">
            <h2 id="about-title">About the rating model</h2>
            <button
              aria-label="Close explanation"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p>
            Stockfish evaluates up to 12 candidate moves. A smooth rating
            profile then combines evaluation loss, tactical risk, and
            natural-looking ideas to choose a plausible move.
          </p>
          <p>
            “Likely move” uses weighted randomness. “Best practical move” favors
            strong, simpler ideas. “Engine-best” shows the highest evaluated
            candidate.
          </p>
          <p>
            The Elo setting is a heuristic human-like simulation. It is not a
            direct prediction of an individual player’s move, nor is it
            equivalent to FIDE, USCF, Chess.com, or Lichess ratings.
          </p>
          <p className="muted">
            This model is not trained on human games. Tactical and complexity
            features are deliberately limited heuristics. Searches with time
            limits may stop below the requested depth.
          </p>
        </Modal>
      )}
    </div>
  );
}
