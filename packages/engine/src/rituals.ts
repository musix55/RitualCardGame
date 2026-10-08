// =============================================================
// 儀式の判定（仕様書 8章・10章）
// =============================================================

import { CARD_DEFS, ELEMENTS, RITUAL_DEFS } from './types';
import type { Card, ManaElement, RitualId, TurnRecord } from './types';

export interface RitualContext {
  /** 判定するターン（自分のターン） */
  readonly turn: TurnRecord;
  /** 相手の直前のターン。先攻の最初のターンは null */
  readonly opponentPrev: TurnRecord | null;
  /** 自分の1つ前のターン。最初のターンは null（調整案の四元素の調和で使う） */
  readonly ownPrev?: TurnRecord | null;
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

// -------------------------------------------------------------
// 調整案（バランス検証用）
// GameConfig.ritualRules で儀式ごとに案を指定した場合だけ、こちらの条件で判定する
// -------------------------------------------------------------

export type RitualRuleId = 'alt1' | 'alt2' | 'alt3' | 'alt4';

/** 儀式ごとに使う調整案。指定のない儀式は現行の条件 */
export type RitualRules = Partial<Record<RitualId, RitualRuleId>>;

interface AltRule {
  readonly description: string;
  readonly judge: RitualJudge;
}

export const ALT_RULES: { readonly [R in RitualId]?: Partial<Record<RitualRuleId, AltRule>> } = {
  abyssalTide: {
    alt1: { description: '水のカードを1枚以上使う', judge: ({ turn }) => countElement(turn.usedCards, 'water') >= 1 },
  },
  stargazing: {
    alt1: {
      description: '遠見か透視を使う',
      judge: ({ turn }) => turn.usedCards.some((c) => c.kind === 'farsight' || c.kind === 'clairvoyance'),
    },
    alt2: {
      description: '遠見・透視・知識の泉のいずれかを使う',
      judge: ({ turn }) =>
        turn.usedCards.some((c) => c.kind === 'farsight' || c.kind === 'clairvoyance' || c.kind === 'fountain'),
    },
  },
  offering: {
    alt1: {
      description: '錬成か魔力の灯を使う',
      judge: ({ turn }) => turn.usedCards.some((c) => c.kind === 'transmute' || c.kind === 'manaLight'),
    },
  },
  elementalHarmony: {
    alt1: {
      description: '自分の直近2ターンで、合わせて3属性以上のカードを使う',
      judge: ({ turn, ownPrev }) => {
        const cards = [...(ownPrev?.usedCards ?? []), ...turn.usedCards];
        return new Set(cards.map((c) => c.element)).size >= 3;
      },
    },
  },
  twinStars: {
    alt1: {
      description: '魔力の灯以外で、同じ属性のカードを2枚使う',
      judge: ({ turn }) => maxSameElement(turn.usedCards.filter((c) => c.kind !== 'manaLight')) >= 2,
    },
    alt2: {
      description: '同じ属性のカードを2枚使う（魔力の灯どうしの組み合わせは除く）',
      judge: ({ turn }) =>
        ELEMENTS.some((e) => {
          const same = turn.usedCards.filter((c) => c.element === e);
          return same.length >= 2 && same.some((c) => c.kind !== 'manaLight');
        }),
    },
    alt3: {
      description: '同じ属性で、種類の異なるカードを2枚使う',
      judge: ({ turn }) =>
        ELEMENTS.some((e) => new Set(turn.usedCards.filter((c) => c.element === e).map((c) => c.kind)).size >= 2),
    },
    alt4: {
      description: '同じ属性で、分類の異なるカードを2枚使う',
      judge: ({ turn }) =>
        ELEMENTS.some(
          (e) =>
            new Set(turn.usedCards.filter((c) => c.element === e).map((c) => CARD_DEFS[c.kind].category)).size >= 2,
        ),
    },
  },
  serenePrayer: {
    alt1: {
      description: 'ちょうど1枚だけカードを使い、それが自分の直前のターンに使わなかった属性',
      judge: ({ turn, ownPrev }) => {
        if (turn.usedCards.length !== 1) return false;
        const before = new Set((ownPrev?.usedCards ?? []).map((c) => c.element));
        return !before.has(turn.usedCards[0]!.element);
      },
    },
  },
  malediction: {
    alt1: {
      description: '妨害カードか結界を使う',
      judge: ({ turn }) =>
        turn.usedCards.some((c) => CARD_DEFS[c.kind].category === 'disrupt' || c.kind === 'barrier'),
    },
  },
  mimicry: {
    alt1: {
      description: '相手が直前のターンに使った枚数と同じ枚数（1枚以上）のカードを使う',
      judge: ({ turn, opponentPrev }) =>
        !!opponentPrev && turn.usedCards.length >= 1 && turn.usedCards.length === opponentPrev.usedCards.length,
    },
  },
  shadowStitch: {
    alt1: {
      description: '使ったカードがすべて、相手が直前のターンに使わなかった属性',
      judge: ({ turn, opponentPrev }) => {
        if (!opponentPrev) return false;
        const seen = visibleElements(opponentPrev);
        return turn.usedCards.length >= 1 && turn.usedCards.every((c) => !seen.has(c.element));
      },
    },
    alt2: {
      description: '2枚使い、どちらも相手が直前のターンに使わなかった属性',
      judge: ({ turn, opponentPrev }) => {
        if (!opponentPrev) return false;
        const seen = visibleElements(opponentPrev);
        return turn.usedCards.length >= 2 && turn.usedCards.every((c) => !seen.has(c.element));
      },
    },
  },
};

function altRule(ritual: RitualId, rules: RitualRules): AltRule | null {
  const key = rules[ritual];
  if (!key) return null;
  const rule = ALT_RULES[ritual]?.[key];
  if (!rule) throw new Error(`儀式 ${ritual} に調整案 ${key} はありません`);
  return rule;
}

/** 設定に合わせた儀式の条件の説明 */
export function ritualDescription(ritual: RitualId, rules: RitualRules = {}): string {
  return altRule(ritual, rules)?.description ?? RITUAL_DEFS[ritual].description;
}

/**
 * このターンに儀式の条件を満たしたか。封印による進行度の停止はここでは見ない。
 * rules で調整案を指定した儀式は、その案の条件で判定する。
 */
export function judgeRitual(ritual: RitualId, ctx: RitualContext, rules: RitualRules = {}): boolean {
  return (altRule(ritual, rules)?.judge ?? JUDGES[ritual])(ctx);
}
