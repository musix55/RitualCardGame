import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CARD_DEFS, ELEMENT_NAMES, RITUAL_DEFS } from '@ritual/engine';
import type { Card, PlayerView, VisibleCard } from '@ritual/engine';
import { CardTile } from './CardTile';
import { eventLabel } from '../labels';

interface Props {
  view: PlayerView;
  myTurn: boolean;
  selected: string | null;
  transmuteId: string | null;
  ritualMet: boolean | null;
  candidates: number;
  actions: ReactNode;
  error: string | null;
  onCardPress: (card: Card) => void;
  onDetail: (card: VisibleCard) => void;
  onMemo: () => void;
  onLog: () => void;
  onMenu: () => void;
}

export function BattleBoard(p: Props) {
  const { view } = p;
  const selectedCard = view.self.hand.find(c => c.id === p.selected);
  const remaining = Math.max(0, (view.turnNumber === 1 ? view.config.firstTurnMaxCards : view.config.maxCardsPerTurn) - view.currentTurn.usedCards.length);
  return (
    <View style={s.root}>
      <View style={s.topbar}>
        <Text style={s.brand}>魔法使いの儀式</Text>
        <Text style={s.turn}>TURN {view.turnNumber} / {view.config.maxTurns}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="対戦メニュー" onPress={p.onMenu} style={s.menu}><Text style={s.menuText}>≡</Text></Pressable>
      </View>
      <ScrollView style={s.boardScroll} contentContainerStyle={s.board}>
        <View style={s.opponent}>
          <Text style={s.playerName}>相手 · CPU　{view.me === 0 ? '後攻' : '先攻'}</Text>
          <Mage progress={view.opponent.progress} goal={view.config.goalProgress} opponent />
          <Text style={s.sub}>{view.opponent.ritual ? RITUAL_DEFS[view.opponent.ritual].name : '秘密の儀式'} · 手札 {view.opponent.handCount}枚</Text>
          <Text style={s.badges}>{[view.opponent.hasBarrier && '結界', view.opponent.sealed && '封印', view.opponent.unveilUsed && '看破済'].filter(Boolean).join(' · ') || ' '}</Text>
        </View>
        <View style={s.arena}>
          <View style={s.sideTools}>
            <Pressable accessibilityRole="button" onPress={p.onLog} style={s.tool}><Text style={s.toolSymbol}>☷</Text><Text style={s.toolLabel}>ログ</Text></Pressable>
            <View style={s.deck}><Text style={s.deckSymbol}>◇</Text><Text style={s.deckNumber}>{view.deckCount}</Text></View>
            <Text style={s.deckLabel}>山札</Text>
          </View>
          <View style={s.stage}>
            <Text style={[s.phase, p.myTurn && s.activePhase]}>{view.phase === 'ritualSelection' ? '儀式を選択中' : view.phase === 'finished' ? '対戦終了' : p.myTurn ? 'あなたのターン' : '相手のターン'}</Text>
            <Text style={s.remaining}>あと {remaining} 枚使用できる</Text>
            <View style={s.played}>
              {Array.from({length: Math.max(2, view.currentTurn.usedCards.length)}, (_, i) => {
                const card = view.currentTurn.usedCards[i];
                return card ? <CardTile key={card.id} card={card} compact onPress={() => p.onDetail(card)} /> : <View key={i} style={s.slot}><Text style={s.slotSymbol}>◇</Text></View>;
              })}
            </View>
            <Text style={s.effect} numberOfLines={2}>{view.currentTurn.events.length ? eventLabel(view.currentTurn.events[view.currentTurn.events.length - 1]!, view.me) : ' '}</Text>
          </View>
          <View style={s.sideTools}>
            <Pressable accessibilityRole="button" onPress={p.onMemo} style={s.tool}>
              <Text style={s.toolSymbol}>◈</Text><Text style={s.toolLabel}>推理メモ</Text><Text style={s.candidate}>{p.candidates} / 13</Text>
            </Pressable>
          </View>
        </View>
        <View style={s.self}>
          <Mage progress={view.self.progress} goal={view.config.goalProgress} />
          <Text style={s.playerName}>あなた　{view.me === 0 ? '先攻' : '後攻'}</Text>
          <Text style={s.ritual}>{view.self.ritual ? RITUAL_DEFS[view.self.ritual].name : '儀式を選択中'}{view.self.ritualRevealed ? ' · 公開済' : ''}</Text>
          <Text style={[s.condition, p.ritualMet && s.conditionMet]}>{p.ritualMet === null ? ' ' : p.ritualMet ? '◆ このターン：条件達成' : '◇ このターン：未達成'}</Text>
          <Text style={s.badges}>{[view.self.barrier && `結界 · ${ELEMENT_NAMES[view.self.barrier.element]}`, view.self.sealed && '封印中：進行しない', view.self.unveilUsed && '看破済'].filter(Boolean).join(' / ') || ' '}</Text>
        </View>
      </ScrollView>
      <View style={s.handDock}>
        <View style={s.handHeader}><Text style={s.handTitle}>{p.transmuteId ? '錬成：捨てるカードを選択' : `手札 ${view.self.hand.length}枚`}</Text><Text style={s.handNote}>{selectedCard ? CARD_DEFS[selectedCard.kind].description : p.error ?? ' '}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.hand} style={s.handScroll}>
          {view.self.hand.map(card => <CardTile key={card.id} card={card} selected={card.id === p.selected || card.id === p.transmuteId} onPress={() => p.myTurn ? p.onCardPress(card) : p.onDetail(card)} />)}
        </ScrollView>
        {p.error && selectedCard && <Text style={s.error}>{p.error}</Text>}
        <View style={s.actions}>{p.actions}</View>
      </View>
    </View>
  );
}

