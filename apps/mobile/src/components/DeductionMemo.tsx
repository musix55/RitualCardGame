// 推理メモ：相手の儀式の候補を一覧にし、行動と矛盾した儀式を自動で外す。自分の印も付けられる

import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { RITUAL_DEFS, RITUAL_IDS, ritualDescription } from '@ritual/engine';
import type { RitualId, RitualStatus, RitualRules } from '@ritual/engine';
import { contradictionLabel } from '../labels';

/** プレイヤーが自分で付ける印 */
export type RitualMark = 'suspect' | 'unlikely';

const MARK_LABELS: Record<RitualMark, string> = { suspect: '怪しい', unlikely: '違いそう' };
const NEXT_MARK = { none: 'suspect', suspect: 'unlikely', unlikely: 'none' } as const;

/** 自動の絞り込みを切っているときは、矛盾も「候補」として扱う（透視・公開は公式の情報なので残す） */
export function effectiveStatus(status: RitualStatus, auto: boolean): RitualStatus {
  return !auto && status.type === 'contradiction' ? { type: 'possible' } : status;
}

/** 候補から外れている儀式と、その短い注記（看破の宣言画面で使う） */
export function excludedMarks(statuses: ReadonlyMap<RitualId, RitualStatus>, auto: boolean): Map<RitualId, string> {
  const marks = new Map<RitualId, string>();
  for (const [r, s] of statuses) {
    const st = effectiveStatus(s, auto);
    if (st.type === 'clairvoyance') marks.set(r, '透視で除外');
    if (st.type === 'contradiction') marks.set(r, '推理で除外');
  }
  return marks;
}

interface Props {
  readonly statuses: ReadonlyMap<RitualId, RitualStatus>;
  readonly rules: RitualRules;
  readonly auto: boolean;
  readonly onAutoChange: (auto: boolean) => void;
  readonly marks: ReadonlyMap<RitualId, RitualMark>;
  readonly onMarksChange: (marks: Map<RitualId, RitualMark>) => void;
}

export function DeductionMemo({ statuses, rules, auto, onAutoChange, marks, onMarksChange }: Props) {
  const remaining = RITUAL_IDS.filter((r) => {
    const st = effectiveStatus(statuses.get(r)!, auto);
    return st.type === 'possible' || st.type === 'revealed';
  }).length;

  const cycleMark = (r: RitualId) => {
    const next = NEXT_MARK[marks.get(r) ?? 'none'];
    const updated = new Map(marks);
    if (next === 'none') updated.delete(r);
    else updated.set(r, next);
    onMarksChange(updated);
  };

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>推理メモ（残り候補 {remaining} / {RITUAL_IDS.length}）</Text>
        <View style={styles.switchRow}>
          <Text style={styles.small}>自動で絞り込む</Text>
          <Switch value={auto} onValueChange={onAutoChange} />
        </View>
      </View>
      <Text style={styles.small}>
        {auto
          ? '相手の行動と進行度の上がり方から、ありえない儀式を自動で外します。右の印は自由に付けられます。'
          : '自動の絞り込みは切っています。透視で分かった儀式だけを外します。'}
      </Text>
      {RITUAL_IDS.map((r) => {
        const st = effectiveStatus(statuses.get(r)!, auto);
        const out = st.type !== 'possible' && st.type !== 'revealed';
        const mark = marks.get(r);
        return (
          <View key={r} style={[styles.row, out && styles.out, st.type === 'revealed' && styles.revealed]}>
            <View style={styles.main}>
              <Text style={styles.name}>
                {RITUAL_DEFS[r].name}
                <Text style={styles.status}>　{STATUS_LABELS[st.type]}</Text>
              </Text>
              <Text style={styles.small}>{ritualDescription(r, rules)}</Text>
              {st.type === 'contradiction' && <Text style={styles.reason}>{contradictionLabel(st.turn)}</Text>}
            </View>
            {!out && st.type !== 'revealed' && (
              <Pressable onPress={() => cycleMark(r)} style={[styles.mark, mark && styles[mark]]}>
                <Text style={styles.markText}>{mark ? MARK_LABELS[mark] : '印'}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const STATUS_LABELS: Record<RitualStatus['type'], string> = {
  possible: '',
  revealed: '公開済み（相手の儀式）',
  otherRevealed: '',
  clairvoyance: '透視で除外',
  contradiction: '推理で除外',
};

const styles = StyleSheet.create({
  box: { backgroundColor: '#fff', borderRadius: 10, padding: 10, gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  title: { fontWeight: 'bold', fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontSize: 12, color: '#555' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 6 },
  out: { opacity: 0.4 },
  revealed: { backgroundColor: '#efedfb' },
  main: { flex: 1 },
  name: { fontWeight: 'bold', fontSize: 14 },
  status: { fontSize: 11, color: '#a33', fontWeight: 'bold' },
  reason: { fontSize: 11, color: '#a33' },
  mark: { borderWidth: 1, borderColor: '#aaa', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, minWidth: 64, alignItems: 'center' },
  suspect: { backgroundColor: '#ffe3b3', borderColor: '#e0a030' },
  unlikely: { backgroundColor: '#e4e4e4', borderColor: '#999' },
  markText: { fontSize: 12 },
});
