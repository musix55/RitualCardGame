import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CARD_DEFS, ELEMENT_NAMES } from '@ritual/engine';
import type { VisibleCard } from '@ritual/engine';
import { CATEGORY_NAMES, ELEMENT_COLORS, HIDDEN_COLOR } from '../labels';

interface Props {
  readonly card: VisibleCard;
  /** 小さく表示する（行動ログ・場のカード） */
  readonly compact?: boolean;
  readonly selected?: boolean;
  readonly onPress?: () => void;
}

export function CardTile({ card, compact = false, selected = false, onPress }: Props) {
  const def = CARD_DEFS[card.kind];
  const color = card.element === null ? HIDDEN_COLOR : ELEMENT_COLORS[card.element];
  const elementName = card.element === null ? '？' : ELEMENT_NAMES[card.element];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.card, compact ? styles.compact : styles.full, { borderColor: color }, selected && styles.selected]}
    >
      <View style={[styles.band, { backgroundColor: color }]}>
        <Text style={styles.element}>{elementName}</Text>
        <Text style={styles.category}>{CATEGORY_NAMES[def.category]}</Text>
      </View>
      <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
        {def.name}
      </Text>
      {!compact && <Text style={styles.description}>{def.description}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  full: { width: 104, minHeight: 132 },
  compact: { width: 72 },
  selected: { transform: [{ translateY: -8 }], borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6 },
  band: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 2 },
  element: { color: '#fff', fontWeight: 'bold' },
  category: { color: '#fff', fontSize: 11 },
  name: { fontWeight: 'bold', fontSize: 14, paddingHorizontal: 6, paddingTop: 6 },
  nameCompact: { fontSize: 12, paddingTop: 2, paddingBottom: 4 },
  description: { fontSize: 11, color: '#444', paddingHorizontal: 6, paddingTop: 4, paddingBottom: 6 },
});
