// Remove build outputs. Standard library only.
import { rmSync } from "node:fs";
for (const d of ["packages/sim/dist", "packages/content/dist", "packages/lab/dist", "apps/web/dist", "tests/dist"]) {
  rmSync(d, { recursive: true, force: true });
}
