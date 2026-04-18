import { describe, it, expect } from "bun:test";
import { homedir } from "os";
import { join } from "path";
import { parseArgs } from "./cli.js";

const DEFAULT_DB_PATH = join(homedir(), ".archon", "archon.db");

describe("parseArgs", () => {
  it("returns default dbPath when --db flag is absent", () => {
    const result = parseArgs(["bun", "src/index.tsx"]);
    expect(result.dbPath).toBe(DEFAULT_DB_PATH);
  });

  it("returns custom dbPath when --db value flag is provided", () => {
    const result = parseArgs(["bun", "src/index.tsx", "--db", "/custom/path/archon.db"]);
    expect(result.dbPath).toBe("/custom/path/archon.db");
  });

  it("returns custom dbPath when --db=value flag is provided", () => {
    const result = parseArgs(["bun", "src/index.tsx", "--db=/custom/path/archon.db"]);
    expect(result.dbPath).toBe("/custom/path/archon.db");
  });

  it("default dbPath starts with home directory", () => {
    const result = parseArgs([]);
    expect(result.dbPath.startsWith(homedir())).toBe(true);
  });

  it("default dbPath ends with .archon/archon.db", () => {
    const result = parseArgs([]);
    expect(result.dbPath.endsWith(join(".archon", "archon.db"))).toBe(true);
  });

  it("does not contain literal tilde in default path", () => {
    const result = parseArgs([]);
    expect(result.dbPath.includes("~")).toBe(false);
  });
});
