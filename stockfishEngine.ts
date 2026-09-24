import { Chess } from "chess.js";
import type { EngineAnalysis, EngineLine } from "../types";
import { formatScore, pvToSan, uciToSan } from "../lib/chess";
export function parseInfo(message: string, fen: string): EngineLine | null {
  if (
    !message.startsWith("info ") ||
    /\b(upperbound|lowerbound)\b/.test(message)
  )
    return null;
  const depth = message.match(/\bdepth (\d+)/),
    rank = message.match(/\bmultipv (\d+)/),
    score = message.match(/\bscore (cp|mate) (-?\d+)/),
    pv = message.match(/\bpv (.+)$/);
  if (!depth || !score || !pv) return null;
  const moves = pv[1].trim().split(/\s+/),
    san = uciToSan(fen, moves[0]);
  if (!san) return null;
  const type = score[1] as "cp" | "mate",
    value = Number(score[2]);
  return {
    rank: Number(rank?.[1] ?? 1),
    depth: Number(depth[1]),
    scoreType: type,
    score: value,
    normalizedScore:
      type === "cp"
        ? Math.max(-90000, Math.min(90000, value))
        : Math.sign(value) * (100000 - Math.abs(value)),
    pvUci: moves,
    pvSan: pvToSan(fen, moves),
    bestMoveUci: moves[0],
    bestMoveSan: san,
  };
}
export class StockfishEngine {
  private worker: Worker | null = null;
  private searching = false;
  private abort: (() => void) | null = null;
  stop() {
    if (this.searching) this.worker?.postMessage("stop");
    else this.abort?.();
  }
  dispose() {
    this.abort?.();
    this.worker?.terminate();
    this.worker = null;
    this.abort = null;
  }
  async analyze(
    fen: string,
    depth: number,
    onProgress: (depth: number) => void,
    seconds = 0,
  ): Promise<EngineAnalysis> {
    this.dispose();
    return new Promise((resolve, reject) => {
      let done = false;
      let phase: "uci" | "ready" | "search" = "uci";
      const lines = new Map<number, EngineLine>();
      const iterations = new Map<number, Map<number, EngineLine>>();
      const expected = Math.min(12, new Chess(fen).moves().length);
      let watchdog: ReturnType<typeof setTimeout>;
      const finish = (error?: Error, bestUci?: string) => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        worker.terminate();
        if (this.worker === worker) {
          this.worker = null;
          this.abort = null;
          this.searching = false;
        }
        if (error) {
          reject(error);
          return;
        }
        const complete = [...iterations.entries()]
          .filter(([, iteration]) => iteration.size === expected)
          .sort((a, b) => b[0] - a[0])[0]?.[1];
        let result = [...(complete ?? lines).values()].sort(
          (a, b) => b.normalizedScore - a.normalizedScore,
        );
        // If stop interrupted a change of leader, retain its latest evaluated line.
        if (bestUci && result[0]?.bestMoveUci !== bestUci) {
          const latest = [...lines.values()].find(
            (l) => l.bestMoveUci === bestUci,
          );
          if (latest)
            result = [
              latest,
              ...result.filter((l) => l.bestMoveUci !== bestUci),
            ];
        }
        const best = result.find((l) => l.bestMoveUci === bestUci) ?? result[0];
        if (!best) {
          reject(
            new Error(
              "Analysis stopped before an evaluated move was available. Please try again.",
            ),
          );
          return;
        }
        const reached = Math.min(...result.map((l) => l.depth));
        resolve({
          fen,
          depth: reached,
          bestMoveUci: bestUci ?? best.bestMoveUci,
          bestMoveSan: bestUci ? uciToSan(fen, bestUci) : best.bestMoveSan,
          lines: result,
          evaluationLabel: formatScore(best.scoreType, best.score),
          isMate: best.scoreType === "mate",
          completed: reached >= depth,
        });
      };
      const worker = new Worker(
        `${import.meta.env.BASE_URL}engine/stockfish-17.1-lite-single.js`,
      );
      this.worker = worker;
      this.abort = () => finish(new Error("Analysis cancelled."));
      watchdog = setTimeout(
        () =>
          finish(
            new Error(
              "Stockfish could not load. Check that the engine JavaScript and WASM files are in public/engine, then reload.",
            ),
          ),
        25000,
      );
      worker.onerror = () =>
        finish(
          new Error(
            "Stockfish failed to load or run. Run npm install to restore the engine assets, and serve the app over HTTP.",
          ),
        );
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (done) return;
        for (const message of String(event.data).split("\n")) {
          if (phase === "uci" && message === "uciok") {
            phase = "ready";
            worker.postMessage("setoption name Threads value 1");
            worker.postMessage("setoption name Hash value 32");
            worker.postMessage("setoption name MultiPV value 12");
            worker.postMessage("isready");
          } else if (phase === "ready" && message === "readyok") {
            phase = "search";
            this.searching = true;
            clearTimeout(watchdog);
            watchdog = setTimeout(
              () => {
                worker.postMessage("stop");
                setTimeout(
                  () =>
                    finish(
                      new Error(
                        "Engine search timed out. Use Fast depth or a time limit.",
                      ),
                    ),
                  3000,
                );
              },
              seconds > 0 ? seconds * 1000 + 5000 : 600000,
            );
            worker.postMessage(`position fen ${fen}`);
            worker.postMessage(
              `go depth ${depth}${seconds > 0 ? ` movetime ${seconds * 1000}` : ""}`,
            );
          } else if (phase === "search") {
            const line = parseInfo(message, fen);
            if (line) {
              const prior = lines.get(line.rank);
              if (!prior || line.depth >= prior.depth) {
                lines.set(line.rank, line);
                const iteration =
                  iterations.get(line.depth) ?? new Map<number, EngineLine>();
                iteration.set(line.rank, line);
                iterations.set(line.depth, iteration);
                onProgress(line.depth);
              }
            }
            if (message.startsWith("bestmove "))
              finish(undefined, message.split(/\s+/)[1]);
          }
        }
      };
      worker.postMessage("uci");
    });
  }
}
