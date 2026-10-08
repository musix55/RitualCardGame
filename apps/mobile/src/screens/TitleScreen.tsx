import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RULES_VERSION } from '@ritual/engine';
import type { CpuLevel } from '@ritual/engine';
import { Button } from '../components/Dialog';

const LEVELS: readonly { level: CpuLevel; label: string; note: string }[] = [
  { level: 'easy', label: 'やさしい', note: '看破に慎重で、ときどき適当に動く' },
  { level: 'normal', label: 'ふつう', note: '標準の強さ' },
  { level: 'hard', label: 'つよい', note: '偽装を使い、積極的に看破する' },
];

export function TitleScreen({ onStart }: { readonly onStart: (level: CpuLevel) => void }) {
  const [level, setLevel] = useState<CpuLevel>('normal');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>魔法使いの儀式カードゲーム</Text>
      <Text style={styles.sub}>試作版（ルール {RULES_VERSION}）</Text>
      <Text style={styles.heading}>CPUの強さ</Text>
      <View style={styles.levels}>
        {LEVELS.map((l) => (
          <Pressable key={l.level} onPress={() => setLevel(l.level)} style={[styles.level, level === l.level && styles.selected]}>
            <Text style={styles.levelLabel}>{l.label}</Text>
            <Text style={styles.note}>{l.note}</Text>
          </Pressable>
        ))}
      </View>
      <Button label="対戦を始める" primary onPress={() => onStart(level)} />
      <Text style={styles.hint}>先攻・後攻はランダムに決まります。対局の記録は終了後に書き出せます。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  sub: { textAlign: 'center', color: '#666', marginBottom: 16 },
  heading: { fontWeight: 'bold', fontSize: 16 },
  levels: { gap: 8, marginBottom: 8 },
  level: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  selected: { borderColor: '#4a3aa8', borderWidth: 2, backgroundColor: '#efedfb' },
  levelLabel: { fontWeight: 'bold', fontSize: 15 },
  note: { color: '#555', fontSize: 13 },
  hint: { color: '#666', fontSize: 12, textAlign: 'center' },
});
