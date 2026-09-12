/**
 * @lastclan/sim primitives: branded Int, checkedMath, units, rates with saved
 * remainders, little-endian serialization (W0-02); sfc32 randomness, labeled
 * stream derivation and canonical two-domain hashing (W0-03).
 */
export { asInt, int, isInt, IntegerError, MAX_SAFE, MIN_SAFE, ONE, ZERO } from "./int.js";
export type { Int, IntegerErrorCode } from "./int.js";
export { abs, add, clamp, divCeil, divFloor, isqrt, max, min, modFloor, mul, mulDiv, neg, sub } from "./checkedMath.js";
export {
  actionDurationTicks,
  composeMilli,
  MILLI_ONE,
  MILLI_ZERO,
  milli,
  mm,
  MM_PER_METER,
  mmFromMeters,
  mmPerTickFromMmPerSecond,
  scaleMilliFloor,
  STANDARD_MATCH_TICKS,
  TICK_HZ,
  TICK_MS,
  ticks,
  ticksFromDeciseconds,
  ticksFromMinutes,
  ticksFromSeconds,
  TICKS_PER_MINUTE,
  TICKS_PER_SECOND,
} from "./units.js";
export type { Milli, Mm, Ticks } from "./units.js";
export { advance, rate, RATE_STATE_ZERO, ratePerMinute, ratePerSecond, ratePerTick, totalOver } from "./rate.js";
export type { Advance, Rate, RateState } from "./rate.js";
export {
  ByteReader,
  ByteWriter,
  decodeRateState,
  encodeRateState,
  RATE_STATE_FORMAT_VERSION,
  readSection,
  SECTION_HEADER_BYTES,
  SECTION_MAGIC,
  SerializationError,
  writeSection,
} from "./serialize.js";
export type { Section, SerializationErrorCode } from "./serialize.js";
export {
  decodeRandomState,
  encodeRandomState,
  labelWord,
  RANDOM_ALGORITHM,
  RANDOM_BYTE_ORDER,
  RANDOM_SEEDING_RULE,
  RANDOM_STATE_FORMAT_VERSION,
  RandomStream,
  splitmix32,
  WARMUP_DRAWS,
} from "./random.js";
export type { RandomState } from "./random.js";
export {
  domainSeed,
  FNV_OFFSET_BASIS,
  fnv1a32,
  formatDigest,
  HashAccumulator,
  HashDomain,
  HashError,
  hashBytes,
  mixInt53,
  mixWord,
} from "./hash.js";
export type { HashDomainTag, HashErrorCode } from "./hash.js";
