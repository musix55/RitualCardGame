// =============================================================
// ランダムに打つ CPU 同士の大量対戦
// 合法手から一様に選ぶだけの CPU で、エンジンが壊れないことを確かめる
// =============================================================

import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions } from '../src/engine';
import { createGame } from '../src/setup';
import { nextRandom } from '../src/rng';
import type { GameResult, GameState, PlayerId } from '../src/types';

const GAMES = 10_000;
const DECK_SIZE = 60;
/** 1局あたりの行動数の上限（無限ループの検出用。正常なら最大ターン数で必ず止まる） */
const MAX_ACTIONS = 2_000;

/** 次に行動するプレイヤー */
function actor(s: GameState): PlayerId {
  if (s.phase === 'ritualSelection') return s.players[0].ritual === null ? 0 : 1;
  return s.pendingChoice?.player ?? s.currentPlayer;
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

function playRandomGame(seed: number): GameState {
  let s = createGame(seed);
  let rng = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < MAX_ACTIONS; i++) {
    if (s.phase === 'finished') return s;
    const legal = getLegalActions(s, actor(s));
    // 終了していない限り、誰かが必ず行動できる（詰みがない）
    expect(legal.length).toBeGreaterThan(0);
    const [r, next] = nextRandom(rng);
    rng = next;
    const result = applyAction(s, legal[Math.floor(r * legal.length)]!);
    if (!result.ok) throw new Error(`合法手が失敗しました: ${result.error}`);
    s = result.state;
    checkInvariants(s);
  }
  throw new Error(`${MAX_ACTIONS}手で終わりませんでした (seed=${seed})`);
}

describe('ランダム対戦', () => {
  it(`${GAMES}局すべてが正常に終わる`, () => {
    const reasons: Record<string, number> = {};
    let totalTurns = 0;
    for (let seed = 0; seed < GAMES; seed++) {
      const s = playRandomGame(seed);
      const result = s.result as GameResult;
      const key = result.type === 'win' ? `win:${result.reason}` : `draw:${result.reason}`;
      reasons[key] = (reasons[key] ?? 0) + 1;
      totalTurns += s.turnNumber;
    }
    console.log('終了理由', reasons, '平均ターン数', (totalTurns / GAMES).toFixed(1));
  }, 120_000);
});
