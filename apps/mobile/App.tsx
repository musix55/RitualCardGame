import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import type { CpuLevel } from '@ritual/engine';
import type { Session } from '@ritual/engine';
import { GameScreen } from './src/screens/GameScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import {
  clearSavedSession,
  loadSavedSession,
  saveSession,
  savedSessionSummary,
} from './src/savedSession';
import type { GameNotes, SavedSession } from './src/savedSession';

export default function App() {
  const [level, setLevel] = useState<CpuLevel | null>(null);
  const [initialSession, setInitialSession] = useState<Session | null>(null);
  const [initialCpuRngState, setInitialCpuRngState] = useState<number | null>(null);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [loadingSave, setLoadingSave] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  /** 「もう一度」で対戦画面を作り直し、新しい対局にするための番号 */
  const [gameNo, setGameNo] = useState(0);
  const [tutorialShown, setTutorialShown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSavedSession()
      .then((saved) => {
        if (!cancelled) setSavedSession(saved);
      })
      .catch(() => {
        if (!cancelled) setStorageError('保存された対局を読み込めませんでした。');
      })
      .finally(() => {
        if (!cancelled) setLoadingSave(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startNewGame = useCallback((nextLevel: CpuLevel) => {
    void clearSavedSession().catch(() => setStorageError('保存データを削除できませんでした。'));
    setSavedSession(null);
    setInitialSession(null);
    setInitialCpuRngState(null);
    setLevel(nextLevel);
    setGameNo((n) => n + 1);
  }, []);

  const continueGame = useCallback(() => {
    if (!savedSession) return;
    setInitialSession(savedSession.session);
    setInitialCpuRngState(savedSession.cpuRngState);
    setLevel(savedSession.session.cpuLevel);
    setGameNo((n) => n + 1);
  }, [savedSession]);

  const handleSessionChange = useCallback((session: Session, cpuRngState: number, notes: GameNotes) => {
    void saveSession(session, cpuRngState, notes)
      .then(() => setStorageError(null))
      .catch(() => setStorageError('対局を保存できませんでした。端末の空き容量を確認してください。'));
    if (session.state.phase === 'finished') setSavedSession(null);
  }, []);

  const exitToTitle = useCallback(() => {
    setLoadingSave(true);
    setLevel(null);
    setInitialSession(null);
    setInitialCpuRngState(null);
    void loadSavedSession().then(setSavedSession)
      .catch(() => setStorageError('保存された対局を読み込めませんでした。'))
      .finally(() => setLoadingSave(false));
  }, []);

  const restartGame = useCallback(() => {
    void clearSavedSession().catch(() => setStorageError('保存データを削除できませんでした。'));
    setSavedSession(null);
    setInitialSession(null);
    setInitialCpuRngState(null);
    setGameNo((n) => n + 1);
  }, []);

  return (
    <View style={styles.container}>
      {loadingSave ? (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>保存された対戦を確認しています…</Text>
        </View>
      ) : level === null ? (
        <TitleScreen
          showTutorialOnMount={!tutorialShown && !savedSession}
          onTutorialShown={() => setTutorialShown(true)}
          savedSession={savedSession ? savedSessionSummary(savedSession) : null}
          onContinue={continueGame}
          onStart={startNewGame}
        />
      ) : (
        <GameScreen
          key={gameNo}
          cpuLevel={level}
          initialSession={initialSession}
          initialCpuRngState={initialCpuRngState}
          initialNotes={initialSession ? savedSession?.notes : undefined}
          onSessionChange={handleSessionChange}
          onExit={exitToTitle}
          onRestart={restartGame}
        />
      )}
      {storageError && <Text style={styles.storageError}>{storageError}</Text>}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f5fb', paddingTop: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#555' },
  storageError: { color: '#a32626', padding: 12 },
});
