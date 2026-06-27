import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("repository secret hygiene", () => {
  it("does not contain committed env files or obvious API key assignments", async () => {
    const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: process.cwd() });
    const tracked = stdout.split("\n").filter(Boolean);
    expect(tracked.some((file) => file === ".env" || file.startsWith(".env."))).toBe(false);

    const grep = await execFileAsync("git", ["grep", "-nE", "(OPENAI_API_KEY|ANTHROPIC_API_KEY)\\s*="], { cwd: process.cwd() }).catch((error: unknown) => {
      const err = error as { code?: number; stdout?: string };
      if (err.code === 1) {
        return { stdout: "" };
      }
      throw error;
    });
    expect(grep.stdout.trim()).toBe("");
  });
});
