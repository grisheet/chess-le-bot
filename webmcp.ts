import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { validatePosition } from "./validation";
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
}
interface Context {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
}
export function useChessTools(fen: string, onLoad: (fen: string) => void) {
  const state = useRef({ fen, onLoad });
  state.current = { fen, onLoad };
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: "read_chess_position",
        description:
          "Read the currently visible chess position and validation feedback.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({
          fen: state.current.fen,
          validation: validatePosition(state.current.fen),
        }),
      },
      {
        name: "load_chess_position",
        description:
          "Replace the visible board with a validated FEN and reset move history and analysis. Updates only local browser state.",
        inputSchema: {
          type: "object",
          properties: { fen: { type: "string" } },
          required: ["fen"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input) => {
          if (
            !input ||
            typeof input !== "object" ||
            !("fen" in input) ||
            typeof input.fen !== "string"
          )
            throw new Error("A FEN string is required.");
          const validation = validatePosition(input.fen);
          if (validation.errors.length)
            throw new Error(validation.errors.join(" "));
          const value = input.fen.trim();
          flushSync(() => state.current.onLoad(value));
          return { fen: state.current.fen, loaded: true };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional API; visible controls are always available. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
