// =============================================================
// 相手の儀式の推理（仕様書 11章：CPU）
// 相手の行動と進行度の記録から、条件と矛盾する儀式を候補から消していく
// =============================================================

import { ELEMENTS, RITUAL_DEFS, RITUAL_IDS } from '../types';
import type { Card, PlayerId, PlayerView, RitualCategory, RitualId, TurnRecord, TurnRecordView } from '../types';
import { judgeRitual } from '../rituals';
import type { RitualRules } from '../rituals';
import { opponentOf } from '../engine';

/**
 * 儀式ごとの事前の選ばれやすさ。候補は分類ごとに1つずつ抽選されるため、
 * 種類の少ない相手依存系（3種）は1つあたりの確率が高い。
 */
const PRIOR: Record<RitualCategory, number> = { element: 1 / 5, action: 1 / 5, opponent: 1 / 3 };

/**
 * 伏せた結界の属性を仮に決めて、判定に使える TurnRecord にする。
 * 自分のターンの記録はすべて見えているので、そのまま通る。
 */
export function assumeBarrierElement(turn: TurnRecordView, element: Card['element']): TurnRecord {
  return { ...turn, usedCards: turn.usedCards.map((c) => (c.element === null ? { ...c, element } : c)) };
}

function hasHiddenBarrier(turn: TurnRecordView): boolean {
  return turn.usedCards.some((c) => c.element === null);
}

/** 相手がこの儀式だったとして、終了した全ターンの「進行度が上がった・上がらなかった」と矛盾しないか */
function isConsistent(
  ritual: RitualId,
  history: readonly TurnRecordView[],
  opp: PlayerId,
  rules: RitualRules,
): boolean {
  return findContradiction(ritual, history, opp, rules) === null;
}

/**
 * 相手がこの儀式だったとすると、進行度の上がり方と矛盾する最初のターン。矛盾がなければ null。
 * 推理メモ（画面の手助け）で、候補から外した理由を示すのにも使う。
 */
export function findContradiction(
  ritual: RitualId,
  history: readonly TurnRecordView[],
  opp: PlayerId,
  rules: RitualRules,
): TurnRecordView | null {
  let oppPrevTurn: TurnRecordView | null = null;
  for (let i = 0; i < history.length; i++) {
    const turn = history[i]!;
    if (turn.player !== opp) continue;
    const ownPrevView = oppPrevTurn;
    oppPrevTurn = turn;
    const prev = i > 0 ? history[i - 1]! : null;
    // 直前の自分のターンで封印が効いていたら、そのターンは条件を満たしても上がらないので手がかりにならない
    if (prev?.events.some((e) => e.type === 'sealApplied' && e.target === opp)) continue;

    // 相手から見た「相手（＝自分）の直前のターン」。自分のカードはすべて見えている
    const opponentPrev = prev && prev.player !== opp ? assumeBarrierElement(prev, 'fire') : null;
    // 相手が伏せた結界の属性は分からないので、どれか1つでも矛盾しなければ候補に残す。
    // 相手の1つ前のターン（調整案の四元素の調和で使う）の結界も同様に試す。
    // ターンごとに別々に試すので、本当の儀式を消すことはないが、消しきれない候補が残ることはある
    const elements = hasHiddenBarrier(turn) ? ELEMENTS : (['fire'] as const);
    const prevElements = ownPrevView && hasHiddenBarrier(ownPrevView) ? ELEMENTS : (['fire'] as const);
    const matches = elements.some((e) =>
      prevElements.some((pe) => {
        const ownPrev = ownPrevView ? assumeBarrierElement(ownPrevView, pe) : null;
        const met = judgeRitual(ritual, { turn: assumeBarrierElement(turn, e), opponentPrev, ownPrev }, rules);
        return met === turn.progressed;
      }),
    );
    if (!matches) return turn;
  }
  return null;
}

/**
 * 相手の儀式ごとの確率。透視で除外した儀式と、記録と矛盾する儀式は 0 になり、結果に含まれない。
 * 看破で公開済みなら、その儀式だけを返す。
 */
export function inferOpponentRituals(view: PlayerView): Map<RitualId, number> {
  if (view.opponent.ritual) return new Map([[view.opponent.ritual, 1]]);

  const opp = opponentOf(view.me);
  const weights = new Map<RitualId, number>();
  for (const r of RITUAL_IDS) {
    if (view.self.excludedRituals.includes(r)) continue;
    if (!isConsistent(r, view.history, opp, view.config.ritualRules)) continue;
    weights.set(r, PRIOR[RITUAL_DEFS[r].category]);
  }

  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  for (const [r, w] of weights) weights.set(r, w / total);
  return weights;
}

/** 確率が最も高い儀式と、その確率 */
export function mostLikelyRitual(probs: Map<RitualId, number>): [RitualId, number] | null {
  let best: [RitualId, number] | null = null;
  for (const entry of probs) if (!best || entry[1] > best[1]) best = entry;
  return best;
}
