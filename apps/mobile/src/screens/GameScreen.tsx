// 対戦画面（試作）。見た目は簡素にし、ルールどおりに遊べることを優先する

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CARD_DEFS, ELEMENT_NAMES, RITUAL_DEFS, RITUAL_IDS, ritualDescription } from '@ritual/engine';
import type { Card, CpuLevel, PendingChoice, PlayerView, RitualId, TurnRecordView } from '@ritual/engine';
import { CardTile } from '../components/CardTile';
import { Button, Dialog } from '../components/Dialog';
import { RitualList } from '../components/RitualList';
import { exportLog } from '../exportLog';
import { eventLabel, resultLabel, who } from '../labels';
import { useGameSession } from '../useGameSession';

interface Props {
  readonly cpuLevel: CpuLevel;
  readonly onExit: () => void;
  readonly onRestart: () => void;
}

export function GameScreen({ cpuLevel, onExit, onRestart }: Props) {
  const game = useGameSession(cpuLevel);
  const { view, legal, act, session } = game;
  const me = view.me;
  const myTurn = view.phase === 'playing' && view.currentPlayer === me && !game.cpuThinking;

  const [selected, setSelected] = useState<string | null>(null);
  /** 錬成を使うために、捨てるカードを選んでいる途中か（錬成のカードの id） */
  const [transmuteId, setTransmuteId] = useState<string | null>(null);
  const [unveilOpen, setUnveilOpen] = useState(false);
  const [unveilTarget, setUnveilTarget] = useState<RitualId | null>(null);
  const [unveilConfirm, setUnveilConfirm] = useState(false);
  const [candidate, setCandidate] = useState<RitualId | null>(null);

  const resetHand = () => {
    setSelected(null);
    setTransmuteId(null);
  };

  const onCardPress = (card: Card) => {
    game.clearError();
    if (transmuteId !== null) {
      if (card.id !== transmuteId) act({ type: 'playCard', player: me, cardId: transmuteId, discardCardId: card.id });
      resetHand();
      return;
    }
    setSelected(selected === card.id ? null : card.id);
  };

  const playSelected = () => {
    const card = view.self.hand.find((c) => c.id === selected);
    if (!card) return;
    const playable = legal.some((a) => a.type === 'playCard' && a.cardId === card.id);
    if (card.kind === 'transmute' && playable) {
      setTransmuteId(card.id);
      setSelected(null);
      return;
    }
    // 使えない場合も行動を送り、ルールエンジンが返す理由を表示する
    const other = view.self.hand.find((c) => c.id !== card.id);
    act(
      card.kind === 'transmute' && other
        ? { type: 'playCard', player: me, cardId: card.id, discardCardId: other.id }
        : { type: 'playCard', player: me, cardId: card.id },
    );
    resetHand();
  };

  const canUnveil = legal.some((a) => a.type === 'unveil');
  const selectedCard = view.self.hand.find((c) => c.id === selected) ?? null;
  const maxCards = view.turnNumber === 1 ? view.config.firstTurnMaxCards : view.config.maxCardsPerTurn;
  const cpuRitual = session.state.players[me === 0 ? 1 : 0].ritual;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 相手 */}
        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.panelTitle}>相手（CPU・{LEVEL_NAMES[cpuLevel]}）</Text>
            <Text style={styles.small}>{me === 0 ? '後攻' : '先攻'}</Text>
          </View>
          <Progress value={view.opponent.progress} goal={view.config.goalProgress} />
          <Text style={styles.small}>
            儀式：{view.opponent.ritual ? `${RITUAL_DEFS[view.opponent.ritual].name}（看破で公開）` : '？？？'}
          </Text>
          <Badges
            items={[
              `手札 ${view.opponent.handCount}枚`,
              view.opponent.hasBarrier && '結界あり',
              view.opponent.sealed && '封印中',
              view.opponent.unveilUsed && '看破使用済み',
            ]}
          />
        </View>

        {/* 状況 */}
        <View style={styles.status}>
          <Text style={styles.statusText}>
            ターン {view.turnNumber} / {view.config.maxTurns}　山札 {view.deckCount}枚
          </Text>
          <Text style={[styles.turnText, myTurn && styles.myTurnText]}>
            {view.phase === 'ritualSelection'
              ? '儀式の選択中'
              : view.phase === 'finished'
                ? '対戦終了'
                : myTurn
                  ? `あなたのターン（あと${Math.max(0, maxCards - view.currentTurn.usedCards.length)}枚使える）`
                  : '相手のターン…'}
          </Text>
          <View style={styles.cards}>
            {view.currentTurn.usedCards.map((c) => (
              <CardTile key={c.id} card={c} compact />
            ))}
            {view.currentTurn.usedCards.length === 0 && <Text style={styles.small}>このターンに使ったカードはまだありません</Text>}
          </View>
          {view.currentTurn.events.map((e, i) => (
            <Text key={i} style={styles.event}>
              ・{eventLabel(e, me)}
            </Text>
          ))}
        </View>

        {/* 自分 */}
        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.panelTitle}>あなた</Text>
            <Text style={styles.small}>{me === 0 ? '先攻' : '後攻'}</Text>
          </View>
          <Progress value={view.self.progress} goal={view.config.goalProgress} />
          {view.self.ritual && (
            <Text style={styles.small}>
              儀式：<Text style={styles.bold}>{RITUAL_DEFS[view.self.ritual].name}</Text>
              {ritualDescription(view.self.ritual, view.config.ritualRules)}
              {view.self.ritualRevealed && '（相手に公開済み）'}
            </Text>
          )}
          <Badges
            items={[
              view.self.barrier && `結界を設置中（${ELEMENT_NAMES[view.self.barrier.element]}）`,
              view.self.sealed && '封印中：このターンは進行度が上がらない',
              view.self.unveilUsed && '看破使用済み',
            ]}
          />
        </View>

        {/* 手札 */}
        <Text style={styles.sectionTitle}>
          {transmuteId ? '錬成で捨てるカードを選んでください' : `手札（${view.self.hand.length}枚）`}
        </Text>
        <View style={styles.hand}>
          {view.self.hand.map((c) => (
            <CardTile
              key={c.id}
              card={c}
              selected={c.id === selected || c.id === transmuteId}
              onPress={myTurn ? () => onCardPress(c) : undefined}
            />
          ))}
        </View>

        {game.error && <Text style={styles.error}>{game.error}</Text>}

        <View style={styles.actions}>
          {transmuteId ? (
            <Button label="錬成をやめる" onPress={resetHand} />
          ) : (
            selectedCard && <Button label={`${CARD_DEFS[selectedCard.kind].name}を使う`} primary onPress={playSelected} />
          )}
          <Button
            label="ターン終了"
            onPress={() => {
              resetHand();
              act({ type: 'endTurn', player: me });
            }}
            disabled={!myTurn}
          />
          <Button label="看破" onPress={() => setUnveilOpen(true)} disabled={!myTurn || !canUnveil} />
        </View>

        {/* 行動ログ */}
        <Text style={styles.sectionTitle}>行動ログ（新しい順）</Text>
        {[...view.history].reverse().map((t) => (
          <TurnLog key={t.turnNumber} turn={t} view={view} />
        ))}
        {view.history.length === 0 && <Text style={styles.small}>まだありません</Text>}
      </ScrollView>

      {/* 儀式の選択 */}
      <Dialog
        visible={view.phase === 'ritualSelection' && legal.some((a) => a.type === 'selectRitual')}
        title="秘密の儀式を選んでください"
        buttons={[
          {
            label: 'この儀式にする',
            primary: true,
            disabled: candidate === null,
            onPress: () => {
              if (candidate) act({ type: 'selectRitual', player: me, ritual: candidate });
            },
          },
        ]}
      >
        <Text style={styles.small}>あなたは{me === 0 ? '先攻' : '後攻'}です。選んだ儀式は相手に知られません。</Text>
        <RitualList rituals={view.self.ritualCandidates} rules={view.config.ritualRules} selected={candidate} onSelect={setCandidate} />
      </Dialog>

      {/* 遠見の並べ替え */}
      {view.pendingChoice && (
        <FarsightDialog
          key={view.pendingChoice.cards.map((c) => c.id).join()}
          choice={view.pendingChoice}
          onDone={(ids) => act({ type: 'arrangeDeckTop', player: me, orderedCardIds: ids })}
        />
      )}

      {/* 看破 */}
      <Dialog
        visible={unveilOpen && !unveilConfirm}
        title="看破：相手の儀式を宣言"
        buttons={[
          {
            label: 'やめる',
            onPress: () => {
              setUnveilOpen(false);
              setUnveilTarget(null);
            },
          },
          { label: '宣言する', primary: true, disabled: unveilTarget === null, onPress: () => setUnveilConfirm(true) },
        ]}
      >
        <Text style={styles.small}>
          成功すると相手の進行度-{view.config.unveilSuccessPenalty}、失敗すると自分の進行度-{view.config.unveilFailPenalty}。1ゲームに1回だけ使えます。
        </Text>
        <RitualList
          rituals={RITUAL_IDS}
          rules={view.config.ritualRules}
          selected={unveilTarget}
          onSelect={setUnveilTarget}
          marked={view.self.excludedRituals}
          markLabel="透視で除外"
        />
      </Dialog>
      <Dialog
        visible={unveilConfirm}
        title="看破の確認"
        buttons={[
          { label: '戻る', onPress: () => setUnveilConfirm(false) },
          {
            label: '看破する',
            primary: true,
            onPress: () => {
              if (unveilTarget) act({ type: 'unveil', player: me, ritual: unveilTarget });
              setUnveilConfirm(false);
              setUnveilOpen(false);
              setUnveilTarget(null);
            },
          },
        ]}
      >
        <Text>相手の儀式は「{unveilTarget ? RITUAL_DEFS[unveilTarget].name : ''}」だと宣言します。よろしいですか？</Text>
      </Dialog>

      {/* 結果 */}
      {view.result && (
        <Dialog
          visible
          title={resultLabel(view.result, me).title}
          buttons={[
            { label: '記録を書き出す', onPress: () => void exportLog(session.log) },
            { label: 'タイトルへ', onPress: onExit },
            { label: 'もう一度', primary: true, onPress: onRestart },
          ]}
        >
          <Text>終了の理由：{resultLabel(view.result, me).detail}</Text>
          <Text>
            進行度：あなた {view.self.progress} ／ 相手 {view.opponent.progress}（{view.turnNumber}ターン）
          </Text>
          <Text>あなたの儀式：{view.self.ritual && RITUAL_DEFS[view.self.ritual].name}</Text>
          <Text>
            相手の儀式：{cpuRitual && `${RITUAL_DEFS[cpuRitual].name}（${ritualDescription(cpuRitual, view.config.ritualRules)}）`}
          </Text>
        </Dialog>
      )}
    </View>
  );
}

