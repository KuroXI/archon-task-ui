import { execSync, spawnSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

function getInstallDir(): string {
  return process.env.ARCHON_UI_INSTALL_DIR ?? join(homedir(), ".archon", "tools", "archon-task-ui");
}

export async function checkForUpdate(): Promise<boolean> {
  const dir = getInstallDir();
  try {
    const local = execSync(`git -C "${dir}" rev-parse HEAD`, { encoding: "utf8", timeout: 3000 }).trim();
    const remote = execSync(`git -C "${dir}" ls-remote origin HEAD`, { encoding: "utf8", timeout: 5000 }).trim().split(/\s/)[0];
    return !!remote && local !== remote;
  } catch {
    return false;
  }
}

export function runUpdate(): void {
  const dir = getInstallDir();
  console.log("Updating archon-task-ui...");
  const pull = spawnSync("git", ["-C", dir, "pull", "--ff-only"], { stdio: "inherit" });
  if (pull.status !== 0) {
    console.error("git pull failed.");
    process.exit(1);
  }
  console.log("Installing dependencies...");
  const install = spawnSync("bun", ["install", "--frozen-lockfile"], { cwd: dir, stdio: "inherit" });
  if (install.status !== 0) {
    console.error("bun install failed.");
    process.exit(1);
  }
  console.log("\nDone! Restart archon-ui to get the latest version.");
}
