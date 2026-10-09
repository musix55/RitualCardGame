import { describe, expect, it } from 'vitest';
import { createCpu } from '../src/cpu/cpu';
import { getLegalActions } from '../src/engine';
import { replayLog } from '../src/log';
import { humanAct, humanView, isCpuTurn, restoreSession, startSession, stepSessionCpu } from '../src/session';
import type { Session } from '../src/session';
import type { PlayerId } from '../src/types';

const STARTED_AT = '2026-10-06T00:00:00.000Z';

/** 人間の代わりに合法手の先頭を選び続けて、1局を最後まで進める */
function playOut(seed: number, human: PlayerId): Session {
  let session = startSession({ seed, human, cpuLevel: 'normal', startedAt: STARTED_AT });
  const cpu = createCpu('normal', seed);
  for (let atMs = 0; session.state.phase !== 'finished'; atMs += 500) {
    if (atMs > 1_000_000) throw new Error('終わりませんでした');
    if (isCpuTurn(session)) {
      session = stepSessionCpu(session, cpu, atMs).session;
    } else {
      const r = humanAct(session, getLegalActions(session.state, human)[0]!, atMs);
      if (!r.ok) throw new Error(r.error);
      session = r.session;
    }
  }
  return session;
}

describe('人間と CPU の1局', () => {
  for (const human of [0, 1] as const) {
    it(`人間が${human === 0 ? '先攻' : '後攻'}でも最後まで進み、記録から再現できる`, () => {
      for (let seed = 0; seed < 10; seed++) {
        const session = playOut(seed, human);
        expect(session.log.result).toEqual(session.state.result);
        expect(replayLog(session.log)).toEqual(session.state);
        expect(session.log.players[human]).toEqual({ kind: 'human' });
        expect(session.log.players[1 - human]).toEqual({ kind: 'cpu', level: 'normal' });
      }
    });
  }

  it('人間が CPU の行動を選ぶことはできない', () => {
    const session = startSession({ seed: 1, human: 1, cpuLevel: 'easy', startedAt: STARTED_AT });
    const cpuAction = getLegalActions(session.state, 0)[0]!;
    expect(humanAct(session, cpuAction, 0)).toEqual({ ok: false, error: '相手の行動は選べません' });
  });

  it('人間の手番に CPU を進めるとエラー', () => {
    const session = startSession({ seed: 1, human: 0, cpuLevel: 'easy', startedAt: STARTED_AT });
    expect(isCpuTurn(session)).toBe(false);
    expect(() => stepSessionCpu(session, createCpu('easy', 1), 0)).toThrow();
  });

  it('人間には自分の席から見た情報が渡る', () => {
    const session = startSession({ seed: 1, human: 1, cpuLevel: 'easy', startedAt: STARTED_AT });
    expect(humanView(session).me).toBe(1);
    expect(humanView(session).opponent.ritual).toBeNull();
  });

  it('対局記録からセッションを復元できる', () => {
    const session = playOut(3, 0);
    const restored = restoreSession(session.log, session.human, session.cpuLevel);
    expect(restored).toEqual(session);
  });

  it('途中で毎手復元してもCPUの行動と最終結果が変わらない', () => {
    for (const cpuLevel of ['easy', 'normal', 'hard'] as const) {
      for (const human of [0, 1] as const) {
        let session = startSession({ seed: 7, human, cpuLevel, startedAt: STARTED_AT });
        const cpu = createCpu(cpuLevel, 8);
        for (let atMs = 0; session.state.phase !== 'finished'; atMs += 500) {
          if (atMs > 1_000_000) throw new Error('終わりませんでした');
          const restored = restoreSession(JSON.parse(JSON.stringify(session.log)), human, cpuLevel);
          expect(restored).toEqual(session);
          if (isCpuTurn(session)) {
            const restoredCpu = createCpu(cpuLevel, cpu.rngState());
            const next = stepSessionCpu(session, cpu, atMs);
            expect(stepSessionCpu(restored, restoredCpu, atMs)).toEqual(next);
            expect(restoredCpu.rngState()).toBe(cpu.rngState());
            session = next.session;
          } else {
            const action = getLegalActions(session.state, human)[0]!;
            const next = humanAct(session, action, atMs);
            expect(humanAct(restored, action, atMs)).toEqual(next);
            if (!next.ok) throw new Error(next.error);
            session = next.session;
          }
        }
      }
    }
  });
});
