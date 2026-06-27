import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportPublicDb } from "../src/publicDb/export.js";
import { validatePublicDb } from "../src/publicDb/validate.js";
import { buildViewer } from "../src/viewer/build.js";

describe("public DB export", () => {
  it("exports every valid ledger match into a viewer-oriented static database", async () => {
    const out = await mkdtemp(join(tmpdir(), "debate-club-public-db-"));

    const manifest = await exportPublicDb("matches", out);

    expect(manifest.match_count).toBeGreaterThanOrEqual(5);
    expect(manifest.schema_version).toBe("1.0");
    const summaries = JSON.parse(await readFile(join(out, "matches.json"), "utf8")) as Array<{
      match_id: string;
      conjecture: { statement: string; domain: string; truth_type: string };
      paths: { detail: string; transcript: string; scorecard: string; source: string };
    }>;
    expect(summaries).toHaveLength(manifest.match_count);
    expect(summaries[0]?.conjecture.statement).toBeTruthy();
    expect(summaries[0]?.conjecture.domain).toBeTruthy();
    expect(summaries[0]?.paths.source).toContain("github.com/ShimonBezalel/debate-club");
    await access(join(out, summaries[0]!.paths.detail));
    await access(join(out, summaries[0]!.paths.transcript));
    await access(join(out, summaries[0]!.paths.scorecard));
    await access(join(out, "agents.json"));
    await access(join(out, "judges.json"));
    await access(join(out, "conjectures.json"));
    const readme = await readFile(join(out, "README.md"), "utf8");
    expect(readme).toContain("## Schema");
    expect(readme).toContain("fork, diff, cite, and replay");
    const transcript = await readFile(join(out, "matches", "live-public-vs-hidden-judges-001.transcript.md"), "utf8");
    expect(transcript).not.toMatch(/[ \t]+$/m);
  });

  it("validates a complete export and rejects inconsistent manifests", async () => {
    const out = await mkdtemp(join(tmpdir(), "debate-club-public-db-"));
    const manifest = await exportPublicDb("matches", out);

    await expect(validatePublicDb(out)).resolves.toMatchObject({
      match_count: manifest.match_count,
      valid: true
    });

    await writeFile(join(out, "index.json"), `${JSON.stringify({ ...manifest, match_count: manifest.match_count + 1 }, null, 2)}\n`);
    await expect(validatePublicDb(out)).rejects.toThrow("match_count");
  });
});

describe("static viewer build", () => {
  it("builds a standalone viewer with an embedded public DB", async () => {
    const db = await mkdtemp(join(tmpdir(), "debate-club-public-db-"));
    const out = await mkdtemp(join(tmpdir(), "debate-club-viewer-"));
    const manifest = await exportPublicDb("matches", db);

    const result = await buildViewer(db, out);

    expect(result.match_count).toBe(manifest.match_count);
    const html = await readFile(join(out, "index.html"), "utf8");
    expect(html).toContain("Debate Club Archive");
    expect(html).toContain("Search conjectures");
    expect(html).toContain('src="./assets/app.js"');
    const styles = await readFile(join(out, "assets", "styles.css"), "utf8");
    expect(styles).toContain("[hidden]");
    await access(join(out, "assets", "app.js"));
    await access(join(out, "assets", "styles.css"));
    await access(join(out, "db", "index.json"));
    await access(join(out, "db", "matches.json"));
  });
});
