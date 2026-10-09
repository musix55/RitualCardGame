// オフライン対戦版の遊び方。初見でもCPU戦に入れるよう、最小限の流れだけをまとめる

import { StyleSheet, Text, View } from 'react-native';
import { Button, Dialog } from './Dialog';

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onStart?: () => void;
}

export function TutorialDialog({ visible, onClose, onStart }: Props) {
  const buttons =
    onStart === undefined
      ? [{ label: '閉じる', primary: true, onPress: onClose }]
      : [
          { label: '閉じる', onPress: onClose },
          { label: '対戦を始める', primary: true, onPress: onStart },
        ];

  return (
    <Dialog visible={visible} title="遊び方" buttons={buttons}>
      <View style={styles.section}>
        <Text style={styles.heading}>目的</Text>
        <Text style={styles.text}>自分だけが知る儀式を進め、進行度を4まで上げると勝ちです。</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>ターン</Text>
        <Text style={styles.text}>手札からカードを最大2枚まで使い、条件を満たしたらターン終了時に進行度が1上がります。</Text>
        <Text style={styles.note}>先攻の最初のターンだけ、使えるカードは1枚です。</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>推理</Text>
        <Text style={styles.text}>相手の進行度が上がったターンと上がらなかったターンを見て、相手の儀式を絞ります。</Text>
        <Text style={styles.note}>対戦画面の推理メモが、ありえない儀式を自動で薄くします。</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>看破</Text>
        <Text style={styles.text}>相手の儀式を当てると、相手の進行度を2下げて儀式を公開できます。</Text>
        <Text style={styles.note}>外すと自分の進行度が1下がります。1ゲームに1回だけ使えます。</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>覚えておくこと</Text>
        <Text style={styles.text}>儀式一覧、カード効果、ログ上のカード詳細は対戦中にいつでも確認できます。</Text>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  section: { gap: 3, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  heading: { fontWeight: 'bold', fontSize: 15 },
  text: { fontSize: 13, color: '#333', lineHeight: 19 },
  note: { fontSize: 12, color: '#666', lineHeight: 17 },
});
