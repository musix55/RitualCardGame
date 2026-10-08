// =============================================================
// 人間と CPU の1局（アプリの画面から使う）
//
// 画面は人間の行動を humanAct で、CPU の手番を stepSessionCpu で進めるだけにし、
// 対局の記録（log.ts）もここでまとめて残す。React には依存しない。
// =============================================================

import { applyAction } from './engine';
import { appendToLog, createGameLog } from './log';
import type { GameLog } from './log';
import { nextActor, stepCpu } from './match';
import { createGame } from './setup';
import { getPlayerView } from './view';
import { DEFAULT_CONFIG } from './types';
import type { Action, GameConfig, GameState, PlayerId, PlayerView } from './types';
import type { Cpu, CpuLevel } from './cpu/cpu';

export interface Session {
  readonly state: GameState;
  readonly log: GameLog;
  /** 人間の席。先攻（0）か後攻（1）か */
  readonly human: PlayerId;
  readonly cpuLevel: CpuLevel;
}

export interface NewSessionOptions {
  readonly seed: number;
  /** 人間の席。先攻・後攻はランダムに決める（4章）ため、呼び出し側で抽選して渡す */
  readonly human: PlayerId;
  readonly cpuLevel: CpuLevel;
  readonly startedAt: string;
  readonly config?: GameConfig;
}

export function startSession({ seed, human, cpuLevel, startedAt, config = DEFAULT_CONFIG }: NewSessionOptions): Session {
  const cpuPlayer = { kind: 'cpu', level: cpuLevel } as const;
  const humanPlayer = { kind: 'human' } as const;
  return {
    state: createGame(seed, config),
    log: createGameLog({
      seed,
      config,
      startedAt,
      players: human === 0 ? [humanPlayer, cpuPlayer] : [cpuPlayer, humanPlayer],
    }),
    human,
    cpuLevel,
  };
}

/** 人間に見える情報 */
export function humanView(session: Session): PlayerView {
  return getPlayerView(session.state, session.human);
}

/** 次が CPU の手番か（終了後は false） */
export function isCpuTurn(session: Session): boolean {
  return session.state.phase !== 'finished' && nextActor(session.state) !== session.human;
}

/** 人間の行動を適用する。不正な行動ならエラーの理由を返す */
export function humanAct(
  session: Session,
  action: Action,
  atMs: number,
): { readonly ok: true; readonly session: Session } | { readonly ok: false; readonly error: string } {
  if (action.player !== session.human) return { ok: false, error: '相手の行動は選べません' };
  const r = applyAction(session.state, action);
  if (!r.ok) return r;
  return { ok: true, session: { ...session, state: r.state, log: appendToLog(session.log, action, atMs, r.state) } };
}

/** CPU の手番を1手進める */
export function stepSessionCpu(session: Session, cpu: Cpu, atMs: number): { session: Session; action: Action } {
  if (!isCpuTurn(session)) throw new Error('CPU の手番ではありません');
  const { state, action } = stepCpu(session.state, cpu);
  return { session: { ...session, state, log: appendToLog(session.log, action, atMs, state) }, action };
}
