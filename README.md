# Chess Skill-Level Move Calculator

A fully client-side chess workspace for studying how plausible human choices differ from engine-best play. Built with React 19, strict TypeScript, Vite, Tailwind CSS, chess.js, react-chessboard, lucide-react, and Stockfish 17.1 WebAssembly.

## Run locally

Requires Node.js 20.19+ (tested with Node.js 24) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm ci` automatically copies the bundled single-threaded Stockfish engine into `public/engine/`. No API key, account, backend, or external chess service is required. Engine computation and saved positions stay in the browser.

```sh
npm test           # 44 focused rule, simulation, parsing, and engine-lifecycle tests
npm run build     # strict TypeScript check and production build
npm run preview   # serve the production build locally
```

Do not open `index.html` or the built output directly with a `file://` URL: browsers need HTTP to load the module and Worker/WASM assets.

## Features

- **Setup:** drag existing pieces anywhere; drag from the piece palette or select a piece and click a square; right-click/eraser to remove; clear/reset; flip; side to move; castling, en passant, halfmove, and fullmove controls.
- **Position validation:** board shape, FEN fields, king counts, adjacent kings, back-rank pawns, castling configuration, possible en passant state, non-moving side in check, active check, checkmate/stalemate, and unusual material warnings. Invalid positions remain freely editable but cannot be analyzed.
- **Play:** legal drag/drop or click moves, legal destination indicators, last-move/check highlights, full promotion choice including underpromotion, SAN history, undo/redo, reset, PGN export, draw detection, and keyboard UCI entry. Board squares also respond to Enter/Space.
- **Analyze:** rating range 400–3000 and seven presets; likely, practical, or engine-best choice; requested depths 12/16/20; optional 5/15/30/60-second limits; progress and stop; SAN/UCI, quality, loss, evaluation, rule-based explanations, principal variation, candidate table, preview highlights, and play-and-analyze-next.
- **Local persistence:** position, configuration, orientation, rating, mode, depth, move timeline, and saved positions with names/notes/dates. Rename/delete, JSON backup export/import. Storage failures are surfaced; imported data is shape-checked and positions are validated before play/analysis.
- Native modal focus containment, associated form labels, visible keyboard focus, responsive layout, and reduced-motion styling.
- Optional feature-detected WebMCP tools to read or load a validated FEN; all normal controls work without this experimental browser API.

## Project map

```text
src/
  App.tsx                         Workspace state, move timeline, analysis orchestration
  types.ts                        Shared strict domain types
  components/
    Board.tsx                     Interactive board and highlights
    SetupControls.tsx             Piece palette and FEN metadata
    AnalysisControls.tsx          Rating, depth, mode, time limit and seed
    Results.tsx                   Recommendation, comparisons and candidate table
    SavedPositions.tsx            Local position management and JSON backups
    Modal.tsx                     Native accessible dialog
  services/
    stockfishEngine.ts            Worker lifecycle, UCI protocol and parser
    stockfishEngine.test.ts       Loading, cancellation, stale-message tests
  data/ratingProfiles.ts          Tunable interpolated profiles and quality thresholds
  lib/
    chess.ts                      Board/FEN conversion and legal UCI/SAN conversion
    validation.ts                 Blocking errors, warnings, terminal state
    humanMoveSimulator.ts         Candidate normalization, features and weighted choice
    quality.ts                    Cp and mate-aware classification
    explainMove.ts                Local deterministic explanations
    storage.ts                    Defensive persistence, imports and exports
    webmcp.ts                     Optional structured browser actions
    chess.test.ts                 Rules, scoring, simulation and conversion tests
scripts/copy-engine.mjs            Reproducible local engine asset installation
public/engine/                    Stockfish Worker, WASM and GPL license
```

## Stockfish integration

`StockfishEngine` creates a dedicated classic Web Worker using `public/engine/stockfish-17.1-lite-single.js`. The Worker loads its neighboring `.wasm` file. This is the smaller **single-threaded** build, so it requires neither SharedArrayBuffer nor cross-origin isolation headers and works on ordinary static hosting, including GitHub Pages.

Each search uses a fresh Worker to isolate position state and stale messages. Commands:

```text
uci
setoption name Threads value 1
setoption name Hash value 32
setoption name MultiPV value 12
isready
position fen <CURRENT_FEN>
go depth <12|16|20> [movetime <milliseconds>]
```

Initialization waits for `uciok` and `readyok`. The parser accepts finite cp/mate scores and legal PVs, discards bounds and malformed lines, and never replaces a deeper line with a shallower one. Results prefer the last complete MultiPV iteration so candidate losses compare the same depth. Early searches without a complete iteration can return a smaller pool. Stop sends `stop` during search; stopping initialization cancels it outright. Position changes, new searches, and unmount terminate the old Worker. Load and search watchdogs produce visible actionable errors.

**Evaluation perspective:** all numeric scores favor the player to move in the analyzed root FEN when positive. They are not always from White's perspective. “Before” is best-play evaluation; “after” is the root search evaluation constrained to the chosen first move, **not** a separate evaluation of the resulting board. Mate scores remain mate scores; cp loss is not fabricated for them.

The final `bestmove` UCI response anchors the engine-best comparison and engine mode. If an early stop interrupts a change of leader, its latest evaluated line is retained alongside the last complete MultiPV snapshot; line depths are exposed in Advanced details. In this case losses can compare different reached depths, as disclosed in the interface.

### Engine assets / manual recovery

No manual setup is normally required. `npm ci` runs `scripts/copy-engine.mjs`, copying these exact assets from the pinned Stockfish 17.1 package:

```text
node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js
node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.wasm
```

They are installed as:

