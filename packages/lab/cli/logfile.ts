/**
 * Bounded run log (W0-06).
 *
 * Detail belongs in a file, never on stdout (the card's note), and a file that
 * can grow without limit is its own failure mode on a 100-seed batch. This
 * buffer stops at a byte ceiling and says, in the file itself, how much it
 * dropped — a truncated log that does not admit truncation is worse than none.
 */
export const DEFAULT_LOG_MAX_BYTES = 256 * 1024;

export class BoundedLog {
  readonly maxBytes: number;
  #parts: string[] = [];
  #bytes = 0;
  #droppedLines = 0;
  #droppedBytes = 0;

  constructor(maxBytes: number = DEFAULT_LOG_MAX_BYTES) {
    this.maxBytes = maxBytes;
  }

  write(line: string): void {
    const text = `${line}\n`;
    const size = Buffer.byteLength(text, "utf8");
    if (this.#bytes + size > this.maxBytes) {
      this.#droppedLines += 1;
      this.#droppedBytes += size;
      return;
    }
    this.#parts.push(text);
    this.#bytes += size;
  }

  get bytes(): number {
    return this.#bytes;
  }

  get droppedLines(): number {
    return this.#droppedLines;
  }

  get truncated(): boolean {
    return this.#droppedLines > 0;
  }

  /** The file content, with an explicit truncation footer when lines were dropped. */
  text(): string {
    const body = this.#parts.join("");
    if (this.#droppedLines === 0) return body;
    return `${body}--- log truncated: ${this.#droppedLines} further line(s), ${this.#droppedBytes} bytes, dropped at the ${this.maxBytes}-byte ceiling ---\n`;
  }
}
