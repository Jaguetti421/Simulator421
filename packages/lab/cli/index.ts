#!/usr/bin/env node
/**
 * clanlab — command-line entry (TP v2.0 §2, §19).
 *
 * W0-01 ships a stub: argument parsing, help, version and truthful
 * NOT_IMPLEMENTED reporting for the commands later packets implement.
 * Nothing here runs a simulation or validates a fixture, and nothing here
 * ever reports a PASS.
 */
import { runCli } from "./run.js";

const code = runCli(process.argv.slice(2), {
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
});
process.exit(code);
