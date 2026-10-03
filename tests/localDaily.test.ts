import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("checks the local publication safety and scheduling contracts", { timeout: 15_000 }, async () => {
  const { stderr } = await promisify(execFile)("python3", ["-m", "unittest", "discover", "-s", "tests", "-p", "test_local_daily.py"]);
  expect(stderr).toContain("OK");
});
