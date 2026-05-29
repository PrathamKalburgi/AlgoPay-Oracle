#!/usr/bin/env node

const path = require("path");
const pkg = require("../package.json");

const cmd = process.argv[2];

switch (cmd) {
  case "quickstart":
    require(path.join(__dirname, "../examples/quickstart.js"));
    break;

  case "help":
  default:
    console.log(`
AlgoPay Oracle SDK v${pkg.version}

Programmable payment attestations for Algorand.

Commands:

  algopay quickstart
      Sign, verify and anchor an APC-1 proof

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
}