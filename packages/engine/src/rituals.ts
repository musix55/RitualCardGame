// =============================================================
// 儀式の判定（仕様書 8章・10章）
// =============================================================

import { CARD_DEFS } from './types';
import type { Card, ManaElement, RitualId, TurnRecord } from './types';

export interface RitualContext {
  /** 判定するターン（自分のターン） */
  readonly turn: TurnRecord;
  /** 相手の直前のターン。先攻の最初のターンは null */
  readonly opponentPrev: TurnRecord | null;
}

/**
 * 相手のターンで、自分から見えた属性の一覧。
 * 伏せた結界は属性が見えないため含めない（10章：相手依存系の儀式）。
 */
export function visibleElements(turn: TurnRecord): Set<ManaElement> {
  return new Set(turn.usedCards.filter((c) => c.kind !== 'barrier').map((c) => c.element));
}

function countElement(cards: readonly Card[], element: ManaElement): number {
  return cards.filter((c) => c.element === element).length;
}

function maxSameElement(cards: readonly Card[]): number {
  const counts = new Map<ManaElement, number>();
  for (const c of cards) counts.set(c.element, (counts.get(c.element) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}

type RitualJudge = (ctx: RitualContext) => boolean;

const JUDGES: Record<RitualId, RitualJudge> = {
  // 属性系（自分の伏せた結界も属性を持つカードとして数える）
  infernoSummon: ({ turn }) => countElement(turn.usedCards, 'fire') >= 1,
  abyssalTide: ({ turn }) => countElement(turn.usedCards, 'water') >= 2,
  elementalHarmony: ({ turn }) => new Set(turn.usedCards.map((c) => c.element)).size >= 2,
  twinStars: ({ turn }) => maxSameElement(turn.usedCards) >= 2,
  galeHerald: ({ turn }) => turn.usedCards[0]?.element === 'wind',

  // 行動系（看破のターンはカードを使わないため瞑想を満たす）
  meditation: ({ turn }) => turn.usedCards.length === 0,
  serenePrayer: ({ turn }) => turn.usedCards.length === 1,
  stargazing: ({ turn }) => turn.usedCards.some((c) => c.kind === 'farsight'),
  // 魔力乱流は相手の手札を捨てさせるだけなので、どちらの供物の儀も満たさない
  offering: ({ turn }) => turn.usedCards.some((c) => c.kind === 'transmute'),
  malediction: ({ turn }) => turn.usedCards.some((c) => CARD_DEFS[c.kind].category === 'disrupt'),

  // 相手依存系（相手が看破したターンは usedCards が空なので、0枚・属性なしとして扱われる）
  mirrorImage: ({ turn, opponentPrev }) => {
    if (!opponentPrev) return false;
    const seen = visibleElements(opponentPrev);
    return turn.usedCards.some((c) => seen.has(c.element));
  },
  shadowStitch: ({ turn, opponentPrev }) => {
    if (!opponentPrev) return false;
    const seen = visibleElements(opponentPrev);
    return turn.usedCards.some((c) => !seen.has(c.element));
  },
  // 伏せた結界も「1枚使った」ことは見えるので枚数には数える
  mimicry: ({ turn, opponentPrev }) => {
    if (!opponentPrev) return false;
    return turn.usedCards.length === opponentPrev.usedCards.length;
  },
};

/** このターンに儀式の条件を満たしたか。封印による進行度の停止はここでは見ない */
export function judgeRitual(ritual: RitualId, ctx: RitualContext): boolean {
  return JUDGES[ritual](ctx);
}
