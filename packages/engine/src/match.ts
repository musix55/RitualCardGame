// =============================================================
// 対戦の進行（CPU 同士の自動対戦、アプリでの CPU の手番に使う）
// =============================================================

import { applyAction, getLegalActions } from './engine';
import { createGame } from './setup';
import { getPlayerView } from './view';
import { DEFAULT_CONFIG } from './types';
import type { Action, GameConfig, GameState, PlayerId } from './types';
import type { Cpu } from './cpu/cpu';

/** 次に行動するプレイヤー。儀式の選択中は未選択の方、遠見の並べ替え中はその本人 */
export function nextActor(s: GameState): PlayerId {
  if (s.phase === 'ritualSelection') return s.players[0].ritual === null ? 0 : 1;
  return s.pendingChoice?.player ?? s.currentPlayer;
}

/** CPU に見える情報と合法手だけを渡して1手進める */
export function stepCpu(s: GameState, cpu: Cpu): { state: GameState; action: Action } {
  const player = nextActor(s);
  const action = cpu.decide(getPlayerView(s, player), getLegalActions(s, player));
  const result = applyAction(s, action);
  if (!result.ok) throw new Error(`CPU が不正な行動を選びました: ${result.error} (${JSON.stringify(action)})`);
  return { state: result.state, action };
}

export interface MatchOptions {
  readonly seed: number;
  readonly cpus: readonly [Cpu, Cpu];
  readonly config?: GameConfig;
  /** 1手ごとに呼ばれる（テストでの検査用） */
  readonly onStep?: (state: GameState, action: Action) => void;
}

/** 1局あたりの行動数の上限。最大ターン数があるので、正常なら必ずこれより前に終わる */
const MAX_ACTIONS = 2_000;

/** CPU 同士で1局を最後まで進め、終了した状態を返す */
export function playMatch({ seed, cpus, config = DEFAULT_CONFIG, onStep }: MatchOptions): GameState {
  let s = createGame(seed, config);
  for (let i = 0; i < MAX_ACTIONS && s.phase !== 'finished'; i++) {
    const { state, action } = stepCpu(s, cpus[nextActor(s)]);
    s = state;
    onStep?.(s, action);
  }
  if (s.phase !== 'finished') throw new Error(`${MAX_ACTIONS}手で終わりませんでした (seed=${seed})`);
  return s;
}
