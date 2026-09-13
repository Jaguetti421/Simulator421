/**
 * @lastclan/sim spatial — island geometry (P1-02; TP v1.1 §5).
 *
 * The compiled height field, traversal classes, sparse fine cells and the one
 * geometry manifest that render and simulation both read.
 */
export * from "./terrain.js";
export * from "./visibility.js";
export { DEFAULT_ROUTE_BUDGET, findRoute, PORTAL_REPEAT_LIMIT, RouteKnowledge, RouteProgress, stepDurationTicks, UNKNOWN } from "./route.js";
export type { RouteCell, RouteResult, RouteStatus } from "./route.js";
