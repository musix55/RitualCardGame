// 儀式の一覧（儀式の選択・看破の宣言・早見表に使う）

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RITUAL_DEFS, ritualDescription } from '@ritual/engine';
import type { RitualId, RitualRules } from '@ritual/engine';

export const RITUAL_CATEGORY_NAMES = { element: '属性系', action: '行動系', opponent: '相手依存系' } as const;

interface Props {
  readonly rituals: readonly RitualId[];
  readonly rules: RitualRules;
  readonly selected?: RitualId | null;
  /** 省略すると選べない一覧（早見表）になる */
  readonly onSelect?: (ritual: RitualId) => void;
  /** 薄く表示する儀式と、その注記（透視で除外、推理で矛盾など） */
  readonly marks?: ReadonlyMap<RitualId, string>;
}

export function RitualList({ rituals, rules, selected = null, onSelect, marks }: Props) {
  return (
    <View style={styles.list}>
      {rituals.map((r) => {
        const mark = marks?.get(r);
        return (
          <Pressable
            key={r}
            onPress={onSelect ? () => onSelect(r) : undefined}
            disabled={!onSelect}
            style={[styles.item, selected === r && styles.selected, mark !== undefined && styles.marked]}
          >
            <View style={styles.head}>
              <Text style={styles.name}>{RITUAL_DEFS[r].name}</Text>
              <Text style={styles.category}>{RITUAL_CATEGORY_NAMES[RITUAL_DEFS[r].category]}</Text>
              {mark !== undefined && <Text style={styles.mark}>{mark}</Text>}
            </View>
            <Text style={styles.description}>{ritualDescription(r, rules)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  item: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  selected: { borderColor: '#4a3aa8', borderWidth: 2, backgroundColor: '#efedfb' },
  marked: { opacity: 0.45 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontWeight: 'bold', fontSize: 15 },
  category: { fontSize: 11, color: '#666' },
  mark: { fontSize: 11, color: '#a33', fontWeight: 'bold' },
  description: { fontSize: 13, color: '#333', marginTop: 2 },
});
