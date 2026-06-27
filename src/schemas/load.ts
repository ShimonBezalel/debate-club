import { readFile } from "node:fs/promises";
import YAML from "yaml";

export async function loadYamlFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return YAML.parse(raw);
}

export function explainZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues;
    return issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}
