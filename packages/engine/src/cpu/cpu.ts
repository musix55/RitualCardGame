// =============================================================
// CPU（仕様書 11章）
// 自分に見えてよい情報（PlayerView）と合法手だけを受け取って行動を選ぶ。
// GameState は受け取らないので、相手の儀式や手札を参照できない。
// =============================================================

import { CARD_DEFS, RITUAL_IDS } from '../types';
import type { Action, Card, PlayerView, RitualId, TurnRecord } from '../types';
import { judgeRitual } from '../rituals';
import type { RitualRules } from '../rituals';
import { randomInt } from '../rng';
import type { RngHolder } from '../rng';
import { assumeBarrierElement, inferOpponentRituals, mostLikelyRitual } from './deduction';

export type CpuLevel = 'easy' | 'normal' | 'hard';

export interface CpuParams {
  /** 看破に踏み切る確信度 */
  readonly unveilConfidence: number;
  /** 相手が完成目前のときの、看破に踏み切る確信度 */
  readonly unveilConfidenceUrgent: number;
  /** 考えずにランダムな合法手を選ぶ割合 */
  readonly randomMoveRate: number;
  /** 偽装：他の儀式の条件も同時に満たす使い方を好む */
  readonly disguise: boolean;
}

export const CPU_PARAMS: Record<CpuLevel, CpuParams> = {
  easy:   { unveilConfidence: 0.9,  unveilConfidenceUrgent: 0.7,  randomMoveRate: 0.25, disguise: false },
  normal: { unveilConfidence: 0.7,  unveilConfidenceUrgent: 0.45, randomMoveRate: 0.05, disguise: false },
  hard:   { unveilConfidence: 0.55, unveilConfidenceUrgent: 0.3,  randomMoveRate: 0,    disguise: true },
};

export interface Cpu {
  decide(view: PlayerView, legal: readonly Action[]): Action;
}

/** 儀式の条件を満たしたときの評価点。カードの効果よりも優先する */
const RITUAL_SCORE = 6;
/** 自分の儀式に必要なカードを、儀式を満たさずに使ってしまうときの減点 */
const WASTE_PENALTY = 0.5;
/** 偽装：自分の儀式と同時に満たす他の儀式1つあたりの加点 */
const DISGUISE_BONUS = 0.4;

// -------------------------------------------------------------
// カードの評価
// -------------------------------------------------------------

/** 自分の儀式を満たすのに役立つカードか（使いどころまで手元に残したい） */
function helpsRitual(card: Card, ritual: RitualId, rules: RitualRules): boolean {
  const rule = rules[ritual];
  switch (ritual) {
    case 'infernoSummon': return card.element === 'fire';
    case 'abyssalTide':   return card.element === 'water';
    case 'galeHerald':    return card.element === 'wind';
    case 'stargazing':
      return (
        card.kind === 'farsight' ||
        (rule !== undefined && card.kind === 'clairvoyance') ||
        (rule === 'alt2' && card.kind === 'fountain')
      );
    case 'offering':      return card.kind === 'transmute' || (rule === 'alt1' && card.kind === 'manaLight');
    case 'malediction':
      return CARD_DEFS[card.kind].category === 'disrupt' || (rule === 'alt1' && card.kind === 'barrier');
    default:              return false;
  }
}

/** カードの効果そのものの価値。barrierBroken は、同じ計画の中で先に相手の結界を壊したか */
function effectValue(card: Card, view: PlayerView, probs: Map<RitualId, number>, barrierBroken: boolean): number {
  const opp = view.opponent;
  const blocked = opp.hasBarrier && !barrierBroken;
  switch (card.kind) {
    case 'manaLight':    return 0;
    case 'fountain':     return 1;
    case 'transmute':    return 1;
    case 'farsight':     return 0.3;
    case 'ritualBreak':  return blocked ? 0.8 : opp.progress > 0 ? 2 + opp.progress : 0.2;
    case 'seal':         return blocked ? 0.8 : opp.progress > 0 ? 1 + opp.progress * 0.8 : 0.3;
    case 'manaStorm':    return blocked ? 0.8 : 0.6;
    case 'barrier':      return 1.5 + view.self.progress * 0.3;
    case 'clairvoyance': return !opp.ritualRevealed && !view.self.unveilUsed && probs.size > 2 ? 1.5 : 0.1;
  }
}

// -------------------------------------------------------------
// このターンの使い方の計画
// -------------------------------------------------------------

interface Plan {
  readonly cards: readonly Card[];
  /** 錬成で捨てるカード（計画に錬成がある場合） */
  readonly discard: Card | null;
}

/** 手札から、これから使うカードの並び（0〜remaining枚）をすべて挙げる */
function enumeratePlans(view: PlayerView, remaining: number): Plan[] {
  const hand = view.self.hand;
  const plans: Card[][] = [[]];
  const extend = (seq: Card[], depth: number) => {
    if (depth === 0) return;
    for (const c of hand) {
      if (seq.includes(c)) continue;
      if (c.kind === 'barrier' && (view.self.barrier || seq.some((s) => s.kind === 'barrier'))) continue;
      const next = [...seq, c];
      plans.push(next);
      extend(next, depth - 1);
    }
  };
  extend([], remaining);
  return plans.flatMap((cards): Plan[] => {
    if (!cards.some((c) => c.kind === 'transmute')) return [{ cards, discard: null }];
    // 錬成で捨てられるのは、計画で使わない手札
    const rest = hand.filter((h) => !cards.includes(h));
    return rest.length > 0 ? [{ cards, discard: rest[0]! }] : [];
  });
}

