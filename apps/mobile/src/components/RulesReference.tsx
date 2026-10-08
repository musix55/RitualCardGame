// ルール早見表：儀式とカードの一覧を対戦中にいつでも確認できる

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CARD_DEFS, RITUAL_IDS } from '@ritual/engine';
import type { CardKind, GameConfig } from '@ritual/engine';
import { CATEGORY_NAMES } from '../labels';
import { Button, Dialog } from './Dialog';
import { RitualList } from './RitualList';

const CARD_KINDS = Object.keys(CARD_DEFS) as CardKind[];

interface Props {
  readonly visible: boolean;
  readonly config: GameConfig;
  readonly onClose: () => void;
}

export function RulesReference({ visible, config, onClose }: Props) {
  const [tab, setTab] = useState<'rituals' | 'cards' | 'rules'>('rituals');
  return (
    <Dialog visible={visible} title="ルール早見表" buttons={[{ label: '閉じる', primary: true, onPress: onClose }]}>
      <View style={styles.tabs}>
        <Button label="儀式" primary={tab === 'rituals'} onPress={() => setTab('rituals')} />
        <Button label="カード" primary={tab === 'cards'} onPress={() => setTab('cards')} />
        <Button label="基本ルール" primary={tab === 'rules'} onPress={() => setTab('rules')} />
      </View>

      {tab === 'rituals' && <RitualList rituals={RITUAL_IDS} rules={config.ritualRules} />}

      {tab === 'cards' &&
        CARD_KINDS.map((k) => (
          <View key={k} style={styles.item}>
            <Text style={styles.name}>
              {CARD_DEFS[k].name}
              <Text style={styles.category}>　{CATEGORY_NAMES[CARD_DEFS[k].category]}</Text>
            </Text>
            <Text style={styles.text}>{CARD_DEFS[k].description}</Text>
          </View>
        ))}

      {tab === 'rules' && (
        <View style={styles.rules}>
          {[
            `自分の秘密の儀式を、相手より先に進行度${config.goalProgress}まで進めると勝ち。`,
            `ターンの初めに手札が${config.handSize}枚になるまで引き、カードを${config.maxCardsPerTurn}枚まで使う（先攻の最初のターンは${config.firstTurnMaxCards}枚まで）。`,
            'ターンの終わりに、そのターンで儀式の条件を満たしていれば進行度+1。',
            '前のターンにカードを使わなかった場合、次のターンはカードを使うか看破をしなければならない。',
            `看破：カードを使う代わりに、相手の儀式を1つ宣言する（1ゲーム1回、自分の進行度${config.unveilMinProgress}以上）。当たれば相手の進行度-${config.unveilSuccessPenalty}、外れたら自分の進行度-${config.unveilFailPenalty}。`,
            '結界：伏せて置き、相手の妨害を1回防ぐ。相手には属性が見えない。',
            `山札が尽きたターン、または${config.maxTurns}ターン目が終わったら、進行度が高い方の勝ち。`,
          ].map((line) => (
            <Text key={line} style={styles.text}>
              ・{line}
            </Text>
          ))}
        </View>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  item: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8 },
  name: { fontWeight: 'bold', fontSize: 14 },
  category: { fontSize: 11, color: '#666', fontWeight: 'normal' },
  text: { fontSize: 13, color: '#333' },
  rules: { gap: 6 },
});
