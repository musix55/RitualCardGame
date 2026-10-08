// =============================================================
// ランダムに打つ CPU 同士の大量対戦
// 合法手から一様に選ぶだけの CPU で、エンジンが壊れないことを確かめる
// （数値の集計は scripts/simulate.ts で行う）
// =============================================================

import { describe, expect, it } from 'vitest';
import { playMatch } from '../src/match';
import { randomInt } from '../src/rng';
import type { Cpu } from '../src/cpu/cpu';
import type { GameState } from '../src/types';

const GAMES = 2_000;
const DECK_SIZE = 60;

function randomCpu(seed: number): Cpu {
  const rng = { rngState: seed >>> 0 };
  return { decide: (_view, legal) => legal[randomInt(rng, legal.length)]! };
}

/** どの時点でも成り立つべき性質 */
function checkInvariants(s: GameState): void {
  const all = [
    ...s.deck,
    ...s.discard,
    ...s.players.flatMap((p) => [...p.hand, ...(p.barrier ? [p.barrier] : [])]),
  ];
  expect(all).toHaveLength(DECK_SIZE);
  expect(new Set(all.map((c) => c.id)).size).toBe(DECK_SIZE);
  for (const p of s.players) {
    expect(p.progress).toBeGreaterThanOrEqual(0);
    expect(p.progress).toBeLessThanOrEqual(s.config.goalProgress);
  }
  expect(s.turnNumber).toBeLessThanOrEqual(s.config.maxTurns);
}

describe('ランダム対戦', () => {
  it(`${GAMES}局すべてが正常に終わる`, () => {
    for (let seed = 0; seed < GAMES; seed++) {
      // 合法手が0件なら randomCpu が undefined を返し、applyAction が失敗して検出される
      const s = playMatch({
        seed,
        cpus: [randomCpu(seed * 2 + 1), randomCpu(seed * 2 + 2)],
        onStep: checkInvariants,
      });
      expect(s.result).not.toBeNull();
    }
  }, 120_000);
});