const LEVEL_NAMES: Record<CpuLevel, string> = { easy: 'やさしい', normal: 'ふつう', hard: 'つよい' };

function Progress({ value, goal }: { readonly value: number; readonly goal: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.small}>進行度</Text>
      <View style={styles.pips}>
        {Array.from({ length: goal }, (_, i) => (
          <View key={i} style={[styles.pip, i < value && styles.pipOn]} />
        ))}
      </View>
      <Text style={styles.bold}>
        {value} / {goal}
      </Text>
    </View>
  );
}

function Badges({ items }: { readonly items: readonly (string | false | null)[] }) {
  const shown = items.filter((x): x is string => typeof x === 'string');
  if (shown.length === 0) return null;
  return (
    <View style={styles.badges}>
      {shown.map((b) => (
        <Text key={b} style={styles.badge}>
          {b}
        </Text>
      ))}
    </View>
  );
}

function TurnLog({ turn, view }: { readonly turn: TurnRecordView; readonly view: PlayerView }) {
  return (
    <View style={styles.log}>
      <Text style={styles.bold}>
        {turn.turnNumber}ターン目：{who(turn.player, view.me)}
        {turn.unveiled && '（看破）'}
        {turn.progressed ? '　進行度+1' : ''}
      </Text>
      <View style={styles.cards}>
        {turn.usedCards.map((c) => (
          <CardTile key={c.id} card={c} compact />
        ))}
        {turn.usedCards.length === 0 && !turn.unveiled && <Text style={styles.small}>カードを使わなかった</Text>}
      </View>
      {turn.events.map((e, i) => (
        <Text key={i} style={styles.event}>
          ・{eventLabel(e, view.me)}
        </Text>
      ))}
    </View>
  );
}

