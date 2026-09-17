import type { usePaseo } from "@getpaseo/plugin/client";
import {
  BOARD_NAMES_OUTPUT_SCHEMA,
  type BoardNameSuggestion,
  type BoardNameTarget,
  LUNA_NAMING_PROVIDER,
  namingPrompt,
  parseNameSuggestions,
} from "../shared/naming";

const BATCH_SIZE = 50;
type PaseoApi = ReturnType<typeof usePaseo>;

export async function generateBoardNames(
  paseo: PaseoApi,
  targets: readonly BoardNameTarget[],
): Promise<BoardNameSuggestion[]> {
  if (targets.length === 0) return [];
  const seed = paseo.agents.ref(targets[0].seedAgentId);
  const refreshed = await seed.refresh();
  const cwd = refreshed?.agent.cwd?.trim();
  if (!cwd) throw new Error("Paseo could not find a working directory for the naming agent.");

  const helper = await paseo.agents.create({
    config: { provider: LUNA_NAMING_PROVIDER, thinkingOptionId: "low" },
    cwd,
    parent: seed,
    title: "Name Thread Board threads",
    outputSchema: BOARD_NAMES_OUTPUT_SCHEMA,
    labels: { "thread-board.role": "naming-helper" },
  });

  try {
    const suggestions: BoardNameSuggestion[] = [];
    for (let start = 0; start < targets.length; start += BATCH_SIZE) {
      const batch = targets.slice(start, start + BATCH_SIZE);
      const result = await helper.run(namingPrompt(batch), { timeoutMs: 180_000 });
      if (result.status !== "idle" || !result.lastMessage) {
        const detail = result.error ? ` ${result.error}` : "";
        throw new Error(`Luna could not finish naming the board.${detail}`);
      }
      suggestions.push(...parseNameSuggestions(result.lastMessage, batch));
    }
    return suggestions;
  } finally {
    await helper.archive().catch(() => undefined);
  }
}