function Mage({progress, goal, opponent = false}: {progress: number; goal: number; opponent?: boolean}) {
  return (
    <View style={s.mageArea}>
      <View style={s.seals} accessibilityLabel={`進行度 ${progress} / ${goal}`}>
        {Array.from({length: goal}, (_, i) => <View key={i} style={[s.seal, i < progress && s.sealLit, {transform: [{translateY: i === 0 || i === goal - 1 ? 24 : 0}]}]}><Text style={[s.sealText, i < progress && s.sealTextLit]}>{i < progress ? '◆' : '◇'}</Text></View>)}
      </View>
      <View style={s.mage} accessibilityLabel={opponent ? '相手の魔法使い' : 'あなたの魔法使い'}>
        <View style={[s.shoulders, opponent && s.redRobe]} />
        <View style={[s.hood, opponent && s.redRobe]}><View style={s.face}><View style={s.eyes}><View style={s.eye}/><View style={s.eye}/></View></View></View>
        <View style={s.clasp}><Text style={s.claspText}>◆</Text></View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex:1, width:'100%', maxWidth:560, alignSelf:'center', backgroundColor:'#172e2a'},
  topbar: {height:46, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, borderBottomWidth:1, borderColor:'#355049'},
  brand: {fontSize:14, fontWeight:'bold', color:'#edece0'}, turn:{fontSize:11, color:'#b8c8bc'},
  menu:{width:44,height:44,alignItems:'center',justifyContent:'center'},menuText:{color:'#edece0',fontSize:28},
  boardScroll:{flex:1}, board:{flexGrow:1,justifyContent:'space-between',paddingVertical:8,minHeight:420},
  opponent:{alignItems:'center'},self:{alignItems:'center'},playerName:{color:'#e1e9df',fontSize:12,fontWeight:'bold'},
  sub:{color:'#b8c8bc',fontSize:11},badges:{color:'#e4b49b',fontSize:10,minHeight:15},
  arena:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:10,marginVertical:6},
  sideTools:{width:62,alignItems:'center',gap:4},tool:{minHeight:58,width:62,alignItems:'center',justifyContent:'center',gap:2},
  toolSymbol:{fontSize:23,color:'#d9c37c'},toolLabel:{fontSize:10,color:'#e5e9db'},candidate:{fontSize:10,color:'#afc7be'},
  stage:{flex:1,alignItems:'center',gap:4},phase:{fontSize:14,fontWeight:'bold',color:'#e4b49b'},activePhase:{color:'#a9e1ca'},remaining:{fontSize:10,color:'#9db7ae'},
  effect: {fontSize:10,color:'#d5d5b7',minHeight:26,textAlign:'center'},
  played:{flexDirection:'row',gap:8,marginTop:8, minHeight:96,justifyContent:'center'},slot:{width:72,height:96,borderWidth:1,borderColor:'#47635a',borderRadius:6,alignItems:'center',justifyContent:'center'},slotSymbol:{color:'#47635a',fontSize:30},
  deck:{width:35,height:46,borderWidth:2,borderColor:'#af9860',borderRadius:4,backgroundColor:'#243f37',alignItems:'center',justifyContent:'center',marginTop:4},deckSymbol:{color:'#d9c37c',fontSize:18},deckNumber:{color:'#eee7d2',fontSize:10},deckLabel:{color:'#a5b9ae',fontSize:9},
  mageArea:{height:108,width:230,alignItems:'center',justifyContent:'flex-end'},seals:{position:'absolute',top:0,left:0,right:0,flexDirection:'row',justifyContent:'space-between'},
  seal:{width:32,height:32,borderWidth:1,borderColor:'#698277',borderRadius:16,backgroundColor:'#203a33',alignItems:'center',justifyContent:'center'},sealLit:{backgroundColor:'#d8c16a',borderColor:'#ffeba3',boxShadow:'0 0 12px #d8c16a80'},sealText:{color:'#7e9789',fontSize:20},sealTextLit:{color:'#394434'},
  mage:{width:102,height:86,alignItems:'center'},shoulders:{position:'absolute',bottom:0,width:100,height:42,borderTopLeftRadius:34,borderTopRightRadius:34,backgroundColor:'#39796e',borderWidth:2,borderColor:'#82a797'},hood:{width:56,height:61,borderRadius:28,backgroundColor:'#39796e',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#82a797'},redRobe:{backgroundColor:'#833f50',borderColor:'#b9787f'},face:{width:32,height:38,borderRadius:16,backgroundColor:'#233029',justifyContent:'center'},eyes:{flexDirection:'row',justifyContent:'space-evenly'},eye:{width:5,height:3,backgroundColor:'#e8d594'},clasp:{position:'absolute',bottom:11},claspText:{fontSize:14,color:'#e6ce84'},
  ritual:{fontSize:13,fontWeight:'bold',color:'#eee8cf',marginTop:3},condition:{fontSize:11,color:'#a0b3a8',marginTop:3},conditionMet:{color:'#d8cf88'},
  handDock:{backgroundColor:'#111f1d',borderTopWidth:1,borderColor:'#49645a',paddingBottom:8},handHeader:{paddingHorizontal:12,paddingTop:8,gap:3,minHeight:45},handTitle:{color:'#e8e5d5',fontSize:12,fontWeight:'bold'},handNote:{fontSize:11,color:'#aec2b5',minHeight:15},handScroll:{flexGrow:0},hand:{paddingTop:12,paddingBottom:4,paddingHorizontal:12,gap:8},actions:{flexDirection:'row',gap:6,flexWrap:'wrap',paddingHorizontal:12,paddingTop:6},error:{color:'#ffb0a0',fontSize:11,paddingHorizontal:12},
});