// -------------------------------------------------------------
// CPU 本体
// -------------------------------------------------------------

export function createCpu(level: CpuLevel = 'normal', seed = 0, params: CpuParams = CPU_PARAMS[level]): Cpu {
  const rng: RngHolder = { rngState: seed >>> 0 };
  const pick = <T>(items: readonly T[]): T => items[randomInt(rng, items.length)]!;

  function decide(view: PlayerView, legal: readonly Action[]): Action {
    if (legal.length === 1) return legal[0]!;

    // 儀式の選択：儀式ごとの勝率を測るため、今は候補から無作為に選ぶ
    if (legal[0]!.type === 'selectRitual') return pick(legal);
    if (legal[0]!.type === 'arrangeDeckTop') return arrangeDeckTop(view, legal);
    if (params.randomMoveRate > 0 && randomInt(rng, 1_000_000) < params.randomMoveRate * 1_000_000) return pick(legal);

    const probs = inferOpponentRituals(view);
    return unveilIfConfident(view, legal, probs) ?? playBestPlan(view, legal, probs);
  }

  function unveilIfConfident(view: PlayerView, legal: readonly Action[], probs: Map<RitualId, number>): Action | null {
    const best = mostLikelyRitual(probs);
    if (!best) return null;
    const urgent = view.opponent.progress >= view.config.goalProgress - 1;
    const threshold = urgent ? params.unveilConfidenceUrgent : params.unveilConfidence;
    if (best[1] < threshold) return null;
    return legal.find((a) => a.type === 'unveil' && a.ritual === best[0]) ?? null;
  }

  function playBestPlan(view: PlayerView, legal: readonly Action[], probs: Map<RitualId, number>): Action {
    const ritual = view.self.ritual!;
    const used = view.currentTurn.usedCards as Card[]; // 自分のターンなので伏せ札も見えている
    const maxCards = view.turnNumber === 1 ? view.config.firstTurnMaxCards : view.config.maxCardsPerTurn;
    const last = view.history.at(-1);
    const opponentPrev: TurnRecord | null = last && last.player !== view.me ? assumeBarrierElement(last, 'fire') : null;
    const ownPrevView = [...view.history].reverse().find((t) => t.player === view.me);
    const ownPrev = ownPrevView ? assumeBarrierElement(ownPrevView, 'fire') : null;
    const alt = view.config.ritualRules;
    const canEnd = legal.some((a) => a.type === 'endTurn');

    const scorePlan = (plan: Plan): number => {
      const turn = { ...view.currentTurn, usedCards: [...used, ...plan.cards] } as TurnRecord;
      const meets = judgeRitual(ritual, { turn, opponentPrev, ownPrev }, alt);
      let score = meets && !view.self.sealed ? RITUAL_SCORE : 0;

      let barrierBroken = false;
      for (const c of plan.cards) {
        score += effectValue(c, view, probs, barrierBroken);
        if (CARD_DEFS[c.kind].category === 'disrupt' && view.opponent.hasBarrier) barrierBroken = true;
        if (!meets && helpsRitual(c, ritual, alt)) score -= WASTE_PENALTY;
      }
      if (plan.discard && helpsRitual(plan.discard, ritual, alt)) score -= WASTE_PENALTY;

      if (meets && params.disguise) {
        const others = RITUAL_IDS.filter((r) => r !== ritual && judgeRitual(r, { turn, opponentPrev, ownPrev }, alt)).length;
        score += others * DISGUISE_BONUS;
      }
      // 同点のときの選び方を散らす
      return score + randomInt(rng, 100) / 10_000;
    };

    const plans = enumeratePlans(view, maxCards - used.length).filter((p) => p.cards.length > 0 || canEnd);
    let best: Plan | null = null;
    let bestScore = -Infinity;
    for (const plan of plans) {
      const score = scorePlan(plan);
      if (score > bestScore) [best, bestScore] = [plan, score];
    }

    // 計画の1手目だけを実行し、引いたカードなどを見て次の手で計画を立て直す
    const first = best?.cards[0];
    if (!first) return legal.find((a) => a.type === 'endTurn') ?? pick(legal);
    const action = legal.find(
      (a) =>
        a.type === 'playCard' &&
        a.cardId === first.id &&
        (first.kind !== 'transmute' || a.discardCardId === best!.discard?.id),
    );
    return action ?? pick(legal);
  }

  /**
   * 遠見の並べ替え。ターン終了後は相手が先に補充するので、
   * 相手が引く枚数分は自分にとって価値の低いカードを上に置き、その下に価値の高いカードを置く。
   */
  function arrangeDeckTop(view: PlayerView, legal: readonly Action[]): Action {
    const cards = view.pendingChoice!.cards;
    const ritual = view.self.ritual!;
    const value = (c: Card) => effectValue(c, view, new Map(), false) + (helpsRitual(c, ritual, view.config.ritualRules) ? 2 : 0);
    const oppDraws = Math.max(0, view.config.handSize - view.opponent.handCount);
    const ascending = [...cards].sort((a, b) => value(a) - value(b));
    const forOpponent = ascending.slice(0, oppDraws);
    const forMe = ascending.slice(oppDraws).reverse();
    const order = [...forOpponent, ...forMe].map((c) => c.id);
    return legal.find((a) => a.type === 'arrangeDeckTop' && a.orderedCardIds.join() === order.join()) ?? pick(legal);
  }

  return { decide };
}
