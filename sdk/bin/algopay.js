#!/usr/bin/env node
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const pkg = require("../package.json");

const cmd = process.argv[2];
const packageRoot = path.join(__dirname, "..");

switch (cmd) {
  case "quickstart":
    // Dynamically require the script so it runs within the current Node process
    require(path.join(__dirname, "../examples/quickstart.js"));
    break;

  case "test":
    console.log("\n Booting AlgoPay Oracle SDK Test Engine...\n");
    // Spawn Jest in a child process, piping the colors and output back to the terminal
    const result = spawnSync("npx", ["jest"], {
      stdio: "inherit",
      cwd: packageRoot,
      shell: true
    });
    process.exit(result.status || 0);
    break;

  case "help":
  default:
    if (cmd && cmd !== "help") {
      console.error(`\n❌ Unknown command: algopay ${cmd}`);
    }
    
    console.log(`
AlgoPay Oracle SDK v${pkg.version}

Programmable payment attestations for Algorand.

Commands:

  algopay quickstart
      Sign, verify and anchor an APC-1 proof
      
  algopay test
      Run the comprehensive SDK unit test suite

  algopay help
      Show this help menu

Documentation:
  https://github.com/PrathamKalburgi/AlgoPay-Oracle

Quick Start:

  Windows PowerShell:
    $env:ORACLE_MNEMONIC="your 25 words"
    npx algopay quickstart

  Linux/macOS:
    export ORACLE_MNEMONIC="your 25 words"
    npx algopay quickstart
`);
    if (cmd && cmd !== "help") process.exit(1);
}