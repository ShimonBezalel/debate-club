import { describe, expect, it } from "vitest";
import { debateClubVersion } from "../src/index.js";

describe("package bootstrap", () => {
  it("exports the milestone version", () => {
    expect(debateClubVersion).toBe("0.1.0");
  });
});
