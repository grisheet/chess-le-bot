import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StockfishEngine } from "./stockfishEngine";
import { START_FEN } from "../lib/chess";
class MockWorker {
  static latest: MockWorker;
  commands: string[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<unknown>) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    MockWorker.latest = this;
  }
  postMessage(command: string) {
    this.commands.push(command);
  }
  terminate() {
    this.terminated = true;
  }
  emit(message: string) {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }
}
beforeEach(() => {
  vi.stubGlobal("Worker", MockWorker);
});
afterEach(() => vi.unstubAllGlobals());
function ready(worker: MockWorker) {
  worker.emit("uciok");
  worker.emit("readyok");
}
describe("Stockfish lifecycle", () => {
  it("handshakes, configures MultiPV and searches the requested position", async () => {
    const engine = new StockfishEngine();
    const pending = engine.analyze(START_FEN, 12, () => {});
    const worker = MockWorker.latest;
    expect(worker.commands).toEqual(["uci"]);
    ready(worker);
    expect(worker.commands).toContain("setoption name MultiPV value 12");
    expect(worker.commands).toContain(`position fen ${START_FEN}`);
    expect(worker.commands).toContain("go depth 12");
    worker.emit("info depth 12 multipv 1 score cp 30 pv e2e4");
    worker.emit("info depth 8 multipv 1 score cp -50 pv d2d4");
    worker.emit("bestmove e2e4");
    const result = await pending;
    expect(result.lines[0].depth).toBe(12);
    expect(result.bestMoveSan).toBe("e4");
    expect(worker.terminated).toBe(true);
  });
  it("sends stop and returns available results", async () => {
    const engine = new StockfishEngine();
    const pending = engine.analyze(START_FEN, 20, () => {});
    const worker = MockWorker.latest;
    ready(worker);
    worker.emit("info depth 4 score cp 30 pv e2e4");
    engine.stop();
    expect(worker.commands.at(-1)).toBe("stop");
    worker.emit("bestmove e2e4");
    expect((await pending).completed).toBe(false);
  });
  it("cancels even during initialization", async () => {
    const engine = new StockfishEngine();
    const pending = engine.analyze(START_FEN, 12, () => {});
    engine.stop();
    await expect(pending).rejects.toThrow("cancelled");
    expect(MockWorker.latest.terminated).toBe(true);
  });
  it("gives an actionable load failure", async () => {
    const engine = new StockfishEngine();
    const pending = engine.analyze(START_FEN, 12, () => {});
    MockWorker.latest.onerror?.();
    await expect(pending).rejects.toThrow("Stockfish failed to load");
  });
  it("disposes stale searches without contaminating later results", async () => {
    const engine = new StockfishEngine();
    const first = engine.analyze(START_FEN, 12, () => {});
    const firstRejection = expect(first).rejects.toThrow("cancelled");
    const old = MockWorker.latest;
    const second = engine.analyze(START_FEN, 12, () => {});
    await firstRejection;
    const worker = MockWorker.latest;
    ready(worker);
    old.emit("info depth 99 score cp 500 pv d2d4");
    worker.emit("info depth 12 score cp 20 pv e2e4");
    worker.emit("bestmove e2e4");
    expect((await second).bestMoveUci).toBe("e2e4");
  });
});
