/**
 * @lastclan/sim — package entry point.
 *
 * Sub-modules arrive with their packets: primitives (W0-02, W0-03), contracts
 * (W0-04), core/host (W0-07), persistence (W0-08). No game system exists yet.
 */
export const PACKAGE_NAME = "@lastclan/sim" as const;
export * from "./primitives/index.js";