function FarsightDialog({ choice, onDone }: { readonly choice: PendingChoice; readonly onDone: (ids: string[]) => void }) {
  const [order, setOrder] = useState<readonly Card[]>(choice.cards);
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const a = next[i];
    const b = next[i + d];
    if (!a || !b) return;
    next[i] = b;
    next[i + d] = a;
    setOrder(next);
  };
  return (
    <Dialog
      visible
      title="遠見：山札の上の並べ替え"
      buttons={[{ label: 'この順で戻す', primary: true, onPress: () => onDone(order.map((c) => c.id)) }]}
    >
      <Text style={styles.small}>上から順に引かれます。次に引くのは相手です。</Text>
      {order.map((c, i) => (
        <View key={c.id} style={styles.farsightRow}>
          <Text style={styles.bold}>{i + 1}枚目</Text>
          <CardTile card={c} compact />
          <Button label="↑" onPress={() => move(i, -1)} disabled={i === 0} />
          <Button label="↓" onPress={() => move(i, 1)} disabled={i === order.length - 1} />
        </View>
      ))}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f5fb' },
  container: { padding: 12, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  panel: { backgroundColor: '#fff', borderRadius: 10, padding: 10, gap: 4 },
  panelTitle: { fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  status: { backgroundColor: '#e9e6f7', borderRadius: 10, padding: 10, gap: 6 },
  statusText: { fontSize: 13, color: '#444' },
  turnText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  myTurnText: { color: '#4a3aa8' },
  sectionTitle: { fontWeight: 'bold', fontSize: 15, marginTop: 4 },
  hand: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: '#b3261e', fontWeight: 'bold' },
  small: { fontSize: 13, color: '#444' },
  bold: { fontWeight: 'bold' },
  event: { fontSize: 12, color: '#555' },
  pips: { flexDirection: 'row', gap: 4, flex: 1 },
  pip: { width: 22, height: 10, borderRadius: 5, backgroundColor: '#ddd' },
  pipOn: { backgroundColor: '#4a3aa8' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { fontSize: 12, backgroundColor: '#f0e6d8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  log: { backgroundColor: '#fff', borderRadius: 8, padding: 8, gap: 4 },
  farsightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
