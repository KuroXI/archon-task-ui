import { render } from "ink";
import React from "react";
import { parseArgs } from "./data/cli.js";
import { App } from "./components/App.js";

const { dbPath } = parseArgs();

render(<App dbPath={dbPath} />);
