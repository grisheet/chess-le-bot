import {
  Bookmark,
  Download,
  FolderOpen,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Modal from "./Modal";
import { useRef, useState } from "react";
import type { SavedPosition } from "../types";
import { createId, downloadText, isSavedPosition } from "../lib/storage";
export default function SavedPositions({
  positions,
  onSave,
  onLoad,
  onDelete,
  onRename,
  onImport,
  onClose,
}: {
  positions: SavedPosition[];
  onSave: (name: string, notes: string) => void;
  onLoad: (fen: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onImport: (items: SavedPosition[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <Modal labelledBy="saved-heading" onClose={onClose}>
      <div className="card-heading">
        <h2 id="saved-heading">
          <Bookmark size={20} /> Saved positions
        </h2>
        <button aria-label="Close saved positions" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      <p className="muted">
        Keep positions on this device, or export a backup.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            onSave(name.trim(), notes);
            setName("");
            setNotes("");
          }
        }}
      >
        <label>
          Position name
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="e.g. The tricky middlegame"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Notes <span className="muted">(optional)</span>
          <textarea
            maxLength={2000}
            placeholder="What would you like to explore?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button className="analyze-button" type="submit">
          <Bookmark size={16} /> Save current position
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="saved-list">
        {positions.length ? (
          positions.map((p) => (
            <article key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <p className="small muted">
                  {new Date(p.date).toLocaleDateString()}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <div className="button-row">
                <button
                  aria-label={`Load ${p.name}`}
                  title="Load position"
                  onClick={() => {
                    onLoad(p.fen);
                    onClose();
                  }}
                >
                  <FolderOpen size={16} />
                </button>
                <button
                  aria-label={`Rename ${p.name}`}
                  onClick={() => {
                    const value = window.prompt("Rename position", p.name);
                    if (value?.trim())
                      onRename(p.id, value.trim().slice(0, 120));
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  aria-label={`Delete ${p.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete “${p.name}”?`)) onDelete(p.id);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="saved-empty">
            Your next interesting position belongs here.
          </p>
        )}
      </div>
      <div className="button-row">
        <button
          onClick={() =>
            downloadText(
              "chess-positions.json",
              JSON.stringify(positions, null, 2),
              "application/json",
            )
          }
        >
          <Download size={15} /> Export JSON
        </button>
        <button onClick={() => input.current?.click()}>
          <Upload size={15} /> Import JSON
        </button>
        <input
          hidden
          ref={input}
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 2_000_000)
                throw new Error("File must be smaller than 2 MB.");
              const data: unknown = JSON.parse(await file.text());
              if (!Array.isArray(data) || !data.every(isSavedPosition))
                throw new Error(
                  "Use a saved-position JSON exported by this app.",
                );
              onImport(data.map((p) => ({ ...p, id: createId() })));
              setError("");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not import file.",
              );
            }
            e.target.value = "";
          }}
        />
      </div>
    </Modal>
  );
}
