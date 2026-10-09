import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RULES_VERSION } from '@ritual/engine';
import type { CpuLevel } from '@ritual/engine';
import { Button, Dialog } from '../components/Dialog';
import { TutorialDialog } from '../components/TutorialDialog';
import type { SavedSessionSummary } from '../savedSession';

const LEVELS: readonly { level: CpuLevel; label: string; note: string }[] = [
  { level: 'easy', label: 'やさしい', note: '看破に慎重で、ときどき適当に動く' },
  { level: 'normal', label: 'ふつう', note: '標準の強さ' },
  { level: 'hard', label: 'つよい', note: '偽装を使い、積極的に看破する' },
];

interface Props {
  readonly showTutorialOnMount: boolean;
  readonly onTutorialShown: () => void;
  readonly savedSession: SavedSessionSummary | null;
  readonly onContinue: () => void;
  readonly onStart: (level: CpuLevel) => void;
}

export function TitleScreen({ showTutorialOnMount, onTutorialShown, savedSession, onContinue, onStart }: Props) {
  const [level, setLevel] = useState<CpuLevel>('normal');
  const [tutorialOpen, setTutorialOpen] = useState(showTutorialOnMount);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const closeTutorial = () => {
    setTutorialOpen(false);
    onTutorialShown();
  };

  const start = () => {
    closeTutorial();
    if (savedSession) setReplaceOpen(true);
    else onStart(level);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>魔法使いの儀式カードゲーム</Text>
      <Text style={styles.sub}>オフライン対戦版（ルール {RULES_VERSION}）</Text>
      {savedSession && (
        <View style={styles.resume}>
          <Text style={styles.resumeTitle}>中断中の対局</Text>
          <Text style={styles.resumeText}>
            ターン {savedSession.turnNumber}：あなた {savedSession.humanProgress} / 相手 {savedSession.opponentProgress}
          </Text>
          <Text style={styles.resumeText}>
            儀式：{savedSession.ritualName ?? '選択前'} ／ CPU {LEVEL_LABELS[savedSession.cpuLevel]}
          </Text>
          <Text style={styles.resumeDate}>保存：{formatSavedAt(savedSession.savedAt)}</Text>
          <Button label="続きから" primary onPress={onContinue} />
        </View>
      )}
      <Text style={styles.heading}>CPUの強さ</Text>
      <View style={styles.levels}>
        {LEVELS.map((l) => (
          <Pressable key={l.level} onPress={() => setLevel(l.level)} style={[styles.level, level === l.level && styles.selected]}>
            <Text style={styles.levelLabel}>{l.label}</Text>
            <Text style={styles.note}>{l.note}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.buttons}>
        <Button label="遊び方" onPress={() => setTutorialOpen(true)} />
        <Button label="対戦を始める" primary onPress={start} />
      </View>
      <Text style={styles.hint}>先攻・後攻はランダムに決まります。対戦の記録は終了後に書き出せます。</Text>
      <TutorialDialog visible={tutorialOpen} onClose={closeTutorial} onStart={start} />
      <Dialog visible={replaceOpen} title="新しい対局を始めますか？" buttons={[
        { label: '戻る', onPress: () => setReplaceOpen(false) },
        { label: '新しく始める', primary: true, onPress: () => onStart(level) },
      ]}>
        <Text>中断中の対局は削除されます。</Text>
      </Dialog>
    </View>
  );
}

const LEVEL_LABELS: Record<CpuLevel, string> = { easy: 'やさしい', normal: 'ふつう', hard: 'つよい' };

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return savedAt;
  return date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  sub: { textAlign: 'center', color: '#666', marginBottom: 16 },
  heading: { fontWeight: 'bold', fontSize: 16 },
  resume: { borderWidth: 1, borderColor: '#cfc8f2', borderRadius: 8, padding: 12, gap: 5, backgroundColor: '#fff' },
  resumeTitle: { fontWeight: 'bold', fontSize: 15 },
  resumeText: { color: '#333', fontSize: 13 },
  resumeDate: { color: '#666', fontSize: 12, marginBottom: 4 },
  levels: { gap: 8, marginBottom: 8 },
  level: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  selected: { borderColor: '#4a3aa8', borderWidth: 2, backgroundColor: '#efedfb' },
  levelLabel: { fontWeight: 'bold', fontSize: 15 },
  note: { color: '#555', fontSize: 13 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  hint: { color: '#666', fontSize: 12, textAlign: 'center' },
});
