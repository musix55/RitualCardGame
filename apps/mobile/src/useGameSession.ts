// 人間と CPU の1局を React の状態として持つ。CPU の手番は少し間を置いて1手ずつ進める

import { useCallback, useEffect, useRef, useState } from 'react';
import { createCpu, getLegalActions, humanAct, humanView, isCpuTurn, startSession, stepSessionCpu } from '@ritual/engine';
import type { Action, CpuLevel, PlayerView, Session } from '@ritual/engine';

/** CPU が1手ごとに待つ時間。相手の動きを目で追えるようにする */
const CPU_DELAY_MS = 700;

export interface GameSession {
  readonly session: Session;
  readonly view: PlayerView;
  /** 人間が今行える行動（ボタンの有効・無効に使う） */
  readonly legal: readonly Action[];
  readonly cpuThinking: boolean;
  /** 直前の行動が不正だった場合の理由 */
  readonly error: string | null;
  act(action: Action): void;
  clearError(): void;
}

interface Options {
  readonly initialSession?: Session | null;
  readonly initialCpuRngState?: number | null;
  readonly onSessionChange?: (session: Session, cpuRngState: number) => void;
}

export function useGameSession(
  cpuLevel: CpuLevel,
  { initialSession = null, initialCpuRngState = null, onSessionChange }: Options = {},
): GameSession {
  const [session, setSession] = useState<Session>(() => {
    if (initialSession) return initialSession;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    // 先攻・後攻はランダム（仕様書 4章）
    const human = Math.random() < 0.5 ? 0 : 1;
    return startSession({ seed, human, cpuLevel, startedAt: new Date().toISOString() });
  });
  const [error, setError] = useState<string | null>(null);
  const lastLoggedAtMs = session.log.actions.at(-1)?.atMs ?? 0;
  const startMs = useRef(Date.now() - lastLoggedAtMs);
  const cpu = useRef(createCpu(cpuLevel, initialCpuRngState ?? session.log.seed + 1));

  useEffect(() => {
    onSessionChange?.(session, cpu.current.rngState());
  }, [onSessionChange, session]);

  const cpuThinking = isCpuTurn(session);
  useEffect(() => {
    if (!cpuThinking) return;
    const timer = setTimeout(() => {
      setSession((s) => (isCpuTurn(s) ? stepSessionCpu(s, cpu.current, Date.now() - startMs.current).session : s));
    }, CPU_DELAY_MS);
    return () => clearTimeout(timer);
  }, [session, cpuThinking]);

  const act = useCallback(
    (action: Action) => {
      const r = humanAct(session, action, Date.now() - startMs.current);
      if (r.ok) {
        setSession(r.session);
        setError(null);
      } else {
        setError(r.error);
      }
    },
    [session],
  );

  return {
    session,
    view: humanView(session),
    legal: getLegalActions(session.state, session.human),
    cpuThinking,
    error,
    act,
    clearError: () => setError(null),
  };
}
