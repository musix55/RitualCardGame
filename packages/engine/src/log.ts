// =============================================================
// 対局の記録（テストプレイの分析用）
//
// 対局はシードと行動の並びから完全に再現できるため、記録には
// 最初の設定と行動だけを残す。途中の状態は replayLog で作り直す。
// =============================================================

import { applyAction } from './engine';
import { createGame } from './setup';
import { RULES_VERSION } from './types';
import type { Action, GameConfig, GameResult, GameState } from './types';
import type { CpuLevel } from './cpu/cpu';

/** 記録の形式の版。形式を変えたら上げる */
export const LOG_FORMAT_VERSION = 1;

export type LogPlayer = { readonly kind: 'human' } | { readonly kind: 'cpu'; readonly level: CpuLevel };

export interface LoggedAction {
  readonly action: Action;
  /** 対局の開始からの経過ミリ秒（考える時間やゲーム時間の分析用） */
  readonly atMs: number;
}

export interface GameLog {
  readonly formatVersion: number;
  /** 対局したときのルールの版（仕様書の版） */
  readonly rulesVersion: string;
  /** 対局の開始日時（ISO 8601） */
  readonly startedAt: string;
  readonly seed: number;
  readonly config: GameConfig;
  /** 先攻・後攻が人間か CPU か */
  readonly players: readonly [LogPlayer, LogPlayer];
  readonly actions: readonly LoggedAction[];
  readonly result: GameResult | null;
}

export interface NewLogOptions {
  readonly seed: number;
  readonly config: GameConfig;
  readonly players: readonly [LogPlayer, LogPlayer];
  readonly startedAt: string;
  readonly rulesVersion?: string;
}

export function createGameLog({ seed, config, players, startedAt, rulesVersion = RULES_VERSION }: NewLogOptions): GameLog {
  return { formatVersion: LOG_FORMAT_VERSION, rulesVersion, startedAt, seed, config, players, actions: [], result: null };
}

/** 行動を1つ追加した記録を返す。state は行動を適用した後の状態（終了していれば結果を残す） */
export function appendToLog(log: GameLog, action: Action, atMs: number, state: GameState): GameLog {
  return { ...log, actions: [...log.actions, { action, atMs }], result: state.result };
}

/**
 * 記録を最初から再生し、upTo 手目まで適用した状態を返す（省略時は最後まで）。
 * 記録と再生結果が食い違う場合（ルールの変更後に古い記録を読んだ場合など）はエラー。
 */
export function replayLog(log: GameLog, upTo = log.actions.length): GameState {
  let s = createGame(log.seed, log.config);
  log.actions.slice(0, upTo).forEach(({ action }, i) => {
    const r = applyAction(s, action);
    if (!r.ok) throw new Error(`記録の ${i + 1} 手目を再生できません: ${r.error}`);
    s = r.state;
  });
  return s;
}
