// Generate the pinned random vectors from the project implementation and
// cross-check the raw sfc32 step against an independent implementation.
import { readFileSync, writeFileSync } from "node:fs";
import { SFC32 } from "@thi.ng/random";
import { RandomStream, RANDOM_ALGORITHM, RANDOM_BYTE_ORDER, RANDOM_SEEDING_RULE, WARMUP_DRAWS, splitmix32, labelWord } from "../packages/sim/dist/primitives/random.js";
import { fnv1a32, hashBytes, HashDomain, domainSeed } from "../packages/sim/dist/primitives/hash.js";

const stepCases = [[1, 2, 3, 4], [0, 0, 0, 0], [0xdeadbeef, 0x12345678, 0x9abcdef0, 1], [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]];
const step = stepCases.map(([a, b, c, counter]) => {
  const ours = new RandomStream({ a, b, c, counter });
  const outputs = Array.from({ length: 16 }, () => ours.nextU32());
  const theirs = new SFC32([a | 0, b | 0, c | 0, counter | 0]);
  const independent = Array.from({ length: 16 }, () => theirs.int() >>> 0);
  const agrees = JSON.stringify(outputs) === JSON.stringify(independent);
  if (!agrees) throw new Error(`sfc32 step disagrees with @thi.ng/random for state ${JSON.stringify([a, b, c, counter])}`);
  return { state: [a, b, c, counter], outputs, stateAfter16: Object.values(ours.snapshot()), crossCheckedAgainst: "@thi.ng/random@4.1.54 SFC32" };
});

const splitmixCases = [0, 1, 0x9e3779b9, 0xffffffff].map((seed) => ({ seed, output: splitmix32(seed) }));

const labels = ["worldgen", "combat", "wildlife", "actor:0001", "actor:0137", "guest", "cosmetic"];
const derived = [];
for (const matchSeed of [0, 1, 20260912, 0xffffffff]) {
  for (const label of labels) {
    const s = RandomStream.derive(matchSeed, label);
    derived.push({ matchSeed, label, labelWord: labelWord(label), seededState: Object.values(s.snapshot()), first8: Array.from({ length: 8 }, () => s.nextU32()) });
  }
}

const hashCases = [
  { input: "", bytes: [] },
  { input: "abc", bytes: [97, 98, 99] },
  { input: "The Last Clan", bytes: Array.from("The Last Clan", (ch) => ch.charCodeAt(0)) },
].map((c) => ({
  ...c,
  fnv1a32: fnv1a32(Uint8Array.from(c.bytes)),
  authoritative: hashBytes(HashDomain.Authoritative, Uint8Array.from(c.bytes)),
  observer: hashBytes(HashDomain.Observer, Uint8Array.from(c.bytes)),
}));

const doc = {
  $comment:
    "Pinned vectors for The Last Clan randomness and hashing. The sfc32 step outputs are cross-checked against an independent implementation (@thi.ng/random@4.1.54 SFC32) at generation time and again in random.test.ts. The seeding rule and the hash domain tags are project-defined, so those vectors pin this project's rule; changing either requires a new seedingRule/version string and regenerated vectors.",
  algorithm: RANDOM_ALGORITHM,
  outputRule: "t = ((a + b) | 0) + d | 0, returned as t >>> 0",
  seedingRule: RANDOM_SEEDING_RULE,
  warmupDraws: WARMUP_DRAWS,
  byteOrder: RANDOM_BYTE_ORDER,
  generatedBy: "tools/gen_random_vectors.mjs (W0-03)",
  hash: { algorithm: "FNV-1a/32", offsetBasis: 2166136261, prime: 16777619, domains: { authoritative: HashDomain.Authoritative, observer: HashDomain.Observer }, domainSeeds: { authoritative: domainSeed(HashDomain.Authoritative), observer: domainSeed(HashDomain.Observer) } },
  splitmix32: splitmixCases,
  step,
  derived,
  hashCases,
};
const out = new URL("../packages/sim/primitives/vectors/random-v1.json", import.meta.url);
writeFileSync(out, JSON.stringify(doc, null, 1) + "\n");
console.log("wrote", out, readFileSync(out).length, "bytes; step cases cross-checked:", step.length);