```text
public/engine/stockfish-17.1-lite-single.js
public/engine/stockfish-17.1-lite-single.wasm
public/engine/Copying.txt
```

If assets were removed or package scripts were disabled, run:

```sh
node scripts/copy-engine.mjs
npm run build
```

To supply a different engine, use a compatible single-threaded UCI Worker and matching WASM together, and update the Worker URL and copy script. Keep its original license/source attribution. Worker/WASM requests must return actual files, not an HTML SPA fallback. Asset URLs use Vite's base URL so repository subpaths work.

Stockfish is GPLv3, from [stockfish.js](https://github.com/nmrugg/stockfish.js) and [upstream Stockfish](https://github.com/official-stockfish/Stockfish). Its license is distributed alongside the assets. The installed package version and source asset names are fixed in `package-lock.json` and the copy script. Stockfish source/build instructions are in its project repository; retain applicable GPL notices and source-distribution obligations when redistributing its binaries.

## Human-like rating model

This is **not** Stockfish's strength slider. Stockfish evaluates candidates at full strength, after which the application models move choice:

1. Normalize and validate up to 12 MultiPV candidates.
2. Compute cp loss against the strongest evaluated candidate (mate outcomes handled separately).
3. Interpolate target loss, spread, tactical awareness, and top-move chance across rating anchors.
4. Inspect captures, checks, development, castling, early queen activity, king-side pawn pushes, repeated opening moves, obvious favorable captures missed, a capture threat against the moved piece, and immediate mate replies.
5. Draw a target loss and weight candidates by distance, naturalness, and tactical risk. Higher ratings strongly suppress large errors; low ratings can still find a good move.
6. Sample a legal candidate. A user-provided integer seed makes selection reproducible **given the same candidate lines**, which themselves depend on engine depth/time and hardware.

Practical mode is separate: only near-best candidates are eligible (about 15–50 cp tolerance, rating-dependent). It favors straightforward development, castling, and easy-to-notice sound ideas over rough calculation-complexity proxies. It chooses the highest practical weight rather than deliberately introducing a mistake. Engine mode selects the highest-evaluated candidate.

Quality thresholds live in `src/data/ratingProfiles.ts`: Best ≤10, Excellent ≤25, Good ≤60, Inaccuracy ≤120, Mistake ≤250, otherwise Blunder. Moves preserving forced mate for the same side are not called blunders solely for a different mate distance.

**The Elo setting is a heuristic human-like simulation. It is not a direct prediction of an individual player’s move, nor is it equivalent to FIDE, USCF, Chess.com, or Lichess ratings.**

Model weights are normalized selection weights conditional on the sampled target error, **not** calibrated confidence estimates or real-world player probabilities.

## Static hosting / GitHub Pages

`npm run build` produces a static `dist/` directory, including all engine assets. The Vite configuration uses `base: './'`, so it works under a repository subpath. Deploy **the entire directory**, including `dist/engine/`.

For GitHub Pages, push this project to a repository, set Settings → Pages → Source to **GitHub Actions**, and use a workflow with:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with Node 22 and npm caching
3. `npm ci`, `npm test`, `npm run build`
4. `actions/configure-pages@v5`
5. `actions/upload-pages-artifact@v3` with `path: dist`
6. `actions/deploy-pages@v4` in a job with `pages: write`, `id-token: write`, and the `github-pages` environment.

There is one route and no server routing or database requirement. No COOP/COEP headers are needed for this bundled engine. Use HTTPS in production. Local state belongs to the browser origin, so switching deployment domains does not transfer saved positions; export/import JSON to migrate.

## Known limitations

- The model is hand-tuned, not trained or validated on rating-bucketed human games. The default top-12 candidate pool often excludes plausible low-rated blunders, particularly in quiet/opening positions. The UI discloses the candidate-pool limit.
- Tactical features are lightweight proxies, not complete static exchange evaluation, fork/pin/skewer recognition, or proof of compensation. A threatened moved piece may be part of a sound sacrifice. Explanations say so rather than inventing tactical claims.
- Practical complexity is approximate: it does not reliably identify a sacrifice requiring exactly eight precise moves or every quiet engine-only idea.
- Validation catches unsafe obvious states; it does not prove a position is historically reachable. Castling rights cannot prove that a rook or king has never moved.
- The bundled lite engine is an actual Stockfish engine but has a smaller network than the full build. Deep MultiPV searches can be expensive. Time-limited results may finish below the requested depth; the actual completed iteration is shown.
- Full move-history/repetition context exists for moves made or reloaded in this app. Importing a FEN alone cannot recover the game's earlier repetition history.
- Saved positions are device-local, with no cloud sync. Browser storage can be unavailable or cleared; export JSON for durable backups.
- Native HTML palette dragging is primarily for desktop; click/tap placement and keyboard square entry support touch and keyboard users.
- Experimental WebMCP is optional and browser-dependent. Its registration/action checks were unavailable in the testing browser because `document.modelContext` was not exposed; normal UI flows were tested.

## Validation performed

- Production TypeScript/Vite build.
- 44 automated tests covering FEN safety, mate-aware move quality, seeded weighted selection, Elo behavior, normalization, SAN conversion including castling/promotion/checkmate, UCI parsing, cancellation, load failure, and stale-result isolation.
- Browser checks: actual Stockfish WASM loading and analysis; legal moves; undo/redo; board setup with missing-king errors; piece placement; saved position creation; FEN import; promotion choice including a knight.

## Future work

- Train on rating-bucketed public games and calibrate uncertainty.
- Platform-specific rating profiles.
- Broader candidate sampling for lower-rated simulation.
- PGN import and full game review.
- Blunder training mode, opening explorer, and puzzle generation.
