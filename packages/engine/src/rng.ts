// =============================================================
// シード付き乱数（mulberry32）
// 状態は GameState.rngState に数値で持たせ、同じシードなら同じ対戦を再現できるようにする
// =============================================================

/** 0以上1未満の乱数と、次の状態を返す */
export function nextRandom(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export interface RngHolder {
  rngState: number;
}

/** 0以上 n 未満の整数 */
export function randomInt(holder: RngHolder, n: number): number {
  const [value, next] = nextRandom(holder.rngState);
  holder.rngState = next;
  return Math.floor(value * n);
}

/** 配列をその場でシャッフルする（Fisher-Yates） */
export function shuffle<T>(holder: RngHolder, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(holder, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}
