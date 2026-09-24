import { copyFileSync, mkdirSync, existsSync } from "node:fs";
const name = "stockfish-17.1-lite-single";
mkdirSync("public/engine", { recursive: true });
for (const ext of ["js", "wasm"]) {
  const source = `node_modules/stockfish/src/${name}-03e3232.${ext}`;
  if (!existsSync(source))
    throw new Error(`Stockfish asset missing: ${source}. See README.md.`);
  copyFileSync(source, `public/engine/${name}.${ext}`);
}
if (existsSync("node_modules/stockfish/Copying.txt"))
  copyFileSync(
    "node_modules/stockfish/Copying.txt",
    "public/engine/Copying.txt",
  );
