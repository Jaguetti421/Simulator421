import { describe, expect, it } from "vitest";
import { BoundedLog, DEFAULT_LOG_MAX_BYTES } from "./logfile.js";

describe("bounded run log", () => {
  it("keeps everything while it fits under the ceiling", () => {
    const log = new BoundedLog(1024);
    log.write("first");
    log.write("second");
    expect(log.text()).toBe("first\nsecond\n");
    expect(log.truncated).toBe(false);
    expect(log.droppedLines).toBe(0);
  });

  it("stops at the ceiling and says so in the file itself", () => {
    const log = new BoundedLog(32);
    log.write("0123456789"); // 11 bytes with the newline
    log.write("0123456789");
    log.write("0123456789"); // 33 > 32: dropped
    log.write("also dropped");
    expect(log.bytes).toBeLessThanOrEqual(32);
    expect(log.droppedLines).toBe(2);
    expect(log.truncated).toBe(true);
    expect(log.text()).toContain("log truncated: 2 further line(s)");
    expect(log.text()).toContain("32-byte ceiling");
  });

  it("counts bytes, not characters, so a non-ASCII log cannot overrun the ceiling", () => {
    const log = new BoundedLog(16);
    log.write("äöäöäöä"); // 14 UTF-8 bytes + newline = 15
    expect(log.bytes).toBe(15);
    log.write("x");
    expect(log.droppedLines).toBe(1);
  });

  it("defaults to a ceiling that keeps a per-run log small enough to read", () => {
    expect(new BoundedLog().maxBytes).toBe(DEFAULT_LOG_MAX_BYTES);
    expect(DEFAULT_LOG_MAX_BYTES).toBe(256 * 1024);
  });
});
