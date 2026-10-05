// =============================================================
// ルールエンジン本体（仕様書 5〜7章・10章）
// 状態は変更せず、行動ごとに新しい GameState を返す
// =============================================================

import { CARD_DEFS, RITUAL_IDS } from './types';
import type {
  Action,
  Card,
  GameResult,
  GameState,
  PlayerId,
  PlayerState,
  RitualId,
  TurnEvent,
  TurnRecord,
} from './types';
import { judgeRitual } from './rituals';
import { randomInt } from './rng';
import { newTurnRecord } from './setup';

export type ActionResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: string };

// -------------------------------------------------------------
// 作業用の書き換え可能なコピー
// -------------------------------------------------------------

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface DraftPlayer extends Mutable<Omit<PlayerState, 'hand' | 'excludedRituals'>> {
  hand: Card[];
  excludedRituals: RitualId[];
}

interface DraftTurn extends Mutable<Omit<TurnRecord, 'usedCards' | 'events'>> {
  usedCards: Card[];
  events: TurnEvent[];
}

interface Draft extends Mutable<Omit<GameState, 'players' | 'deck' | 'discard' | 'currentTurn' | 'history'>> {
  players: [DraftPlayer, DraftPlayer];
  deck: Card[];
  discard: Card[];
  currentTurn: DraftTurn;
  /** 終了したターンの記録は書き換えないので、配列だけ複製する */
  history: TurnRecord[];
}

function toDraft(s: GameState): Draft {
  const player = (p: PlayerState): DraftPlayer => ({ ...p, hand: [...p.hand], excludedRituals: [...p.excludedRituals] });
  return {
    ...s,
    players: [player(s.players[0]), player(s.players[1])],
    deck: [...s.deck],
    discard: [...s.discard],
    currentTurn: { ...s.currentTurn, usedCards: [...s.currentTurn.usedCards], events: [...s.currentTurn.events] },
    history: [...s.history],
  };
}

// -------------------------------------------------------------
// 補助
// -------------------------------------------------------------

