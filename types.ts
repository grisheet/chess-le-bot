import type { Square, PieceSymbol, Color } from "chess.js";
export type AppMode = "analyze" | "setup" | "play";
export type AnalysisMode = "likely" | "practical" | "engine";
export type PieceMap = Partial<
  Record<Square, { type: PieceSymbol; color: Color }>
>;
export type ScoreType = "cp" | "mate";
export interface EngineLine {
  rank: number;
  depth: number;
  scoreType: ScoreType;
  score: number;
  normalizedScore: number;
  pvUci: string[];
  pvSan: string[];
  bestMoveUci: string;
  bestMoveSan: string;
}
export interface EngineAnalysis {
  fen: string;
  depth: number;
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  lines: EngineLine[];
  evaluationLabel: string;
  isMate: boolean;
  completed: boolean;
}
export type Quality =
  "Best" | "Excellent" | "Good" | "Inaccuracy" | "Mistake" | "Blunder";
export interface Features {
  capture: boolean;
  check: boolean;
  development: boolean;
  castle: boolean;
  queenEarly: boolean;
  kingPawn: boolean;
  repeat: boolean;
  hanging: boolean;
  allowsMateOne: boolean;
  missesCapture: boolean;
  kingCentral: boolean;
  naturalness: number;
  complexity: number;
}
export interface Candidate {
  line: EngineLine;
  loss: number | null;
  quality: Quality;
  features: Features;
  weight: number;
  plausibility: number;
  note: string;
}
export interface Simulation {
  chosen: Candidate;
  best: Candidate;
  candidates: Candidate[];
  explanation: string;
  reasons: string[];
  missed: string | null;
  limitation: string | null;
}
export interface SavedPosition {
  id: string;
  name: string;
  fen: string;
  date: string;
  notes: string;
}
