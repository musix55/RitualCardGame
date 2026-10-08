import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import type { CpuLevel } from '@ritual/engine';
import { GameScreen } from './src/screens/GameScreen';
import { TitleScreen } from './src/screens/TitleScreen';

export default function App() {
  const [level, setLevel] = useState<CpuLevel | null>(null);
  /** 「もう一度」で対戦画面を作り直し、新しい対局にするための番号 */
  const [gameNo, setGameNo] = useState(0);

  return (
    <View style={styles.container}>
      {level === null ? (
        <TitleScreen onStart={setLevel} />
      ) : (
        <GameScreen key={gameNo} cpuLevel={level} onExit={() => setLevel(null)} onRestart={() => setGameNo((n) => n + 1)} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f5fb', paddingTop: 32 },
});
