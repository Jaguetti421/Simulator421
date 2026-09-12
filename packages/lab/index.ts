/**
 * @lastclan/lab — library entry point (the CLI lives in ./cli).
 *
 * W0-05 added the fixture DSL; W0-06 adds the runner, hosts, bounded logs and
 * failure bundles. The readability renderer (W0-09) arrives with its packet.
 */
export const PACKAGE_NAME = "@lastclan/lab" as const;
export * from "./fixture/index.js";
export * from "./bundle/index.js";
