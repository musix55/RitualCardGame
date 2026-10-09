// 中断と再開のため、未終了のCPU対戦を端末内に保存する

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOG_FORMAT_VERSION, RULES_VERSION, RITUAL_DEFS, RITUAL_IDS, restoreSession } from '@ritual/engine';
import type { CpuLevel, GameLog, PlayerId, RitualId, Session } from '@ritual/engine';

const STORAGE_KEY = 'ritual-card-game.current-session.v1';
const SAVE_VERSION = 1;

export interface GameNotes {
  readonly deductionAuto: boolean;
  readonly ritualMarks: readonly (readonly [RitualId, 'suspect' | 'unlikely'])[];
}

export const DEFAULT_GAME_NOTES: GameNotes = { deductionAuto: true, ritualMarks: [] };

// Keep writes, deletions, and reads in order, including when a new game starts.
let storageQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation);
  storageQueue = result.catch(() => undefined);
  return result;
}

interface SavedSessionData {
  readonly version: typeof SAVE_VERSION;
  readonly savedAt: string;
  readonly human: PlayerId;
  readonly cpuLevel: CpuLevel;
  readonly cpuRngState: number;
  readonly log: GameLog;
  readonly notes?: GameNotes;
}

export interface SavedSession {
  readonly session: Session;
  readonly savedAt: string;
  readonly cpuRngState: number;
  readonly notes: GameNotes;
}

export interface SavedSessionSummary {
  readonly savedAt: string;
  readonly cpuLevel: CpuLevel;
  readonly turnNumber: number;
  readonly humanProgress: number;
  readonly opponentProgress: number;
  readonly ritualName: string | null;
}

export function loadSavedSession(): Promise<SavedSession | null> {
  return enqueue(readSavedSession);
}

async function readSavedSession(): Promise<SavedSession | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as SavedSessionData;
    if (data.version !== SAVE_VERSION || data.log.formatVersion !== LOG_FORMAT_VERSION ||
        data.log.rulesVersion !== RULES_VERSION ||
        (data.human !== 0 && data.human !== 1) ||
        !['easy', 'normal', 'hard'].includes(data.cpuLevel) ||
        !Number.isFinite(data.cpuRngState) ||
        !Number.isFinite(Date.parse(data.savedAt))) {
      throw new Error('Invalid saved session');
    }
    const session = restoreSession(data.log, data.human, data.cpuLevel);
    if (session.state.phase === 'finished') {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const notes = data.notes ?? DEFAULT_GAME_NOTES;
    if (typeof notes.deductionAuto !== 'boolean' || !Array.isArray(notes.ritualMarks) ||
        !notes.ritualMarks.every((entry) => Array.isArray(entry) && entry.length === 2 &&
          RITUAL_IDS.includes(entry[0]) && ['suspect', 'unlikely'].includes(entry[1]))) {
      throw new Error('Invalid saved notes');
    }
    return { session, savedAt: data.savedAt, cpuRngState: data.cpuRngState, notes };
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: Session, cpuRngState: number, notes = DEFAULT_GAME_NOTES): Promise<void> {
  if (session.state.phase === 'finished') {
    return clearSavedSession();
  }

  const data: SavedSessionData = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    human: session.human,
    cpuLevel: session.cpuLevel,
    cpuRngState,
    log: session.log,
    notes,
  };
  const raw = JSON.stringify(data);
  return enqueue(() => AsyncStorage.setItem(STORAGE_KEY, raw));
}

export function clearSavedSession(): Promise<void> {
  return enqueue(() => AsyncStorage.removeItem(STORAGE_KEY));
}

export function savedSessionSummary(saved: SavedSession): SavedSessionSummary {
  const human = saved.session.state.players[saved.session.human];
  const opponent = saved.session.state.players[saved.session.human === 0 ? 1 : 0];
  return {
    savedAt: saved.savedAt,
    cpuLevel: saved.session.cpuLevel,
    turnNumber: saved.session.state.turnNumber,
    humanProgress: human.progress,
    opponentProgress: opponent.progress,
    ritualName: ritualName(human.ritual),
  };
}

function ritualName(ritual: RitualId | null): string | null {
  return ritual ? RITUAL_DEFS[ritual].name : null;
}
