/** Small deterministic PRNG for reproducible demo CSVs (mulberry32-style). */
export type SeededRng = {
  next: () => number;
  nextInt: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffleInPlace: <T>(items: T[]) => void;
};

export function createSeededRng(seed: number): SeededRng {
  let t = seed >>> 0;
  function next(): number {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  }
  function nextInt(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1));
  }
  return {
    next,
    nextInt,
    pick<T>(items: readonly T[]) {
      return items[nextInt(0, items.length - 1)]!;
    },
    shuffleInPlace<T>(items: T[]) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = nextInt(0, i);
        [items[i], items[j]] = [items[j]!, items[i]!];
      }
    },
  };
}
