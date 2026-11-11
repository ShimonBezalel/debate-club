import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { tempDir } from "./helpers/tempDir.js";

const directories: string[] = [];

afterAll(async () => {
  expect(directories).toHaveLength(2);
  for (const directory of directories) {
    await expect(access(directory)).rejects.toMatchObject({ code: "ENOENT" });
  }
});

it("keeps temporary artifacts available until the test finishes", async () => {
  const directory = await tempDir("debate-club-cleanup-pass-");
  directories.push(directory);
  await mkdir(join(directory, "nested"));
  const artifact = join(directory, "nested", "artifact.txt");
  await writeFile(artifact, "generated test data");
  await expect(access(artifact)).resolves.toBeUndefined();
});

it.fails("removes temporary artifacts after a failing test", async () => {
  const directory = await tempDir("debate-club-cleanup-fail-");
  directories.push(directory);
  await writeFile(join(directory, "artifact.txt"), "generated test data");
  throw new Error("Intentional failure to exercise test teardown");
});
