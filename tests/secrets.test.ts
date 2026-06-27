import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("repository secret hygiene", () => {
  it("does not contain committed env files or obvious API key assignments", async () => {
    const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: process.cwd() });
    const tracked = stdout.split("\n").filter(Boolean);
    expect(tracked.some((file) => file === ".env" || file.startsWith(".env."))).toBe(false);

    const keyShape = new RegExp([
      "sk-proj-[A-Za-z0-9_-]{16,}",
      "sk-ant-[A-Za-z0-9_-]{16,}",
      "OPENAI_API_KEY\\s*=\\s*['\\\"]?sk-[A-Za-z0-9_-]{16,}",
      "ANTHROPIC_API_KEY\\s*=\\s*['\\\"]?sk-ant-[A-Za-z0-9_-]{16,}"
    ].join("|"));
    const findings: string[] = [];
    for (const file of tracked) {
      if (file === "tests/secrets.test.ts") {
        continue;
      }
      const content = await readFile(file, "utf8").catch(() => "");
      if (keyShape.test(content)) {
        findings.push(file);
      }
    }
    expect(findings).toEqual([]);
  });
});