export function opponentOf(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

/** このターンに使えるカードの最大枚数（先攻の最初のターンだけ少ない） */
export function maxCardsThisTurn(s: GameState): number {
  return s.turnNumber === 1 ? s.config.firstTurnMaxCards : s.config.maxCardsPerTurn;
}

/** そのプレイヤーの直近の終了したターン */
function lastTurnOf(s: GameState, player: PlayerId): TurnRecord | null {
  for (let i = s.history.length - 1; i >= 0; i--) {
    const t = s.history[i]!;
    if (t.player === player) return t;
  }
  return null;
}

/** 枚数制限を除いて、そのカードを使える状態か */
function isCardPlayable(p: PlayerState, card: Card): boolean {
  if (card.kind === 'barrier') return p.barrier === null;
  if (card.kind === 'transmute') return p.hand.length >= 2;
  return true;
}

/**
 * カードを使わないターンの連続制限（5章）に当たり、カードを使わずにターンを終えられない状態か。
 * 看破したターンは「カードを使わなかったターン」に数えない。使えるカードが手札にない場合は例外。
 */
export function mustPlayCard(s: GameState): boolean {
  const t = s.currentTurn;
  if (t.usedCards.length > 0 || t.unveiled) return false;
  const last = lastTurnOf(s, s.currentPlayer);
  if (!last || last.usedCards.length > 0 || last.unveiled) return false;
  const me = s.players[s.currentPlayer];
  return me.hand.some((c) => isCardPlayable(me, c));
}

// -------------------------------------------------------------
// 行動の検証
// -------------------------------------------------------------

/** 行動が今の状態で行えるかを調べる。行える場合は null、行えない場合は理由を返す */
export function validateAction(s: GameState, a: Action): string | null {
  if (s.phase === 'finished') return 'ゲームは終了しています';

  if (a.type === 'selectRitual') {
    if (s.phase !== 'ritualSelection') return '儀式の選択中ではありません';
    const p = s.players[a.player];
    if (p.ritual !== null) return '儀式は選択済みです';
    if (!p.ritualCandidates.includes(a.ritual)) return '候補にない儀式です';
    return null;
  }

  if (s.phase !== 'playing') return '対戦中ではありません';

  if (a.type === 'arrangeDeckTop') {
    const pc = s.pendingChoice;
    if (!pc || pc.player !== a.player) return '並べ替えの選択待ちではありません';
    const ids = pc.cards.map((c) => c.id);
    const ordered = a.orderedCardIds;
    if (ordered.length !== ids.length || new Set(ordered).size !== ids.length || !ordered.every((id) => ids.includes(id))) {
      return '並べ替えるカードが一致しません';
    }
    return null;
  }

  if (a.player !== s.currentPlayer) return '自分のターンではありません';
  if (s.pendingChoice) return '選択待ちの効果があります';
  const me = s.players[a.player];
  const t = s.currentTurn;

  switch (a.type) {
    case 'playCard': {
      if (t.unveiled) return '看破したターンはカードを使えません';
      if (t.usedCards.length >= maxCardsThisTurn(s)) return 'このターンはもうカードを使えません';
      const card = me.hand.find((c) => c.id === a.cardId);
      if (!card) return '手札にないカードです';
      if (card.kind === 'transmute') {
        if (a.discardCardId === undefined) return '錬成で捨てるカードを指定してください';
        if (a.discardCardId === a.cardId || !me.hand.some((c) => c.id === a.discardCardId)) {
          return '錬成で捨てるカードが手札にありません';
        }
      } else if (a.discardCardId !== undefined) {
        return '捨てるカードを指定できるのは錬成だけです';
      }
      if (card.kind === 'barrier' && me.barrier) return '結界はすでに設置されています';
      return null;
    }
    case 'unveil': {
      if (me.unveilUsed) return '看破は使用済みです';
      if (t.usedCards.length > 0) return 'カードを使ったターンは看破できません';
      if (t.unveiled) return 'このターンは看破済みです';
      if (me.progress < s.config.unveilMinProgress) return `看破は進行度${s.config.unveilMinProgress}以上で使えます`;
      if (!RITUAL_IDS.includes(a.ritual)) return '存在しない儀式です';
      return null;
    }
    case 'endTurn': {
      if (mustPlayCard(s)) return '前のターンにカードを使わなかったため、カードを使うか看破をしてください';
      return null;
    }
  }
}

// -------------------------------------------------------------
// 行動の適用
// -------------------------------------------------------------

export function applyAction(state: GameState, action: Action): ActionResult {
  const error = validateAction(state, action);
  if (error !== null) return { ok: false, error };

  const d = toDraft(state);
  switch (action.type) {
    case 'selectRitual':
      selectRitual(d, action.player, action.ritual);
      break;
    case 'playCard':
      playCard(d, action.player, action.cardId, action.discardCardId);
      break;
    case 'arrangeDeckTop':
      arrangeDeckTop(d, action.player, action.orderedCardIds);
      break;
    case 'unveil':
      unveil(d, action.player, action.ritual);
      break;
    case 'endTurn':
      endTurn(d);
      break;
  }
  return { ok: true, state: d };
}

function selectRitual(d: Draft, player: PlayerId, ritual: RitualId): void {
  d.players[player].ritual = ritual;
  if (d.players.every((p) => p.ritual !== null)) {
    d.phase = 'playing';
    refill(d);
  }
}

/** 山札の上から引ける分だけ引く */
function draw(d: Draft, player: PlayerId, count: number): void {
  const cards = d.deck.splice(0, count);
  if (cards.length === 0) return;
  d.players[player].hand.push(...cards);
  d.currentTurn.events.push({ type: 'cardsDrawn', player, count: cards.length });
}

/** ターン開始時の補充：手札が上限になるまで引く */
function refill(d: Draft): void {
  const p = d.currentPlayer;
  draw(d, p, d.config.handSize - d.players[p].hand.length);
}

function takeFromHand(p: DraftPlayer, cardId: string): Card {
  const index = p.hand.findIndex((c) => c.id === cardId);
  return p.hand.splice(index, 1)[0]!;
}

function playCard(d: Draft, player: PlayerId, cardId: string, discardCardId: string | undefined): void {
  const me = d.players[player];
  const card = takeFromHand(me, cardId);
  d.currentTurn.usedCards.push(card);

  if (card.kind === 'barrier') {
    me.barrier = card;
    return;
  }
  d.discard.push(card);

  switch (card.kind) {
    case 'manaLight':
      break;
    case 'fountain':
      draw(d, player, 1);
      break;
    case 'farsight': {
      const cards = d.deck.slice(0, d.config.farsightCount);
      if (cards.length >= 2) {
        d.pendingChoice = { type: 'arrangeDeckTop', player, cards };
      } else {
        // 0〜1枚なら並べ替える余地がないので、選択を待たずに済ませる
        d.currentTurn.events.push({ type: 'deckTopArranged', player, count: cards.length });
      }
      break;
    }
    case 'transmute':
      d.discard.push(takeFromHand(me, discardCardId!));
      draw(d, player, 2);
      break;
    case 'ritualBreak':
    case 'seal':
    case 'manaStorm':
      disrupt(d, player, card);
      break;
    case 'clairvoyance':
      clairvoyance(d, player);
      break;
  }
}

/** 妨害カードの効果。相手に結界があれば無効化して結界を捨て札にする */
function disrupt(d: Draft, player: PlayerId, card: Card): void {
  const target = opponentOf(player);
  const opp = d.players[target];
  const events = d.currentTurn.events;

  if (opp.barrier) {
    d.discard.push(opp.barrier);
    events.push({ type: 'disruptBlocked', target, card: opp.barrier });
    opp.barrier = null;
    return;
  }

  switch (card.kind) {
    case 'ritualBreak': {
      const amount = Math.min(1, opp.progress);
      opp.progress -= amount;
      events.push({ type: 'progressReduced', target, amount });
      break;
    }
    case 'seal':
      opp.sealed = true;
      events.push({ type: 'sealApplied', target });
      break;
    case 'manaStorm': {
      if (opp.hand.length === 0) break;
      const [discarded] = opp.hand.splice(randomInt(d, opp.hand.length), 1);
      d.discard.push(discarded!);
      events.push({ type: 'handDiscarded', target, card: discarded! });
      break;
    }
    default:
      throw new Error(`妨害カードではありません: ${card.kind}`);
  }
}

/** 相手の儀式と除外済みの儀式を除いた中から、ランダムに提示する */
function clairvoyance(d: Draft, player: PlayerId): void {
  const me = d.players[player];
  const oppRitual = d.players[opponentOf(player)].ritual;
  const pool = RITUAL_IDS.filter((r) => r !== oppRitual && !me.excludedRituals.includes(r));
  const rituals: RitualId[] = [];
  while (rituals.length < d.config.clairvoyanceCount && pool.length > 0) {
    rituals.push(pool.splice(randomInt(d, pool.length), 1)[0]!);
  }
  me.excludedRituals.push(...rituals);
  d.currentTurn.events.push({ type: 'clairvoyance', player, rituals });
}

function arrangeDeckTop(d: Draft, player: PlayerId, orderedCardIds: readonly string[]): void {
  const pending = d.pendingChoice!;
  const ordered = orderedCardIds.map((id) => pending.cards.find((c) => c.id === id)!);
  d.deck.splice(0, ordered.length, ...ordered);
  d.pendingChoice = null;
  d.currentTurn.events.push({ type: 'deckTopArranged', player, count: ordered.length });
}

function unveil(d: Draft, player: PlayerId, ritual: RitualId): void {
  const me = d.players[player];
  const opp = d.players[opponentOf(player)];
  const success = opp.ritual === ritual;
  me.unveilUsed = true;
  d.currentTurn.unveiled = true;
  d.currentTurn.events.push({ type: 'unveil', player, ritual, success });

  if (success) {
    const amount = Math.min(d.config.unveilSuccessPenalty, opp.progress);
    opp.progress -= amount;
    opp.ritualRevealed = true;
    d.currentTurn.events.push({ type: 'progressReduced', target: opponentOf(player), amount });
  } else {
    const amount = Math.min(d.config.unveilFailPenalty, me.progress);
    me.progress -= amount;
    d.currentTurn.events.push({ type: 'progressReduced', target: player, amount });
  }
}

/** ターン終了：儀式の判定 → 勝敗の確認 → 相手のターンの開始（補充） */
function endTurn(d: Draft): void {
  const player = d.currentPlayer;
  const me = d.players[player];
  const last = d.history.at(-1);
  const opponentPrev = last && last.player !== player ? last : null;

  const met = me.ritual !== null && judgeRitual(me.ritual, { turn: d.currentTurn, opponentPrev });
  const progressed = met && !me.sealed;
  if (progressed) me.progress += 1;
  // 封印は「次の自分のターン」1回分だけ効く
  me.sealed = false;

  d.history.push({ ...d.currentTurn, progressed });

  const result = judgeGameEnd(d, player);
  if (result) {
    d.result = result;
    d.phase = 'finished';
    return;
  }

  const next = opponentOf(player);
  d.currentPlayer = next;
  d.turnNumber += 1;
  d.currentTurn = { ...newTurnRecord(next, d.turnNumber), usedCards: [], events: [] };
  refill(d);
}

/** 儀式の完成を優先し、次に山札切れ・最大ターン数を確認する（6章） */
function judgeGameEnd(d: Draft, player: PlayerId): GameResult | null {
  if (d.players[player].progress >= d.config.goalProgress) {
    return { type: 'win', winner: player, reason: 'ritualComplete' };
  }
  const reason = d.deck.length === 0 ? 'deckOut' : d.turnNumber >= d.config.maxTurns ? 'turnLimit' : null;
  if (reason === null) return null;
  const [p0, p1] = d.players;
  if (p0.progress === p1.progress) return { type: 'draw', reason };
  return { type: 'win', winner: p0.progress > p1.progress ? 0 : 1, reason };
}

// -------------------------------------------------------------
// 合法手の列挙
// -------------------------------------------------------------

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

/**
 * そのプレイヤーが今行える行動をすべて返す。
 * 画面のボタンの有効・無効、CPU、ランダム対戦のテストで共通に使う。
 */
export function getLegalActions(s: GameState, player: PlayerId): Action[] {
  const candidates: Action[] = [];
  const me = s.players[player];

  if (s.phase === 'ritualSelection') {
    for (const ritual of me.ritualCandidates) candidates.push({ type: 'selectRitual', player, ritual });
  } else if (s.phase === 'playing') {
    if (s.pendingChoice) {
      if (s.pendingChoice.player === player) {
        for (const order of permutations(s.pendingChoice.cards.map((c) => c.id))) {
          candidates.push({ type: 'arrangeDeckTop', player, orderedCardIds: order });
        }
      }
    } else if (player === s.currentPlayer) {
      for (const card of me.hand) {
        if (card.kind === 'transmute') {
          for (const other of me.hand) {
            if (other.id !== card.id) candidates.push({ type: 'playCard', player, cardId: card.id, discardCardId: other.id });
          }
        } else {
          candidates.push({ type: 'playCard', player, cardId: card.id });
        }
      }
      for (const ritual of RITUAL_IDS) candidates.push({ type: 'unveil', player, ritual });
      candidates.push({ type: 'endTurn', player });
    }
  }

  return candidates.filter((a) => validateAction(s, a) === null);
}

/** カードの分類が妨害か（CPU やログ表示用） */
export function isDisruptCard(card: Card): boolean {
  return CARD_DEFS[card.kind].category === 'disrupt';
}
