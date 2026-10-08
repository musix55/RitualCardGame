// 画面に出す文言（ルールエンジンの値を日本語の表示に変える）

import { CARD_DEFS, ELEMENT_NAMES, RITUAL_DEFS } from '@ritual/engine';
import type {
  CardCategory,
  GameResult,
  ManaElement,
  PlayerId,
  TurnEvent,
  TurnRecordView,
  VisibleCard,
} from '@ritual/engine';

export const CATEGORY_NAMES: Record<CardCategory, string> = {
  basic: '基本',
  support: '補助',
  disrupt: '妨害',
  defense: '防御',
  info: '情報',
};

export const ELEMENT_COLORS: Record<ManaElement, string> = {
  fire: '#c8463c',
  water: '#2f6fc4',
  wind: '#2f9461',
  earth: '#9a6a32',
};

/** 相手の伏せた結界（属性が見えない）の色 */
export const HIDDEN_COLOR = '#6b6b78';

export function cardLabel(card: VisibleCard): string {
  const name = CARD_DEFS[card.kind].name;
  return card.element === null ? `${name}（伏せ）` : `${ELEMENT_NAMES[card.element]}・${name}`;
}

export function who(player: PlayerId, me: PlayerId): string {
  return player === me ? 'あなた' : '相手';
}

export function eventLabel(e: TurnEvent, me: PlayerId): string {
  switch (e.type) {
    case 'cardsDrawn':
      return `${who(e.player, me)}がカードを${e.count}枚引いた`;
    case 'disruptBlocked':
      return `${who(e.target, me)}の結界が${CARD_DEFS[e.card.kind].name}を防いだ`;
    case 'progressReduced':
      return `${who(e.target, me)}の進行度が${e.amount}下がった`;
    case 'sealApplied':
      return `${who(e.target, me)}は封印された（次のターンは進行度が上がらない）`;
    case 'handDiscarded':
      return `${who(e.target, me)}の手札の${cardLabel(e.card)}が捨てられた`;
    case 'deckTopArranged':
      return `${who(e.player, me)}が山札の上${e.count}枚を並べ替えた`;
    case 'clairvoyance':
      return e.rituals.length === 0
        ? '透視：新しく分かった儀式はなかった'
        : `透視：相手の儀式は${e.rituals.map((r) => `「${RITUAL_DEFS[r].name}」`).join('')}ではない`;
    case 'unveil':
      return `${who(e.player, me)}が「${RITUAL_DEFS[e.ritual].name}」で看破 → ${e.success ? '成功' : '失敗'}`;
  }
}

/** 推理メモで、儀式を候補から外した理由（相手のそのターンの行動と進行度） */
export function contradictionLabel(turn: TurnRecordView): string {
  const what = turn.unveiled
    ? '看破し'
    : turn.usedCards.length === 0
      ? 'カードを使わず'
      : `${turn.usedCards.map(cardLabel).join('、')}を使い`;
  return turn.progressed
    ? `${turn.turnNumber}ターン目：${what}、進行度が上がった（この儀式なら上がらない）`
    : `${turn.turnNumber}ターン目：${what}、進行度が上がらなかった（この儀式なら上がる）`;
}

const REASON_NAMES = { ritualComplete: '儀式の完成', deckOut: '山札切れ', turnLimit: '最大ターン数' } as const;

export function resultLabel(result: GameResult, me: PlayerId): { title: string; detail: string } {
  if (result.type === 'draw') return { title: '引き分け', detail: `${REASON_NAMES[result.reason]}（進行度が同点）` };
  return { title: result.winner === me ? 'あなたの勝ち' : 'あなたの負け', detail: REASON_NAMES[result.reason] };
}
