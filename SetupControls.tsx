import { Eraser, RotateCcw, Trash2 } from "lucide-react";
import type { PieceMap } from "../types";
import { boardFromFen, fenFromBoard, START_FEN } from "../lib/chess";
export const glyphs: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};
export default function SetupControls({
  fen,
  palette,
  onPalette,
  onChange,
}: {
  fen: string;
  palette: string | null;
  onPalette: (s: string | null) => void;
  onChange: (fen: string) => void;
}) {
  const fields = fen.split(" ").slice(1);
  const update = (i: number, v: string) => {
    const f = [...fields];
    f[i] = v;
    onChange(fenFromBoard(boardFromFen(fen), f));
  };
  const names = {
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
  };
  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">POSITION EDITOR</span>
          <h2>Build your position</h2>
        </div>
        <span className="tag">Free editing</span>
      </div>
      <p className="muted">
        Choose a piece, then click a square. Drag pieces to place or move them.
        Right-click to remove.
      </p>
      <div className="palette">
        {["w", "b"].map((c) => (
          <div className="palette-row" key={c}>
            {Object.entries(names).map(([t, name]) => (
              <button
                key={t}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("chess-piece", c + t)
                }
                className={`piece-pick ${palette === c + t ? "active" : ""} ${c === "w" ? "white-piece" : ""}`}
                aria-label={`${c === "w" ? "White" : "Black"} ${name}`}
                onClick={() => onPalette(palette === c + t ? null : c + t)}
              >
                {glyphs[c + t]}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="button-row">
        <button
          className={palette === "erase" ? "active" : ""}
          onClick={() => onPalette(palette === "erase" ? null : "erase")}
        >
          <Eraser size={16} /> Eraser
        </button>
        <button
          onClick={() =>
            onChange(fenFromBoard({} as PieceMap, ["w", "-", "-", "0", "1"]))
          }
        >
          <Trash2 size={16} /> Clear board
        </button>
        <button onClick={() => onChange(START_FEN)}>
          <RotateCcw size={16} /> Reset
        </button>
      </div>
      <div className="divider" />
      <label>Side to move</label>
      <div className="segmented two">
        <button
          className={fields[0] === "w" ? "active" : ""}
          onClick={() => update(0, "w")}
        >
          ○ White
        </button>
        <button
          className={fields[0] === "b" ? "active" : ""}
          onClick={() => update(0, "b")}
        >
          ● Black
        </button>
      </div>
      <fieldset>
        <legend>Castling rights</legend>
        <div className="check-grid">
          {[
            ["K", "White kingside"],
            ["Q", "White queenside"],
            ["k", "Black kingside"],
            ["q", "Black queenside"],
          ].map(([flag, name]) => (
            <label key={flag}>
              <input
                type="checkbox"
                checked={(fields[1] ?? "").includes(flag)}
                onChange={(e) => {
                  const next = "KQkq"
                    .split("")
                    .filter((c) =>
                      c === flag ? e.target.checked : fields[1]?.includes(c),
                    )
                    .join("");
                  update(1, next || "-");
                }}
              />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field-grid three">
        <label>
          En passant
          <input
            placeholder="-"
            value={fields[2] ?? "-"}
            maxLength={2}
            onChange={(e) => update(2, e.target.value || "-")}
          />
        </label>
        <label>
          Halfmove
          <input
            type="number"
            min={0}
            value={fields[3] ?? 0}
            onChange={(e) => update(3, e.target.value)}
          />
        </label>
        <label>
          Fullmove
          <input
            type="number"
            min={1}
            value={fields[4] ?? 1}
            onChange={(e) => update(4, e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
