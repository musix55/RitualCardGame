import { beforeEach, describe, expect, it, vi } from 'vitest';
import { humanAct, RITUAL_IDS, startSession } from '@ritual/engine';
import { clearSavedSession, loadSavedSession, saveSession, savedSessionSummary } from '../src/savedSession';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), raw: null as string | null,
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

beforeEach(() => {
  vi.resetAllMocks();
  storage.raw = null;
  storage.getItem.mockImplementation(async () => storage.raw);
  storage.setItem.mockImplementation(async (_key, raw) => { storage.raw = raw; });
  storage.removeItem.mockImplementation(async () => { storage.raw = null; });
});

const initial = () => startSession({ seed: 7, human: 0, cpuLevel: 'easy', startedAt: '2026-10-09T00:00:00.000Z' });

describe('中断した対局の端末内保存', () => {
  it('儀式選択中と選択後の状態、CPU乱数、推理メモを復元する', async () => {
    const notes = { deductionAuto: false, ritualMarks: [[RITUAL_IDS[0]!, 'suspect']] as const };
    let session = initial();
    await saveSession(session, 123, notes);
    expect(await loadSavedSession()).toMatchObject({ session, cpuRngState: 123, notes });
    const next = humanAct(session, { type: 'selectRitual', player: 0, ritual: session.state.players[0].ritualCandidates[0]! }, 100);
    if (!next.ok) throw new Error(next.error);
    session = next.session;
    await saveSession(session, 456, notes);
    const saved = (await loadSavedSession())!;
    expect(saved).toMatchObject({ session, cpuRngState: 456, notes });
    expect(savedSessionSummary(saved).ritualName).not.toBeNull();
  });

  it('連続保存・削除・読み込みを呼び出した順に処理する', async () => {
    let release!: () => void;
    storage.setItem.mockImplementationOnce(async (_key, raw) => {
      await new Promise<void>((resolve) => { release = resolve; });
      storage.raw = raw;
    });
    const first = saveSession(initial(), 1);
    await Promise.resolve();
    const deletion = clearSavedSession();
    const second = saveSession(initial(), 2);
    const read = loadSavedSession();
    release();
    await Promise.all([first, deletion, second]);
    expect((await read)?.cpuRngState).toBe(2);
  });

  it('壊れた保存データと異なるルール版の保存を削除する', async () => {
    for (const raw of ['{', JSON.stringify({ version: 99 }), 'null']) {
      storage.raw = raw;
      expect(await loadSavedSession()).toBeNull();
      expect(storage.raw).toBeNull();
    }
    await saveSession(initial(), 1);
    const data = JSON.parse(storage.raw!);
    data.log.rulesVersion = 'old';
    storage.raw = JSON.stringify(data);
    expect(await loadSavedSession()).toBeNull();
  });

  it('保存失敗を呼び出し元に伝え、その後の保存は継続できる', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('storage full'));
    await expect(saveSession(initial(), 1)).rejects.toThrow('storage full');
    await saveSession(initial(), 2);
    expect((await loadSavedSession())?.cpuRngState).toBe(2);
  });

  it('終了時は中断データを削除する', async () => {
    const session = initial();
    await saveSession(session, 1);
    await saveSession({ ...session, state: { ...session.state, phase: 'finished' } }, 1);
    expect(await loadSavedSession()).toBeNull();
  });
});
