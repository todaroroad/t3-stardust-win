import * as NodeReadline from "node:readline";
import { SpotlightIndex } from "./orchestration-v2/spotlightSearchIndex.ts";
export async function runSpotlightSearchWorker(rawOptions: string) {
  const options = JSON.parse(rawOptions) as {
    dbPath: string;
    cachePath: string;
    aliasesPath?: string;
  };
  const index = new SpotlightIndex(options.dbPath, options.cachePath, options.aliasesPath);
  const lines = NodeReadline.createInterface({ input: process.stdin });
  try {
    for await (const line of lines) {
      const request = JSON.parse(line) as { id: number; query: string; limit: number };
      try {
        process.stdout.write(
          JSON.stringify({ id: request.id, matches: index.search(request.query, request.limit) }) +
            "\n",
        );
      } catch (error) {
        const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
        process.stderr.write(`[spotlight-search-worker] search failed: ${detail}\n`);
        process.stdout.write(
          JSON.stringify({ id: request.id, error: "本地搜索索引暂不可用，请稍后重试。" }) + "\n",
        );
      }
    }
  } finally {
    lines.close();
    index.close();
  }
}
