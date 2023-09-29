#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { execaSh } from "./execa-sh.js";

const argv = await yargs(hideBin(process.argv))
  .alias("c", "command")
  .describe("c", "Command(s) to run")
  .nargs("c", 1)
  .option("c", { type: "string" })
  .help()
  .alias("h", "help")
  .version()
  .alias("v", "version").argv;

console.debug(argv);
const _x = execaSh({ stdio: "inherit" })`echo test from cli.ts`;

if (argv.c) {
  const strings = Object.assign([argv.c], { raw: [argv.c] });
  execaSh({ stdio: "inherit" })(strings);
}
