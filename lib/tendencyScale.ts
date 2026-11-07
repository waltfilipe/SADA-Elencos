/**
 * Place a value on a bar whose middle is the pool average.
 * The left half runs from 0 to the average; the right half from the average to the scale.
 */
export function centeredTendencyPosition(share: number, average: number, scale: number): number {
  const hi = Math.max(scale, share, average, 1);
  if (share <= average) {
    if (average <= 0) return 50;
    return (Math.max(share, 0) / average) * 50;
  }
  if (hi <= average) return 50;
  return 50 + ((share - average) / (hi - average)) * 50;
}
