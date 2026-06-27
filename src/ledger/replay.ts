import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function replayMatch(matchDirectory: string): Promise<string> {
  return readFile(join(matchDirectory, "transcript.md"), "utf8");
}
