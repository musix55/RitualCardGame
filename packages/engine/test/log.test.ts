import { describe, expect, it } from 'vitest';
import { createCpu } from '../src/cpu/cpu';
import { appendToLog, createGameLog, replayLog } from '../src/log';
import type { GameLog } from '../src/log';
import { playMatch } from '../src/match';
import { DEFAULT_CONFIG, RULES_VERSION } from '../src/types';
import type { GameState } from '../src/types';

/** CPU 同士の1局を記録しながら進め、記録と最後の状態を返す */
function recordedMatch(seed: number): { log: GameLog; final: GameState } {
  let log = createGameLog({
    seed,
    config: DEFAULT_CONFIG,
    players: [{ kind: 'cpu', level: 'normal' }, { kind: 'human' }],
    startedAt: '2026-10-06T00:00:00.000Z',
  });
  let atMs = 0;
  const final = playMatch({
    seed,
    cpus: [createCpu('normal', 1), createCpu('hard', 2)],
    onStep: (state, action) => {
      atMs += 1000;
      log = appendToLog(log, action, atMs, state);
    },
  });
  return { log, final };
}

describe('対局の記録', () => {
  it('記録を再生すると、最後の状態がそのまま再現される', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { log, final } = recordedMatch(seed);
      expect(log.result).toEqual(final.result);
      expect(replayLog(log)).toEqual(final);
    }
  });

  it('JSON に変換して読み戻しても再生できる', () => {
    const { log, final } = recordedMatch(1);
    const restored = JSON.parse(JSON.stringify(log)) as GameLog;
    expect(replayLog(restored)).toEqual(final);
  });

  it('途中の手数まで再生できる', () => {
    const { log } = recordedMatch(2);
    expect(replayLog(log, 0).phase).toBe('ritualSelection');
    expect(replayLog(log, 2).phase).toBe('playing');
  });

  it('ルールの版と形式の版が残る', () => {
    const { log } = recordedMatch(3);
    expect(log.rulesVersion).toBe(RULES_VERSION);
    expect(log.formatVersion).toBe(1);
    expect(log.actions.at(-1)!.atMs).toBe(log.actions.length * 1000);
  });

  it('再生できない記録はエラーになる', () => {
    const { log } = recordedMatch(4);
    const broken: GameLog = { ...log, seed: log.seed + 1 };
    expect(() => replayLog(broken)).toThrow(/再生できません/);
  });
});
