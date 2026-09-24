import type { SavedPosition, AppMode } from "../types";
import { START_FEN } from "./chess";
export interface Settings {
  fen: string;
  elo: number;
  mode: AppMode;
  depth: number;
  orientation: "white" | "black";
}
const defaults: Settings = {
  fen: START_FEN,
  elo: 1200,
  mode: "analyze",
  depth: 12,
  orientation: "white",
};
export function loadSettings(): Settings {
  try {
    const p = JSON.parse(localStorage.getItem("chess-lab-settings") ?? "null");
    if (!p || typeof p !== "object") return defaults;
    return {
      fen: typeof p.fen === "string" && p.fen.length < 200 ? p.fen : START_FEN,
      elo: Number.isFinite(p.elo) ? Math.min(3000, Math.max(400, p.elo)) : 1200,
      mode: ["analyze", "setup", "play"].includes(p.mode) ? p.mode : "analyze",
      depth: [12, 16, 20].includes(p.depth) ? p.depth : 12,
      orientation: p.orientation === "black" ? "black" : "white",
    };
  } catch {
    return defaults;
  }
}
export function isSavedPosition(p: unknown): p is SavedPosition {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  return (
    ["id", "name", "fen", "date", "notes"].every(
      (k) => typeof r[k] === "string",
    ) &&
    (r.fen as string).length < 200 &&
    (r.name as string).length <= 120 &&
    (r.notes as string).length <= 2000
  );
}
export function loadSaved(): SavedPosition[] {
  try {
    const p: unknown = JSON.parse(
      localStorage.getItem("chess-lab-positions") ?? "[]",
    );
    return Array.isArray(p) ? p.filter(isSavedPosition) : [];
  } catch {
    return [];
  }
}
export function store(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function loadTimeline(fen: string): {
  rootFen: string;
  moves: string[];
  cursor: number;
} {
  const fallback = { rootFen: fen, moves: [], cursor: 0 };
  try {
    const p: unknown = JSON.parse(
      localStorage.getItem("chess-lab-history") ?? "null",
    );
    if (!p || typeof p !== "object") return fallback;
    const t = p as Record<string, unknown>;
    if (
      typeof t.rootFen !== "string" ||
      !Array.isArray(t.moves) ||
      !t.moves.every(
        (m) => typeof m === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m),
      ) ||
      typeof t.cursor !== "number" ||
      !Number.isInteger(t.cursor) ||
      t.cursor < 0 ||
      t.cursor > t.moves.length
    )
      return fallback;
    return { rootFen: t.rootFen, moves: t.moves as string[], cursor: t.cursor };
  } catch {
    return fallback;
  }
}
export function createId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
