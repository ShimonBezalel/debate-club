import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { validatePublicDb } from "../publicDb/validate.js";

const VIEWER_SOURCE = fileURLToPath(new URL("../../viewer/", import.meta.url));

export interface ViewerBuildResult {
  match_count: number;
  output: string;
}

export async function buildViewer(dbRoot: string, outRoot: string): Promise<ViewerBuildResult> {
  const validation = await validatePublicDb(dbRoot);
  await rm(outRoot, { recursive: true, force: true });
  await mkdir(outRoot, { recursive: true });
  await cp(VIEWER_SOURCE, outRoot, { recursive: true });
  await cp(dbRoot, join(outRoot, "db"), { recursive: true });
  return { match_count: validation.match_count, output: outRoot };
}
