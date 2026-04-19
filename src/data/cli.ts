import { homedir } from "os";
import { join } from "path";

const DEFAULT_DB_PATH = join(homedir(), ".archon", "archon.db");

export function parseArgs(argv: string[] = process.argv): { dbPath: string; subcommand: string | null } {
  let dbPath = DEFAULT_DB_PATH;
  let subcommand: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "update") {
      subcommand = "update";
      break;
    }
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Handle --db=value form
    if (arg.startsWith("--db=")) {
      dbPath = arg.slice("--db=".length);
      break;
    }

    // Handle --db value form
    if (arg === "--db" && i + 1 < argv.length) {
      dbPath = argv[i + 1];
      break;
    }
  }

  return { dbPath, subcommand };
}
