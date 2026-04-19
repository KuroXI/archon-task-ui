import { render } from "ink";
import React from "react";
import { parseArgs } from "./data/cli.js";
import { runUpdate } from "./data/updater.js";
import { App } from "./components/App.js";

const { dbPath, subcommand } = parseArgs();

if (subcommand === "update") {
  runUpdate();
  process.exit(0);
}

render(<App dbPath={dbPath} />);
