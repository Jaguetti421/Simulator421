/**
 * @lastclan/sim — package entry point.
 *
 * Sub-modules arrive with their packets: primitives (W0-02, W0-03), contracts
 * (W0-04), core/host (W0-07), persistence (W0-08). No game system exists yet.
 */
export const PACKAGE_NAME = "@lastclan/sim" as const;
export * from "./primitives/index.js";
/**
 * Contracts are namespaced: several schema builders share names with the unit
 * constructors in primitives (`int`, `milli`, `mm`), and a flat re-export would
 * make `import { milli }` ambiguous at the call site.
 */
export * as contracts from "./contracts/index.js";
