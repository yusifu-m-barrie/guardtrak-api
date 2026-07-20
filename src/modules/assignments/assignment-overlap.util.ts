/**
 * Returns true when two half-open time ranges [start, end) overlap.
 * Works for overnight shifts when end is on the following calendar day.
 */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
