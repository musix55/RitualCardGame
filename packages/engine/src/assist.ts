// =============================================================
// 人間のプレイヤー向けの手助け（推理メモ・自分の儀式の達成状況）
// どちらも PlayerView だけから計算し、相手の隠れた情報は使わない
// =============================================================

import { findContradiction, assumeBarrierElement } from './cpu/deduction';
import { opponentOf } from './engine';
import { judgeRitual } from './rituals';
import { RITUAL_IDS } from './types';
import type { PlayerView, RitualId, TurnRecord, TurnRecordView } from './types';

/** 推理メモでの儀式の状態 */
export type RitualStatus =
  /** まだ候補に残っている */
  | { readonly type: 'possible' }
  /** 看破で公開された相手の儀式 */
  | { readonly type: 'revealed' }
  /** 相手の儀式が公開済みで、それ以外の儀式 */
  | { readonly type: 'otherRevealed' }
  /** 透視で「相手の儀式ではない」と分かった */
  | { readonly type: 'clairvoyance' }
  /** 相手の進行度の上がり方と矛盾する。turn はその最初のターン */
  | { readonly type: 'contradiction'; readonly turn: TurnRecordView };

/**
 * 相手の儀式の候補を、儀式ごとの状態として返す（推理メモ）。
 * 判定は CPU の推理と同じで、本当の儀式を候補から外すことはない。
 */
export function opponentRitualStatuses(view: PlayerView): Map<RitualId, RitualStatus> {
  const result = new Map<RitualId, RitualStatus>();
  const opp = opponentOf(view.me);
  for (const r of RITUAL_IDS) {
    if (view.opponent.ritual) {
      result.set(r, { type: r === view.opponent.ritual ? 'revealed' : 'otherRevealed' });
      continue;
    }
    if (view.self.excludedRituals.includes(r)) {
      result.set(r, { type: 'clairvoyance' });
      continue;
    }
    const turn = findContradiction(r, view.history, opp, view.config.ritualRules);
    result.set(r, turn ? { type: 'contradiction', turn } : { type: 'possible' });
  }
  return result;
}

/**
 * 今の時点で、自分の儀式の条件を満たしているか（このままターンを終えたら満たすか）。
 * 儀式の選択前は null。封印で進行度が上がらない場合も、条件の判定だけを返す。
 */
export function ownRitualMetNow(view: PlayerView): boolean | null {
  const ritual = view.self.ritual;
  if (!ritual || view.phase !== 'playing' || view.currentPlayer !== view.me) return null;

  const last = view.history.at(-1);
  // 相手の直前のターン。相手の伏せた結界は、相手依存系の判定では属性を見ない（rituals.ts の visibleElements）ため、仮の属性で構わない
  const opponentPrev =
    last && last.player === opponentOf(view.me) ? assumeBarrierElement(last, 'fire') : null;
  // 自分のターンの記録はすべて見えているので、assumeBarrierElement は型を合わせるだけで中身は変わらない
  let ownPrev: TurnRecord | null = null;
  for (const t of view.history) if (t.player === view.me) ownPrev = assumeBarrierElement(t, 'fire');

  const turn = assumeBarrierElement(view.currentTurn, 'fire');
  return judgeRitual(ritual, { turn, opponentPrev, ownPrev }, view.config.ritualRules);
}
