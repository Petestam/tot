/** Fisher–Yates shuffle in place; returns same array for convenience. */
export function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random true/false with uniform distribution. */
export function randomBool(): boolean {
  return Math.random() < 0.5;
}
